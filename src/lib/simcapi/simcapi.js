(function () {
  //   var root = this;
  var root = window;

  var previousSimcapi = root.simcapi;
  /**
   * @license almond 0.3.3 Copyright jQuery Foundation and other contributors.
   * Released under MIT license, http://github.com/requirejs/almond/LICENSE
   */
  //Going sloppy to avoid 'use strict' string cost, but strict practices should
  //be followed.
  /*global setTimeout: false */

  var requirejs, require, define;
  (function (undef) {
    var main,
      req,
      makeMap,
      handlers,
      defined = {},
      waiting = {},
      config = {},
      defining = {},
      hasOwn = Object.prototype.hasOwnProperty,
      aps = [].slice,
      jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
      return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
      var nameParts,
        nameSegment,
        mapValue,
        foundMap,
        lastIndex,
        foundI,
        foundStarMap,
        starI,
        i,
        j,
        part,
        normalizedBaseParts,
        baseParts = baseName && baseName.split("/"),
        map = config.map,
        starMap = (map && map["*"]) || {};

      //Adjust any relative paths.
      if (name) {
        name = name.split("/");
        lastIndex = name.length - 1;

        // If wanting node ID compatibility, strip .js from end
        // of IDs. Have to do this here, and not in nameToUrl
        // because node allows either .js or non .js to map
        // to same file.
        if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
          name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, "");
        }

        // Starts with a '.' so need the baseName
        if (name[0].charAt(0) === "." && baseParts) {
          //Convert baseName to array, and lop off the last part,
          //so that . matches that 'directory' and not name of the baseName's
          //module. For instance, baseName of 'one/two/three', maps to
          //'one/two/three.js', but we want the directory, 'one/two' for
          //this normalization.
          normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
          name = normalizedBaseParts.concat(name);
        }

        //start trimDots
        for (i = 0; i < name.length; i++) {
          part = name[i];
          if (part === ".") {
            name.splice(i, 1);
            i -= 1;
          } else if (part === "..") {
            // If at the start, or previous value is still ..,
            // keep them so that when converted to a path it may
            // still work when converted to a path, even though
            // as an ID it is less than ideal. In larger point
            // releases, may be better to just kick out an error.
            if (
              i === 0 ||
              (i === 1 && name[2] === "..") ||
              name[i - 1] === ".."
            ) {
              continue;
            } else if (i > 0) {
              name.splice(i - 1, 2);
              i -= 2;
            }
          }
        }
        //end trimDots

        name = name.join("/");
      }

      //Apply map config if available.
      if ((baseParts || starMap) && map) {
        nameParts = name.split("/");

        for (i = nameParts.length; i > 0; i -= 1) {
          nameSegment = nameParts.slice(0, i).join("/");

          if (baseParts) {
            //Find the longest baseName segment match in the config.
            //So, do joins on the biggest to smallest lengths of baseParts.
            for (j = baseParts.length; j > 0; j -= 1) {
              mapValue = map[baseParts.slice(0, j).join("/")];

              //baseName segment has  config, find if it has one for
              //this name.
              if (mapValue) {
                mapValue = mapValue[nameSegment];
                if (mapValue) {
                  //Match, update name to the new value.
                  foundMap = mapValue;
                  foundI = i;
                  break;
                }
              }
            }
          }

          if (foundMap) {
            break;
          }

          //Check for a star map match, but just hold on to it,
          //if there is a shorter segment match later in a matching
          //config, then favor over this star map.
          if (!foundStarMap && starMap && starMap[nameSegment]) {
            foundStarMap = starMap[nameSegment];
            starI = i;
          }
        }

        if (!foundMap && foundStarMap) {
          foundMap = foundStarMap;
          foundI = starI;
        }

        if (foundMap) {
          nameParts.splice(0, foundI, foundMap);
          name = nameParts.join("/");
        }
      }

      return name;
    }

    function makeRequire(relName, forceSync) {
      return function () {
        //A version of a require function that passes a moduleName
        //value for items that may need to
        //look up paths relative to the moduleName
        var args = aps.call(arguments, 0);

        //If first arg is not require('string'), and there is only
        //one arg, it is the array form without a callback. Insert
        //a null so that the following concat is correct.
        if (typeof args[0] !== "string" && args.length === 1) {
          args.push(null);
        }
        return req.apply(undef, args.concat([relName, forceSync]));
      };
    }

    function makeNormalize(relName) {
      return function (name) {
        return normalize(name, relName);
      };
    }

    function makeLoad(depName) {
      return function (value) {
        defined[depName] = value;
      };
    }

    function callDep(name) {
      if (hasProp(waiting, name)) {
        var args = waiting[name];
        delete waiting[name];
        defining[name] = true;
        main.apply(undef, args);
      }

      if (!hasProp(defined, name) && !hasProp(defining, name)) {
        throw new Error("No " + name);
      }
      return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
      var prefix,
        index = name ? name.indexOf("!") : -1;
      if (index > -1) {
        prefix = name.substring(0, index);
        name = name.substring(index + 1, name.length);
      }
      return [prefix, name];
    }

    //Creates a parts array for a relName where first part is plugin ID,
    //second part is resource ID. Assumes relName has already been normalized.
    function makeRelParts(relName) {
      return relName ? splitPrefix(relName) : [];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relParts) {
      var plugin,
        parts = splitPrefix(name),
        prefix = parts[0],
        relResourceName = relParts[1];

      name = parts[1];

      if (prefix) {
        prefix = normalize(prefix, relResourceName);
        plugin = callDep(prefix);
      }

      //Normalize according
      if (prefix) {
        if (plugin && plugin.normalize) {
          name = plugin.normalize(name, makeNormalize(relResourceName));
        } else {
          name = normalize(name, relResourceName);
        }
      } else {
        name = normalize(name, relResourceName);
        parts = splitPrefix(name);
        prefix = parts[0];
        name = parts[1];
        if (prefix) {
          plugin = callDep(prefix);
        }
      }

      //Using ridiculous property names for space reasons
      return {
        f: prefix ? prefix + "!" + name : name, //fullName
        n: name,
        pr: prefix,
        p: plugin,
      };
    };

    function makeConfig(name) {
      return function () {
        return (config && config.config && config.config[name]) || {};
      };
    }

    handlers = {
      require: function (name) {
        return makeRequire(name);
      },
      exports: function (name) {
        var e = defined[name];
        if (typeof e !== "undefined") {
          return e;
        } else {
          return (defined[name] = {});
        }
      },
      module: function (name) {
        return {
          id: name,
          uri: "",
          exports: defined[name],
          config: makeConfig(name),
        };
      },
    };

    main = function (name, deps, callback, relName) {
      var cjsModule,
        depName,
        ret,
        map,
        i,
        relParts,
        args = [],
        callbackType = typeof callback,
        usingExports;

      //Use name if no relName
      relName = relName || name;
      relParts = makeRelParts(relName);

      //Call the callback to define the module, if necessary.
      if (callbackType === "undefined" || callbackType === "function") {
        //Pull out the defined dependencies and pass the ordered
        //values to the callback.
        //Default to [require, exports, module] if no deps
        deps =
          !deps.length && callback.length
            ? ["require", "exports", "module"]
            : deps;
        for (i = 0; i < deps.length; i += 1) {
          map = makeMap(deps[i], relParts);
          depName = map.f;

          //Fast path CommonJS standard dependencies.
          if (depName === "require") {
            args[i] = handlers.require(name);
          } else if (depName === "exports") {
            //CommonJS module spec 1.1
            args[i] = handlers.exports(name);
            usingExports = true;
          } else if (depName === "module") {
            //CommonJS module spec 1.1
            cjsModule = args[i] = handlers.module(name);
          } else if (
            hasProp(defined, depName) ||
            hasProp(waiting, depName) ||
            hasProp(defining, depName)
          ) {
            args[i] = callDep(depName);
          } else if (map.p) {
            map.p.load(
              map.n,
              makeRequire(relName, true),
              makeLoad(depName),
              {},
            );
            args[i] = defined[depName];
          } else {
            throw new Error(name + " missing " + depName);
          }
        }

        ret = callback ? callback.apply(defined[name], args) : undefined;

        if (name) {
          //If setting exports via "module" is in play,
          //favor that over return value and exports. After that,
          //favor a non-undefined return value over exports use.
          if (
            cjsModule &&
            cjsModule.exports !== undef &&
            cjsModule.exports !== defined[name]
          ) {
            defined[name] = cjsModule.exports;
          } else if (ret !== undef || !usingExports) {
            //Use the return value from the function.
            defined[name] = ret;
          }
        }
      } else if (name) {
        //May just be an object definition for the module. Only
        //worry about defining if have a module name.
        defined[name] = callback;
      }
    };

    requirejs =
      require =
      req =
        function (deps, callback, relName, forceSync, alt) {
          if (typeof deps === "string") {
            if (handlers[deps]) {
              //callback in this case is really relName
              return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, makeRelParts(callback)).f);
          } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
              req(config.deps, config.callback);
            }
            if (!callback) {
              return;
            }

            if (callback.splice) {
              //callback is an array, which means it is a dependency list.
              //Adjust args if there are dependencies
              deps = callback;
              callback = relName;
              relName = null;
            } else {
              deps = undef;
            }
          }

          //Support require(['a'])
          callback = callback || function () {};

          //If relName is a function, it is an errback handler,
          //so remove it.
          if (typeof relName === "function") {
            relName = forceSync;
            forceSync = alt;
          }

          //Simulate async callback;
          if (forceSync) {
            main(undef, deps, callback, relName);
          } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
              main(undef, deps, callback, relName);
            }, 4);
          }

          return req;
        };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
      return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
      if (typeof name !== "string") {
        throw new Error(
          "See almond README: incorrect module build, no module name",
        );
      }

      //This module may not have dependencies
      if (!deps.splice) {
        //deps is not an array, so probably means
        //an object literal or factory function for
        //the value. Adjust args.
        callback = deps;
        deps = [];
      }

      if (!hasProp(defined, name) && !hasProp(waiting, name)) {
        waiting[name] = [name, deps, callback];
      }
    };

    define.amd = {
      jQuery: true,
    };
  })();

  define("../../../bower_components/almond/almond", function () {});

  /*!
   * jQuery JavaScript Library v2.1.0
   * http://jquery.com/
   *
   * Includes Sizzle.js
   * http://sizzlejs.com/
   *
   * Copyright 2005, 2014 jQuery Foundation, Inc. and other contributors
   * Released under the MIT license
   * http://jquery.org/license
   *
   * Date: 2014-01-23T21:10Z
   */

  (function (global, factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
      // For CommonJS and CommonJS-like environments where a proper window is present,
      // execute the factory and get jQuery
      // For environments that do not inherently posses a window with a document
      // (such as Node.js), expose a jQuery-making factory as module.exports
      // This accentuates the need for the creation of a real window
      // e.g. var jQuery = require("jquery")(window);
      // See ticket #14549 for more info
      module.exports = global.document
        ? factory(global, true)
        : function (w) {
            if (!w.document) {
              throw new Error("jQuery requires a window with a document");
            }
            return factory(w);
          };
    } else {
      factory(global);
    }

    // Pass this if window is not defined yet
  })(
    typeof window !== "undefined" ? window : this,
    function (window, noGlobal) {
      // Can't do this because several apps including ASP.NET trace
      // the stack via arguments.caller.callee and Firefox dies if
      // you try to trace through "use strict" call chains. (#13335)
      // Support: Firefox 18+
      //

      var arr = [];

      var slice = arr.slice;

      var concat = arr.concat;

      var push = arr.push;

      var indexOf = arr.indexOf;

      var class2type = {};

      var toString = class2type.toString;

      var hasOwn = class2type.hasOwnProperty;

      var trim = "".trim;

      var support = {};

      var // Use the correct document accordingly with window argument (sandbox)
        document = window.document,
        version = "2.1.0",
        // Define a local copy of jQuery
        jQuery = function (selector, context) {
          // The jQuery object is actually just the init constructor 'enhanced'
          // Need init if jQuery is called (just allow error to be thrown if not included)
          return new jQuery.fn.init(selector, context);
        },
        // Matches dashed string for camelizing
        rmsPrefix = /^-ms-/,
        rdashAlpha = /-([\da-z])/gi,
        // Used by jQuery.camelCase as callback to replace()
        fcamelCase = function (all, letter) {
          return letter.toUpperCase();
        };

      jQuery.fn = jQuery.prototype = {
        // The current version of jQuery being used
        jquery: version,

        constructor: jQuery,

        // Start with an empty selector
        selector: "",

        // The default length of a jQuery object is 0
        length: 0,

        toArray: function () {
          return slice.call(this);
        },

        // Get the Nth element in the matched element set OR
        // Get the whole matched element set as a clean array
        get: function (num) {
          return num != null
            ? // Return a 'clean' array
              num < 0
              ? this[num + this.length]
              : this[num]
            : // Return just the object
              slice.call(this);
        },

        // Take an array of elements and push it onto the stack
        // (returning the new matched element set)
        pushStack: function (elems) {
          // Build a new jQuery matched element set
          var ret = jQuery.merge(this.constructor(), elems);

          // Add the old object onto the stack (as a reference)
          ret.prevObject = this;
          ret.context = this.context;

          // Return the newly-formed element set
          return ret;
        },

        // Execute a callback for every element in the matched set.
        // (You can seed the arguments with an array of args, but this is
        // only used internally.)
        each: function (callback, args) {
          return jQuery.each(this, callback, args);
        },

        map: function (callback) {
          return this.pushStack(
            jQuery.map(this, function (elem, i) {
              return callback.call(elem, i, elem);
            }),
          );
        },

        slice: function () {
          return this.pushStack(slice.apply(this, arguments));
        },

        first: function () {
          return this.eq(0);
        },

        last: function () {
          return this.eq(-1);
        },

        eq: function (i) {
          var len = this.length,
            j = +i + (i < 0 ? len : 0);
          return this.pushStack(j >= 0 && j < len ? [this[j]] : []);
        },

        end: function () {
          return this.prevObject || this.constructor(null);
        },

        // For internal use only.
        // Behaves like an Array's method, not like a jQuery method.
        push: push,
        sort: arr.sort,
        splice: arr.splice,
      };

      jQuery.extend = jQuery.fn.extend = function () {
        var options,
          name,
          src,
          copy,
          copyIsArray,
          clone,
          target = arguments[0] || {},
          i = 1,
          length = arguments.length,
          deep = false;

        // Handle a deep copy situation
        if (typeof target === "boolean") {
          deep = target;

          // skip the boolean and the target
          target = arguments[i] || {};
          i++;
        }

        // Handle case when target is a string or something (possible in deep copy)
        if (typeof target !== "object" && !jQuery.isFunction(target)) {
          target = {};
        }

        // extend jQuery itself if only one argument is passed
        if (i === length) {
          target = this;
          i--;
        }

        for (; i < length; i++) {
          // Only deal with non-null/undefined values
          if ((options = arguments[i]) != null) {
            // Extend the base object
            for (name in options) {
              src = target[name];
              copy = options[name];

              // Prevent never-ending loop
              if (target === copy) {
                continue;
              }

              // Recurse if we're merging plain objects or arrays
              if (
                deep &&
                copy &&
                (jQuery.isPlainObject(copy) ||
                  (copyIsArray = jQuery.isArray(copy)))
              ) {
                if (copyIsArray) {
                  copyIsArray = false;
                  clone = src && jQuery.isArray(src) ? src : [];
                } else {
                  clone = src && jQuery.isPlainObject(src) ? src : {};
                }

                // Never move original objects, clone them
                target[name] = jQuery.extend(deep, clone, copy);

                // Don't bring in undefined values
              } else if (copy !== undefined) {
                target[name] = copy;
              }
            }
          }
        }

        // Return the modified object
        return target;
      };

      jQuery.extend({
        // Unique for each copy of jQuery on the page
        expando: "jQuery" + (version + Math.random()).replace(/\D/g, ""),

        // Assume jQuery is ready without the ready module
        isReady: true,

        error: function (msg) {
          throw new Error(msg);
        },

        noop: function () {},

        // See test/unit/core.js for details concerning isFunction.
        // Since version 1.3, DOM methods and functions like alert
        // aren't supported. They return false on IE (#2968).
        isFunction: function (obj) {
          return jQuery.type(obj) === "function";
        },

        isArray: Array.isArray,

        isWindow: function (obj) {
          return obj != null && obj === obj.window;
        },

        isNumeric: function (obj) {
          // parseFloat NaNs numeric-cast false positives (null|true|false|"")
          // ...but misinterprets leading-number strings, particularly hex literals ("0x...")
          // subtraction forces infinities to NaN
          return obj - parseFloat(obj) >= 0;
        },

        isPlainObject: function (obj) {
          // Not plain objects:
          // - Any object or value whose internal [[Class]] property is not "[object Object]"
          // - DOM nodes
          // - window
          if (
            jQuery.type(obj) !== "object" ||
            obj.nodeType ||
            jQuery.isWindow(obj)
          ) {
            return false;
          }

          // Support: Firefox <20
          // The try/catch suppresses exceptions thrown when attempting to access
          // the "constructor" property of certain host objects, ie. |window.location|
          // https://bugzilla.mozilla.org/show_bug.cgi?id=814622
          try {
            if (
              obj.constructor &&
              !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")
            ) {
              return false;
            }
          } catch (e) {
            return false;
          }

          // If the function hasn't returned already, we're confident that
          // |obj| is a plain object, created by {} or constructed with new Object
          return true;
        },

        isEmptyObject: function (obj) {
          var name;
          for (name in obj) {
            return false;
          }
          return true;
        },

        type: function (obj) {
          if (obj == null) {
            return obj + "";
          }
          // Support: Android < 4.0, iOS < 6 (functionish RegExp)
          return typeof obj === "object" || typeof obj === "function"
            ? class2type[toString.call(obj)] || "object"
            : typeof obj;
        },

        // Evaluates a script in a global context
        globalEval: function (code) {
          var script,
            indirect = eval;

          code = jQuery.trim(code);

          if (code) {
            // If the code includes a valid, prologue position
            // strict mode pragma, execute code by injecting a
            // script tag into the document.
            if (code.indexOf("use strict") === 1) {
              script = document.createElement("script");
              script.text = code;
              document.head.appendChild(script).parentNode.removeChild(script);
            } else {
              // Otherwise, avoid the DOM node creation, insertion
              // and removal by using an indirect global eval
              indirect(code);
            }
          }
        },

        // Convert dashed to camelCase; used by the css and data modules
        // Microsoft forgot to hump their vendor prefix (#9572)
        camelCase: function (string) {
          return string
            .replace(rmsPrefix, "ms-")
            .replace(rdashAlpha, fcamelCase);
        },

        nodeName: function (elem, name) {
          return (
            elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase()
          );
        },

        // args is for internal usage only
        each: function (obj, callback, args) {
          var value,
            i = 0,
            length = obj.length,
            isArray = isArraylike(obj);

          if (args) {
            if (isArray) {
              for (; i < length; i++) {
                value = callback.apply(obj[i], args);

                if (value === false) {
                  break;
                }
              }
            } else {
              for (i in obj) {
                value = callback.apply(obj[i], args);

                if (value === false) {
                  break;
                }
              }
            }

            // A special, fast, case for the most common use of each
          } else {
            if (isArray) {
              for (; i < length; i++) {
                value = callback.call(obj[i], i, obj[i]);

                if (value === false) {
                  break;
                }
              }
            } else {
              for (i in obj) {
                value = callback.call(obj[i], i, obj[i]);

                if (value === false) {
                  break;
                }
              }
            }
          }

          return obj;
        },

        trim: function (text) {
          return text == null ? "" : trim.call(text);
        },

        // results is for internal usage only
        makeArray: function (arr, results) {
          var ret = results || [];

          if (arr != null) {
            if (isArraylike(Object(arr))) {
              jQuery.merge(ret, typeof arr === "string" ? [arr] : arr);
            } else {
              push.call(ret, arr);
            }
          }

          return ret;
        },

        inArray: function (elem, arr, i) {
          return arr == null ? -1 : indexOf.call(arr, elem, i);
        },

        merge: function (first, second) {
          var len = +second.length,
            j = 0,
            i = first.length;

          for (; j < len; j++) {
            first[i++] = second[j];
          }

          first.length = i;

          return first;
        },

        grep: function (elems, callback, invert) {
          var callbackInverse,
            matches = [],
            i = 0,
            length = elems.length,
            callbackExpect = !invert;

          // Go through the array, only saving the items
          // that pass the validator function
          for (; i < length; i++) {
            callbackInverse = !callback(elems[i], i);
            if (callbackInverse !== callbackExpect) {
              matches.push(elems[i]);
            }
          }

          return matches;
        },

        // arg is for internal usage only
        map: function (elems, callback, arg) {
          var value,
            i = 0,
            length = elems.length,
            isArray = isArraylike(elems),
            ret = [];

          // Go through the array, translating each of the items to their new values
          if (isArray) {
            for (; i < length; i++) {
              value = callback(elems[i], i, arg);

              if (value != null) {
                ret.push(value);
              }
            }

            // Go through every key on the object,
          } else {
            for (i in elems) {
              value = callback(elems[i], i, arg);

              if (value != null) {
                ret.push(value);
              }
            }
          }

          // Flatten any nested arrays
          return concat.apply([], ret);
        },

        // A global GUID counter for objects
        guid: 1,

        // Bind a function to a context, optionally partially applying any
        // arguments.
        proxy: function (fn, context) {
          var tmp, args, proxy;

          if (typeof context === "string") {
            tmp = fn[context];
            context = fn;
            fn = tmp;
          }

          // Quick check to determine if target is callable, in the spec
          // this throws a TypeError, but we will just return undefined.
          if (!jQuery.isFunction(fn)) {
            return undefined;
          }

          // Simulated bind
          args = slice.call(arguments, 2);
          proxy = function () {
            return fn.apply(
              context || this,
              args.concat(slice.call(arguments)),
            );
          };

          // Set the guid of unique handler to the same of original handler, so it can be removed
          proxy.guid = fn.guid = fn.guid || jQuery.guid++;

          return proxy;
        },

        now: Date.now,

        // jQuery.support is not used in Core but other projects attach their
        // properties to it so it needs to exist.
        support: support,
      });

      // Populate the class2type map
      jQuery.each(
        "Boolean Number String Function Array Date RegExp Object Error".split(
          " ",
        ),
        function (i, name) {
          class2type["[object " + name + "]"] = name.toLowerCase();
        },
      );

      function isArraylike(obj) {
        var length = obj.length,
          type = jQuery.type(obj);

        if (type === "function" || jQuery.isWindow(obj)) {
          return false;
        }

        if (obj.nodeType === 1 && length) {
          return true;
        }

        return (
          type === "array" ||
          length === 0 ||
          (typeof length === "number" && length > 0 && length - 1 in obj)
        );
      }
      var Sizzle =
        /*!
         * Sizzle CSS Selector Engine v1.10.16
         * http://sizzlejs.com/
         *
         * Copyright 2013 jQuery Foundation, Inc. and other contributors
         * Released under the MIT license
         * http://jquery.org/license
         *
         * Date: 2014-01-13
         */
        (function (window) {
          var i,
            support,
            Expr,
            getText,
            isXML,
            compile,
            outermostContext,
            sortInput,
            hasDuplicate,
            // Local document vars
            setDocument,
            document,
            docElem,
            documentIsHTML,
            rbuggyQSA,
            rbuggyMatches,
            matches,
            contains,
            // Instance-specific data
            expando = "sizzle" + -new Date(),
            preferredDoc = window.document,
            dirruns = 0,
            done = 0,
            classCache = createCache(),
            tokenCache = createCache(),
            compilerCache = createCache(),
            sortOrder = function (a, b) {
              if (a === b) {
                hasDuplicate = true;
              }
              return 0;
            },
            // General-purpose constants
            strundefined = typeof undefined,
            MAX_NEGATIVE = 1 << 31,
            // Instance methods
            hasOwn = {}.hasOwnProperty,
            arr = [],
            pop = arr.pop,
            push_native = arr.push,
            push = arr.push,
            slice = arr.slice,
            // Use a stripped-down indexOf if we can't use a native one
            indexOf =
              arr.indexOf ||
              function (elem) {
                var i = 0,
                  len = this.length;
                for (; i < len; i++) {
                  if (this[i] === elem) {
                    return i;
                  }
                }
                return -1;
              },
            booleans =
              "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
            // Regular expressions

            // Whitespace characters http://www.w3.org/TR/css3-selectors/#whitespace
            whitespace = "[\\x20\\t\\r\\n\\f]",
            // http://www.w3.org/TR/css3-syntax/#characters
            characterEncoding = "(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",
            // Loosely modeled on CSS identifier characters
            // An unquoted value should be a CSS identifier http://www.w3.org/TR/css3-selectors/#attribute-selectors
            // Proper syntax: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
            identifier = characterEncoding.replace("w", "w#"),
            // Acceptable operators http://www.w3.org/TR/selectors/#attribute-selectors
            attributes =
              "\\[" +
              whitespace +
              "*(" +
              characterEncoding +
              ")" +
              whitespace +
              "*(?:([*^$|!~]?=)" +
              whitespace +
              "*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|(" +
              identifier +
              ")|)|)" +
              whitespace +
              "*\\]",
            // Prefer arguments quoted,
            //   then not containing pseudos/brackets,
            //   then attribute selectors/non-parenthetical expressions,
            //   then anything else
            // These preferences are here to reduce the number of selectors
            //   needing tokenize in the PSEUDO preFilter
            pseudos =
              ":(" +
              characterEncoding +
              ")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|" +
              attributes.replace(3, 8) +
              ")*)|.*)\\)|)",
            // Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
            rtrim = new RegExp(
              "^" +
                whitespace +
                "+|((?:^|[^\\\\])(?:\\\\.)*)" +
                whitespace +
                "+$",
              "g",
            ),
            rcomma = new RegExp("^" + whitespace + "*," + whitespace + "*"),
            rcombinators = new RegExp(
              "^" +
                whitespace +
                "*([>+~]|" +
                whitespace +
                ")" +
                whitespace +
                "*",
            ),
            rattributeQuotes = new RegExp(
              "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]",
              "g",
            ),
            rpseudo = new RegExp(pseudos),
            ridentifier = new RegExp("^" + identifier + "$"),
            matchExpr = {
              ID: new RegExp("^#(" + characterEncoding + ")"),
              CLASS: new RegExp("^\\.(" + characterEncoding + ")"),
              TAG: new RegExp(
                "^(" + characterEncoding.replace("w", "w*") + ")",
              ),
              ATTR: new RegExp("^" + attributes),
              PSEUDO: new RegExp("^" + pseudos),
              CHILD: new RegExp(
                "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" +
                  whitespace +
                  "*(even|odd|(([+-]|)(\\d*)n|)" +
                  whitespace +
                  "*(?:([+-]|)" +
                  whitespace +
                  "*(\\d+)|))" +
                  whitespace +
                  "*\\)|)",
                "i",
              ),
              bool: new RegExp("^(?:" + booleans + ")$", "i"),
              // For use in libraries implementing .is()
              // We use this for POS matching in `select`
              needsContext: new RegExp(
                "^" +
                  whitespace +
                  "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
                  whitespace +
                  "*((?:-\\d)?\\d*)" +
                  whitespace +
                  "*\\)|)(?=[^-]|$)",
                "i",
              ),
            },
            rinputs = /^(?:input|select|textarea|button)$/i,
            rheader = /^h\d$/i,
            rnative = /^[^{]+\{\s*\[native \w/,
            // Easily-parseable/retrievable ID or TAG or CLASS selectors
            rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,
            rsibling = /[+~]/,
            rescape = /'|\\/g,
            // CSS escapes http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
            runescape = new RegExp(
              "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)",
              "ig",
            ),
            funescape = function (_, escaped, escapedWhitespace) {
              var high = "0x" + escaped - 0x10000;
              // NaN means non-codepoint
              // Support: Firefox
              // Workaround erroneous numeric interpretation of +"0x"
              return high !== high || escapedWhitespace
                ? escaped
                : high < 0
                  ? // BMP codepoint
                    String.fromCharCode(high + 0x10000)
                  : // Supplemental Plane codepoint (surrogate pair)
                    String.fromCharCode(
                      (high >> 10) | 0xd800,
                      (high & 0x3ff) | 0xdc00,
                    );
            };

          // Optimize for push.apply( _, NodeList )
          try {
            push.apply(
              (arr = slice.call(preferredDoc.childNodes)),
              preferredDoc.childNodes,
            );
            // Support: Android<4.0
            // Detect silently failing push.apply
            arr[preferredDoc.childNodes.length].nodeType;
          } catch (e) {
            push = {
              apply: arr.length
                ? // Leverage slice if possible
                  function (target, els) {
                    push_native.apply(target, slice.call(els));
                  }
                : // Support: IE<9
                  // Otherwise append directly
                  function (target, els) {
                    var j = target.length,
                      i = 0;
                    // Can't trust NodeList.length
                    while ((target[j++] = els[i++])) {}
                    target.length = j - 1;
                  },
            };
          }

          function Sizzle(selector, context, results, seed) {
            var match,
              elem,
              m,
              nodeType,
              // QSA vars
              i,
              groups,
              old,
              nid,
              newContext,
              newSelector;

            if (
              (context ? context.ownerDocument || context : preferredDoc) !==
              document
            ) {
              setDocument(context);
            }

            context = context || document;
            results = results || [];

            if (!selector || typeof selector !== "string") {
              return results;
            }

            if ((nodeType = context.nodeType) !== 1 && nodeType !== 9) {
              return [];
            }

            if (documentIsHTML && !seed) {
              // Shortcuts
              if ((match = rquickExpr.exec(selector))) {
                // Speed-up: Sizzle("#ID")
                if ((m = match[1])) {
                  if (nodeType === 9) {
                    elem = context.getElementById(m);
                    // Check parentNode to catch when Blackberry 4.6 returns
                    // nodes that are no longer in the document (jQuery #6963)
                    if (elem && elem.parentNode) {
                      // Handle the case where IE, Opera, and Webkit return items
                      // by name instead of ID
                      if (elem.id === m) {
                        results.push(elem);
                        return results;
                      }
                    } else {
                      return results;
                    }
                  } else {
                    // Context is not a document
                    if (
                      context.ownerDocument &&
                      (elem = context.ownerDocument.getElementById(m)) &&
                      contains(context, elem) &&
                      elem.id === m
                    ) {
                      results.push(elem);
                      return results;
                    }
                  }

                  // Speed-up: Sizzle("TAG")
                } else if (match[2]) {
                  push.apply(results, context.getElementsByTagName(selector));
                  return results;

                  // Speed-up: Sizzle(".CLASS")
                } else if (
                  (m = match[3]) &&
                  support.getElementsByClassName &&
                  context.getElementsByClassName
                ) {
                  push.apply(results, context.getElementsByClassName(m));
                  return results;
                }
              }

              // QSA path
              if (support.qsa && (!rbuggyQSA || !rbuggyQSA.test(selector))) {
                nid = old = expando;
                newContext = context;
                newSelector = nodeType === 9 && selector;

                // qSA works strangely on Element-rooted queries
                // We can work around this by specifying an extra ID on the root
                // and working up from there (Thanks to Andrew Dupont for the technique)
                // IE 8 doesn't work on object elements
                if (
                  nodeType === 1 &&
                  context.nodeName.toLowerCase() !== "object"
                ) {
                  groups = tokenize(selector);

                  if ((old = context.getAttribute("id"))) {
                    nid = old.replace(rescape, "\\$&");
                  } else {
                    context.setAttribute("id", nid);
                  }
                  nid = "[id='" + nid + "'] ";

                  i = groups.length;
                  while (i--) {
                    groups[i] = nid + toSelector(groups[i]);
                  }
                  newContext =
                    (rsibling.test(selector) &&
                      testContext(context.parentNode)) ||
                    context;
                  newSelector = groups.join(",");
                }

                if (newSelector) {
                  try {
                    push.apply(
                      results,
                      newContext.querySelectorAll(newSelector),
                    );
                    return results;
                  } catch (qsaError) {
                  } finally {
                    if (!old) {
                      context.removeAttribute("id");
                    }
                  }
                }
              }
            }

            // All others
            return select(
              selector.replace(rtrim, "$1"),
              context,
              results,
              seed,
            );
          }

          /**
           * Create key-value caches of limited size
           * @returns {Function(string, Object)} Returns the Object data after storing it on itself with
           *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
           *	deleting the oldest entry
           */
          function createCache() {
            var keys = [];

            function cache(key, value) {
              // Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
              if (keys.push(key + " ") > Expr.cacheLength) {
                // Only keep the most recent entries
                delete cache[keys.shift()];
              }
              return (cache[key + " "] = value);
            }
            return cache;
          }

          /**
           * Mark a function for special use by Sizzle
           * @param {Function} fn The function to mark
           */
          function markFunction(fn) {
            fn[expando] = true;
            return fn;
          }

          /**
           * Support testing using an element
           * @param {Function} fn Passed the created div and expects a boolean result
           */
          function assert(fn) {
            var div = document.createElement("div");

            try {
              return !!fn(div);
            } catch (e) {
              return false;
            } finally {
              // Remove from its parent by default
              if (div.parentNode) {
                div.parentNode.removeChild(div);
              }
              // release memory in IE
              div = null;
            }
          }

          /**
           * Adds the same handler for all of the specified attrs
           * @param {String} attrs Pipe-separated list of attributes
           * @param {Function} handler The method that will be applied
           */
          function addHandle(attrs, handler) {
            var arr = attrs.split("|"),
              i = attrs.length;

            while (i--) {
              Expr.attrHandle[arr[i]] = handler;
            }
          }

          /**
           * Checks document order of two siblings
           * @param {Element} a
           * @param {Element} b
           * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
           */
          function siblingCheck(a, b) {
            var cur = b && a,
              diff =
                cur &&
                a.nodeType === 1 &&
                b.nodeType === 1 &&
                (~b.sourceIndex || MAX_NEGATIVE) -
                  (~a.sourceIndex || MAX_NEGATIVE);

            // Use IE sourceIndex if available on both nodes
            if (diff) {
              return diff;
            }

            // Check if b follows a
            if (cur) {
              while ((cur = cur.nextSibling)) {
                if (cur === b) {
                  return -1;
                }
              }
            }

            return a ? 1 : -1;
          }

          /**
           * Returns a function to use in pseudos for input types
           * @param {String} type
           */
          function createInputPseudo(type) {
            return function (elem) {
              var name = elem.nodeName.toLowerCase();
              return name === "input" && elem.type === type;
            };
          }

          /**
           * Returns a function to use in pseudos for buttons
           * @param {String} type
           */
          function createButtonPseudo(type) {
            return function (elem) {
              var name = elem.nodeName.toLowerCase();
              return (
                (name === "input" || name === "button") && elem.type === type
              );
            };
          }

          /**
           * Returns a function to use in pseudos for positionals
           * @param {Function} fn
           */
          function createPositionalPseudo(fn) {
            return markFunction(function (argument) {
              argument = +argument;
              return markFunction(function (seed, matches) {
                var j,
                  matchIndexes = fn([], seed.length, argument),
                  i = matchIndexes.length;

                // Match elements found at the specified indexes
                while (i--) {
                  if (seed[(j = matchIndexes[i])]) {
                    seed[j] = !(matches[j] = seed[j]);
                  }
                }
              });
            });
          }

          /**
           * Checks a node for validity as a Sizzle context
           * @param {Element|Object=} context
           * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
           */
          function testContext(context) {
            return (
              context &&
              typeof context.getElementsByTagName !== strundefined &&
              context
            );
          }

          // Expose support vars for convenience
          support = Sizzle.support = {};

          /**
           * Detects XML nodes
           * @param {Element|Object} elem An element or a document
           * @returns {Boolean} True iff elem is a non-HTML XML node
           */
          isXML = Sizzle.isXML = function (elem) {
            // documentElement is verified for cases where it doesn't yet exist
            // (such as loading iframes in IE - #4833)
            var documentElement =
              elem && (elem.ownerDocument || elem).documentElement;
            return documentElement
              ? documentElement.nodeName !== "HTML"
              : false;
          };

          /**
           * Sets document-related variables once based on the current document
           * @param {Element|Object} [doc] An element or document object to use to set the document
           * @returns {Object} Returns the current document
           */
          setDocument = Sizzle.setDocument = function (node) {
            var hasCompare,
              doc = node ? node.ownerDocument || node : preferredDoc,
              parent = doc.defaultView;

            // If no document and documentElement is available, return
            if (
              doc === document ||
              doc.nodeType !== 9 ||
              !doc.documentElement
            ) {
              return document;
            }

            // Set our document
            document = doc;
            docElem = doc.documentElement;

            // Support tests
            documentIsHTML = !isXML(doc);

            // Support: IE>8
            // If iframe document is assigned to "document" variable and if iframe has been reloaded,
            // IE will throw "permission denied" error when accessing "document" variable, see jQuery #13936
            // IE6-8 do not support the defaultView property so parent will be undefined
            if (parent && parent !== parent.top) {
              // IE11 does not have attachEvent, so all must suffer
              if (parent.addEventListener) {
                parent.addEventListener(
                  "unload",
                  function () {
                    setDocument();
                  },
                  false,
                );
              } else if (parent.attachEvent) {
                parent.attachEvent("onunload", function () {
                  setDocument();
                });
              }
            }

            /* Attributes
---------------------------------------------------------------------- */

            // Support: IE<8
            // Verify that getAttribute really returns attributes and not properties (excepting IE8 booleans)
            support.attributes = assert(function (div) {
              div.className = "i";
              return !div.getAttribute("className");
            });

            /* getElement(s)By*
---------------------------------------------------------------------- */

            // Check if getElementsByTagName("*") returns only elements
            support.getElementsByTagName = assert(function (div) {
              div.appendChild(doc.createComment(""));
              return !div.getElementsByTagName("*").length;
            });

            // Check if getElementsByClassName can be trusted
            support.getElementsByClassName =
              rnative.test(doc.getElementsByClassName) &&
              assert(function (div) {
                div.innerHTML = "<div class='a'></div><div class='a i'></div>";

                // Support: Safari<4
                // Catch class over-caching
                div.firstChild.className = "i";
                // Support: Opera<10
                // Catch gEBCN failure to find non-leading classes
                return div.getElementsByClassName("i").length === 2;
              });

            // Support: IE<10
            // Check if getElementById returns elements by name
            // The broken getElementById methods don't pick up programatically-set names,
            // so use a roundabout getElementsByName test
            support.getById = assert(function (div) {
              docElem.appendChild(div).id = expando;
              return (
                !doc.getElementsByName || !doc.getElementsByName(expando).length
              );
            });

            // ID find and filter
            if (support.getById) {
              Expr.find["ID"] = function (id, context) {
                if (
                  typeof context.getElementById !== strundefined &&
                  documentIsHTML
                ) {
                  var m = context.getElementById(id);
                  // Check parentNode to catch when Blackberry 4.6 returns
                  // nodes that are no longer in the document #6963
                  return m && m.parentNode ? [m] : [];
                }
              };
              Expr.filter["ID"] = function (id) {
                var attrId = id.replace(runescape, funescape);
                return function (elem) {
                  return elem.getAttribute("id") === attrId;
                };
              };
            } else {
              // Support: IE6/7
              // getElementById is not reliable as a find shortcut
              delete Expr.find["ID"];

              Expr.filter["ID"] = function (id) {
                var attrId = id.replace(runescape, funescape);
                return function (elem) {
                  var node =
                    typeof elem.getAttributeNode !== strundefined &&
                    elem.getAttributeNode("id");
                  return node && node.value === attrId;
                };
              };
            }

            // Tag
            Expr.find["TAG"] = support.getElementsByTagName
              ? function (tag, context) {
                  if (typeof context.getElementsByTagName !== strundefined) {
                    return context.getElementsByTagName(tag);
                  }
                }
              : function (tag, context) {
                  var elem,
                    tmp = [],
                    i = 0,
                    results = context.getElementsByTagName(tag);

                  // Filter out possible comments
                  if (tag === "*") {
                    while ((elem = results[i++])) {
                      if (elem.nodeType === 1) {
                        tmp.push(elem);
                      }
                    }

                    return tmp;
                  }
                  return results;
                };

            // Class
            Expr.find["CLASS"] =
              support.getElementsByClassName &&
              function (className, context) {
                if (
                  typeof context.getElementsByClassName !== strundefined &&
                  documentIsHTML
                ) {
                  return context.getElementsByClassName(className);
                }
              };

            /* QSA/matchesSelector
---------------------------------------------------------------------- */

            // QSA and matchesSelector support

            // matchesSelector(:active) reports false when true (IE9/Opera 11.5)
            rbuggyMatches = [];

            // qSa(:focus) reports false when true (Chrome 21)
            // We allow this because of a bug in IE8/9 that throws an error
            // whenever `document.activeElement` is accessed on an iframe
            // So, we allow :focus to pass through QSA all the time to avoid the IE error
            // See http://bugs.jquery.com/ticket/13378
            rbuggyQSA = [];

            if ((support.qsa = rnative.test(doc.querySelectorAll))) {
              // Build QSA regex
              // Regex strategy adopted from Diego Perini
              assert(function (div) {
                // Select is set to empty string on purpose
                // This is to test IE's treatment of not explicitly
                // setting a boolean content attribute,
                // since its presence should be enough
                // http://bugs.jquery.com/ticket/12359
                div.innerHTML =
                  "<select t=''><option selected=''></option></select>";

                // Support: IE8, Opera 10-12
                // Nothing should be selected when empty strings follow ^= or $= or *=
                if (div.querySelectorAll("[t^='']").length) {
                  rbuggyQSA.push("[*^$]=" + whitespace + "*(?:''|\"\")");
                }

                // Support: IE8
                // Boolean attributes and "value" are not treated correctly
                if (!div.querySelectorAll("[selected]").length) {
                  rbuggyQSA.push(
                    "\\[" + whitespace + "*(?:value|" + booleans + ")",
                  );
                }

                // Webkit/Opera - :checked should return selected option elements
                // http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
                // IE8 throws error here and will not see later tests
                if (!div.querySelectorAll(":checked").length) {
                  rbuggyQSA.push(":checked");
                }
              });

              assert(function (div) {
                // Support: Windows 8 Native Apps
                // The type and name attributes are restricted during .innerHTML assignment
                var input = doc.createElement("input");
                input.setAttribute("type", "hidden");
                div.appendChild(input).setAttribute("name", "D");

                // Support: IE8
                // Enforce case-sensitivity of name attribute
                if (div.querySelectorAll("[name=d]").length) {
                  rbuggyQSA.push("name" + whitespace + "*[*^$|!~]?=");
                }

                // FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
                // IE8 throws error here and will not see later tests
                if (!div.querySelectorAll(":enabled").length) {
                  rbuggyQSA.push(":enabled", ":disabled");
                }

                // Opera 10-11 does not throw on post-comma invalid pseudos
                div.querySelectorAll("*,:x");
                rbuggyQSA.push(",.*:");
              });
            }

            if (
              (support.matchesSelector = rnative.test(
                (matches =
                  docElem.webkitMatchesSelector ||
                  docElem.mozMatchesSelector ||
                  docElem.oMatchesSelector ||
                  docElem.msMatchesSelector),
              ))
            ) {
              assert(function (div) {
                // Check to see if it's possible to do matchesSelector
                // on a disconnected node (IE 9)
                support.disconnectedMatch = matches.call(div, "div");

                // This should fail with an exception
                // Gecko does not error, returns false instead
                matches.call(div, "[s!='']:x");
                rbuggyMatches.push("!=", pseudos);
              });
            }

            rbuggyQSA = rbuggyQSA.length && new RegExp(rbuggyQSA.join("|"));
            rbuggyMatches =
              rbuggyMatches.length && new RegExp(rbuggyMatches.join("|"));

            /* Contains
---------------------------------------------------------------------- */
            hasCompare = rnative.test(docElem.compareDocumentPosition);

            // Element contains another
            // Purposefully does not implement inclusive descendent
            // As in, an element does not contain itself
            contains =
              hasCompare || rnative.test(docElem.contains)
                ? function (a, b) {
                    var adown = a.nodeType === 9 ? a.documentElement : a,
                      bup = b && b.parentNode;
                    return (
                      a === bup ||
                      !!(
                        bup &&
                        bup.nodeType === 1 &&
                        (adown.contains
                          ? adown.contains(bup)
                          : a.compareDocumentPosition &&
                            a.compareDocumentPosition(bup) & 16)
                      )
                    );
                  }
                : function (a, b) {
                    if (b) {
                      while ((b = b.parentNode)) {
                        if (b === a) {
                          return true;
                        }
                      }
                    }
                    return false;
                  };

            /* Sorting
---------------------------------------------------------------------- */

            // Document order sorting
            sortOrder = hasCompare
              ? function (a, b) {
                  // Flag for duplicate removal
                  if (a === b) {
                    hasDuplicate = true;
                    return 0;
                  }

                  // Sort on method existence if only one input has compareDocumentPosition
                  var compare =
                    !a.compareDocumentPosition - !b.compareDocumentPosition;
                  if (compare) {
                    return compare;
                  }

                  // Calculate position if both inputs belong to the same document
                  compare =
                    (a.ownerDocument || a) === (b.ownerDocument || b)
                      ? a.compareDocumentPosition(b)
                      : // Otherwise we know they are disconnected
                        1;

                  // Disconnected nodes
                  if (
                    compare & 1 ||
                    (!support.sortDetached &&
                      b.compareDocumentPosition(a) === compare)
                  ) {
                    // Choose the first element that is related to our preferred document
                    if (
                      a === doc ||
                      (a.ownerDocument === preferredDoc &&
                        contains(preferredDoc, a))
                    ) {
                      return -1;
                    }
                    if (
                      b === doc ||
                      (b.ownerDocument === preferredDoc &&
                        contains(preferredDoc, b))
                    ) {
                      return 1;
                    }

                    // Maintain original order
                    return sortInput
                      ? indexOf.call(sortInput, a) - indexOf.call(sortInput, b)
                      : 0;
                  }

                  return compare & 4 ? -1 : 1;
                }
              : function (a, b) {
                  // Exit early if the nodes are identical
                  if (a === b) {
                    hasDuplicate = true;
                    return 0;
                  }

                  var cur,
                    i = 0,
                    aup = a.parentNode,
                    bup = b.parentNode,
                    ap = [a],
                    bp = [b];

                  // Parentless nodes are either documents or disconnected
                  if (!aup || !bup) {
                    return a === doc
                      ? -1
                      : b === doc
                        ? 1
                        : aup
                          ? -1
                          : bup
                            ? 1
                            : sortInput
                              ? indexOf.call(sortInput, a) -
                                indexOf.call(sortInput, b)
                              : 0;

                    // If the nodes are siblings, we can do a quick check
                  } else if (aup === bup) {
                    return siblingCheck(a, b);
                  }

                  // Otherwise we need full lists of their ancestors for comparison
                  cur = a;
                  while ((cur = cur.parentNode)) {
                    ap.unshift(cur);
                  }
                  cur = b;
                  while ((cur = cur.parentNode)) {
                    bp.unshift(cur);
                  }

                  // Walk down the tree looking for a discrepancy
                  while (ap[i] === bp[i]) {
                    i++;
                  }

                  return i
                    ? // Do a sibling check if the nodes have a common ancestor
                      siblingCheck(ap[i], bp[i])
                    : // Otherwise nodes in our document sort first
                      ap[i] === preferredDoc
                      ? -1
                      : bp[i] === preferredDoc
                        ? 1
                        : 0;
                };

            return doc;
          };

          Sizzle.matches = function (expr, elements) {
            return Sizzle(expr, null, null, elements);
          };

          Sizzle.matchesSelector = function (elem, expr) {
            // Set document vars if needed
            if ((elem.ownerDocument || elem) !== document) {
              setDocument(elem);
            }

            // Make sure that attribute selectors are quoted
            expr = expr.replace(rattributeQuotes, "='$1']");

            if (
              support.matchesSelector &&
              documentIsHTML &&
              (!rbuggyMatches || !rbuggyMatches.test(expr)) &&
              (!rbuggyQSA || !rbuggyQSA.test(expr))
            ) {
              try {
                var ret = matches.call(elem, expr);

                // IE 9's matchesSelector returns false on disconnected nodes
                if (
                  ret ||
                  support.disconnectedMatch ||
                  // As well, disconnected nodes are said to be in a document
                  // fragment in IE 9
                  (elem.document && elem.document.nodeType !== 11)
                ) {
                  return ret;
                }
              } catch (e) {}
            }

            return Sizzle(expr, document, null, [elem]).length > 0;
          };

          Sizzle.contains = function (context, elem) {
            // Set document vars if needed
            if ((context.ownerDocument || context) !== document) {
              setDocument(context);
            }
            return contains(context, elem);
          };

          Sizzle.attr = function (elem, name) {
            // Set document vars if needed
            if ((elem.ownerDocument || elem) !== document) {
              setDocument(elem);
            }

            var fn = Expr.attrHandle[name.toLowerCase()],
              // Don't get fooled by Object.prototype properties (jQuery #13807)
              val =
                fn && hasOwn.call(Expr.attrHandle, name.toLowerCase())
                  ? fn(elem, name, !documentIsHTML)
                  : undefined;

            return val !== undefined
              ? val
              : support.attributes || !documentIsHTML
                ? elem.getAttribute(name)
                : (val = elem.getAttributeNode(name)) && val.specified
                  ? val.value
                  : null;
          };

          Sizzle.error = function (msg) {
            throw new Error("Syntax error, unrecognized expression: " + msg);
          };

          /**
           * Document sorting and removing duplicates
           * @param {ArrayLike} results
           */
          Sizzle.uniqueSort = function (results) {
            var elem,
              duplicates = [],
              j = 0,
              i = 0;

            // Unless we *know* we can detect duplicates, assume their presence
            hasDuplicate = !support.detectDuplicates;
            sortInput = !support.sortStable && results.slice(0);
            results.sort(sortOrder);

            if (hasDuplicate) {
              while ((elem = results[i++])) {
                if (elem === results[i]) {
                  j = duplicates.push(i);
                }
              }
              while (j--) {
                results.splice(duplicates[j], 1);
              }
            }

            // Clear input after sorting to release objects
            // See https://github.com/jquery/sizzle/pull/225
            sortInput = null;

            return results;
          };

          /**
           * Utility function for retrieving the text value of an array of DOM nodes
           * @param {Array|Element} elem
           */
          getText = Sizzle.getText = function (elem) {
            var node,
              ret = "",
              i = 0,
              nodeType = elem.nodeType;

            if (!nodeType) {
              // If no nodeType, this is expected to be an array
              while ((node = elem[i++])) {
                // Do not traverse comment nodes
                ret += getText(node);
              }
            } else if (nodeType === 1 || nodeType === 9 || nodeType === 11) {
              // Use textContent for elements
              // innerText usage removed for consistency of new lines (jQuery #11153)
              if (typeof elem.textContent === "string") {
                return elem.textContent;
              } else {
                // Traverse its children
                for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
                  ret += getText(elem);
                }
              }
            } else if (nodeType === 3 || nodeType === 4) {
              return elem.nodeValue;
            }
            // Do not include comment or processing instruction nodes

            return ret;
          };

          Expr = Sizzle.selectors = {
            // Can be adjusted by the user
            cacheLength: 50,

            createPseudo: markFunction,

            match: matchExpr,

            attrHandle: {},

            find: {},

            relative: {
              ">": { dir: "parentNode", first: true },
              " ": { dir: "parentNode" },
              "+": { dir: "previousSibling", first: true },
              "~": { dir: "previousSibling" },
            },

            preFilter: {
              ATTR: function (match) {
                match[1] = match[1].replace(runescape, funescape);

                // Move the given value to match[3] whether quoted or unquoted
                match[3] = (match[4] || match[5] || "").replace(
                  runescape,
                  funescape,
                );

                if (match[2] === "~=") {
                  match[3] = " " + match[3] + " ";
                }

                return match.slice(0, 4);
              },

              CHILD: function (match) {
                /* matches from matchExpr["CHILD"]
            1 type (only|nth|...)
            2 what (child|of-type)
            3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
            4 xn-component of xn+y argument ([+-]?\d*n|)
            5 sign of xn-component
            6 x of xn-component
            7 sign of y-component
            8 y of y-component
        */
                match[1] = match[1].toLowerCase();

                if (match[1].slice(0, 3) === "nth") {
                  // nth-* requires argument
                  if (!match[3]) {
                    Sizzle.error(match[0]);
                  }

                  // numeric x and y parameters for Expr.filter.CHILD
                  // remember that false/true cast respectively to 0/1
                  match[4] = +(match[4]
                    ? match[5] + (match[6] || 1)
                    : 2 * (match[3] === "even" || match[3] === "odd"));
                  match[5] = +(match[7] + match[8] || match[3] === "odd");

                  // other types prohibit arguments
                } else if (match[3]) {
                  Sizzle.error(match[0]);
                }

                return match;
              },

              PSEUDO: function (match) {
                var excess,
                  unquoted = !match[5] && match[2];

                if (matchExpr["CHILD"].test(match[0])) {
                  return null;
                }

                // Accept quoted arguments as-is
                if (match[3] && match[4] !== undefined) {
                  match[2] = match[4];

                  // Strip excess characters from unquoted arguments
                } else if (
                  unquoted &&
                  rpseudo.test(unquoted) &&
                  // Get excess from tokenize (recursively)
                  (excess = tokenize(unquoted, true)) &&
                  // advance to the next closing parenthesis
                  (excess =
                    unquoted.indexOf(")", unquoted.length - excess) -
                    unquoted.length)
                ) {
                  // excess is a negative index
                  match[0] = match[0].slice(0, excess);
                  match[2] = unquoted.slice(0, excess);
                }

                // Return only captures needed by the pseudo filter method (type and argument)
                return match.slice(0, 3);
              },
            },

            filter: {
              TAG: function (nodeNameSelector) {
                var nodeName = nodeNameSelector
                  .replace(runescape, funescape)
                  .toLowerCase();
                return nodeNameSelector === "*"
                  ? function () {
                      return true;
                    }
                  : function (elem) {
                      return (
                        elem.nodeName &&
                        elem.nodeName.toLowerCase() === nodeName
                      );
                    };
              },

              CLASS: function (className) {
                var pattern = classCache[className + " "];

                return (
                  pattern ||
                  ((pattern = new RegExp(
                    "(^|" +
                      whitespace +
                      ")" +
                      className +
                      "(" +
                      whitespace +
                      "|$)",
                  )) &&
                    classCache(className, function (elem) {
                      return pattern.test(
                        (typeof elem.className === "string" &&
                          elem.className) ||
                          (typeof elem.getAttribute !== strundefined &&
                            elem.getAttribute("class")) ||
                          "",
                      );
                    }))
                );
              },

              ATTR: function (name, operator, check) {
                return function (elem) {
                  var result = Sizzle.attr(elem, name);

                  if (result == null) {
                    return operator === "!=";
                  }
                  if (!operator) {
                    return true;
                  }

                  result += "";

                  return operator === "="
                    ? result === check
                    : operator === "!="
                      ? result !== check
                      : operator === "^="
                        ? check && result.indexOf(check) === 0
                        : operator === "*="
                          ? check && result.indexOf(check) > -1
                          : operator === "$="
                            ? check && result.slice(-check.length) === check
                            : operator === "~="
                              ? (" " + result + " ").indexOf(check) > -1
                              : operator === "|="
                                ? result === check ||
                                  result.slice(0, check.length + 1) ===
                                    check + "-"
                                : false;
                };
              },

              CHILD: function (type, what, argument, first, last) {
                var simple = type.slice(0, 3) !== "nth",
                  forward = type.slice(-4) !== "last",
                  ofType = what === "of-type";

                return first === 1 && last === 0
                  ? // Shortcut for :nth-*(n)
                    function (elem) {
                      return !!elem.parentNode;
                    }
                  : function (elem, context, xml) {
                      var cache,
                        outerCache,
                        node,
                        diff,
                        nodeIndex,
                        start,
                        dir =
                          simple !== forward
                            ? "nextSibling"
                            : "previousSibling",
                        parent = elem.parentNode,
                        name = ofType && elem.nodeName.toLowerCase(),
                        useCache = !xml && !ofType;

                      if (parent) {
                        // :(first|last|only)-(child|of-type)
                        if (simple) {
                          while (dir) {
                            node = elem;
                            while ((node = node[dir])) {
                              if (
                                ofType
                                  ? node.nodeName.toLowerCase() === name
                                  : node.nodeType === 1
                              ) {
                                return false;
                              }
                            }
                            // Reverse direction for :only-* (if we haven't yet done so)
                            start = dir =
                              type === "only" && !start && "nextSibling";
                          }
                          return true;
                        }

                        start = [
                          forward ? parent.firstChild : parent.lastChild,
                        ];

                        // non-xml :nth-child(...) stores cache data on `parent`
                        if (forward && useCache) {
                          // Seek `elem` from a previously-cached index
                          outerCache =
                            parent[expando] || (parent[expando] = {});
                          cache = outerCache[type] || [];
                          nodeIndex = cache[0] === dirruns && cache[1];
                          diff = cache[0] === dirruns && cache[2];
                          node = nodeIndex && parent.childNodes[nodeIndex];

                          while (
                            (node =
                              (++nodeIndex && node && node[dir]) ||
                              // Fallback to seeking `elem` from the start
                              (diff = nodeIndex = 0) ||
                              start.pop())
                          ) {
                            // When found, cache indexes on `parent` and break
                            if (
                              node.nodeType === 1 &&
                              ++diff &&
                              node === elem
                            ) {
                              outerCache[type] = [dirruns, nodeIndex, diff];
                              break;
                            }
                          }

                          // Use previously-cached element index if available
                        } else if (
                          useCache &&
                          (cache = (elem[expando] || (elem[expando] = {}))[
                            type
                          ]) &&
                          cache[0] === dirruns
                        ) {
                          diff = cache[1];

                          // xml :nth-child(...) or :nth-last-child(...) or :nth(-last)?-of-type(...)
                        } else {
                          // Use the same loop as above to seek `elem` from the start
                          while (
                            (node =
                              (++nodeIndex && node && node[dir]) ||
                              (diff = nodeIndex = 0) ||
                              start.pop())
                          ) {
                            if (
                              (ofType
                                ? node.nodeName.toLowerCase() === name
                                : node.nodeType === 1) &&
                              ++diff
                            ) {
                              // Cache the index of each encountered element
                              if (useCache) {
                                (node[expando] || (node[expando] = {}))[type] =
                                  [dirruns, diff];
                              }

                              if (node === elem) {
                                break;
                              }
                            }
                          }
                        }

                        // Incorporate the offset, then check against cycle size
                        diff -= last;
                        return (
                          diff === first ||
                          (diff % first === 0 && diff / first >= 0)
                        );
                      }
                    };
              },

              PSEUDO: function (pseudo, argument) {
                // pseudo-class names are case-insensitive
                // http://www.w3.org/TR/selectors/#pseudo-classes
                // Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
                // Remember that setFilters inherits from pseudos
                var args,
                  fn =
                    Expr.pseudos[pseudo] ||
                    Expr.setFilters[pseudo.toLowerCase()] ||
                    Sizzle.error("unsupported pseudo: " + pseudo);

                // The user may use createPseudo to indicate that
                // arguments are needed to create the filter function
                // just as Sizzle does
                if (fn[expando]) {
                  return fn(argument);
                }

                // But maintain support for old signatures
                if (fn.length > 1) {
                  args = [pseudo, pseudo, "", argument];
                  return Expr.setFilters.hasOwnProperty(pseudo.toLowerCase())
                    ? markFunction(function (seed, matches) {
                        var idx,
                          matched = fn(seed, argument),
                          i = matched.length;
                        while (i--) {
                          idx = indexOf.call(seed, matched[i]);
                          seed[idx] = !(matches[idx] = matched[i]);
                        }
                      })
                    : function (elem) {
                        return fn(elem, 0, args);
                      };
                }

                return fn;
              },
            },

            pseudos: {
              // Potentially complex pseudos
              not: markFunction(function (selector) {
                // Trim the selector passed to compile
                // to avoid treating leading and trailing
                // spaces as combinators
                var input = [],
                  results = [],
                  matcher = compile(selector.replace(rtrim, "$1"));

                return matcher[expando]
                  ? markFunction(function (seed, matches, context, xml) {
                      var elem,
                        unmatched = matcher(seed, null, xml, []),
                        i = seed.length;

                      // Match elements unmatched by `matcher`
                      while (i--) {
                        if ((elem = unmatched[i])) {
                          seed[i] = !(matches[i] = elem);
                        }
                      }
                    })
                  : function (elem, context, xml) {
                      input[0] = elem;
                      matcher(input, null, xml, results);
                      return !results.pop();
                    };
              }),

              has: markFunction(function (selector) {
                return function (elem) {
                  return Sizzle(selector, elem).length > 0;
                };
              }),

              contains: markFunction(function (text) {
                return function (elem) {
                  return (
                    (
                      elem.textContent ||
                      elem.innerText ||
                      getText(elem)
                    ).indexOf(text) > -1
                  );
                };
              }),

              // "Whether an element is represented by a :lang() selector
              // is based solely on the element's language value
              // being equal to the identifier C,
              // or beginning with the identifier C immediately followed by "-".
              // The matching of C against the element's language value is performed case-insensitively.
              // The identifier C does not have to be a valid language name."
              // http://www.w3.org/TR/selectors/#lang-pseudo
              lang: markFunction(function (lang) {
                // lang value must be a valid identifier
                if (!ridentifier.test(lang || "")) {
                  Sizzle.error("unsupported lang: " + lang);
                }
                lang = lang.replace(runescape, funescape).toLowerCase();
                return function (elem) {
                  var elemLang;
                  do {
                    if (
                      (elemLang = documentIsHTML
                        ? elem.lang
                        : elem.getAttribute("xml:lang") ||
                          elem.getAttribute("lang"))
                    ) {
                      elemLang = elemLang.toLowerCase();
                      return (
                        elemLang === lang || elemLang.indexOf(lang + "-") === 0
                      );
                    }
                  } while ((elem = elem.parentNode) && elem.nodeType === 1);
                  return false;
                };
              }),

              // Miscellaneous
              target: function (elem) {
                var hash = window.location && window.location.hash;
                return hash && hash.slice(1) === elem.id;
              },

              root: function (elem) {
                return elem === docElem;
              },

              focus: function (elem) {
                return (
                  elem === document.activeElement &&
                  (!document.hasFocus || document.hasFocus()) &&
                  !!(elem.type || elem.href || ~elem.tabIndex)
                );
              },

              // Boolean properties
              enabled: function (elem) {
                return elem.disabled === false;
              },

              disabled: function (elem) {
                return elem.disabled === true;
              },

              checked: function (elem) {
                // In CSS3, :checked should return both checked and selected elements
                // http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
                var nodeName = elem.nodeName.toLowerCase();
                return (
                  (nodeName === "input" && !!elem.checked) ||
                  (nodeName === "option" && !!elem.selected)
                );
              },

              selected: function (elem) {
                // Accessing this property makes selected-by-default
                // options in Safari work properly
                if (elem.parentNode) {
                  elem.parentNode.selectedIndex;
                }

                return elem.selected === true;
              },

              // Contents
              empty: function (elem) {
                // http://www.w3.org/TR/selectors/#empty-pseudo
                // :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
                //   but not by others (comment: 8; processing instruction: 7; etc.)
                // nodeType < 6 works because attributes (2) do not appear as children
                for (elem = elem.firstChild; elem; elem = elem.nextSibling) {
                  if (elem.nodeType < 6) {
                    return false;
                  }
                }
                return true;
              },

              parent: function (elem) {
                return !Expr.pseudos["empty"](elem);
              },

              // Element/input types
              header: function (elem) {
                return rheader.test(elem.nodeName);
              },

              input: function (elem) {
                return rinputs.test(elem.nodeName);
              },

              button: function (elem) {
                var name = elem.nodeName.toLowerCase();
                return (
                  (name === "input" && elem.type === "button") ||
                  name === "button"
                );
              },

              text: function (elem) {
                var attr;
                return (
                  elem.nodeName.toLowerCase() === "input" &&
                  elem.type === "text" &&
                  // Support: IE<8
                  // New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
                  ((attr = elem.getAttribute("type")) == null ||
                    attr.toLowerCase() === "text")
                );
              },

              // Position-in-collection
              first: createPositionalPseudo(function () {
                return [0];
              }),

              last: createPositionalPseudo(function (matchIndexes, length) {
                return [length - 1];
              }),

              eq: createPositionalPseudo(
                function (matchIndexes, length, argument) {
                  return [argument < 0 ? argument + length : argument];
                },
              ),

              even: createPositionalPseudo(function (matchIndexes, length) {
                var i = 0;
                for (; i < length; i += 2) {
                  matchIndexes.push(i);
                }
                return matchIndexes;
              }),

              odd: createPositionalPseudo(function (matchIndexes, length) {
                var i = 1;
                for (; i < length; i += 2) {
                  matchIndexes.push(i);
                }
                return matchIndexes;
              }),

              lt: createPositionalPseudo(
                function (matchIndexes, length, argument) {
                  var i = argument < 0 ? argument + length : argument;
                  for (; --i >= 0; ) {
                    matchIndexes.push(i);
                  }
                  return matchIndexes;
                },
              ),

              gt: createPositionalPseudo(
                function (matchIndexes, length, argument) {
                  var i = argument < 0 ? argument + length : argument;
                  for (; ++i < length; ) {
                    matchIndexes.push(i);
                  }
                  return matchIndexes;
                },
              ),
            },
          };

          Expr.pseudos["nth"] = Expr.pseudos["eq"];

          // Add button/input type pseudos
          for (i in {
            radio: true,
            checkbox: true,
            file: true,
            password: true,
            image: true,
          }) {
            Expr.pseudos[i] = createInputPseudo(i);
          }
          for (i in { submit: true, reset: true }) {
            Expr.pseudos[i] = createButtonPseudo(i);
          }

          // Easy API for creating new setFilters
          function setFilters() {}
          setFilters.prototype = Expr.filters = Expr.pseudos;
          Expr.setFilters = new setFilters();

          function tokenize(selector, parseOnly) {
            var matched,
              match,
              tokens,
              type,
              soFar,
              groups,
              preFilters,
              cached = tokenCache[selector + " "];

            if (cached) {
              return parseOnly ? 0 : cached.slice(0);
            }

            soFar = selector;
            groups = [];
            preFilters = Expr.preFilter;

            while (soFar) {
              // Comma and first run
              if (!matched || (match = rcomma.exec(soFar))) {
                if (match) {
                  // Don't consume trailing commas as valid
                  soFar = soFar.slice(match[0].length) || soFar;
                }
                groups.push((tokens = []));
              }

              matched = false;

              // Combinators
              if ((match = rcombinators.exec(soFar))) {
                matched = match.shift();
                tokens.push({
                  value: matched,
                  // Cast descendant combinators to space
                  type: match[0].replace(rtrim, " "),
                });
                soFar = soFar.slice(matched.length);
              }

              // Filters
              for (type in Expr.filter) {
                if (
                  (match = matchExpr[type].exec(soFar)) &&
                  (!preFilters[type] || (match = preFilters[type](match)))
                ) {
                  matched = match.shift();
                  tokens.push({
                    value: matched,
                    type: type,
                    matches: match,
                  });
                  soFar = soFar.slice(matched.length);
                }
              }

              if (!matched) {
                break;
              }
            }

            // Return the length of the invalid excess
            // if we're just parsing
            // Otherwise, throw an error or return tokens
            return parseOnly
              ? soFar.length
              : soFar
                ? Sizzle.error(selector)
                : // Cache the tokens
                  tokenCache(selector, groups).slice(0);
          }

          function toSelector(tokens) {
            var i = 0,
              len = tokens.length,
              selector = "";
            for (; i < len; i++) {
              selector += tokens[i].value;
            }
            return selector;
          }

          function addCombinator(matcher, combinator, base) {
            var dir = combinator.dir,
              checkNonElements = base && dir === "parentNode",
              doneName = done++;

            return combinator.first
              ? // Check against closest ancestor/preceding element
                function (elem, context, xml) {
                  while ((elem = elem[dir])) {
                    if (elem.nodeType === 1 || checkNonElements) {
                      return matcher(elem, context, xml);
                    }
                  }
                }
              : // Check against all ancestor/preceding elements
                function (elem, context, xml) {
                  var oldCache,
                    outerCache,
                    newCache = [dirruns, doneName];

                  // We can't set arbitrary data on XML nodes, so they don't benefit from dir caching
                  if (xml) {
                    while ((elem = elem[dir])) {
                      if (elem.nodeType === 1 || checkNonElements) {
                        if (matcher(elem, context, xml)) {
                          return true;
                        }
                      }
                    }
                  } else {
                    while ((elem = elem[dir])) {
                      if (elem.nodeType === 1 || checkNonElements) {
                        outerCache = elem[expando] || (elem[expando] = {});
                        if (
                          (oldCache = outerCache[dir]) &&
                          oldCache[0] === dirruns &&
                          oldCache[1] === doneName
                        ) {
                          // Assign to newCache so results back-propagate to previous elements
                          return (newCache[2] = oldCache[2]);
                        } else {
                          // Reuse newcache so results back-propagate to previous elements
                          outerCache[dir] = newCache;

                          // A match means we're done; a fail means we have to keep checking
                          if ((newCache[2] = matcher(elem, context, xml))) {
                            return true;
                          }
                        }
                      }
                    }
                  }
                };
          }

          function elementMatcher(matchers) {
            return matchers.length > 1
              ? function (elem, context, xml) {
                  var i = matchers.length;
                  while (i--) {
                    if (!matchers[i](elem, context, xml)) {
                      return false;
                    }
                  }
                  return true;
                }
              : matchers[0];
          }

          function condense(unmatched, map, filter, context, xml) {
            var elem,
              newUnmatched = [],
              i = 0,
              len = unmatched.length,
              mapped = map != null;

            for (; i < len; i++) {
              if ((elem = unmatched[i])) {
                if (!filter || filter(elem, context, xml)) {
                  newUnmatched.push(elem);
                  if (mapped) {
                    map.push(i);
                  }
                }
              }
            }

            return newUnmatched;
          }

          function setMatcher(
            preFilter,
            selector,
            matcher,
            postFilter,
            postFinder,
            postSelector,
          ) {
            if (postFilter && !postFilter[expando]) {
              postFilter = setMatcher(postFilter);
            }
            if (postFinder && !postFinder[expando]) {
              postFinder = setMatcher(postFinder, postSelector);
            }
            return markFunction(function (seed, results, context, xml) {
              var temp,
                i,
                elem,
                preMap = [],
                postMap = [],
                preexisting = results.length,
                // Get initial elements from seed or context
                elems =
                  seed ||
                  multipleContexts(
                    selector || "*",
                    context.nodeType ? [context] : context,
                    [],
                  ),
                // Prefilter to get matcher input, preserving a map for seed-results synchronization
                matcherIn =
                  preFilter && (seed || !selector)
                    ? condense(elems, preMap, preFilter, context, xml)
                    : elems,
                matcherOut = matcher
                  ? // If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
                    postFinder || (seed ? preFilter : preexisting || postFilter)
                    ? // ...intermediate processing is necessary
                      []
                    : // ...otherwise use results directly
                      results
                  : matcherIn;

              // Find primary matches
              if (matcher) {
                matcher(matcherIn, matcherOut, context, xml);
              }

              // Apply postFilter
              if (postFilter) {
                temp = condense(matcherOut, postMap);
                postFilter(temp, [], context, xml);

                // Un-match failing elements by moving them back to matcherIn
                i = temp.length;
                while (i--) {
                  if ((elem = temp[i])) {
                    matcherOut[postMap[i]] = !(matcherIn[postMap[i]] = elem);
                  }
                }
              }

              if (seed) {
                if (postFinder || preFilter) {
                  if (postFinder) {
                    // Get the final matcherOut by condensing this intermediate into postFinder contexts
                    temp = [];
                    i = matcherOut.length;
                    while (i--) {
                      if ((elem = matcherOut[i])) {
                        // Restore matcherIn since elem is not yet a final match
                        temp.push((matcherIn[i] = elem));
                      }
                    }
                    postFinder(null, (matcherOut = []), temp, xml);
                  }

                  // Move matched elements from seed to results to keep them synchronized
                  i = matcherOut.length;
                  while (i--) {
                    if (
                      (elem = matcherOut[i]) &&
                      (temp = postFinder
                        ? indexOf.call(seed, elem)
                        : preMap[i]) > -1
                    ) {
                      seed[temp] = !(results[temp] = elem);
                    }
                  }
                }

                // Add elements to results, through postFinder if defined
              } else {
                matcherOut = condense(
                  matcherOut === results
                    ? matcherOut.splice(preexisting, matcherOut.length)
                    : matcherOut,
                );
                if (postFinder) {
                  postFinder(null, results, matcherOut, xml);
                } else {
                  push.apply(results, matcherOut);
                }
              }
            });
          }

          function matcherFromTokens(tokens) {
            var checkContext,
              matcher,
              j,
              len = tokens.length,
              leadingRelative = Expr.relative[tokens[0].type],
              implicitRelative = leadingRelative || Expr.relative[" "],
              i = leadingRelative ? 1 : 0,
              // The foundational matcher ensures that elements are reachable from top-level context(s)
              matchContext = addCombinator(
                function (elem) {
                  return elem === checkContext;
                },
                implicitRelative,
                true,
              ),
              matchAnyContext = addCombinator(
                function (elem) {
                  return indexOf.call(checkContext, elem) > -1;
                },
                implicitRelative,
                true,
              ),
              matchers = [
                function (elem, context, xml) {
                  return (
                    (!leadingRelative &&
                      (xml || context !== outermostContext)) ||
                    ((checkContext = context).nodeType
                      ? matchContext(elem, context, xml)
                      : matchAnyContext(elem, context, xml))
                  );
                },
              ];

            for (; i < len; i++) {
              if ((matcher = Expr.relative[tokens[i].type])) {
                matchers = [addCombinator(elementMatcher(matchers), matcher)];
              } else {
                matcher = Expr.filter[tokens[i].type].apply(
                  null,
                  tokens[i].matches,
                );

                // Return special upon seeing a positional matcher
                if (matcher[expando]) {
                  // Find the next relative operator (if any) for proper handling
                  j = ++i;
                  for (; j < len; j++) {
                    if (Expr.relative[tokens[j].type]) {
                      break;
                    }
                  }
                  return setMatcher(
                    i > 1 && elementMatcher(matchers),
                    i > 1 &&
                      toSelector(
                        // If the preceding token was a descendant combinator, insert an implicit any-element `*`
                        tokens.slice(0, i - 1).concat({
                          value: tokens[i - 2].type === " " ? "*" : "",
                        }),
                      ).replace(rtrim, "$1"),
                    matcher,
                    i < j && matcherFromTokens(tokens.slice(i, j)),
                    j < len && matcherFromTokens((tokens = tokens.slice(j))),
                    j < len && toSelector(tokens),
                  );
                }
                matchers.push(matcher);
              }
            }

            return elementMatcher(matchers);
          }

          function matcherFromGroupMatchers(elementMatchers, setMatchers) {
            var bySet = setMatchers.length > 0,
              byElement = elementMatchers.length > 0,
              superMatcher = function (seed, context, xml, results, outermost) {
                var elem,
                  j,
                  matcher,
                  matchedCount = 0,
                  i = "0",
                  unmatched = seed && [],
                  setMatched = [],
                  contextBackup = outermostContext,
                  // We must always have either seed elements or outermost context
                  elems =
                    seed || (byElement && Expr.find["TAG"]("*", outermost)),
                  // Use integer dirruns iff this is the outermost matcher
                  dirrunsUnique = (dirruns +=
                    contextBackup == null ? 1 : Math.random() || 0.1),
                  len = elems.length;

                if (outermost) {
                  outermostContext = context !== document && context;
                }

                // Add elements passing elementMatchers directly to results
                // Keep `i` a string if there are no elements so `matchedCount` will be "00" below
                // Support: IE<9, Safari
                // Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
                for (; i !== len && (elem = elems[i]) != null; i++) {
                  if (byElement && elem) {
                    j = 0;
                    while ((matcher = elementMatchers[j++])) {
                      if (matcher(elem, context, xml)) {
                        results.push(elem);
                        break;
                      }
                    }
                    if (outermost) {
                      dirruns = dirrunsUnique;
                    }
                  }

                  // Track unmatched elements for set filters
                  if (bySet) {
                    // They will have gone through all possible matchers
                    if ((elem = !matcher && elem)) {
                      matchedCount--;
                    }

                    // Lengthen the array for every element, matched or not
                    if (seed) {
                      unmatched.push(elem);
                    }
                  }
                }

                // Apply set filters to unmatched elements
                matchedCount += i;
                if (bySet && i !== matchedCount) {
                  j = 0;
                  while ((matcher = setMatchers[j++])) {
                    matcher(unmatched, setMatched, context, xml);
                  }

                  if (seed) {
                    // Reintegrate element matches to eliminate the need for sorting
                    if (matchedCount > 0) {
                      while (i--) {
                        if (!(unmatched[i] || setMatched[i])) {
                          setMatched[i] = pop.call(results);
                        }
                      }
                    }

                    // Discard index placeholder values to get only actual matches
                    setMatched = condense(setMatched);
                  }

                  // Add matches to results
                  push.apply(results, setMatched);

                  // Seedless set matches succeeding multiple successful matchers stipulate sorting
                  if (
                    outermost &&
                    !seed &&
                    setMatched.length > 0 &&
                    matchedCount + setMatchers.length > 1
                  ) {
                    Sizzle.uniqueSort(results);
                  }
                }

                // Override manipulation of globals by nested matchers
                if (outermost) {
                  dirruns = dirrunsUnique;
                  outermostContext = contextBackup;
                }

                return unmatched;
              };

            return bySet ? markFunction(superMatcher) : superMatcher;
          }

          compile = Sizzle.compile = function (
            selector,
            group /* Internal Use Only */,
          ) {
            var i,
              setMatchers = [],
              elementMatchers = [],
              cached = compilerCache[selector + " "];

            if (!cached) {
              // Generate a function of recursive functions that can be used to check each element
              if (!group) {
                group = tokenize(selector);
              }
              i = group.length;
              while (i--) {
                cached = matcherFromTokens(group[i]);
                if (cached[expando]) {
                  setMatchers.push(cached);
                } else {
                  elementMatchers.push(cached);
                }
              }

              // Cache the compiled function
              cached = compilerCache(
                selector,
                matcherFromGroupMatchers(elementMatchers, setMatchers),
              );
            }
            return cached;
          };

          function multipleContexts(selector, contexts, results) {
            var i = 0,
              len = contexts.length;
            for (; i < len; i++) {
              Sizzle(selector, contexts[i], results);
            }
            return results;
          }

          function select(selector, context, results, seed) {
            var i,
              tokens,
              token,
              type,
              find,
              match = tokenize(selector);

            if (!seed) {
              // Try to minimize operations if there is only one group
              if (match.length === 1) {
                // Take a shortcut and set the context if the root selector is an ID
                tokens = match[0] = match[0].slice(0);
                if (
                  tokens.length > 2 &&
                  (token = tokens[0]).type === "ID" &&
                  support.getById &&
                  context.nodeType === 9 &&
                  documentIsHTML &&
                  Expr.relative[tokens[1].type]
                ) {
                  context = (Expr.find["ID"](
                    token.matches[0].replace(runescape, funescape),
                    context,
                  ) || [])[0];
                  if (!context) {
                    return results;
                  }
                  selector = selector.slice(tokens.shift().value.length);
                }

                // Fetch a seed set for right-to-left matching
                i = matchExpr["needsContext"].test(selector)
                  ? 0
                  : tokens.length;
                while (i--) {
                  token = tokens[i];

                  // Abort if we hit a combinator
                  if (Expr.relative[(type = token.type)]) {
                    break;
                  }
                  if ((find = Expr.find[type])) {
                    // Search, expanding context for leading sibling combinators
                    if (
                      (seed = find(
                        token.matches[0].replace(runescape, funescape),
                        (rsibling.test(tokens[0].type) &&
                          testContext(context.parentNode)) ||
                          context,
                      ))
                    ) {
                      // If seed is empty or no tokens remain, we can return early
                      tokens.splice(i, 1);
                      selector = seed.length && toSelector(tokens);
                      if (!selector) {
                        push.apply(results, seed);
                        return results;
                      }

                      break;
                    }
                  }
                }
              }
            }

            // Compile and execute a filtering function
            // Provide `match` to avoid retokenization if we modified the selector above
            compile(selector, match)(
              seed,
              context,
              !documentIsHTML,
              results,
              (rsibling.test(selector) && testContext(context.parentNode)) ||
                context,
            );
            return results;
          }

          // One-time assignments

          // Sort stability
          support.sortStable =
            expando.split("").sort(sortOrder).join("") === expando;

          // Support: Chrome<14
          // Always assume duplicates if they aren't passed to the comparison function
          support.detectDuplicates = !!hasDuplicate;

          // Initialize against the default document
          setDocument();

          // Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
          // Detached nodes confoundingly follow *each other*
          support.sortDetached = assert(function (div1) {
            // Should return 1, but returns 4 (following)
            return (
              div1.compareDocumentPosition(document.createElement("div")) & 1
            );
          });

          // Support: IE<8
          // Prevent attribute/property "interpolation"
          // http://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
          if (
            !assert(function (div) {
              div.innerHTML = "<a href='#'></a>";
              return div.firstChild.getAttribute("href") === "#";
            })
          ) {
            addHandle("type|href|height|width", function (elem, name, isXML) {
              if (!isXML) {
                return elem.getAttribute(
                  name,
                  name.toLowerCase() === "type" ? 1 : 2,
                );
              }
            });
          }

          // Support: IE<9
          // Use defaultValue in place of getAttribute("value")
          if (
            !support.attributes ||
            !assert(function (div) {
              div.innerHTML = "<input/>";
              div.firstChild.setAttribute("value", "");
              return div.firstChild.getAttribute("value") === "";
            })
          ) {
            addHandle("value", function (elem, name, isXML) {
              if (!isXML && elem.nodeName.toLowerCase() === "input") {
                return elem.defaultValue;
              }
            });
          }

          // Support: IE<9
          // Use getAttributeNode to fetch booleans when getAttribute lies
          if (
            !assert(function (div) {
              return div.getAttribute("disabled") == null;
            })
          ) {
            addHandle(booleans, function (elem, name, isXML) {
              var val;
              if (!isXML) {
                return elem[name] === true
                  ? name.toLowerCase()
                  : (val = elem.getAttributeNode(name)) && val.specified
                    ? val.value
                    : null;
              }
            });
          }

          return Sizzle;
        })(window);

      jQuery.find = Sizzle;
      jQuery.expr = Sizzle.selectors;
      jQuery.expr[":"] = jQuery.expr.pseudos;
      jQuery.unique = Sizzle.uniqueSort;
      jQuery.text = Sizzle.getText;
      jQuery.isXMLDoc = Sizzle.isXML;
      jQuery.contains = Sizzle.contains;

      var rneedsContext = jQuery.expr.match.needsContext;

      var rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>|)$/;

      var risSimple = /^.[^:#\[\.,]*$/;

      // Implement the identical functionality for filter and not
      function winnow(elements, qualifier, not) {
        if (jQuery.isFunction(qualifier)) {
          return jQuery.grep(elements, function (elem, i) {
            /* jshint -W018 */
            return !!qualifier.call(elem, i, elem) !== not;
          });
        }

        if (qualifier.nodeType) {
          return jQuery.grep(elements, function (elem) {
            return (elem === qualifier) !== not;
          });
        }

        if (typeof qualifier === "string") {
          if (risSimple.test(qualifier)) {
            return jQuery.filter(qualifier, elements, not);
          }

          qualifier = jQuery.filter(qualifier, elements);
        }

        return jQuery.grep(elements, function (elem) {
          return indexOf.call(qualifier, elem) >= 0 !== not;
        });
      }

      jQuery.filter = function (expr, elems, not) {
        var elem = elems[0];

        if (not) {
          expr = ":not(" + expr + ")";
        }

        return elems.length === 1 && elem.nodeType === 1
          ? jQuery.find.matchesSelector(elem, expr)
            ? [elem]
            : []
          : jQuery.find.matches(
              expr,
              jQuery.grep(elems, function (elem) {
                return elem.nodeType === 1;
              }),
            );
      };

      jQuery.fn.extend({
        find: function (selector) {
          var i,
            len = this.length,
            ret = [],
            self = this;

          if (typeof selector !== "string") {
            return this.pushStack(
              jQuery(selector).filter(function () {
                for (i = 0; i < len; i++) {
                  if (jQuery.contains(self[i], this)) {
                    return true;
                  }
                }
              }),
            );
          }

          for (i = 0; i < len; i++) {
            jQuery.find(selector, self[i], ret);
          }

          // Needed because $( selector, context ) becomes $( context ).find( selector )
          ret = this.pushStack(len > 1 ? jQuery.unique(ret) : ret);
          ret.selector = this.selector
            ? this.selector + " " + selector
            : selector;
          return ret;
        },
        filter: function (selector) {
          return this.pushStack(winnow(this, selector || [], false));
        },
        not: function (selector) {
          return this.pushStack(winnow(this, selector || [], true));
        },
        is: function (selector) {
          return !!winnow(
            this,

            // If this is a positional/relative selector, check membership in the returned set
            // so $("p:first").is("p:last") won't return true for a doc with two "p".
            typeof selector === "string" && rneedsContext.test(selector)
              ? jQuery(selector)
              : selector || [],
            false,
          ).length;
        },
      });

      // Initialize a jQuery object

      // A central reference to the root jQuery(document)
      var rootjQuery,
        // A simple way to check for HTML strings
        // Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
        // Strict HTML recognition (#11290: must start with <)
        rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,
        init = (jQuery.fn.init = function (selector, context) {
          var match, elem;

          // HANDLE: $(""), $(null), $(undefined), $(false)
          if (!selector) {
            return this;
          }

          // Handle HTML strings
          if (typeof selector === "string") {
            if (
              selector[0] === "<" &&
              selector[selector.length - 1] === ">" &&
              selector.length >= 3
            ) {
              // Assume that strings that start and end with <> are HTML and skip the regex check
              match = [null, selector, null];
            } else {
              match = rquickExpr.exec(selector);
            }

            // Match html or make sure no context is specified for #id
            if (match && (match[1] || !context)) {
              // HANDLE: $(html) -> $(array)
              if (match[1]) {
                context = context instanceof jQuery ? context[0] : context;

                // scripts is true for back-compat
                // Intentionally let the error be thrown if parseHTML is not present
                jQuery.merge(
                  this,
                  jQuery.parseHTML(
                    match[1],
                    context && context.nodeType
                      ? context.ownerDocument || context
                      : document,
                    true,
                  ),
                );

                // HANDLE: $(html, props)
                if (
                  rsingleTag.test(match[1]) &&
                  jQuery.isPlainObject(context)
                ) {
                  for (match in context) {
                    // Properties of context are called as methods if possible
                    if (jQuery.isFunction(this[match])) {
                      this[match](context[match]);

                      // ...and otherwise set as attributes
                    } else {
                      this.attr(match, context[match]);
                    }
                  }
                }

                return this;

                // HANDLE: $(#id)
              } else {
                elem = document.getElementById(match[2]);

                // Check parentNode to catch when Blackberry 4.6 returns
                // nodes that are no longer in the document #6963
                if (elem && elem.parentNode) {
                  // Inject the element directly into the jQuery object
                  this.length = 1;
                  this[0] = elem;
                }

                this.context = document;
                this.selector = selector;
                return this;
              }

              // HANDLE: $(expr, $(...))
            } else if (!context || context.jquery) {
              return (context || rootjQuery).find(selector);

              // HANDLE: $(expr, context)
              // (which is just equivalent to: $(context).find(expr)
            } else {
              return this.constructor(context).find(selector);
            }

            // HANDLE: $(DOMElement)
          } else if (selector.nodeType) {
            this.context = this[0] = selector;
            this.length = 1;
            return this;

            // HANDLE: $(function)
            // Shortcut for document ready
          } else if (jQuery.isFunction(selector)) {
            return typeof rootjQuery.ready !== "undefined"
              ? rootjQuery.ready(selector)
              : // Execute immediately if ready is not present
                selector(jQuery);
          }

          if (selector.selector !== undefined) {
            this.selector = selector.selector;
            this.context = selector.context;
          }

          return jQuery.makeArray(selector, this);
        });

      // Give the init function the jQuery prototype for later instantiation
      init.prototype = jQuery.fn;

      // Initialize central reference
      rootjQuery = jQuery(document);

      var rparentsprev = /^(?:parents|prev(?:Until|All))/,
        // methods guaranteed to produce a unique set when starting from a unique set
        guaranteedUnique = {
          children: true,
          contents: true,
          next: true,
          prev: true,
        };

      jQuery.extend({
        dir: function (elem, dir, until) {
          var matched = [],
            truncate = until !== undefined;

          while ((elem = elem[dir]) && elem.nodeType !== 9) {
            if (elem.nodeType === 1) {
              if (truncate && jQuery(elem).is(until)) {
                break;
              }
              matched.push(elem);
            }
          }
          return matched;
        },

        sibling: function (n, elem) {
          var matched = [];

          for (; n; n = n.nextSibling) {
            if (n.nodeType === 1 && n !== elem) {
              matched.push(n);
            }
          }

          return matched;
        },
      });

      jQuery.fn.extend({
        has: function (target) {
          var targets = jQuery(target, this),
            l = targets.length;

          return this.filter(function () {
            var i = 0;
            for (; i < l; i++) {
              if (jQuery.contains(this, targets[i])) {
                return true;
              }
            }
          });
        },

        closest: function (selectors, context) {
          var cur,
            i = 0,
            l = this.length,
            matched = [],
            pos =
              rneedsContext.test(selectors) || typeof selectors !== "string"
                ? jQuery(selectors, context || this.context)
                : 0;

          for (; i < l; i++) {
            for (cur = this[i]; cur && cur !== context; cur = cur.parentNode) {
              // Always skip document fragments
              if (
                cur.nodeType < 11 &&
                (pos
                  ? pos.index(cur) > -1
                  : // Don't pass non-elements to Sizzle
                    cur.nodeType === 1 &&
                    jQuery.find.matchesSelector(cur, selectors))
              ) {
                matched.push(cur);
                break;
              }
            }
          }

          return this.pushStack(
            matched.length > 1 ? jQuery.unique(matched) : matched,
          );
        },

        // Determine the position of an element within
        // the matched set of elements
        index: function (elem) {
          // No argument, return index in parent
          if (!elem) {
            return this[0] && this[0].parentNode
              ? this.first().prevAll().length
              : -1;
          }

          // index in selector
          if (typeof elem === "string") {
            return indexOf.call(jQuery(elem), this[0]);
          }

          // Locate the position of the desired element
          return indexOf.call(
            this,

            // If it receives a jQuery object, the first element is used
            elem.jquery ? elem[0] : elem,
          );
        },

        add: function (selector, context) {
          return this.pushStack(
            jQuery.unique(jQuery.merge(this.get(), jQuery(selector, context))),
          );
        },

        addBack: function (selector) {
          return this.add(
            selector == null
              ? this.prevObject
              : this.prevObject.filter(selector),
          );
        },
      });

      function sibling(cur, dir) {
        while ((cur = cur[dir]) && cur.nodeType !== 1) {}
        return cur;
      }

      jQuery.each(
        {
          parent: function (elem) {
            var parent = elem.parentNode;
            return parent && parent.nodeType !== 11 ? parent : null;
          },
          parents: function (elem) {
            return jQuery.dir(elem, "parentNode");
          },
          parentsUntil: function (elem, i, until) {
            return jQuery.dir(elem, "parentNode", until);
          },
          next: function (elem) {
            return sibling(elem, "nextSibling");
          },
          prev: function (elem) {
            return sibling(elem, "previousSibling");
          },
          nextAll: function (elem) {
            return jQuery.dir(elem, "nextSibling");
          },
          prevAll: function (elem) {
            return jQuery.dir(elem, "previousSibling");
          },
          nextUntil: function (elem, i, until) {
            return jQuery.dir(elem, "nextSibling", until);
          },
          prevUntil: function (elem, i, until) {
            return jQuery.dir(elem, "previousSibling", until);
          },
          siblings: function (elem) {
            return jQuery.sibling((elem.parentNode || {}).firstChild, elem);
          },
          children: function (elem) {
            return jQuery.sibling(elem.firstChild);
          },
          contents: function (elem) {
            return elem.contentDocument || jQuery.merge([], elem.childNodes);
          },
        },
        function (name, fn) {
          jQuery.fn[name] = function (until, selector) {
            var matched = jQuery.map(this, fn, until);

            if (name.slice(-5) !== "Until") {
              selector = until;
            }

            if (selector && typeof selector === "string") {
              matched = jQuery.filter(selector, matched);
            }

            if (this.length > 1) {
              // Remove duplicates
              if (!guaranteedUnique[name]) {
                jQuery.unique(matched);
              }

              // Reverse order for parents* and prev-derivatives
              if (rparentsprev.test(name)) {
                matched.reverse();
              }
            }

            return this.pushStack(matched);
          };
        },
      );
      var rnotwhite = /\S+/g;

      // String to Object options format cache
      var optionsCache = {};

      // Convert String-formatted options into Object-formatted ones and store in cache
      function createOptions(options) {
        var object = (optionsCache[options] = {});
        jQuery.each(options.match(rnotwhite) || [], function (_, flag) {
          object[flag] = true;
        });
        return object;
      }

      /*
       * Create a callback list using the following parameters:
       *
       *	options: an optional list of space-separated options that will change how
       *			the callback list behaves or a more traditional option object
       *
       * By default a callback list will act like an event callback list and can be
       * "fired" multiple times.
       *
       * Possible options:
       *
       *	once:			will ensure the callback list can only be fired once (like a Deferred)
       *
       *	memory:			will keep track of previous values and will call any callback added
       *					after the list has been fired right away with the latest "memorized"
       *					values (like a Deferred)
       *
       *	unique:			will ensure a callback can only be added once (no duplicate in the list)
       *
       *	stopOnFalse:	interrupt callings when a callback returns false
       *
       */
      jQuery.Callbacks = function (options) {
        // Convert options from String-formatted to Object-formatted if needed
        // (we check in cache first)
        options =
          typeof options === "string"
            ? optionsCache[options] || createOptions(options)
            : jQuery.extend({}, options);

        var // Last fire value (for non-forgettable lists)
          memory,
          // Flag to know if list was already fired
          fired,
          // Flag to know if list is currently firing
          firing,
          // First callback to fire (used internally by add and fireWith)
          firingStart,
          // End of the loop when firing
          firingLength,
          // Index of currently firing callback (modified by remove if needed)
          firingIndex,
          // Actual callback list
          list = [],
          // Stack of fire calls for repeatable lists
          stack = !options.once && [],
          // Fire callbacks
          fire = function (data) {
            memory = options.memory && data;
            fired = true;
            firingIndex = firingStart || 0;
            firingStart = 0;
            firingLength = list.length;
            firing = true;
            for (; list && firingIndex < firingLength; firingIndex++) {
              if (
                list[firingIndex].apply(data[0], data[1]) === false &&
                options.stopOnFalse
              ) {
                memory = false; // To prevent further calls using add
                break;
              }
            }
            firing = false;
            if (list) {
              if (stack) {
                if (stack.length) {
                  fire(stack.shift());
                }
              } else if (memory) {
                list = [];
              } else {
                self.disable();
              }
            }
          },
          // Actual Callbacks object
          self = {
            // Add a callback or a collection of callbacks to the list
            add: function () {
              if (list) {
                // First, we save the current length
                var start = list.length;
                (function add(args) {
                  jQuery.each(args, function (_, arg) {
                    var type = jQuery.type(arg);
                    if (type === "function") {
                      if (!options.unique || !self.has(arg)) {
                        list.push(arg);
                      }
                    } else if (arg && arg.length && type !== "string") {
                      // Inspect recursively
                      add(arg);
                    }
                  });
                })(arguments);
                // Do we need to add the callbacks to the
                // current firing batch?
                if (firing) {
                  firingLength = list.length;
                  // With memory, if we're not firing then
                  // we should call right away
                } else if (memory) {
                  firingStart = start;
                  fire(memory);
                }
              }
              return this;
            },
            // Remove a callback from the list
            remove: function () {
              if (list) {
                jQuery.each(arguments, function (_, arg) {
                  var index;
                  while ((index = jQuery.inArray(arg, list, index)) > -1) {
                    list.splice(index, 1);
                    // Handle firing indexes
                    if (firing) {
                      if (index <= firingLength) {
                        firingLength--;
                      }
                      if (index <= firingIndex) {
                        firingIndex--;
                      }
                    }
                  }
                });
              }
              return this;
            },
            // Check if a given callback is in the list.
            // If no argument is given, return whether or not list has callbacks attached.
            has: function (fn) {
              return fn
                ? jQuery.inArray(fn, list) > -1
                : !!(list && list.length);
            },
            // Remove all callbacks from the list
            empty: function () {
              list = [];
              firingLength = 0;
              return this;
            },
            // Have the list do nothing anymore
            disable: function () {
              list = stack = memory = undefined;
              return this;
            },
            // Is it disabled?
            disabled: function () {
              return !list;
            },
            // Lock the list in its current state
            lock: function () {
              stack = undefined;
              if (!memory) {
                self.disable();
              }
              return this;
            },
            // Is it locked?
            locked: function () {
              return !stack;
            },
            // Call all callbacks with the given context and arguments
            fireWith: function (context, args) {
              if (list && (!fired || stack)) {
                args = args || [];
                args = [context, args.slice ? args.slice() : args];
                if (firing) {
                  stack.push(args);
                } else {
                  fire(args);
                }
              }
              return this;
            },
            // Call all the callbacks with the given arguments
            fire: function () {
              self.fireWith(this, arguments);
              return this;
            },
            // To know if the callbacks have already been called at least once
            fired: function () {
              return !!fired;
            },
          };

        return self;
      };

      jQuery.extend({
        Deferred: function (func) {
          var tuples = [
              // action, add listener, listener list, final state
              ["resolve", "done", jQuery.Callbacks("once memory"), "resolved"],
              ["reject", "fail", jQuery.Callbacks("once memory"), "rejected"],
              ["notify", "progress", jQuery.Callbacks("memory")],
            ],
            state = "pending",
            promise = {
              state: function () {
                return state;
              },
              always: function () {
                deferred.done(arguments).fail(arguments);
                return this;
              },
              then: function (/* fnDone, fnFail, fnProgress */) {
                var fns = arguments;
                return jQuery
                  .Deferred(function (newDefer) {
                    jQuery.each(tuples, function (i, tuple) {
                      var fn = jQuery.isFunction(fns[i]) && fns[i];
                      // deferred[ done | fail | progress ] for forwarding actions to newDefer
                      deferred[tuple[1]](function () {
                        var returned = fn && fn.apply(this, arguments);
                        if (returned && jQuery.isFunction(returned.promise)) {
                          returned
                            .promise()
                            .done(newDefer.resolve)
                            .fail(newDefer.reject)
                            .progress(newDefer.notify);
                        } else {
                          newDefer[tuple[0] + "With"](
                            this === promise ? newDefer.promise() : this,
                            fn ? [returned] : arguments,
                          );
                        }
                      });
                    });
                    fns = null;
                  })
                  .promise();
              },
              // Get a promise for this deferred
              // If obj is provided, the promise aspect is added to the object
              promise: function (obj) {
                return obj != null ? jQuery.extend(obj, promise) : promise;
              },
            },
            deferred = {};

          // Keep pipe for back-compat
          promise.pipe = promise.then;

          // Add list-specific methods
          jQuery.each(tuples, function (i, tuple) {
            var list = tuple[2],
              stateString = tuple[3];

            // promise[ done | fail | progress ] = list.add
            promise[tuple[1]] = list.add;

            // Handle state
            if (stateString) {
              list.add(
                function () {
                  // state = [ resolved | rejected ]
                  state = stateString;

                  // [ reject_list | resolve_list ].disable; progress_list.lock
                },
                tuples[i ^ 1][2].disable,
                tuples[2][2].lock,
              );
            }

            // deferred[ resolve | reject | notify ]
            deferred[tuple[0]] = function () {
              deferred[tuple[0] + "With"](
                this === deferred ? promise : this,
                arguments,
              );
              return this;
            };
            deferred[tuple[0] + "With"] = list.fireWith;
          });

          // Make the deferred a promise
          promise.promise(deferred);

          // Call given func if any
          if (func) {
            func.call(deferred, deferred);
          }

          // All done!
          return deferred;
        },

        // Deferred helper
        when: function (subordinate /* , ..., subordinateN */) {
          var i = 0,
            resolveValues = slice.call(arguments),
            length = resolveValues.length,
            // the count of uncompleted subordinates
            remaining =
              length !== 1 ||
              (subordinate && jQuery.isFunction(subordinate.promise))
                ? length
                : 0,
            // the master Deferred. If resolveValues consist of only a single Deferred, just use that.
            deferred = remaining === 1 ? subordinate : jQuery.Deferred(),
            // Update function for both resolve and progress values
            updateFunc = function (i, contexts, values) {
              return function (value) {
                contexts[i] = this;
                values[i] =
                  arguments.length > 1 ? slice.call(arguments) : value;
                if (values === progressValues) {
                  deferred.notifyWith(contexts, values);
                } else if (!--remaining) {
                  deferred.resolveWith(contexts, values);
                }
              };
            },
            progressValues,
            progressContexts,
            resolveContexts;

          // add listeners to Deferred subordinates; treat others as resolved
          if (length > 1) {
            progressValues = new Array(length);
            progressContexts = new Array(length);
            resolveContexts = new Array(length);
            for (; i < length; i++) {
              if (
                resolveValues[i] &&
                jQuery.isFunction(resolveValues[i].promise)
              ) {
                resolveValues[i]
                  .promise()
                  .done(updateFunc(i, resolveContexts, resolveValues))
                  .fail(deferred.reject)
                  .progress(updateFunc(i, progressContexts, progressValues));
              } else {
                --remaining;
              }
            }
          }

          // if we're not waiting on anything, resolve the master
          if (!remaining) {
            deferred.resolveWith(resolveContexts, resolveValues);
          }

          return deferred.promise();
        },
      });

      // The deferred used on DOM ready
      var readyList;

      jQuery.fn.ready = function (fn) {
        // Add the callback
        jQuery.ready.promise().done(fn);

        return this;
      };

      jQuery.extend({
        // Is the DOM ready to be used? Set to true once it occurs.
        isReady: false,

        // A counter to track how many items to wait for before
        // the ready event fires. See #6781
        readyWait: 1,

        // Hold (or release) the ready event
        holdReady: function (hold) {
          if (hold) {
            jQuery.readyWait++;
          } else {
            jQuery.ready(true);
          }
        },

        // Handle when the DOM is ready
        ready: function (wait) {
          // Abort if there are pending holds or we're already ready
          if (wait === true ? --jQuery.readyWait : jQuery.isReady) {
            return;
          }

          // Remember that the DOM is ready
          jQuery.isReady = true;

          // If a normal DOM Ready event fired, decrement, and wait if need be
          if (wait !== true && --jQuery.readyWait > 0) {
            return;
          }

          // If there are functions bound, to execute
          readyList.resolveWith(document, [jQuery]);

          // Trigger any bound ready events
          if (jQuery.fn.trigger) {
            jQuery(document).trigger("ready").off("ready");
          }
        },
      });

      /**
       * The ready event handler and self cleanup method
       */
      function completed() {
        document.removeEventListener("DOMContentLoaded", completed, false);
        window.removeEventListener("load", completed, false);
        jQuery.ready();
      }

      jQuery.ready.promise = function (obj) {
        if (!readyList) {
          readyList = jQuery.Deferred();

          // Catch cases where $(document).ready() is called after the browser event has already occurred.
          // we once tried to use readyState "interactive" here, but it caused issues like the one
          // discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15
          if (document.readyState === "complete") {
            // Handle it asynchronously to allow scripts the opportunity to delay ready
            setTimeout(jQuery.ready);
          } else {
            // Use the handy event callback
            document.addEventListener("DOMContentLoaded", completed, false);

            // A fallback to window.onload, that will always work
            window.addEventListener("load", completed, false);
          }
        }
        return readyList.promise(obj);
      };

      // Kick off the DOM ready check even if the user does not
      jQuery.ready.promise();

      // Multifunctional method to get and set values of a collection
      // The value/s can optionally be executed if it's a function
      var access = (jQuery.access = function (
        elems,
        fn,
        key,
        value,
        chainable,
        emptyGet,
        raw,
      ) {
        var i = 0,
          len = elems.length,
          bulk = key == null;

        // Sets many values
        if (jQuery.type(key) === "object") {
          chainable = true;
          for (i in key) {
            jQuery.access(elems, fn, i, key[i], true, emptyGet, raw);
          }

          // Sets one value
        } else if (value !== undefined) {
          chainable = true;

          if (!jQuery.isFunction(value)) {
            raw = true;
          }

          if (bulk) {
            // Bulk operations run against the entire set
            if (raw) {
              fn.call(elems, value);
              fn = null;

              // ...except when executing function values
            } else {
              bulk = fn;
              fn = function (elem, key, value) {
                return bulk.call(jQuery(elem), value);
              };
            }
          }

          if (fn) {
            for (; i < len; i++) {
              fn(
                elems[i],
                key,
                raw ? value : value.call(elems[i], i, fn(elems[i], key)),
              );
            }
          }
        }

        return chainable
          ? elems
          : // Gets
            bulk
            ? fn.call(elems)
            : len
              ? fn(elems[0], key)
              : emptyGet;
      });

      /**
       * Determines whether an object can have data
       */
      jQuery.acceptData = function (owner) {
        // Accepts only:
        //  - Node
        //    - Node.ELEMENT_NODE
        //    - Node.DOCUMENT_NODE
        //  - Object
        //    - Any
        /* jshint -W018 */
        return owner.nodeType === 1 || owner.nodeType === 9 || !+owner.nodeType;
      };

      function Data() {
        // Support: Android < 4,
        // Old WebKit does not have Object.preventExtensions/freeze method,
        // return new empty object instead with no [[set]] accessor
        Object.defineProperty((this.cache = {}), 0, {
          get: function () {
            return {};
          },
        });

        this.expando = jQuery.expando + Math.random();
      }

      Data.uid = 1;
      Data.accepts = jQuery.acceptData;

      Data.prototype = {
        key: function (owner) {
          // We can accept data for non-element nodes in modern browsers,
          // but we should not, see #8335.
          // Always return the key for a frozen object.
          if (!Data.accepts(owner)) {
            return 0;
          }

          var descriptor = {},
            // Check if the owner object already has a cache key
            unlock = owner[this.expando];

          // If not, create one
          if (!unlock) {
            unlock = Data.uid++;

            // Secure it in a non-enumerable, non-writable property
            try {
              descriptor[this.expando] = { value: unlock };
              Object.defineProperties(owner, descriptor);

              // Support: Android < 4
              // Fallback to a less secure definition
            } catch (e) {
              descriptor[this.expando] = unlock;
              jQuery.extend(owner, descriptor);
            }
          }

          // Ensure the cache object
          if (!this.cache[unlock]) {
            this.cache[unlock] = {};
          }

          return unlock;
        },
        set: function (owner, data, value) {
          var prop,
            // There may be an unlock assigned to this node,
            // if there is no entry for this "owner", create one inline
            // and set the unlock as though an owner entry had always existed
            unlock = this.key(owner),
            cache = this.cache[unlock];

          // Handle: [ owner, key, value ] args
          if (typeof data === "string") {
            cache[data] = value;

            // Handle: [ owner, { properties } ] args
          } else {
            // Fresh assignments by object are shallow copied
            if (jQuery.isEmptyObject(cache)) {
              jQuery.extend(this.cache[unlock], data);
              // Otherwise, copy the properties one-by-one to the cache object
            } else {
              for (prop in data) {
                cache[prop] = data[prop];
              }
            }
          }
          return cache;
        },
        get: function (owner, key) {
          // Either a valid cache is found, or will be created.
          // New caches will be created and the unlock returned,
          // allowing direct access to the newly created
          // empty data object. A valid owner object must be provided.
          var cache = this.cache[this.key(owner)];

          return key === undefined ? cache : cache[key];
        },
        access: function (owner, key, value) {
          var stored;
          // In cases where either:
          //
          //   1. No key was specified
          //   2. A string key was specified, but no value provided
          //
          // Take the "read" path and allow the get method to determine
          // which value to return, respectively either:
          //
          //   1. The entire cache object
          //   2. The data stored at the key
          //
          if (
            key === undefined ||
            (key && typeof key === "string" && value === undefined)
          ) {
            stored = this.get(owner, key);

            return stored !== undefined
              ? stored
              : this.get(owner, jQuery.camelCase(key));
          }

          // [*]When the key is not a string, or both a key and value
          // are specified, set or extend (existing objects) with either:
          //
          //   1. An object of properties
          //   2. A key and value
          //
          this.set(owner, key, value);

          // Since the "set" path can have two possible entry points
          // return the expected data based on which path was taken[*]
          return value !== undefined ? value : key;
        },
        remove: function (owner, key) {
          var i,
            name,
            camel,
            unlock = this.key(owner),
            cache = this.cache[unlock];

          if (key === undefined) {
            this.cache[unlock] = {};
          } else {
            // Support array or space separated string of keys
            if (jQuery.isArray(key)) {
              // If "name" is an array of keys...
              // When data is initially created, via ("key", "val") signature,
              // keys will be converted to camelCase.
              // Since there is no way to tell _how_ a key was added, remove
              // both plain key and camelCase key. #12786
              // This will only penalize the array argument path.
              name = key.concat(key.map(jQuery.camelCase));
            } else {
              camel = jQuery.camelCase(key);
              // Try the string as a key before any manipulation
              if (key in cache) {
                name = [key, camel];
              } else {
                // If a key with the spaces exists, use it.
                // Otherwise, create an array by matching non-whitespace
                name = camel;
                name = name in cache ? [name] : name.match(rnotwhite) || [];
              }
            }

            i = name.length;
            while (i--) {
              delete cache[name[i]];
            }
          }
        },
        hasData: function (owner) {
          return !jQuery.isEmptyObject(this.cache[owner[this.expando]] || {});
        },
        discard: function (owner) {
          if (owner[this.expando]) {
            delete this.cache[owner[this.expando]];
          }
        },
      };
      var data_priv = new Data();

      var data_user = new Data();

      /*
Implementation Summary

1. Enforce API surface and semantic compatibility with 1.9.x branch
2. Improve the module's maintainability by reducing the storage
    paths to a single mechanism.
3. Use the same single mechanism to support "private" and "user" data.
4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
5. Avoid exposing implementation details on user objects (eg. expando properties)
6. Provide a clear path for implementation upgrade to WeakMap in 2014
*/
      var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
        rmultiDash = /([A-Z])/g;

      function dataAttr(elem, key, data) {
        var name;

        // If nothing was found internally, try to fetch any
        // data from the HTML5 data-* attribute
        if (data === undefined && elem.nodeType === 1) {
          name = "data-" + key.replace(rmultiDash, "-$1").toLowerCase();
          data = elem.getAttribute(name);

          if (typeof data === "string") {
            try {
              data =
                data === "true"
                  ? true
                  : data === "false"
                    ? false
                    : data === "null"
                      ? null
                      : // Only convert to a number if it doesn't change the string
                        +data + "" === data
                        ? +data
                        : rbrace.test(data)
                          ? jQuery.parseJSON(data)
                          : data;
            } catch (e) {}

            // Make sure we set the data so it isn't changed later
            data_user.set(elem, key, data);
          } else {
            data = undefined;
          }
        }
        return data;
      }

      jQuery.extend({
        hasData: function (elem) {
          return data_user.hasData(elem) || data_priv.hasData(elem);
        },

        data: function (elem, name, data) {
          return data_user.access(elem, name, data);
        },

        removeData: function (elem, name) {
          data_user.remove(elem, name);
        },

        // TODO: Now that all calls to _data and _removeData have been replaced
        // with direct calls to data_priv methods, these can be deprecated.
        _data: function (elem, name, data) {
          return data_priv.access(elem, name, data);
        },

        _removeData: function (elem, name) {
          data_priv.remove(elem, name);
        },
      });

      jQuery.fn.extend({
        data: function (key, value) {
          var i,
            name,
            data,
            elem = this[0],
            attrs = elem && elem.attributes;

          // Gets all values
          if (key === undefined) {
            if (this.length) {
              data = data_user.get(elem);

              if (elem.nodeType === 1 && !data_priv.get(elem, "hasDataAttrs")) {
                i = attrs.length;
                while (i--) {
                  name = attrs[i].name;

                  if (name.indexOf("data-") === 0) {
                    name = jQuery.camelCase(name.slice(5));
                    dataAttr(elem, name, data[name]);
                  }
                }
                data_priv.set(elem, "hasDataAttrs", true);
              }
            }

            return data;
          }

          // Sets multiple values
          if (typeof key === "object") {
            return this.each(function () {
              data_user.set(this, key);
            });
          }

          return access(
            this,
            function (value) {
              var data,
                camelKey = jQuery.camelCase(key);

              // The calling jQuery object (element matches) is not empty
              // (and therefore has an element appears at this[ 0 ]) and the
              // `value` parameter was not undefined. An empty jQuery object
              // will result in `undefined` for elem = this[ 0 ] which will
              // throw an exception if an attempt to read a data cache is made.
              if (elem && value === undefined) {
                // Attempt to get data from the cache
                // with the key as-is
                data = data_user.get(elem, key);
                if (data !== undefined) {
                  return data;
                }

                // Attempt to get data from the cache
                // with the key camelized
                data = data_user.get(elem, camelKey);
                if (data !== undefined) {
                  return data;
                }

                // Attempt to "discover" the data in
                // HTML5 custom data-* attrs
                data = dataAttr(elem, camelKey, undefined);
                if (data !== undefined) {
                  return data;
                }

                // We tried really hard, but the data doesn't exist.
                return;
              }

              // Set the data...
              this.each(function () {
                // First, attempt to store a copy or reference of any
                // data that might've been store with a camelCased key.
                var data = data_user.get(this, camelKey);

                // For HTML5 data-* attribute interop, we have to
                // store property names with dashes in a camelCase form.
                // This might not apply to all properties...*
                data_user.set(this, camelKey, value);

                // *... In the case of properties that might _actually_
                // have dashes, we need to also store a copy of that
                // unchanged property.
                if (key.indexOf("-") !== -1 && data !== undefined) {
                  data_user.set(this, key, value);
                }
              });
            },
            null,
            value,
            arguments.length > 1,
            null,
            true,
          );
        },

        removeData: function (key) {
          return this.each(function () {
            data_user.remove(this, key);
          });
        },
      });

      jQuery.extend({
        queue: function (elem, type, data) {
          var queue;

          if (elem) {
            type = (type || "fx") + "queue";
            queue = data_priv.get(elem, type);

            // Speed up dequeue by getting out quickly if this is just a lookup
            if (data) {
              if (!queue || jQuery.isArray(data)) {
                queue = data_priv.access(elem, type, jQuery.makeArray(data));
              } else {
                queue.push(data);
              }
            }
            return queue || [];
          }
        },

        dequeue: function (elem, type) {
          type = type || "fx";

          var queue = jQuery.queue(elem, type),
            startLength = queue.length,
            fn = queue.shift(),
            hooks = jQuery._queueHooks(elem, type),
            next = function () {
              jQuery.dequeue(elem, type);
            };

          // If the fx queue is dequeued, always remove the progress sentinel
          if (fn === "inprogress") {
            fn = queue.shift();
            startLength--;
          }

          if (fn) {
            // Add a progress sentinel to prevent the fx queue from being
            // automatically dequeued
            if (type === "fx") {
              queue.unshift("inprogress");
            }

            // clear up the last queue stop function
            delete hooks.stop;
            fn.call(elem, next, hooks);
          }

          if (!startLength && hooks) {
            hooks.empty.fire();
          }
        },

        // not intended for public consumption - generates a queueHooks object, or returns the current one
        _queueHooks: function (elem, type) {
          var key = type + "queueHooks";
          return (
            data_priv.get(elem, key) ||
            data_priv.access(elem, key, {
              empty: jQuery.Callbacks("once memory").add(function () {
                data_priv.remove(elem, [type + "queue", key]);
              }),
            })
          );
        },
      });

      jQuery.fn.extend({
        queue: function (type, data) {
          var setter = 2;

          if (typeof type !== "string") {
            data = type;
            type = "fx";
            setter--;
          }

          if (arguments.length < setter) {
            return jQuery.queue(this[0], type);
          }

          return data === undefined
            ? this
            : this.each(function () {
                var queue = jQuery.queue(this, type, data);

                // ensure a hooks for this queue
                jQuery._queueHooks(this, type);

                if (type === "fx" && queue[0] !== "inprogress") {
                  jQuery.dequeue(this, type);
                }
              });
        },
        dequeue: function (type) {
          return this.each(function () {
            jQuery.dequeue(this, type);
          });
        },
        clearQueue: function (type) {
          return this.queue(type || "fx", []);
        },
        // Get a promise resolved when queues of a certain type
        // are emptied (fx is the type by default)
        promise: function (type, obj) {
          var tmp,
            count = 1,
            defer = jQuery.Deferred(),
            elements = this,
            i = this.length,
            resolve = function () {
              if (!--count) {
                defer.resolveWith(elements, [elements]);
              }
            };

          if (typeof type !== "string") {
            obj = type;
            type = undefined;
          }
          type = type || "fx";

          while (i--) {
            tmp = data_priv.get(elements[i], type + "queueHooks");
            if (tmp && tmp.empty) {
              count++;
              tmp.empty.add(resolve);
            }
          }
          resolve();
          return defer.promise(obj);
        },
      });
      var pnum = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source;

      var cssExpand = ["Top", "Right", "Bottom", "Left"];

      var isHidden = function (elem, el) {
        // isHidden might be called from jQuery#filter function;
        // in that case, element will be second argument
        elem = el || elem;
        return (
          jQuery.css(elem, "display") === "none" ||
          !jQuery.contains(elem.ownerDocument, elem)
        );
      };

      var rcheckableType = /^(?:checkbox|radio)$/i;

      (function () {
        var fragment = document.createDocumentFragment(),
          div = fragment.appendChild(document.createElement("div"));

        // #11217 - WebKit loses check when the name is after the checked attribute
        div.innerHTML = "<input type='radio' checked='checked' name='t'/>";

        // Support: Safari 5.1, iOS 5.1, Android 4.x, Android 2.3
        // old WebKit doesn't clone checked state correctly in fragments
        support.checkClone = div
          .cloneNode(true)
          .cloneNode(true).lastChild.checked;

        // Make sure textarea (and checkbox) defaultValue is properly cloned
        // Support: IE9-IE11+
        div.innerHTML = "<textarea>x</textarea>";
        support.noCloneChecked = !!div.cloneNode(true).lastChild.defaultValue;
      })();
      var strundefined = typeof undefined;

      support.focusinBubbles = "onfocusin" in window;

      var rkeyEvent = /^key/,
        rmouseEvent = /^(?:mouse|contextmenu)|click/,
        rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
        rtypenamespace = /^([^.]*)(?:\.(.+)|)$/;

      function returnTrue() {
        return true;
      }

      function returnFalse() {
        return false;
      }

      function safeActiveElement() {
        try {
          return document.activeElement;
        } catch (err) {}
      }

      /*
       * Helper functions for managing events -- not part of the public interface.
       * Props to Dean Edwards' addEvent library for many of the ideas.
       */
      jQuery.event = {
        global: {},

        add: function (elem, types, handler, data, selector) {
          var handleObjIn,
            eventHandle,
            tmp,
            events,
            t,
            handleObj,
            special,
            handlers,
            type,
            namespaces,
            origType,
            elemData = data_priv.get(elem);

          // Don't attach events to noData or text/comment nodes (but allow plain objects)
          if (!elemData) {
            return;
          }

          // Caller can pass in an object of custom data in lieu of the handler
          if (handler.handler) {
            handleObjIn = handler;
            handler = handleObjIn.handler;
            selector = handleObjIn.selector;
          }

          // Make sure that the handler has a unique ID, used to find/remove it later
          if (!handler.guid) {
            handler.guid = jQuery.guid++;
          }

          // Init the element's event structure and main handler, if this is the first
          if (!(events = elemData.events)) {
            events = elemData.events = {};
          }
          if (!(eventHandle = elemData.handle)) {
            eventHandle = elemData.handle = function (e) {
              // Discard the second event of a jQuery.event.trigger() and
              // when an event is called after a page has unloaded
              return typeof jQuery !== strundefined &&
                jQuery.event.triggered !== e.type
                ? jQuery.event.dispatch.apply(elem, arguments)
                : undefined;
            };
          }

          // Handle multiple events separated by a space
          types = (types || "").match(rnotwhite) || [""];
          t = types.length;
          while (t--) {
            tmp = rtypenamespace.exec(types[t]) || [];
            type = origType = tmp[1];
            namespaces = (tmp[2] || "").split(".").sort();

            // There *must* be a type, no attaching namespace-only handlers
            if (!type) {
              continue;
            }

            // If event changes its type, use the special event handlers for the changed type
            special = jQuery.event.special[type] || {};

            // If selector defined, determine special event api type, otherwise given type
            type = (selector ? special.delegateType : special.bindType) || type;

            // Update special based on newly reset type
            special = jQuery.event.special[type] || {};

            // handleObj is passed to all event handlers
            handleObj = jQuery.extend(
              {
                type: type,
                origType: origType,
                data: data,
                handler: handler,
                guid: handler.guid,
                selector: selector,
                needsContext:
                  selector && jQuery.expr.match.needsContext.test(selector),
                namespace: namespaces.join("."),
              },
              handleObjIn,
            );

            // Init the event handler queue if we're the first
            if (!(handlers = events[type])) {
              handlers = events[type] = [];
              handlers.delegateCount = 0;

              // Only use addEventListener if the special events handler returns false
              if (
                !special.setup ||
                special.setup.call(elem, data, namespaces, eventHandle) ===
                  false
              ) {
                if (elem.addEventListener) {
                  elem.addEventListener(type, eventHandle, false);
                }
              }
            }

            if (special.add) {
              special.add.call(elem, handleObj);

              if (!handleObj.handler.guid) {
                handleObj.handler.guid = handler.guid;
              }
            }

            // Add to the element's handler list, delegates in front
            if (selector) {
              handlers.splice(handlers.delegateCount++, 0, handleObj);
            } else {
              handlers.push(handleObj);
            }

            // Keep track of which events have ever been used, for event optimization
            jQuery.event.global[type] = true;
          }
        },

        // Detach an event or set of events from an element
        remove: function (elem, types, handler, selector, mappedTypes) {
          var j,
            origCount,
            tmp,
            events,
            t,
            handleObj,
            special,
            handlers,
            type,
            namespaces,
            origType,
            elemData = data_priv.hasData(elem) && data_priv.get(elem);

          if (!elemData || !(events = elemData.events)) {
            return;
          }

          // Once for each type.namespace in types; type may be omitted
          types = (types || "").match(rnotwhite) || [""];
          t = types.length;
          while (t--) {
            tmp = rtypenamespace.exec(types[t]) || [];
            type = origType = tmp[1];
            namespaces = (tmp[2] || "").split(".").sort();

            // Unbind all events (on this namespace, if provided) for the element
            if (!type) {
              for (type in events) {
                jQuery.event.remove(
                  elem,
                  type + types[t],
                  handler,
                  selector,
                  true,
                );
              }
              continue;
            }

            special = jQuery.event.special[type] || {};
            type = (selector ? special.delegateType : special.bindType) || type;
            handlers = events[type] || [];
            tmp =
              tmp[2] &&
              new RegExp(
                "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)",
              );

            // Remove matching events
            origCount = j = handlers.length;
            while (j--) {
              handleObj = handlers[j];

              if (
                (mappedTypes || origType === handleObj.origType) &&
                (!handler || handler.guid === handleObj.guid) &&
                (!tmp || tmp.test(handleObj.namespace)) &&
                (!selector ||
                  selector === handleObj.selector ||
                  (selector === "**" && handleObj.selector))
              ) {
                handlers.splice(j, 1);

                if (handleObj.selector) {
                  handlers.delegateCount--;
                }
                if (special.remove) {
                  special.remove.call(elem, handleObj);
                }
              }
            }

            // Remove generic event handler if we removed something and no more handlers exist
            // (avoids potential for endless recursion during removal of special event handlers)
            if (origCount && !handlers.length) {
              if (
                !special.teardown ||
                special.teardown.call(elem, namespaces, elemData.handle) ===
                  false
              ) {
                jQuery.removeEvent(elem, type, elemData.handle);
              }

              delete events[type];
            }
          }

          // Remove the expando if it's no longer used
          if (jQuery.isEmptyObject(events)) {
            delete elemData.handle;
            data_priv.remove(elem, "events");
          }
        },

        trigger: function (event, data, elem, onlyHandlers) {
          var i,
            cur,
            tmp,
            bubbleType,
            ontype,
            handle,
            special,
            eventPath = [elem || document],
            type = hasOwn.call(event, "type") ? event.type : event,
            namespaces = hasOwn.call(event, "namespace")
              ? event.namespace.split(".")
              : [];

          cur = tmp = elem = elem || document;

          // Don't do events on text and comment nodes
          if (elem.nodeType === 3 || elem.nodeType === 8) {
            return;
          }

          // focus/blur morphs to focusin/out; ensure we're not firing them right now
          if (rfocusMorph.test(type + jQuery.event.triggered)) {
            return;
          }

          if (type.indexOf(".") >= 0) {
            // Namespaced trigger; create a regexp to match event type in handle()
            namespaces = type.split(".");
            type = namespaces.shift();
            namespaces.sort();
          }
          ontype = type.indexOf(":") < 0 && "on" + type;

          // Caller can pass in a jQuery.Event object, Object, or just an event type string
          event = event[jQuery.expando]
            ? event
            : new jQuery.Event(type, typeof event === "object" && event);

          // Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
          event.isTrigger = onlyHandlers ? 2 : 3;
          event.namespace = namespaces.join(".");
          event.namespace_re = event.namespace
            ? new RegExp(
                "(^|\\.)" + namespaces.join("\\.(?:.*\\.|)") + "(\\.|$)",
              )
            : null;

          // Clean up the event in case it is being reused
          event.result = undefined;
          if (!event.target) {
            event.target = elem;
          }

          // Clone any incoming data and prepend the event, creating the handler arg list
          data = data == null ? [event] : jQuery.makeArray(data, [event]);

          // Allow special events to draw outside the lines
          special = jQuery.event.special[type] || {};
          if (
            !onlyHandlers &&
            special.trigger &&
            special.trigger.apply(elem, data) === false
          ) {
            return;
          }

          // Determine event propagation path in advance, per W3C events spec (#9951)
          // Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
          if (!onlyHandlers && !special.noBubble && !jQuery.isWindow(elem)) {
            bubbleType = special.delegateType || type;
            if (!rfocusMorph.test(bubbleType + type)) {
              cur = cur.parentNode;
            }
            for (; cur; cur = cur.parentNode) {
              eventPath.push(cur);
              tmp = cur;
            }

            // Only add window if we got to document (e.g., not plain obj or detached DOM)
            if (tmp === (elem.ownerDocument || document)) {
              eventPath.push(tmp.defaultView || tmp.parentWindow || window);
            }
          }

          // Fire handlers on the event path
          i = 0;
          while ((cur = eventPath[i++]) && !event.isPropagationStopped()) {
            event.type = i > 1 ? bubbleType : special.bindType || type;

            // jQuery handler
            handle =
              (data_priv.get(cur, "events") || {})[event.type] &&
              data_priv.get(cur, "handle");
            if (handle) {
              handle.apply(cur, data);
            }

            // Native handler
            handle = ontype && cur[ontype];
            if (handle && handle.apply && jQuery.acceptData(cur)) {
              event.result = handle.apply(cur, data);
              if (event.result === false) {
                event.preventDefault();
              }
            }
          }
          event.type = type;

          // If nobody prevented the default action, do it now
          if (!onlyHandlers && !event.isDefaultPrevented()) {
            if (
              (!special._default ||
                special._default.apply(eventPath.pop(), data) === false) &&
              jQuery.acceptData(elem)
            ) {
              // Call a native DOM method on the target with the same name name as the event.
              // Don't do default actions on window, that's where global variables be (#6170)
              if (
                ontype &&
                jQuery.isFunction(elem[type]) &&
                !jQuery.isWindow(elem)
              ) {
                // Don't re-trigger an onFOO event when we call its FOO() method
                tmp = elem[ontype];

                if (tmp) {
                  elem[ontype] = null;
                }

                // Prevent re-triggering of the same event, since we already bubbled it above
                jQuery.event.triggered = type;
                elem[type]();
                jQuery.event.triggered = undefined;

                if (tmp) {
                  elem[ontype] = tmp;
                }
              }
            }
          }

          return event.result;
        },

        dispatch: function (event) {
          // Make a writable jQuery.Event from the native event object
          event = jQuery.event.fix(event);

          var i,
            j,
            ret,
            matched,
            handleObj,
            handlerQueue = [],
            args = slice.call(arguments),
            handlers = (data_priv.get(this, "events") || {})[event.type] || [],
            special = jQuery.event.special[event.type] || {};

          // Use the fix-ed jQuery.Event rather than the (read-only) native event
          args[0] = event;
          event.delegateTarget = this;

          // Call the preDispatch hook for the mapped type, and let it bail if desired
          if (
            special.preDispatch &&
            special.preDispatch.call(this, event) === false
          ) {
            return;
          }

          // Determine handlers
          handlerQueue = jQuery.event.handlers.call(this, event, handlers);

          // Run delegates first; they may want to stop propagation beneath us
          i = 0;
          while (
            (matched = handlerQueue[i++]) &&
            !event.isPropagationStopped()
          ) {
            event.currentTarget = matched.elem;

            j = 0;
            while (
              (handleObj = matched.handlers[j++]) &&
              !event.isImmediatePropagationStopped()
            ) {
              // Triggered event must either 1) have no namespace, or
              // 2) have namespace(s) a subset or equal to those in the bound event (both can have no namespace).
              if (
                !event.namespace_re ||
                event.namespace_re.test(handleObj.namespace)
              ) {
                event.handleObj = handleObj;
                event.data = handleObj.data;

                ret = (
                  (jQuery.event.special[handleObj.origType] || {}).handle ||
                  handleObj.handler
                ).apply(matched.elem, args);

                if (ret !== undefined) {
                  if ((event.result = ret) === false) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }
              }
            }
          }

          // Call the postDispatch hook for the mapped type
          if (special.postDispatch) {
            special.postDispatch.call(this, event);
          }

          return event.result;
        },

        handlers: function (event, handlers) {
          var i,
            matches,
            sel,
            handleObj,
            handlerQueue = [],
            delegateCount = handlers.delegateCount,
            cur = event.target;

          // Find delegate handlers
          // Black-hole SVG <use> instance trees (#13180)
          // Avoid non-left-click bubbling in Firefox (#3861)
          if (
            delegateCount &&
            cur.nodeType &&
            (!event.button || event.type !== "click")
          ) {
            for (; cur !== this; cur = cur.parentNode || this) {
              // Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
              if (cur.disabled !== true || event.type !== "click") {
                matches = [];
                for (i = 0; i < delegateCount; i++) {
                  handleObj = handlers[i];

                  // Don't conflict with Object.prototype properties (#13203)
                  sel = handleObj.selector + " ";

                  if (matches[sel] === undefined) {
                    matches[sel] = handleObj.needsContext
                      ? jQuery(sel, this).index(cur) >= 0
                      : jQuery.find(sel, this, null, [cur]).length;
                  }
                  if (matches[sel]) {
                    matches.push(handleObj);
                  }
                }
                if (matches.length) {
                  handlerQueue.push({ elem: cur, handlers: matches });
                }
              }
            }
          }

          // Add the remaining (directly-bound) handlers
          if (delegateCount < handlers.length) {
            handlerQueue.push({
              elem: this,
              handlers: handlers.slice(delegateCount),
            });
          }

          return handlerQueue;
        },

        // Includes some event props shared by KeyEvent and MouseEvent
        props:
          "altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(
            " ",
          ),

        fixHooks: {},

        keyHooks: {
          props: "char charCode key keyCode".split(" "),
          filter: function (event, original) {
            // Add which for key events
            if (event.which == null) {
              event.which =
                original.charCode != null
                  ? original.charCode
                  : original.keyCode;
            }

            return event;
          },
        },

        mouseHooks: {
          props:
            "button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(
              " ",
            ),
          filter: function (event, original) {
            var eventDoc,
              doc,
              body,
              button = original.button;

            // Calculate pageX/Y if missing and clientX/Y available
            if (event.pageX == null && original.clientX != null) {
              eventDoc = event.target.ownerDocument || document;
              doc = eventDoc.documentElement;
              body = eventDoc.body;

              event.pageX =
                original.clientX +
                ((doc && doc.scrollLeft) || (body && body.scrollLeft) || 0) -
                ((doc && doc.clientLeft) || (body && body.clientLeft) || 0);
              event.pageY =
                original.clientY +
                ((doc && doc.scrollTop) || (body && body.scrollTop) || 0) -
                ((doc && doc.clientTop) || (body && body.clientTop) || 0);
            }

            // Add which for click: 1 === left; 2 === middle; 3 === right
            // Note: button is not normalized, so don't use it
            if (!event.which && button !== undefined) {
              event.which =
                button & 1 ? 1 : button & 2 ? 3 : button & 4 ? 2 : 0;
            }

            return event;
          },
        },

        fix: function (event) {
          if (event[jQuery.expando]) {
            return event;
          }

          // Create a writable copy of the event object and normalize some properties
          var i,
            prop,
            copy,
            type = event.type,
            originalEvent = event,
            fixHook = this.fixHooks[type];

          if (!fixHook) {
            this.fixHooks[type] = fixHook = rmouseEvent.test(type)
              ? this.mouseHooks
              : rkeyEvent.test(type)
                ? this.keyHooks
                : {};
          }
          copy = fixHook.props ? this.props.concat(fixHook.props) : this.props;

          event = new jQuery.Event(originalEvent);

          i = copy.length;
          while (i--) {
            prop = copy[i];
            event[prop] = originalEvent[prop];
          }

          // Support: Cordova 2.5 (WebKit) (#13255)
          // All events should have a target; Cordova deviceready doesn't
          if (!event.target) {
            event.target = document;
          }

          // Support: Safari 6.0+, Chrome < 28
          // Target should not be a text node (#504, #13143)
          if (event.target.nodeType === 3) {
            event.target = event.target.parentNode;
          }

          return fixHook.filter ? fixHook.filter(event, originalEvent) : event;
        },

        special: {
          load: {
            // Prevent triggered image.load events from bubbling to window.load
            noBubble: true,
          },
          focus: {
            // Fire native event if possible so blur/focus sequence is correct
            trigger: function () {
              if (this !== safeActiveElement() && this.focus) {
                this.focus();
                return false;
              }
            },
            delegateType: "focusin",
          },
          blur: {
            trigger: function () {
              if (this === safeActiveElement() && this.blur) {
                this.blur();
                return false;
              }
            },
            delegateType: "focusout",
          },
          click: {
            // For checkbox, fire native event so checked state will be right
            trigger: function () {
              if (
                this.type === "checkbox" &&
                this.click &&
                jQuery.nodeName(this, "input")
              ) {
                this.click();
                return false;
              }
            },

            // For cross-browser consistency, don't fire native .click() on links
            _default: function (event) {
              return jQuery.nodeName(event.target, "a");
            },
          },

          beforeunload: {
            postDispatch: function (event) {
              // Support: Firefox 20+
              // Firefox doesn't alert if the returnValue field is not set.
              if (event.result !== undefined) {
                event.originalEvent.returnValue = event.result;
              }
            },
          },
        },

        simulate: function (type, elem, event, bubble) {
          // Piggyback on a donor event to simulate a different one.
          // Fake originalEvent to avoid donor's stopPropagation, but if the
          // simulated event prevents default then we do the same on the donor.
          var e = jQuery.extend(new jQuery.Event(), event, {
            type: type,
            isSimulated: true,
            originalEvent: {},
          });
          if (bubble) {
            jQuery.event.trigger(e, null, elem);
          } else {
            jQuery.event.dispatch.call(elem, e);
          }
          if (e.isDefaultPrevented()) {
            event.preventDefault();
          }
        },
      };

      jQuery.removeEvent = function (elem, type, handle) {
        if (elem.removeEventListener) {
          elem.removeEventListener(type, handle, false);
        }
      };

      jQuery.Event = function (src, props) {
        // Allow instantiation without the 'new' keyword
        if (!(this instanceof jQuery.Event)) {
          return new jQuery.Event(src, props);
        }

        // Event object
        if (src && src.type) {
          this.originalEvent = src;
          this.type = src.type;

          // Events bubbling up the document may have been marked as prevented
          // by a handler lower down the tree; reflect the correct value.
          this.isDefaultPrevented =
            src.defaultPrevented ||
            // Support: Android < 4.0
            (src.defaultPrevented === undefined &&
              src.getPreventDefault &&
              src.getPreventDefault())
              ? returnTrue
              : returnFalse;

          // Event type
        } else {
          this.type = src;
        }

        // Put explicitly provided properties onto the event object
        if (props) {
          jQuery.extend(this, props);
        }

        // Create a timestamp if incoming event doesn't have one
        this.timeStamp = (src && src.timeStamp) || jQuery.now();

        // Mark it as fixed
        this[jQuery.expando] = true;
      };

      // jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
      // http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
      jQuery.Event.prototype = {
        isDefaultPrevented: returnFalse,
        isPropagationStopped: returnFalse,
        isImmediatePropagationStopped: returnFalse,

        preventDefault: function () {
          var e = this.originalEvent;

          this.isDefaultPrevented = returnTrue;

          if (e && e.preventDefault) {
            e.preventDefault();
          }
        },
        stopPropagation: function () {
          var e = this.originalEvent;

          this.isPropagationStopped = returnTrue;

          if (e && e.stopPropagation) {
            e.stopPropagation();
          }
        },
        stopImmediatePropagation: function () {
          this.isImmediatePropagationStopped = returnTrue;
          this.stopPropagation();
        },
      };

      // Create mouseenter/leave events using mouseover/out and event-time checks
      // Support: Chrome 15+
      jQuery.each(
        {
          mouseenter: "mouseover",
          mouseleave: "mouseout",
        },
        function (orig, fix) {
          jQuery.event.special[orig] = {
            delegateType: fix,
            bindType: fix,

            handle: function (event) {
              var ret,
                target = this,
                related = event.relatedTarget,
                handleObj = event.handleObj;

              // For mousenter/leave call the handler if related is outside the target.
              // NB: No relatedTarget if the mouse left/entered the browser window
              if (
                !related ||
                (related !== target && !jQuery.contains(target, related))
              ) {
                event.type = handleObj.origType;
                ret = handleObj.handler.apply(this, arguments);
                event.type = fix;
              }
              return ret;
            },
          };
        },
      );

      // Create "bubbling" focus and blur events
      // Support: Firefox, Chrome, Safari
      if (!support.focusinBubbles) {
        jQuery.each(
          { focus: "focusin", blur: "focusout" },
          function (orig, fix) {
            // Attach a single capturing handler on the document while someone wants focusin/focusout
            var handler = function (event) {
              jQuery.event.simulate(
                fix,
                event.target,
                jQuery.event.fix(event),
                true,
              );
            };

            jQuery.event.special[fix] = {
              setup: function () {
                var doc = this.ownerDocument || this,
                  attaches = data_priv.access(doc, fix);

                if (!attaches) {
                  doc.addEventListener(orig, handler, true);
                }
                data_priv.access(doc, fix, (attaches || 0) + 1);
              },
              teardown: function () {
                var doc = this.ownerDocument || this,
                  attaches = data_priv.access(doc, fix) - 1;

                if (!attaches) {
                  doc.removeEventListener(orig, handler, true);
                  data_priv.remove(doc, fix);
                } else {
                  data_priv.access(doc, fix, attaches);
                }
              },
            };
          },
        );
      }

      jQuery.fn.extend({
        on: function (types, selector, data, fn, /*INTERNAL*/ one) {
          var origFn, type;

          // Types can be a map of types/handlers
          if (typeof types === "object") {
            // ( types-Object, selector, data )
            if (typeof selector !== "string") {
              // ( types-Object, data )
              data = data || selector;
              selector = undefined;
            }
            for (type in types) {
              this.on(type, selector, data, types[type], one);
            }
            return this;
          }

          if (data == null && fn == null) {
            // ( types, fn )
            fn = selector;
            data = selector = undefined;
          } else if (fn == null) {
            if (typeof selector === "string") {
              // ( types, selector, fn )
              fn = data;
              data = undefined;
            } else {
              // ( types, data, fn )
              fn = data;
              data = selector;
              selector = undefined;
            }
          }
          if (fn === false) {
            fn = returnFalse;
          } else if (!fn) {
            return this;
          }

          if (one === 1) {
            origFn = fn;
            fn = function (event) {
              // Can use an empty set, since event contains the info
              jQuery().off(event);
              return origFn.apply(this, arguments);
            };
            // Use same guid so caller can remove using origFn
            fn.guid = origFn.guid || (origFn.guid = jQuery.guid++);
          }
          return this.each(function () {
            jQuery.event.add(this, types, fn, data, selector);
          });
        },
        one: function (types, selector, data, fn) {
          return this.on(types, selector, data, fn, 1);
        },
        off: function (types, selector, fn) {
          var handleObj, type;
          if (types && types.preventDefault && types.handleObj) {
            // ( event )  dispatched jQuery.Event
            handleObj = types.handleObj;
            jQuery(types.delegateTarget).off(
              handleObj.namespace
                ? handleObj.origType + "." + handleObj.namespace
                : handleObj.origType,
              handleObj.selector,
              handleObj.handler,
            );
            return this;
          }
          if (typeof types === "object") {
            // ( types-object [, selector] )
            for (type in types) {
              this.off(type, selector, types[type]);
            }
            return this;
          }
          if (selector === false || typeof selector === "function") {
            // ( types [, fn] )
            fn = selector;
            selector = undefined;
          }
          if (fn === false) {
            fn = returnFalse;
          }
          return this.each(function () {
            jQuery.event.remove(this, types, fn, selector);
          });
        },

        trigger: function (type, data) {
          return this.each(function () {
            jQuery.event.trigger(type, data, this);
          });
        },
        triggerHandler: function (type, data) {
          var elem = this[0];
          if (elem) {
            return jQuery.event.trigger(type, data, elem, true);
          }
        },
      });

      var rxhtmlTag =
          /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
        rtagName = /<([\w:]+)/,
        rhtml = /<|&#?\w+;/,
        rnoInnerhtml = /<(?:script|style|link)/i,
        // checked="checked" or checked
        rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
        rscriptType = /^$|\/(?:java|ecma)script/i,
        rscriptTypeMasked = /^true\/(.*)/,
        rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,
        // We have to close these tags to support XHTML (#13200)
        wrapMap = {
          // Support: IE 9
          option: [1, "<select multiple='multiple'>", "</select>"],

          thead: [1, "<table>", "</table>"],
          col: [2, "<table><colgroup>", "</colgroup></table>"],
          tr: [2, "<table><tbody>", "</tbody></table>"],
          td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],

          _default: [0, "", ""],
        };

      // Support: IE 9
      wrapMap.optgroup = wrapMap.option;

      wrapMap.tbody =
        wrapMap.tfoot =
        wrapMap.colgroup =
        wrapMap.caption =
          wrapMap.thead;
      wrapMap.th = wrapMap.td;

      // Support: 1.x compatibility
      // Manipulating tables requires a tbody
      function manipulationTarget(elem, content) {
        return jQuery.nodeName(elem, "table") &&
          jQuery.nodeName(
            content.nodeType !== 11 ? content : content.firstChild,
            "tr",
          )
          ? elem.getElementsByTagName("tbody")[0] ||
              elem.appendChild(elem.ownerDocument.createElement("tbody"))
          : elem;
      }

      // Replace/restore the type attribute of script elements for safe DOM manipulation
      function disableScript(elem) {
        elem.type = (elem.getAttribute("type") !== null) + "/" + elem.type;
        return elem;
      }
      function restoreScript(elem) {
        var match = rscriptTypeMasked.exec(elem.type);

        if (match) {
          elem.type = match[1];
        } else {
          elem.removeAttribute("type");
        }

        return elem;
      }

      // Mark scripts as having already been evaluated
      function setGlobalEval(elems, refElements) {
        var i = 0,
          l = elems.length;

        for (; i < l; i++) {
          data_priv.set(
            elems[i],
            "globalEval",
            !refElements || data_priv.get(refElements[i], "globalEval"),
          );
        }
      }

      function cloneCopyEvent(src, dest) {
        var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

        if (dest.nodeType !== 1) {
          return;
        }

        // 1. Copy private data: events, handlers, etc.
        if (data_priv.hasData(src)) {
          pdataOld = data_priv.access(src);
          pdataCur = data_priv.set(dest, pdataOld);
          events = pdataOld.events;

          if (events) {
            delete pdataCur.handle;
            pdataCur.events = {};

            for (type in events) {
              for (i = 0, l = events[type].length; i < l; i++) {
                jQuery.event.add(dest, type, events[type][i]);
              }
            }
          }
        }

        // 2. Copy user data
        if (data_user.hasData(src)) {
          udataOld = data_user.access(src);
          udataCur = jQuery.extend({}, udataOld);

          data_user.set(dest, udataCur);
        }
      }

      function getAll(context, tag) {
        var ret = context.getElementsByTagName
          ? context.getElementsByTagName(tag || "*")
          : context.querySelectorAll
            ? context.querySelectorAll(tag || "*")
            : [];

        return tag === undefined || (tag && jQuery.nodeName(context, tag))
          ? jQuery.merge([context], ret)
          : ret;
      }

      // Support: IE >= 9
      function fixInput(src, dest) {
        var nodeName = dest.nodeName.toLowerCase();

        // Fails to persist the checked state of a cloned checkbox or radio button.
        if (nodeName === "input" && rcheckableType.test(src.type)) {
          dest.checked = src.checked;

          // Fails to return the selected option to the default selected state when cloning options
        } else if (nodeName === "input" || nodeName === "textarea") {
          dest.defaultValue = src.defaultValue;
        }
      }

      jQuery.extend({
        clone: function (elem, dataAndEvents, deepDataAndEvents) {
          var i,
            l,
            srcElements,
            destElements,
            clone = elem.cloneNode(true),
            inPage = jQuery.contains(elem.ownerDocument, elem);

          // Support: IE >= 9
          // Fix Cloning issues
          if (
            !support.noCloneChecked &&
            (elem.nodeType === 1 || elem.nodeType === 11) &&
            !jQuery.isXMLDoc(elem)
          ) {
            // We eschew Sizzle here for performance reasons: http://jsperf.com/getall-vs-sizzle/2
            destElements = getAll(clone);
            srcElements = getAll(elem);

            for (i = 0, l = srcElements.length; i < l; i++) {
              fixInput(srcElements[i], destElements[i]);
            }
          }

          // Copy the events from the original to the clone
          if (dataAndEvents) {
            if (deepDataAndEvents) {
              srcElements = srcElements || getAll(elem);
              destElements = destElements || getAll(clone);

              for (i = 0, l = srcElements.length; i < l; i++) {
                cloneCopyEvent(srcElements[i], destElements[i]);
              }
            } else {
              cloneCopyEvent(elem, clone);
            }
          }

          // Preserve script evaluation history
          destElements = getAll(clone, "script");
          if (destElements.length > 0) {
            setGlobalEval(destElements, !inPage && getAll(elem, "script"));
          }

          // Return the cloned set
          return clone;
        },

        buildFragment: function (elems, context, scripts, selection) {
          var elem,
            tmp,
            tag,
            wrap,
            contains,
            j,
            fragment = context.createDocumentFragment(),
            nodes = [],
            i = 0,
            l = elems.length;

          for (; i < l; i++) {
            elem = elems[i];

            if (elem || elem === 0) {
              // Add nodes directly
              if (jQuery.type(elem) === "object") {
                // Support: QtWebKit
                // jQuery.merge because push.apply(_, arraylike) throws
                jQuery.merge(nodes, elem.nodeType ? [elem] : elem);

                // Convert non-html into a text node
              } else if (!rhtml.test(elem)) {
                nodes.push(context.createTextNode(elem));

                // Convert html into DOM nodes
              } else {
                tmp = tmp || fragment.appendChild(context.createElement("div"));

                // Deserialize a standard representation
                tag = (rtagName.exec(elem) || ["", ""])[1].toLowerCase();
                wrap = wrapMap[tag] || wrapMap._default;
                tmp.innerHTML =
                  wrap[1] + elem.replace(rxhtmlTag, "<$1></$2>") + wrap[2];

                // Descend through wrappers to the right content
                j = wrap[0];
                while (j--) {
                  tmp = tmp.lastChild;
                }

                // Support: QtWebKit
                // jQuery.merge because push.apply(_, arraylike) throws
                jQuery.merge(nodes, tmp.childNodes);

                // Remember the top-level container
                tmp = fragment.firstChild;

                // Fixes #12346
                // Support: Webkit, IE
                tmp.textContent = "";
              }
            }
          }

          // Remove wrapper from fragment
          fragment.textContent = "";

          i = 0;
          while ((elem = nodes[i++])) {
            // #4087 - If origin and destination elements are the same, and this is
            // that element, do not do anything
            if (selection && jQuery.inArray(elem, selection) !== -1) {
              continue;
            }

            contains = jQuery.contains(elem.ownerDocument, elem);

            // Append to fragment
            tmp = getAll(fragment.appendChild(elem), "script");

            // Preserve script evaluation history
            if (contains) {
              setGlobalEval(tmp);
            }

            // Capture executables
            if (scripts) {
              j = 0;
              while ((elem = tmp[j++])) {
                if (rscriptType.test(elem.type || "")) {
                  scripts.push(elem);
                }
              }
            }
          }

          return fragment;
        },

        cleanData: function (elems) {
          var data,
            elem,
            events,
            type,
            key,
            j,
            special = jQuery.event.special,
            i = 0;

          for (; (elem = elems[i]) !== undefined; i++) {
            if (jQuery.acceptData(elem)) {
              key = elem[data_priv.expando];

              if (key && (data = data_priv.cache[key])) {
                events = Object.keys(data.events || {});
                if (events.length) {
                  for (j = 0; (type = events[j]) !== undefined; j++) {
                    if (special[type]) {
                      jQuery.event.remove(elem, type);

                      // This is a shortcut to avoid jQuery.event.remove's overhead
                    } else {
                      jQuery.removeEvent(elem, type, data.handle);
                    }
                  }
                }
                if (data_priv.cache[key]) {
                  // Discard any remaining `private` data
                  delete data_priv.cache[key];
                }
              }
            }
            // Discard any remaining `user` data
            delete data_user.cache[elem[data_user.expando]];
          }
        },
      });

      jQuery.fn.extend({
        text: function (value) {
          return access(
            this,
            function (value) {
              return value === undefined
                ? jQuery.text(this)
                : this.empty().each(function () {
                    if (
                      this.nodeType === 1 ||
                      this.nodeType === 11 ||
                      this.nodeType === 9
                    ) {
                      this.textContent = value;
                    }
                  });
            },
            null,
            value,
            arguments.length,
          );
        },

        append: function () {
          return this.domManip(arguments, function (elem) {
            if (
              this.nodeType === 1 ||
              this.nodeType === 11 ||
              this.nodeType === 9
            ) {
              var target = manipulationTarget(this, elem);
              target.appendChild(elem);
            }
          });
        },

        prepend: function () {
          return this.domManip(arguments, function (elem) {
            if (
              this.nodeType === 1 ||
              this.nodeType === 11 ||
              this.nodeType === 9
            ) {
              var target = manipulationTarget(this, elem);
              target.insertBefore(elem, target.firstChild);
            }
          });
        },

        before: function () {
          return this.domManip(arguments, function (elem) {
            if (this.parentNode) {
              this.parentNode.insertBefore(elem, this);
            }
          });
        },

        after: function () {
          return this.domManip(arguments, function (elem) {
            if (this.parentNode) {
              this.parentNode.insertBefore(elem, this.nextSibling);
            }
          });
        },

        remove: function (selector, keepData /* Internal Use Only */) {
          var elem,
            elems = selector ? jQuery.filter(selector, this) : this,
            i = 0;

          for (; (elem = elems[i]) != null; i++) {
            if (!keepData && elem.nodeType === 1) {
              jQuery.cleanData(getAll(elem));
            }

            if (elem.parentNode) {
              if (keepData && jQuery.contains(elem.ownerDocument, elem)) {
                setGlobalEval(getAll(elem, "script"));
              }
              elem.parentNode.removeChild(elem);
            }
          }

          return this;
        },

        empty: function () {
          var elem,
            i = 0;

          for (; (elem = this[i]) != null; i++) {
            if (elem.nodeType === 1) {
              // Prevent memory leaks
              jQuery.cleanData(getAll(elem, false));

              // Remove any remaining nodes
              elem.textContent = "";
            }
          }

          return this;
        },

        clone: function (dataAndEvents, deepDataAndEvents) {
          dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
          deepDataAndEvents =
            deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

          return this.map(function () {
            return jQuery.clone(this, dataAndEvents, deepDataAndEvents);
          });
        },

        html: function (value) {
          return access(
            this,
            function (value) {
              var elem = this[0] || {},
                i = 0,
                l = this.length;

              if (value === undefined && elem.nodeType === 1) {
                return elem.innerHTML;
              }

              // See if we can take a shortcut and just use innerHTML
              if (
                typeof value === "string" &&
                !rnoInnerhtml.test(value) &&
                !wrapMap[(rtagName.exec(value) || ["", ""])[1].toLowerCase()]
              ) {
                value = value.replace(rxhtmlTag, "<$1></$2>");

                try {
                  for (; i < l; i++) {
                    elem = this[i] || {};

                    // Remove element nodes and prevent memory leaks
                    if (elem.nodeType === 1) {
                      jQuery.cleanData(getAll(elem, false));
                      elem.innerHTML = value;
                    }
                  }

                  elem = 0;

                  // If using innerHTML throws an exception, use the fallback method
                } catch (e) {}
              }

              if (elem) {
                this.empty().append(value);
              }
            },
            null,
            value,
            arguments.length,
          );
        },

        replaceWith: function () {
          var arg = arguments[0];

          // Make the changes, replacing each context element with the new content
          this.domManip(arguments, function (elem) {
            arg = this.parentNode;

            jQuery.cleanData(getAll(this));

            if (arg) {
              arg.replaceChild(elem, this);
            }
          });

          // Force removal if there was no new content (e.g., from empty arguments)
          return arg && (arg.length || arg.nodeType) ? this : this.remove();
        },

        detach: function (selector) {
          return this.remove(selector, true);
        },

        domManip: function (args, callback) {
          // Flatten any nested arrays
          args = concat.apply([], args);

          var fragment,
            first,
            scripts,
            hasScripts,
            node,
            doc,
            i = 0,
            l = this.length,
            set = this,
            iNoClone = l - 1,
            value = args[0],
            isFunction = jQuery.isFunction(value);

          // We can't cloneNode fragments that contain checked, in WebKit
          if (
            isFunction ||
            (l > 1 &&
              typeof value === "string" &&
              !support.checkClone &&
              rchecked.test(value))
          ) {
            return this.each(function (index) {
              var self = set.eq(index);
              if (isFunction) {
                args[0] = value.call(this, index, self.html());
              }
              self.domManip(args, callback);
            });
          }

          if (l) {
            fragment = jQuery.buildFragment(
              args,
              this[0].ownerDocument,
              false,
              this,
            );
            first = fragment.firstChild;

            if (fragment.childNodes.length === 1) {
              fragment = first;
            }

            if (first) {
              scripts = jQuery.map(getAll(fragment, "script"), disableScript);
              hasScripts = scripts.length;

              // Use the original fragment for the last item instead of the first because it can end up
              // being emptied incorrectly in certain situations (#8070).
              for (; i < l; i++) {
                node = fragment;

                if (i !== iNoClone) {
                  node = jQuery.clone(node, true, true);

                  // Keep references to cloned scripts for later restoration
                  if (hasScripts) {
                    // Support: QtWebKit
                    // jQuery.merge because push.apply(_, arraylike) throws
                    jQuery.merge(scripts, getAll(node, "script"));
                  }
                }

                callback.call(this[i], node, i);
              }

              if (hasScripts) {
                doc = scripts[scripts.length - 1].ownerDocument;

                // Reenable scripts
                jQuery.map(scripts, restoreScript);

                // Evaluate executable scripts on first document insertion
                for (i = 0; i < hasScripts; i++) {
                  node = scripts[i];
                  if (
                    rscriptType.test(node.type || "") &&
                    !data_priv.access(node, "globalEval") &&
                    jQuery.contains(doc, node)
                  ) {
                    if (node.src) {
                      // Optional AJAX dependency, but won't run scripts if not present
                      if (jQuery._evalUrl) {
                        jQuery._evalUrl(node.src);
                      }
                    } else {
                      jQuery.globalEval(
                        node.textContent.replace(rcleanScript, ""),
                      );
                    }
                  }
                }
              }
            }
          }

          return this;
        },
      });

      jQuery.each(
        {
          appendTo: "append",
          prependTo: "prepend",
          insertBefore: "before",
          insertAfter: "after",
          replaceAll: "replaceWith",
        },
        function (name, original) {
          jQuery.fn[name] = function (selector) {
            var elems,
              ret = [],
              insert = jQuery(selector),
              last = insert.length - 1,
              i = 0;

            for (; i <= last; i++) {
              elems = i === last ? this : this.clone(true);
              jQuery(insert[i])[original](elems);

              // Support: QtWebKit
              // .get() because push.apply(_, arraylike) throws
              push.apply(ret, elems.get());
            }

            return this.pushStack(ret);
          };
        },
      );

      var iframe,
        elemdisplay = {};

      /**
       * Retrieve the actual display of a element
       * @param {String} name nodeName of the element
       * @param {Object} doc Document object
       */
      // Called only from within defaultDisplay
      function actualDisplay(name, doc) {
        var elem = jQuery(doc.createElement(name)).appendTo(doc.body),
          // getDefaultComputedStyle might be reliably used only on attached element
          display = window.getDefaultComputedStyle
            ? // Use of this method is a temporary fix (more like optmization) until something better comes along,
              // since it was removed from specification and supported only in FF
              window.getDefaultComputedStyle(elem[0]).display
            : jQuery.css(elem[0], "display");

        // We don't have any data stored on the element,
        // so use "detach" method as fast way to get rid of the element
        elem.detach();

        return display;
      }

      /**
       * Try to determine the default display value of an element
       * @param {String} nodeName
       */
      function defaultDisplay(nodeName) {
        var doc = document,
          display = elemdisplay[nodeName];

        if (!display) {
          display = actualDisplay(nodeName, doc);

          // If the simple way fails, read from inside an iframe
          if (display === "none" || !display) {
            // Use the already-created iframe if possible
            iframe = (
              iframe || jQuery("<iframe frameborder='0' width='0' height='0'/>")
            ).appendTo(doc.documentElement);

            // Always write a new HTML skeleton so Webkit and Firefox don't choke on reuse
            doc = iframe[0].contentDocument;

            // Support: IE
            doc.write();
            doc.close();

            display = actualDisplay(nodeName, doc);
            iframe.detach();
          }

          // Store the correct default display
          elemdisplay[nodeName] = display;
        }

        return display;
      }
      var rmargin = /^margin/;

      var rnumnonpx = new RegExp("^(" + pnum + ")(?!px)[a-z%]+$", "i");

      var getStyles = function (elem) {
        return elem.ownerDocument.defaultView.getComputedStyle(elem, null);
      };

      function curCSS(elem, name, computed) {
        var width,
          minWidth,
          maxWidth,
          ret,
          style = elem.style;

        computed = computed || getStyles(elem);

        // Support: IE9
        // getPropertyValue is only needed for .css('filter') in IE9, see #12537
        if (computed) {
          ret = computed.getPropertyValue(name) || computed[name];
        }

        if (computed) {
          if (ret === "" && !jQuery.contains(elem.ownerDocument, elem)) {
            ret = jQuery.style(elem, name);
          }

          // Support: iOS < 6
          // A tribute to the "awesome hack by Dean Edwards"
          // iOS < 6 (at least) returns percentage for a larger set of values, but width seems to be reliably pixels
          // this is against the CSSOM draft spec: http://dev.w3.org/csswg/cssom/#resolved-values
          if (rnumnonpx.test(ret) && rmargin.test(name)) {
            // Remember the original values
            width = style.width;
            minWidth = style.minWidth;
            maxWidth = style.maxWidth;

            // Put in the new values to get a computed value out
            style.minWidth = style.maxWidth = style.width = ret;
            ret = computed.width;

            // Revert the changed values
            style.width = width;
            style.minWidth = minWidth;
            style.maxWidth = maxWidth;
          }
        }

        return ret !== undefined
          ? // Support: IE
            // IE returns zIndex value as an integer.
            ret + ""
          : ret;
      }

      function addGetHookIf(conditionFn, hookFn) {
        // Define the hook, we'll check on the first run if it's really needed.
        return {
          get: function () {
            if (conditionFn()) {
              // Hook not needed (or it's not possible to use it due to missing dependency),
              // remove it.
              // Since there are no other hooks for marginRight, remove the whole object.
              delete this.get;
              return;
            }

            // Hook needed; redefine it so that the support test is not executed again.

            return (this.get = hookFn).apply(this, arguments);
          },
        };
      }

      (function () {
        var pixelPositionVal,
          boxSizingReliableVal,
          // Support: Firefox, Android 2.3 (Prefixed box-sizing versions).
          divReset =
            "padding:0;margin:0;border:0;display:block;-webkit-box-sizing:content-box;" +
            "-moz-box-sizing:content-box;box-sizing:content-box",
          docElem = document.documentElement,
          container = document.createElement("div"),
          div = document.createElement("div");

        div.style.backgroundClip = "content-box";
        div.cloneNode(true).style.backgroundClip = "";
        support.clearCloneStyle = div.style.backgroundClip === "content-box";

        container.style.cssText =
          "border:0;width:0;height:0;position:absolute;top:0;left:-9999px;" +
          "margin-top:1px";
        container.appendChild(div);

        // Executing both pixelPosition & boxSizingReliable tests require only one layout
        // so they're executed at the same time to save the second computation.
        function computePixelPositionAndBoxSizingReliable() {
          // Support: Firefox, Android 2.3 (Prefixed box-sizing versions).
          div.style.cssText =
            "-webkit-box-sizing:border-box;-moz-box-sizing:border-box;" +
            "box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;" +
            "position:absolute;top:1%";
          docElem.appendChild(container);

          var divStyle = window.getComputedStyle(div, null);
          pixelPositionVal = divStyle.top !== "1%";
          boxSizingReliableVal = divStyle.width === "4px";

          docElem.removeChild(container);
        }

        // Use window.getComputedStyle because jsdom on node.js will break without it.
        if (window.getComputedStyle) {
          jQuery.extend(support, {
            pixelPosition: function () {
              // This test is executed only once but we still do memoizing
              // since we can use the boxSizingReliable pre-computing.
              // No need to check if the test was already performed, though.
              computePixelPositionAndBoxSizingReliable();
              return pixelPositionVal;
            },
            boxSizingReliable: function () {
              if (boxSizingReliableVal == null) {
                computePixelPositionAndBoxSizingReliable();
              }
              return boxSizingReliableVal;
            },
            reliableMarginRight: function () {
              // Support: Android 2.3
              // Check if div with explicit width and no margin-right incorrectly
              // gets computed margin-right based on width of container. (#3333)
              // WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
              // This support function is only executed once so no memoizing is needed.
              var ret,
                marginDiv = div.appendChild(document.createElement("div"));
              marginDiv.style.cssText = div.style.cssText = divReset;
              marginDiv.style.marginRight = marginDiv.style.width = "0";
              div.style.width = "1px";
              docElem.appendChild(container);

              ret = !parseFloat(
                window.getComputedStyle(marginDiv, null).marginRight,
              );

              docElem.removeChild(container);

              // Clean up the div for other support tests.
              div.innerHTML = "";

              return ret;
            },
          });
        }
      })();

      // A method for quickly swapping in/out CSS properties to get correct calculations.
      jQuery.swap = function (elem, options, callback, args) {
        var ret,
          name,
          old = {};

        // Remember the old values, and insert the new ones
        for (name in options) {
          old[name] = elem.style[name];
          elem.style[name] = options[name];
        }

        ret = callback.apply(elem, args || []);

        // Revert the old values
        for (name in options) {
          elem.style[name] = old[name];
        }

        return ret;
      };

      var // swappable if display is none or starts with table except "table", "table-cell", or "table-caption"
        // see here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
        rdisplayswap = /^(none|table(?!-c[ea]).+)/,
        rnumsplit = new RegExp("^(" + pnum + ")(.*)$", "i"),
        rrelNum = new RegExp("^([+-])=(" + pnum + ")", "i"),
        cssShow = {
          position: "absolute",
          visibility: "hidden",
          display: "block",
        },
        cssNormalTransform = {
          letterSpacing: 0,
          fontWeight: 400,
        },
        cssPrefixes = ["Webkit", "O", "Moz", "ms"];

      // return a css property mapped to a potentially vendor prefixed property
      function vendorPropName(style, name) {
        // shortcut for names that are not vendor prefixed
        if (name in style) {
          return name;
        }

        // check for vendor prefixed names
        var capName = name[0].toUpperCase() + name.slice(1),
          origName = name,
          i = cssPrefixes.length;

        while (i--) {
          name = cssPrefixes[i] + capName;
          if (name in style) {
            return name;
          }
        }

        return origName;
      }

      function setPositiveNumber(elem, value, subtract) {
        var matches = rnumsplit.exec(value);
        return matches
          ? // Guard against undefined "subtract", e.g., when used as in cssHooks
            Math.max(0, matches[1] - (subtract || 0)) + (matches[2] || "px")
          : value;
      }

      function augmentWidthOrHeight(elem, name, extra, isBorderBox, styles) {
        var i =
            extra === (isBorderBox ? "border" : "content")
              ? // If we already have the right measurement, avoid augmentation
                4
              : // Otherwise initialize for horizontal or vertical properties
                name === "width"
                ? 1
                : 0,
          val = 0;

        for (; i < 4; i += 2) {
          // both box models exclude margin, so add it if we want it
          if (extra === "margin") {
            val += jQuery.css(elem, extra + cssExpand[i], true, styles);
          }

          if (isBorderBox) {
            // border-box includes padding, so remove it if we want content
            if (extra === "content") {
              val -= jQuery.css(elem, "padding" + cssExpand[i], true, styles);
            }

            // at this point, extra isn't border nor margin, so remove border
            if (extra !== "margin") {
              val -= jQuery.css(
                elem,
                "border" + cssExpand[i] + "Width",
                true,
                styles,
              );
            }
          } else {
            // at this point, extra isn't content, so add padding
            val += jQuery.css(elem, "padding" + cssExpand[i], true, styles);

            // at this point, extra isn't content nor padding, so add border
            if (extra !== "padding") {
              val += jQuery.css(
                elem,
                "border" + cssExpand[i] + "Width",
                true,
                styles,
              );
            }
          }
        }

        return val;
      }

      function getWidthOrHeight(elem, name, extra) {
        // Start with offset property, which is equivalent to the border-box value
        var valueIsBorderBox = true,
          val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
          styles = getStyles(elem),
          isBorderBox =
            jQuery.css(elem, "boxSizing", false, styles) === "border-box";

        // some non-html elements return undefined for offsetWidth, so check for null/undefined
        // svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
        // MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
        if (val <= 0 || val == null) {
          // Fall back to computed then uncomputed css if necessary
          val = curCSS(elem, name, styles);
          if (val < 0 || val == null) {
            val = elem.style[name];
          }

          // Computed unit is not pixels. Stop here and return.
          if (rnumnonpx.test(val)) {
            return val;
          }

          // we need the check for style in case a browser which returns unreliable values
          // for getComputedStyle silently falls back to the reliable elem.style
          valueIsBorderBox =
            isBorderBox &&
            (support.boxSizingReliable() || val === elem.style[name]);

          // Normalize "", auto, and prepare for extra
          val = parseFloat(val) || 0;
        }

        // use the active box-sizing model to add/subtract irrelevant styles
        return (
          val +
          augmentWidthOrHeight(
            elem,
            name,
            extra || (isBorderBox ? "border" : "content"),
            valueIsBorderBox,
            styles,
          ) +
          "px"
        );
      }

      function showHide(elements, show) {
        var display,
          elem,
          hidden,
          values = [],
          index = 0,
          length = elements.length;

        for (; index < length; index++) {
          elem = elements[index];
          if (!elem.style) {
            continue;
          }

          values[index] = data_priv.get(elem, "olddisplay");
          display = elem.style.display;
          if (show) {
            // Reset the inline display of this element to learn if it is
            // being hidden by cascaded rules or not
            if (!values[index] && display === "none") {
              elem.style.display = "";
            }

            // Set elements which have been overridden with display: none
            // in a stylesheet to whatever the default browser style is
            // for such an element
            if (elem.style.display === "" && isHidden(elem)) {
              values[index] = data_priv.access(
                elem,
                "olddisplay",
                defaultDisplay(elem.nodeName),
              );
            }
          } else {
            if (!values[index]) {
              hidden = isHidden(elem);

              if ((display && display !== "none") || !hidden) {
                data_priv.set(
                  elem,
                  "olddisplay",
                  hidden ? display : jQuery.css(elem, "display"),
                );
              }
            }
          }
        }

        // Set the display of most of the elements in a second loop
        // to avoid the constant reflow
        for (index = 0; index < length; index++) {
          elem = elements[index];
          if (!elem.style) {
            continue;
          }
          if (
            !show ||
            elem.style.display === "none" ||
            elem.style.display === ""
          ) {
            elem.style.display = show ? values[index] || "" : "none";
          }
        }

        return elements;
      }

      jQuery.extend({
        // Add in style property hooks for overriding the default
        // behavior of getting and setting a style property
        cssHooks: {
          opacity: {
            get: function (elem, computed) {
              if (computed) {
                // We should always get a number back from opacity
                var ret = curCSS(elem, "opacity");
                return ret === "" ? "1" : ret;
              }
            },
          },
        },

        // Don't automatically add "px" to these possibly-unitless properties
        cssNumber: {
          columnCount: true,
          fillOpacity: true,
          fontWeight: true,
          lineHeight: true,
          opacity: true,
          order: true,
          orphans: true,
          widows: true,
          zIndex: true,
          zoom: true,
        },

        // Add in properties whose names you wish to fix before
        // setting or getting the value
        cssProps: {
          // normalize float css property
          float: "cssFloat",
        },

        // Get and set the style property on a DOM Node
        style: function (elem, name, value, extra) {
          // Don't set styles on text and comment nodes
          if (
            !elem ||
            elem.nodeType === 3 ||
            elem.nodeType === 8 ||
            !elem.style
          ) {
            return;
          }

          // Make sure that we're working with the right name
          var ret,
            type,
            hooks,
            origName = jQuery.camelCase(name),
            style = elem.style;

          name =
            jQuery.cssProps[origName] ||
            (jQuery.cssProps[origName] = vendorPropName(style, origName));

          // gets hook for the prefixed version
          // followed by the unprefixed version
          hooks = jQuery.cssHooks[name] || jQuery.cssHooks[origName];

          // Check if we're setting a value
          if (value !== undefined) {
            type = typeof value;

            // convert relative number strings (+= or -=) to relative numbers. #7345
            if (type === "string" && (ret = rrelNum.exec(value))) {
              value =
                (ret[1] + 1) * ret[2] + parseFloat(jQuery.css(elem, name));
              // Fixes bug #9237
              type = "number";
            }

            // Make sure that null and NaN values aren't set. See: #7116
            if (value == null || value !== value) {
              return;
            }

            // If a number was passed in, add 'px' to the (except for certain CSS properties)
            if (type === "number" && !jQuery.cssNumber[origName]) {
              value += "px";
            }

            // Fixes #8908, it can be done more correctly by specifying setters in cssHooks,
            // but it would mean to define eight (for every problematic property) identical functions
            if (
              !support.clearCloneStyle &&
              value === "" &&
              name.indexOf("background") === 0
            ) {
              style[name] = "inherit";
            }

            // If a hook was provided, use that value, otherwise just set the specified value
            if (
              !hooks ||
              !("set" in hooks) ||
              (value = hooks.set(elem, value, extra)) !== undefined
            ) {
              // Support: Chrome, Safari
              // Setting style to blank string required to delete "style: x !important;"
              style[name] = "";
              style[name] = value;
            }
          } else {
            // If a hook was provided get the non-computed value from there
            if (
              hooks &&
              "get" in hooks &&
              (ret = hooks.get(elem, false, extra)) !== undefined
            ) {
              return ret;
            }

            // Otherwise just get the value from the style object
            return style[name];
          }
        },

        css: function (elem, name, extra, styles) {
          var val,
            num,
            hooks,
            origName = jQuery.camelCase(name);

          // Make sure that we're working with the right name
          name =
            jQuery.cssProps[origName] ||
            (jQuery.cssProps[origName] = vendorPropName(elem.style, origName));

          // gets hook for the prefixed version
          // followed by the unprefixed version
          hooks = jQuery.cssHooks[name] || jQuery.cssHooks[origName];

          // If a hook was provided get the computed value from there
          if (hooks && "get" in hooks) {
            val = hooks.get(elem, true, extra);
          }

          // Otherwise, if a way to get the computed value exists, use that
          if (val === undefined) {
            val = curCSS(elem, name, styles);
          }

          //convert "normal" to computed value
          if (val === "normal" && name in cssNormalTransform) {
            val = cssNormalTransform[name];
          }

          // Return, converting to number if forced or a qualifier was provided and val looks numeric
          if (extra === "" || extra) {
            num = parseFloat(val);
            return extra === true || jQuery.isNumeric(num) ? num || 0 : val;
          }
          return val;
        },
      });

      jQuery.each(["height", "width"], function (i, name) {
        jQuery.cssHooks[name] = {
          get: function (elem, computed, extra) {
            if (computed) {
              // certain elements can have dimension info if we invisibly show them
              // however, it must have a current display style that would benefit from this
              return elem.offsetWidth === 0 &&
                rdisplayswap.test(jQuery.css(elem, "display"))
                ? jQuery.swap(elem, cssShow, function () {
                    return getWidthOrHeight(elem, name, extra);
                  })
                : getWidthOrHeight(elem, name, extra);
            }
          },

          set: function (elem, value, extra) {
            var styles = extra && getStyles(elem);
            return setPositiveNumber(
              elem,
              value,
              extra
                ? augmentWidthOrHeight(
                    elem,
                    name,
                    extra,
                    jQuery.css(elem, "boxSizing", false, styles) ===
                      "border-box",
                    styles,
                  )
                : 0,
            );
          },
        };
      });

      // Support: Android 2.3
      jQuery.cssHooks.marginRight = addGetHookIf(
        support.reliableMarginRight,
        function (elem, computed) {
          if (computed) {
            // WebKit Bug 13343 - getComputedStyle returns wrong value for margin-right
            // Work around by temporarily setting element display to inline-block
            return jQuery.swap(elem, { display: "inline-block" }, curCSS, [
              elem,
              "marginRight",
            ]);
          }
        },
      );

      // These hooks are used by animate to expand properties
      jQuery.each(
        {
          margin: "",
          padding: "",
          border: "Width",
        },
        function (prefix, suffix) {
          jQuery.cssHooks[prefix + suffix] = {
            expand: function (value) {
              var i = 0,
                expanded = {},
                // assumes a single number if not a string
                parts = typeof value === "string" ? value.split(" ") : [value];

              for (; i < 4; i++) {
                expanded[prefix + cssExpand[i] + suffix] =
                  parts[i] || parts[i - 2] || parts[0];
              }

              return expanded;
            },
          };

          if (!rmargin.test(prefix)) {
            jQuery.cssHooks[prefix + suffix].set = setPositiveNumber;
          }
        },
      );

      jQuery.fn.extend({
        css: function (name, value) {
          return access(
            this,
            function (elem, name, value) {
              var styles,
                len,
                map = {},
                i = 0;

              if (jQuery.isArray(name)) {
                styles = getStyles(elem);
                len = name.length;

                for (; i < len; i++) {
                  map[name[i]] = jQuery.css(elem, name[i], false, styles);
                }

                return map;
              }

              return value !== undefined
                ? jQuery.style(elem, name, value)
                : jQuery.css(elem, name);
            },
            name,
            value,
            arguments.length > 1,
          );
        },
        show: function () {
          return showHide(this, true);
        },
        hide: function () {
          return showHide(this);
        },
        toggle: function (state) {
          if (typeof state === "boolean") {
            return state ? this.show() : this.hide();
          }

          return this.each(function () {
            if (isHidden(this)) {
              jQuery(this).show();
            } else {
              jQuery(this).hide();
            }
          });
        },
      });

      function Tween(elem, options, prop, end, easing) {
        return new Tween.prototype.init(elem, options, prop, end, easing);
      }
      jQuery.Tween = Tween;

      Tween.prototype = {
        constructor: Tween,
        init: function (elem, options, prop, end, easing, unit) {
          this.elem = elem;
          this.prop = prop;
          this.easing = easing || "swing";
          this.options = options;
          this.start = this.now = this.cur();
          this.end = end;
          this.unit = unit || (jQuery.cssNumber[prop] ? "" : "px");
        },
        cur: function () {
          var hooks = Tween.propHooks[this.prop];

          return hooks && hooks.get
            ? hooks.get(this)
            : Tween.propHooks._default.get(this);
        },
        run: function (percent) {
          var eased,
            hooks = Tween.propHooks[this.prop];

          if (this.options.duration) {
            this.pos = eased = jQuery.easing[this.easing](
              percent,
              this.options.duration * percent,
              0,
              1,
              this.options.duration,
            );
          } else {
            this.pos = eased = percent;
          }
          this.now = (this.end - this.start) * eased + this.start;

          if (this.options.step) {
            this.options.step.call(this.elem, this.now, this);
          }

          if (hooks && hooks.set) {
            hooks.set(this);
          } else {
            Tween.propHooks._default.set(this);
          }
          return this;
        },
      };

      Tween.prototype.init.prototype = Tween.prototype;

      Tween.propHooks = {
        _default: {
          get: function (tween) {
            var result;

            if (
              tween.elem[tween.prop] != null &&
              (!tween.elem.style || tween.elem.style[tween.prop] == null)
            ) {
              return tween.elem[tween.prop];
            }

            // passing an empty string as a 3rd parameter to .css will automatically
            // attempt a parseFloat and fallback to a string if the parse fails
            // so, simple values such as "10px" are parsed to Float.
            // complex values such as "rotate(1rad)" are returned as is.
            result = jQuery.css(tween.elem, tween.prop, "");
            // Empty strings, null, undefined and "auto" are converted to 0.
            return !result || result === "auto" ? 0 : result;
          },
          set: function (tween) {
            // use step hook for back compat - use cssHook if its there - use .style if its
            // available and use plain properties where available
            if (jQuery.fx.step[tween.prop]) {
              jQuery.fx.step[tween.prop](tween);
            } else if (
              tween.elem.style &&
              (tween.elem.style[jQuery.cssProps[tween.prop]] != null ||
                jQuery.cssHooks[tween.prop])
            ) {
              jQuery.style(tween.elem, tween.prop, tween.now + tween.unit);
            } else {
              tween.elem[tween.prop] = tween.now;
            }
          },
        },
      };

      // Support: IE9
      // Panic based approach to setting things on disconnected nodes

      Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
        set: function (tween) {
          if (tween.elem.nodeType && tween.elem.parentNode) {
            tween.elem[tween.prop] = tween.now;
          }
        },
      };

      jQuery.easing = {
        linear: function (p) {
          return p;
        },
        swing: function (p) {
          return 0.5 - Math.cos(p * Math.PI) / 2;
        },
      };

      jQuery.fx = Tween.prototype.init;

      // Back Compat <1.8 extension point
      jQuery.fx.step = {};

      var fxNow,
        timerId,
        rfxtypes = /^(?:toggle|show|hide)$/,
        rfxnum = new RegExp("^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i"),
        rrun = /queueHooks$/,
        animationPrefilters = [defaultPrefilter],
        tweeners = {
          "*": [
            function (prop, value) {
              var tween = this.createTween(prop, value),
                target = tween.cur(),
                parts = rfxnum.exec(value),
                unit =
                  (parts && parts[3]) || (jQuery.cssNumber[prop] ? "" : "px"),
                // Starting value computation is required for potential unit mismatches
                start =
                  (jQuery.cssNumber[prop] || (unit !== "px" && +target)) &&
                  rfxnum.exec(jQuery.css(tween.elem, prop)),
                scale = 1,
                maxIterations = 20;

              if (start && start[3] !== unit) {
                // Trust units reported by jQuery.css
                unit = unit || start[3];

                // Make sure we update the tween properties later on
                parts = parts || [];

                // Iteratively approximate from a nonzero starting point
                start = +target || 1;

                do {
                  // If previous iteration zeroed out, double until we get *something*
                  // Use a string for doubling factor so we don't accidentally see scale as unchanged below
                  scale = scale || ".5";

                  // Adjust and apply
                  start = start / scale;
                  jQuery.style(tween.elem, prop, start + unit);

                  // Update scale, tolerating zero or NaN from tween.cur()
                  // And breaking the loop if scale is unchanged or perfect, or if we've just had enough
                } while (
                  scale !== (scale = tween.cur() / target) &&
                  scale !== 1 &&
                  --maxIterations
                );
              }

              // Update tween properties
              if (parts) {
                start = tween.start = +start || +target || 0;
                tween.unit = unit;
                // If a +=/-= token was provided, we're doing a relative animation
                tween.end = parts[1]
                  ? start + (parts[1] + 1) * parts[2]
                  : +parts[2];
              }

              return tween;
            },
          ],
        };

      // Animations created synchronously will run synchronously
      function createFxNow() {
        setTimeout(function () {
          fxNow = undefined;
        });
        return (fxNow = jQuery.now());
      }

      // Generate parameters to create a standard animation
      function genFx(type, includeWidth) {
        var which,
          i = 0,
          attrs = { height: type };

        // if we include width, step value is 1 to do all cssExpand values,
        // if we don't include width, step value is 2 to skip over Left and Right
        includeWidth = includeWidth ? 1 : 0;
        for (; i < 4; i += 2 - includeWidth) {
          which = cssExpand[i];
          attrs["margin" + which] = attrs["padding" + which] = type;
        }

        if (includeWidth) {
          attrs.opacity = attrs.width = type;
        }

        return attrs;
      }

      function createTween(value, prop, animation) {
        var tween,
          collection = (tweeners[prop] || []).concat(tweeners["*"]),
          index = 0,
          length = collection.length;
        for (; index < length; index++) {
          if ((tween = collection[index].call(animation, prop, value))) {
            // we're done with this property
            return tween;
          }
        }
      }

      function defaultPrefilter(elem, props, opts) {
        /* jshint validthis: true */
        var prop,
          value,
          toggle,
          tween,
          hooks,
          oldfire,
          display,
          anim = this,
          orig = {},
          style = elem.style,
          hidden = elem.nodeType && isHidden(elem),
          dataShow = data_priv.get(elem, "fxshow");

        // handle queue: false promises
        if (!opts.queue) {
          hooks = jQuery._queueHooks(elem, "fx");
          if (hooks.unqueued == null) {
            hooks.unqueued = 0;
            oldfire = hooks.empty.fire;
            hooks.empty.fire = function () {
              if (!hooks.unqueued) {
                oldfire();
              }
            };
          }
          hooks.unqueued++;

          anim.always(function () {
            // doing this makes sure that the complete handler will be called
            // before this completes
            anim.always(function () {
              hooks.unqueued--;
              if (!jQuery.queue(elem, "fx").length) {
                hooks.empty.fire();
              }
            });
          });
        }

        // height/width overflow pass
        if (elem.nodeType === 1 && ("height" in props || "width" in props)) {
          // Make sure that nothing sneaks out
          // Record all 3 overflow attributes because IE9-10 do not
          // change the overflow attribute when overflowX and
          // overflowY are set to the same value
          opts.overflow = [style.overflow, style.overflowX, style.overflowY];

          // Set display property to inline-block for height/width
          // animations on inline elements that are having width/height animated
          display = jQuery.css(elem, "display");
          // Get default display if display is currently "none"
          if (display === "none") {
            display = defaultDisplay(elem.nodeName);
          }
          if (display === "inline" && jQuery.css(elem, "float") === "none") {
            style.display = "inline-block";
          }
        }

        if (opts.overflow) {
          style.overflow = "hidden";
          anim.always(function () {
            style.overflow = opts.overflow[0];
            style.overflowX = opts.overflow[1];
            style.overflowY = opts.overflow[2];
          });
        }

        // show/hide pass
        for (prop in props) {
          value = props[prop];
          if (rfxtypes.exec(value)) {
            delete props[prop];
            toggle = toggle || value === "toggle";
            if (value === (hidden ? "hide" : "show")) {
              // If there is dataShow left over from a stopped hide or show and we are going to proceed with show, we should pretend to be hidden
              if (
                value === "show" &&
                dataShow &&
                dataShow[prop] !== undefined
              ) {
                hidden = true;
              } else {
                continue;
              }
            }
            orig[prop] =
              (dataShow && dataShow[prop]) || jQuery.style(elem, prop);
          }
        }

        if (!jQuery.isEmptyObject(orig)) {
          if (dataShow) {
            if ("hidden" in dataShow) {
              hidden = dataShow.hidden;
            }
          } else {
            dataShow = data_priv.access(elem, "fxshow", {});
          }

          // store state if its toggle - enables .stop().toggle() to "reverse"
          if (toggle) {
            dataShow.hidden = !hidden;
          }
          if (hidden) {
            jQuery(elem).show();
          } else {
            anim.done(function () {
              jQuery(elem).hide();
            });
          }
          anim.done(function () {
            var prop;

            data_priv.remove(elem, "fxshow");
            for (prop in orig) {
              jQuery.style(elem, prop, orig[prop]);
            }
          });
          for (prop in orig) {
            tween = createTween(hidden ? dataShow[prop] : 0, prop, anim);

            if (!(prop in dataShow)) {
              dataShow[prop] = tween.start;
              if (hidden) {
                tween.end = tween.start;
                tween.start = prop === "width" || prop === "height" ? 1 : 0;
              }
            }
          }
        }
      }

      function propFilter(props, specialEasing) {
        var index, name, easing, value, hooks;

        // camelCase, specialEasing and expand cssHook pass
        for (index in props) {
          name = jQuery.camelCase(index);
          easing = specialEasing[name];
          value = props[index];
          if (jQuery.isArray(value)) {
            easing = value[1];
            value = props[index] = value[0];
          }

          if (index !== name) {
            props[name] = value;
            delete props[index];
          }

          hooks = jQuery.cssHooks[name];
          if (hooks && "expand" in hooks) {
            value = hooks.expand(value);
            delete props[name];

            // not quite $.extend, this wont overwrite keys already present.
            // also - reusing 'index' from above because we have the correct "name"
            for (index in value) {
              if (!(index in props)) {
                props[index] = value[index];
                specialEasing[index] = easing;
              }
            }
          } else {
            specialEasing[name] = easing;
          }
        }
      }

      function Animation(elem, properties, options) {
        var result,
          stopped,
          index = 0,
          length = animationPrefilters.length,
          deferred = jQuery.Deferred().always(function () {
            // don't match elem in the :animated selector
            delete tick.elem;
          }),
          tick = function () {
            if (stopped) {
              return false;
            }
            var currentTime = fxNow || createFxNow(),
              remaining = Math.max(
                0,
                animation.startTime + animation.duration - currentTime,
              ),
              // archaic crash bug won't allow us to use 1 - ( 0.5 || 0 ) (#12497)
              temp = remaining / animation.duration || 0,
              percent = 1 - temp,
              index = 0,
              length = animation.tweens.length;

            for (; index < length; index++) {
              animation.tweens[index].run(percent);
            }

            deferred.notifyWith(elem, [animation, percent, remaining]);

            if (percent < 1 && length) {
              return remaining;
            } else {
              deferred.resolveWith(elem, [animation]);
              return false;
            }
          },
          animation = deferred.promise({
            elem: elem,
            props: jQuery.extend({}, properties),
            opts: jQuery.extend(true, { specialEasing: {} }, options),
            originalProperties: properties,
            originalOptions: options,
            startTime: fxNow || createFxNow(),
            duration: options.duration,
            tweens: [],
            createTween: function (prop, end) {
              var tween = jQuery.Tween(
                elem,
                animation.opts,
                prop,
                end,
                animation.opts.specialEasing[prop] || animation.opts.easing,
              );
              animation.tweens.push(tween);
              return tween;
            },
            stop: function (gotoEnd) {
              var index = 0,
                // if we are going to the end, we want to run all the tweens
                // otherwise we skip this part
                length = gotoEnd ? animation.tweens.length : 0;
              if (stopped) {
                return this;
              }
              stopped = true;
              for (; index < length; index++) {
                animation.tweens[index].run(1);
              }

              // resolve when we played the last frame
              // otherwise, reject
              if (gotoEnd) {
                deferred.resolveWith(elem, [animation, gotoEnd]);
              } else {
                deferred.rejectWith(elem, [animation, gotoEnd]);
              }
              return this;
            },
          }),
          props = animation.props;

        propFilter(props, animation.opts.specialEasing);

        for (; index < length; index++) {
          result = animationPrefilters[index].call(
            animation,
            elem,
            props,
            animation.opts,
          );
          if (result) {
            return result;
          }
        }

        jQuery.map(props, createTween, animation);

        if (jQuery.isFunction(animation.opts.start)) {
          animation.opts.start.call(elem, animation);
        }

        jQuery.fx.timer(
          jQuery.extend(tick, {
            elem: elem,
            anim: animation,
            queue: animation.opts.queue,
          }),
        );

        // attach callbacks from options
        return animation
          .progress(animation.opts.progress)
          .done(animation.opts.done, animation.opts.complete)
          .fail(animation.opts.fail)
          .always(animation.opts.always);
      }

      jQuery.Animation = jQuery.extend(Animation, {
        tweener: function (props, callback) {
          if (jQuery.isFunction(props)) {
            callback = props;
            props = ["*"];
          } else {
            props = props.split(" ");
          }

          var prop,
            index = 0,
            length = props.length;

          for (; index < length; index++) {
            prop = props[index];
            tweeners[prop] = tweeners[prop] || [];
            tweeners[prop].unshift(callback);
          }
        },

        prefilter: function (callback, prepend) {
          if (prepend) {
            animationPrefilters.unshift(callback);
          } else {
            animationPrefilters.push(callback);
          }
        },
      });

      jQuery.speed = function (speed, easing, fn) {
        var opt =
          speed && typeof speed === "object"
            ? jQuery.extend({}, speed)
            : {
                complete:
                  fn || (!fn && easing) || (jQuery.isFunction(speed) && speed),
                duration: speed,
                easing:
                  (fn && easing) ||
                  (easing && !jQuery.isFunction(easing) && easing),
              };

        opt.duration = jQuery.fx.off
          ? 0
          : typeof opt.duration === "number"
            ? opt.duration
            : opt.duration in jQuery.fx.speeds
              ? jQuery.fx.speeds[opt.duration]
              : jQuery.fx.speeds._default;

        // normalize opt.queue - true/undefined/null -> "fx"
        if (opt.queue == null || opt.queue === true) {
          opt.queue = "fx";
        }

        // Queueing
        opt.old = opt.complete;

        opt.complete = function () {
          if (jQuery.isFunction(opt.old)) {
            opt.old.call(this);
          }

          if (opt.queue) {
            jQuery.dequeue(this, opt.queue);
          }
        };

        return opt;
      };

      jQuery.fn.extend({
        fadeTo: function (speed, to, easing, callback) {
          // show any hidden elements after setting opacity to 0
          return (
            this.filter(isHidden)
              .css("opacity", 0)
              .show()

              // animate to the value specified
              .end()
              .animate({ opacity: to }, speed, easing, callback)
          );
        },
        animate: function (prop, speed, easing, callback) {
          var empty = jQuery.isEmptyObject(prop),
            optall = jQuery.speed(speed, easing, callback),
            doAnimation = function () {
              // Operate on a copy of prop so per-property easing won't be lost
              var anim = Animation(this, jQuery.extend({}, prop), optall);

              // Empty animations, or finishing resolves immediately
              if (empty || data_priv.get(this, "finish")) {
                anim.stop(true);
              }
            };
          doAnimation.finish = doAnimation;

          return empty || optall.queue === false
            ? this.each(doAnimation)
            : this.queue(optall.queue, doAnimation);
        },
        stop: function (type, clearQueue, gotoEnd) {
          var stopQueue = function (hooks) {
            var stop = hooks.stop;
            delete hooks.stop;
            stop(gotoEnd);
          };

          if (typeof type !== "string") {
            gotoEnd = clearQueue;
            clearQueue = type;
            type = undefined;
          }
          if (clearQueue && type !== false) {
            this.queue(type || "fx", []);
          }

          return this.each(function () {
            var dequeue = true,
              index = type != null && type + "queueHooks",
              timers = jQuery.timers,
              data = data_priv.get(this);

            if (index) {
              if (data[index] && data[index].stop) {
                stopQueue(data[index]);
              }
            } else {
              for (index in data) {
                if (data[index] && data[index].stop && rrun.test(index)) {
                  stopQueue(data[index]);
                }
              }
            }

            for (index = timers.length; index--; ) {
              if (
                timers[index].elem === this &&
                (type == null || timers[index].queue === type)
              ) {
                timers[index].anim.stop(gotoEnd);
                dequeue = false;
                timers.splice(index, 1);
              }
            }

            // start the next in the queue if the last step wasn't forced
            // timers currently will call their complete callbacks, which will dequeue
            // but only if they were gotoEnd
            if (dequeue || !gotoEnd) {
              jQuery.dequeue(this, type);
            }
          });
        },
        finish: function (type) {
          if (type !== false) {
            type = type || "fx";
          }
          return this.each(function () {
            var index,
              data = data_priv.get(this),
              queue = data[type + "queue"],
              hooks = data[type + "queueHooks"],
              timers = jQuery.timers,
              length = queue ? queue.length : 0;

            // enable finishing flag on private data
            data.finish = true;

            // empty the queue first
            jQuery.queue(this, type, []);

            if (hooks && hooks.stop) {
              hooks.stop.call(this, true);
            }

            // look for any active animations, and finish them
            for (index = timers.length; index--; ) {
              if (timers[index].elem === this && timers[index].queue === type) {
                timers[index].anim.stop(true);
                timers.splice(index, 1);
              }
            }

            // look for any animations in the old queue and finish them
            for (index = 0; index < length; index++) {
              if (queue[index] && queue[index].finish) {
                queue[index].finish.call(this);
              }
            }

            // turn off finishing flag
            delete data.finish;
          });
        },
      });

      jQuery.each(["toggle", "show", "hide"], function (i, name) {
        var cssFn = jQuery.fn[name];
        jQuery.fn[name] = function (speed, easing, callback) {
          return speed == null || typeof speed === "boolean"
            ? cssFn.apply(this, arguments)
            : this.animate(genFx(name, true), speed, easing, callback);
        };
      });

      // Generate shortcuts for custom animations
      jQuery.each(
        {
          slideDown: genFx("show"),
          slideUp: genFx("hide"),
          slideToggle: genFx("toggle"),
          fadeIn: { opacity: "show" },
          fadeOut: { opacity: "hide" },
          fadeToggle: { opacity: "toggle" },
        },
        function (name, props) {
          jQuery.fn[name] = function (speed, easing, callback) {
            return this.animate(props, speed, easing, callback);
          };
        },
      );

      jQuery.timers = [];
      jQuery.fx.tick = function () {
        var timer,
          i = 0,
          timers = jQuery.timers;

        fxNow = jQuery.now();

        for (; i < timers.length; i++) {
          timer = timers[i];
          // Checks the timer has not already been removed
          if (!timer() && timers[i] === timer) {
            timers.splice(i--, 1);
          }
        }

        if (!timers.length) {
          jQuery.fx.stop();
        }
        fxNow = undefined;
      };

      jQuery.fx.timer = function (timer) {
        jQuery.timers.push(timer);
        if (timer()) {
          jQuery.fx.start();
        } else {
          jQuery.timers.pop();
        }
      };

      jQuery.fx.interval = 13;

      jQuery.fx.start = function () {
        if (!timerId) {
          timerId = setInterval(jQuery.fx.tick, jQuery.fx.interval);
        }
      };

      jQuery.fx.stop = function () {
        clearInterval(timerId);
        timerId = null;
      };

      jQuery.fx.speeds = {
        slow: 600,
        fast: 200,
        // Default speed
        _default: 400,
      };

      // Based off of the plugin by Clint Helfers, with permission.
      // http://blindsignals.com/index.php/2009/07/jquery-delay/
      jQuery.fn.delay = function (time, type) {
        time = jQuery.fx ? jQuery.fx.speeds[time] || time : time;
        type = type || "fx";

        return this.queue(type, function (next, hooks) {
          var timeout = setTimeout(next, time);
          hooks.stop = function () {
            clearTimeout(timeout);
          };
        });
      };

      (function () {
        var input = document.createElement("input"),
          select = document.createElement("select"),
          opt = select.appendChild(document.createElement("option"));

        input.type = "checkbox";

        // Support: iOS 5.1, Android 4.x, Android 2.3
        // Check the default checkbox/radio value ("" on old WebKit; "on" elsewhere)
        support.checkOn = input.value !== "";

        // Must access the parent to make an option select properly
        // Support: IE9, IE10
        support.optSelected = opt.selected;

        // Make sure that the options inside disabled selects aren't marked as disabled
        // (WebKit marks them as disabled)
        select.disabled = true;
        support.optDisabled = !opt.disabled;

        // Check if an input maintains its value after becoming a radio
        // Support: IE9, IE10
        input = document.createElement("input");
        input.value = "t";
        input.type = "radio";
        support.radioValue = input.value === "t";
      })();

      var nodeHook,
        boolHook,
        attrHandle = jQuery.expr.attrHandle;

      jQuery.fn.extend({
        attr: function (name, value) {
          return access(this, jQuery.attr, name, value, arguments.length > 1);
        },

        removeAttr: function (name) {
          return this.each(function () {
            jQuery.removeAttr(this, name);
          });
        },
      });

      jQuery.extend({
        attr: function (elem, name, value) {
          var hooks,
            ret,
            nType = elem.nodeType;

          // don't get/set attributes on text, comment and attribute nodes
          if (!elem || nType === 3 || nType === 8 || nType === 2) {
            return;
          }

          // Fallback to prop when attributes are not supported
          if (typeof elem.getAttribute === strundefined) {
            return jQuery.prop(elem, name, value);
          }

          // All attributes are lowercase
          // Grab necessary hook if one is defined
          if (nType !== 1 || !jQuery.isXMLDoc(elem)) {
            name = name.toLowerCase();
            hooks =
              jQuery.attrHooks[name] ||
              (jQuery.expr.match.bool.test(name) ? boolHook : nodeHook);
          }

          if (value !== undefined) {
            if (value === null) {
              jQuery.removeAttr(elem, name);
            } else if (
              hooks &&
              "set" in hooks &&
              (ret = hooks.set(elem, value, name)) !== undefined
            ) {
              return ret;
            } else {
              elem.setAttribute(name, value + "");
              return value;
            }
          } else if (
            hooks &&
            "get" in hooks &&
            (ret = hooks.get(elem, name)) !== null
          ) {
            return ret;
          } else {
            ret = jQuery.find.attr(elem, name);

            // Non-existent attributes return null, we normalize to undefined
            return ret == null ? undefined : ret;
          }
        },

        removeAttr: function (elem, value) {
          var name,
            propName,
            i = 0,
            attrNames = value && value.match(rnotwhite);

          if (attrNames && elem.nodeType === 1) {
            while ((name = attrNames[i++])) {
              propName = jQuery.propFix[name] || name;

              // Boolean attributes get special treatment (#10870)
              if (jQuery.expr.match.bool.test(name)) {
                // Set corresponding property to false
                elem[propName] = false;
              }

              elem.removeAttribute(name);
            }
          }
        },

        attrHooks: {
          type: {
            set: function (elem, value) {
              if (
                !support.radioValue &&
                value === "radio" &&
                jQuery.nodeName(elem, "input")
              ) {
                // Setting the type on a radio button after the value resets the value in IE6-9
                // Reset value to default in case type is set after value during creation
                var val = elem.value;
                elem.setAttribute("type", value);
                if (val) {
                  elem.value = val;
                }
                return value;
              }
            },
          },
        },
      });

      // Hooks for boolean attributes
      boolHook = {
        set: function (elem, value, name) {
          if (value === false) {
            // Remove boolean attributes when set to false
            jQuery.removeAttr(elem, name);
          } else {
            elem.setAttribute(name, name);
          }
          return name;
        },
      };
      jQuery.each(
        jQuery.expr.match.bool.source.match(/\w+/g),
        function (i, name) {
          var getter = attrHandle[name] || jQuery.find.attr;

          attrHandle[name] = function (elem, name, isXML) {
            var ret, handle;
            if (!isXML) {
              // Avoid an infinite loop by temporarily removing this function from the getter
              handle = attrHandle[name];
              attrHandle[name] = ret;
              ret =
                getter(elem, name, isXML) != null ? name.toLowerCase() : null;
              attrHandle[name] = handle;
            }
            return ret;
          };
        },
      );

      var rfocusable = /^(?:input|select|textarea|button)$/i;

      jQuery.fn.extend({
        prop: function (name, value) {
          return access(this, jQuery.prop, name, value, arguments.length > 1);
        },

        removeProp: function (name) {
          return this.each(function () {
            delete this[jQuery.propFix[name] || name];
          });
        },
      });

      jQuery.extend({
        propFix: {
          for: "htmlFor",
          class: "className",
        },

        prop: function (elem, name, value) {
          var ret,
            hooks,
            notxml,
            nType = elem.nodeType;

          // don't get/set properties on text, comment and attribute nodes
          if (!elem || nType === 3 || nType === 8 || nType === 2) {
            return;
          }

          notxml = nType !== 1 || !jQuery.isXMLDoc(elem);

          if (notxml) {
            // Fix name and attach hooks
            name = jQuery.propFix[name] || name;
            hooks = jQuery.propHooks[name];
          }

          if (value !== undefined) {
            return hooks &&
              "set" in hooks &&
              (ret = hooks.set(elem, value, name)) !== undefined
              ? ret
              : (elem[name] = value);
          } else {
            return hooks &&
              "get" in hooks &&
              (ret = hooks.get(elem, name)) !== null
              ? ret
              : elem[name];
          }
        },

        propHooks: {
          tabIndex: {
            get: function (elem) {
              return elem.hasAttribute("tabindex") ||
                rfocusable.test(elem.nodeName) ||
                elem.href
                ? elem.tabIndex
                : -1;
            },
          },
        },
      });

      // Support: IE9+
      // Selectedness for an option in an optgroup can be inaccurate
      if (!support.optSelected) {
        jQuery.propHooks.selected = {
          get: function (elem) {
            var parent = elem.parentNode;
            if (parent && parent.parentNode) {
              parent.parentNode.selectedIndex;
            }
            return null;
          },
        };
      }

      jQuery.each(
        [
          "tabIndex",
          "readOnly",
          "maxLength",
          "cellSpacing",
          "cellPadding",
          "rowSpan",
          "colSpan",
          "useMap",
          "frameBorder",
          "contentEditable",
        ],
        function () {
          jQuery.propFix[this.toLowerCase()] = this;
        },
      );

      var rclass = /[\t\r\n\f]/g;

      jQuery.fn.extend({
        addClass: function (value) {
          var classes,
            elem,
            cur,
            clazz,
            j,
            finalValue,
            proceed = typeof value === "string" && value,
            i = 0,
            len = this.length;

          if (jQuery.isFunction(value)) {
            return this.each(function (j) {
              jQuery(this).addClass(value.call(this, j, this.className));
            });
          }

          if (proceed) {
            // The disjunction here is for better compressibility (see removeClass)
            classes = (value || "").match(rnotwhite) || [];

            for (; i < len; i++) {
              elem = this[i];
              cur =
                elem.nodeType === 1 &&
                (elem.className
                  ? (" " + elem.className + " ").replace(rclass, " ")
                  : " ");

              if (cur) {
                j = 0;
                while ((clazz = classes[j++])) {
                  if (cur.indexOf(" " + clazz + " ") < 0) {
                    cur += clazz + " ";
                  }
                }

                // only assign if different to avoid unneeded rendering.
                finalValue = jQuery.trim(cur);
                if (elem.className !== finalValue) {
                  elem.className = finalValue;
                }
              }
            }
          }

          return this;
        },

        removeClass: function (value) {
          var classes,
            elem,
            cur,
            clazz,
            j,
            finalValue,
            proceed =
              arguments.length === 0 || (typeof value === "string" && value),
            i = 0,
            len = this.length;

          if (jQuery.isFunction(value)) {
            return this.each(function (j) {
              jQuery(this).removeClass(value.call(this, j, this.className));
            });
          }
          if (proceed) {
            classes = (value || "").match(rnotwhite) || [];

            for (; i < len; i++) {
              elem = this[i];
              // This expression is here for better compressibility (see addClass)
              cur =
                elem.nodeType === 1 &&
                (elem.className
                  ? (" " + elem.className + " ").replace(rclass, " ")
                  : "");

              if (cur) {
                j = 0;
                while ((clazz = classes[j++])) {
                  // Remove *all* instances
                  while (cur.indexOf(" " + clazz + " ") >= 0) {
                    cur = cur.replace(" " + clazz + " ", " ");
                  }
                }

                // only assign if different to avoid unneeded rendering.
                finalValue = value ? jQuery.trim(cur) : "";
                if (elem.className !== finalValue) {
                  elem.className = finalValue;
                }
              }
            }
          }

          return this;
        },

        toggleClass: function (value, stateVal) {
          var type = typeof value;

          if (typeof stateVal === "boolean" && type === "string") {
            return stateVal ? this.addClass(value) : this.removeClass(value);
          }

          if (jQuery.isFunction(value)) {
            return this.each(function (i) {
              jQuery(this).toggleClass(
                value.call(this, i, this.className, stateVal),
                stateVal,
              );
            });
          }

          return this.each(function () {
            if (type === "string") {
              // toggle individual class names
              var className,
                i = 0,
                self = jQuery(this),
                classNames = value.match(rnotwhite) || [];

              while ((className = classNames[i++])) {
                // check each className given, space separated list
                if (self.hasClass(className)) {
                  self.removeClass(className);
                } else {
                  self.addClass(className);
                }
              }

              // Toggle whole class name
            } else if (type === strundefined || type === "boolean") {
              if (this.className) {
                // store className if set
                data_priv.set(this, "__className__", this.className);
              }

              // If the element has a class name or if we're passed "false",
              // then remove the whole classname (if there was one, the above saved it).
              // Otherwise bring back whatever was previously saved (if anything),
              // falling back to the empty string if nothing was stored.
              this.className =
                this.className || value === false
                  ? ""
                  : data_priv.get(this, "__className__") || "";
            }
          });
        },

        hasClass: function (selector) {
          var className = " " + selector + " ",
            i = 0,
            l = this.length;
          for (; i < l; i++) {
            if (
              this[i].nodeType === 1 &&
              (" " + this[i].className + " ")
                .replace(rclass, " ")
                .indexOf(className) >= 0
            ) {
              return true;
            }
          }

          return false;
        },
      });

      var rreturn = /\r/g;

      jQuery.fn.extend({
        val: function (value) {
          var hooks,
            ret,
            isFunction,
            elem = this[0];

          if (!arguments.length) {
            if (elem) {
              hooks =
                jQuery.valHooks[elem.type] ||
                jQuery.valHooks[elem.nodeName.toLowerCase()];

              if (
                hooks &&
                "get" in hooks &&
                (ret = hooks.get(elem, "value")) !== undefined
              ) {
                return ret;
              }

              ret = elem.value;

              return typeof ret === "string"
                ? // handle most common string cases
                  ret.replace(rreturn, "")
                : // handle cases where value is null/undef or number
                  ret == null
                  ? ""
                  : ret;
            }

            return;
          }

          isFunction = jQuery.isFunction(value);

          return this.each(function (i) {
            var val;

            if (this.nodeType !== 1) {
              return;
            }

            if (isFunction) {
              val = value.call(this, i, jQuery(this).val());
            } else {
              val = value;
            }

            // Treat null/undefined as ""; convert numbers to string
            if (val == null) {
              val = "";
            } else if (typeof val === "number") {
              val += "";
            } else if (jQuery.isArray(val)) {
              val = jQuery.map(val, function (value) {
                return value == null ? "" : value + "";
              });
            }

            hooks =
              jQuery.valHooks[this.type] ||
              jQuery.valHooks[this.nodeName.toLowerCase()];

            // If set returns undefined, fall back to normal setting
            if (
              !hooks ||
              !("set" in hooks) ||
              hooks.set(this, val, "value") === undefined
            ) {
              this.value = val;
            }
          });
        },
      });

      jQuery.extend({
        valHooks: {
          select: {
            get: function (elem) {
              var value,
                option,
                options = elem.options,
                index = elem.selectedIndex,
                one = elem.type === "select-one" || index < 0,
                values = one ? null : [],
                max = one ? index + 1 : options.length,
                i = index < 0 ? max : one ? index : 0;

              // Loop through all the selected options
              for (; i < max; i++) {
                option = options[i];

                // IE6-9 doesn't update selected after form reset (#2551)
                if (
                  (option.selected || i === index) &&
                  // Don't return options that are disabled or in a disabled optgroup
                  (support.optDisabled
                    ? !option.disabled
                    : option.getAttribute("disabled") === null) &&
                  (!option.parentNode.disabled ||
                    !jQuery.nodeName(option.parentNode, "optgroup"))
                ) {
                  // Get the specific value for the option
                  value = jQuery(option).val();

                  // We don't need an array for one selects
                  if (one) {
                    return value;
                  }

                  // Multi-Selects return an array
                  values.push(value);
                }
              }

              return values;
            },

            set: function (elem, value) {
              var optionSet,
                option,
                options = elem.options,
                values = jQuery.makeArray(value),
                i = options.length;

              while (i--) {
                option = options[i];
                if (
                  (option.selected =
                    jQuery.inArray(jQuery(option).val(), values) >= 0)
                ) {
                  optionSet = true;
                }
              }

              // force browsers to behave consistently when non-matching value is set
              if (!optionSet) {
                elem.selectedIndex = -1;
              }
              return values;
            },
          },
        },
      });

      // Radios and checkboxes getter/setter
      jQuery.each(["radio", "checkbox"], function () {
        jQuery.valHooks[this] = {
          set: function (elem, value) {
            if (jQuery.isArray(value)) {
              return (elem.checked =
                jQuery.inArray(jQuery(elem).val(), value) >= 0);
            }
          },
        };
        if (!support.checkOn) {
          jQuery.valHooks[this].get = function (elem) {
            // Support: Webkit
            // "" is returned instead of "on" if a value isn't specified
            return elem.getAttribute("value") === null ? "on" : elem.value;
          };
        }
      });

      // Return jQuery for attributes-only inclusion

      jQuery.each(
        (
          "blur focus focusin focusout load resize scroll unload click dblclick " +
          "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
          "change select submit keydown keypress keyup error contextmenu"
        ).split(" "),
        function (i, name) {
          // Handle event binding
          jQuery.fn[name] = function (data, fn) {
            return arguments.length > 0
              ? this.on(name, null, data, fn)
              : this.trigger(name);
          };
        },
      );

      jQuery.fn.extend({
        hover: function (fnOver, fnOut) {
          return this.mouseenter(fnOver).mouseleave(fnOut || fnOver);
        },

        bind: function (types, data, fn) {
          return this.on(types, null, data, fn);
        },
        unbind: function (types, fn) {
          return this.off(types, null, fn);
        },

        delegate: function (selector, types, data, fn) {
          return this.on(types, selector, data, fn);
        },
        undelegate: function (selector, types, fn) {
          // ( namespace ) or ( selector, types [, fn] )
          return arguments.length === 1
            ? this.off(selector, "**")
            : this.off(types, selector || "**", fn);
        },
      });

      var nonce = jQuery.now();

      var rquery = /\?/;

      // Support: Android 2.3
      // Workaround failure to string-cast null input
      jQuery.parseJSON = function (data) {
        return JSON.parse(data + "");
      };

      // Cross-browser xml parsing
      jQuery.parseXML = function (data) {
        var xml, tmp;
        if (!data || typeof data !== "string") {
          return null;
        }

        // Support: IE9
        try {
          tmp = new DOMParser();
          xml = tmp.parseFromString(data, "text/xml");
        } catch (e) {
          xml = undefined;
        }

        if (!xml || xml.getElementsByTagName("parsererror").length) {
          jQuery.error("Invalid XML: " + data);
        }
        return xml;
      };

      var // Document location
        ajaxLocParts,
        ajaxLocation,
        rhash = /#.*$/,
        rts = /([?&])_=[^&]*/,
        rheaders = /^(.*?):[ \t]*([^\r\n]*)$/gm,
        // #7653, #8125, #8152: local protocol detection
        rlocalProtocol =
          /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
        rnoContent = /^(?:GET|HEAD)$/,
        rprotocol = /^\/\//,
        rurl = /^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,
        /* Prefilters
         * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
         * 2) These are called:
         *    - BEFORE asking for a transport
         *    - AFTER param serialization (s.data is a string if s.processData is true)
         * 3) key is the dataType
         * 4) the catchall symbol "*" can be used
         * 5) execution will start with transport dataType and THEN continue down to "*" if needed
         */
        prefilters = {},
        /* Transports bindings
         * 1) key is the dataType
         * 2) the catchall symbol "*" can be used
         * 3) selection will start with transport dataType and THEN go to "*" if needed
         */
        transports = {},
        // Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
        allTypes = "*/".concat("*");

      // #8138, IE may throw an exception when accessing
      // a field from window.location if document.domain has been set
      try {
        ajaxLocation = location.href;
      } catch (e) {
        // Use the href attribute of an A element
        // since IE will modify it given document.location
        ajaxLocation = document.createElement("a");
        ajaxLocation.href = "";
        ajaxLocation = ajaxLocation.href;
      }

      // Segment location into parts
      ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || [];

      // Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
      function addToPrefiltersOrTransports(structure) {
        // dataTypeExpression is optional and defaults to "*"
        return function (dataTypeExpression, func) {
          if (typeof dataTypeExpression !== "string") {
            func = dataTypeExpression;
            dataTypeExpression = "*";
          }

          var dataType,
            i = 0,
            dataTypes = dataTypeExpression.toLowerCase().match(rnotwhite) || [];

          if (jQuery.isFunction(func)) {
            // For each dataType in the dataTypeExpression
            while ((dataType = dataTypes[i++])) {
              // Prepend if requested
              if (dataType[0] === "+") {
                dataType = dataType.slice(1) || "*";
                (structure[dataType] = structure[dataType] || []).unshift(func);

                // Otherwise append
              } else {
                (structure[dataType] = structure[dataType] || []).push(func);
              }
            }
          }
        };
      }

      // Base inspection function for prefilters and transports
      function inspectPrefiltersOrTransports(
        structure,
        options,
        originalOptions,
        jqXHR,
      ) {
        var inspected = {},
          seekingTransport = structure === transports;

        function inspect(dataType) {
          var selected;
          inspected[dataType] = true;
          jQuery.each(
            structure[dataType] || [],
            function (_, prefilterOrFactory) {
              var dataTypeOrTransport = prefilterOrFactory(
                options,
                originalOptions,
                jqXHR,
              );
              if (
                typeof dataTypeOrTransport === "string" &&
                !seekingTransport &&
                !inspected[dataTypeOrTransport]
              ) {
                options.dataTypes.unshift(dataTypeOrTransport);
                inspect(dataTypeOrTransport);
                return false;
              } else if (seekingTransport) {
                return !(selected = dataTypeOrTransport);
              }
            },
          );
          return selected;
        }

        return (
          inspect(options.dataTypes[0]) || (!inspected["*"] && inspect("*"))
        );
      }

      // A special extend for ajax options
      // that takes "flat" options (not to be deep extended)
      // Fixes #9887
      function ajaxExtend(target, src) {
        var key,
          deep,
          flatOptions = jQuery.ajaxSettings.flatOptions || {};

        for (key in src) {
          if (src[key] !== undefined) {
            (flatOptions[key] ? target : deep || (deep = {}))[key] = src[key];
          }
        }
        if (deep) {
          jQuery.extend(true, target, deep);
        }

        return target;
      }

      /* Handles responses to an ajax request:
       * - finds the right dataType (mediates between content-type and expected dataType)
       * - returns the corresponding response
       */
      function ajaxHandleResponses(s, jqXHR, responses) {
        var ct,
          type,
          finalDataType,
          firstDataType,
          contents = s.contents,
          dataTypes = s.dataTypes;

        // Remove auto dataType and get content-type in the process
        while (dataTypes[0] === "*") {
          dataTypes.shift();
          if (ct === undefined) {
            ct = s.mimeType || jqXHR.getResponseHeader("Content-Type");
          }
        }

        // Check if we're dealing with a known content-type
        if (ct) {
          for (type in contents) {
            if (contents[type] && contents[type].test(ct)) {
              dataTypes.unshift(type);
              break;
            }
          }
        }

        // Check to see if we have a response for the expected dataType
        if (dataTypes[0] in responses) {
          finalDataType = dataTypes[0];
        } else {
          // Try convertible dataTypes
          for (type in responses) {
            if (!dataTypes[0] || s.converters[type + " " + dataTypes[0]]) {
              finalDataType = type;
              break;
            }
            if (!firstDataType) {
              firstDataType = type;
            }
          }
          // Or just use first one
          finalDataType = finalDataType || firstDataType;
        }

        // If we found a dataType
        // We add the dataType to the list if needed
        // and return the corresponding response
        if (finalDataType) {
          if (finalDataType !== dataTypes[0]) {
            dataTypes.unshift(finalDataType);
          }
          return responses[finalDataType];
        }
      }

      /* Chain conversions given the request and the original response
       * Also sets the responseXXX fields on the jqXHR instance
       */
      function ajaxConvert(s, response, jqXHR, isSuccess) {
        var conv2,
          current,
          conv,
          tmp,
          prev,
          converters = {},
          // Work with a copy of dataTypes in case we need to modify it for conversion
          dataTypes = s.dataTypes.slice();

        // Create converters map with lowercased keys
        if (dataTypes[1]) {
          for (conv in s.converters) {
            converters[conv.toLowerCase()] = s.converters[conv];
          }
        }

        current = dataTypes.shift();

        // Convert to each sequential dataType
        while (current) {
          if (s.responseFields[current]) {
            jqXHR[s.responseFields[current]] = response;
          }

          // Apply the dataFilter if provided
          if (!prev && isSuccess && s.dataFilter) {
            response = s.dataFilter(response, s.dataType);
          }

          prev = current;
          current = dataTypes.shift();

          if (current) {
            // There's only work to do if current dataType is non-auto
            if (current === "*") {
              current = prev;

              // Convert response if prev dataType is non-auto and differs from current
            } else if (prev !== "*" && prev !== current) {
              // Seek a direct converter
              conv =
                converters[prev + " " + current] || converters["* " + current];

              // If none found, seek a pair
              if (!conv) {
                for (conv2 in converters) {
                  // If conv2 outputs current
                  tmp = conv2.split(" ");
                  if (tmp[1] === current) {
                    // If prev can be converted to accepted input
                    conv =
                      converters[prev + " " + tmp[0]] ||
                      converters["* " + tmp[0]];
                    if (conv) {
                      // Condense equivalence converters
                      if (conv === true) {
                        conv = converters[conv2];

                        // Otherwise, insert the intermediate dataType
                      } else if (converters[conv2] !== true) {
                        current = tmp[0];
                        dataTypes.unshift(tmp[1]);
                      }
                      break;
                    }
                  }
                }
              }

              // Apply converter (if not an equivalence)
              if (conv !== true) {
                // Unless errors are allowed to bubble, catch and return them
                if (conv && s["throws"]) {
                  response = conv(response);
                } else {
                  try {
                    response = conv(response);
                  } catch (e) {
                    return {
                      state: "parsererror",
                      error: conv
                        ? e
                        : "No conversion from " + prev + " to " + current,
                    };
                  }
                }
              }
            }
          }
        }

        return { state: "success", data: response };
      }

      jQuery.extend({
        // Counter for holding the number of active queries
        active: 0,

        // Last-Modified header cache for next request
        lastModified: {},
        etag: {},

        ajaxSettings: {
          url: ajaxLocation,
          type: "GET",
          isLocal: rlocalProtocol.test(ajaxLocParts[1]),
          global: true,
          processData: true,
          async: true,
          contentType: "application/x-www-form-urlencoded; charset=UTF-8",
          /*
    timeout: 0,
    data: null,
    dataType: null,
    username: null,
    password: null,
    cache: null,
    throws: false,
    traditional: false,
    headers: {},
    */

          accepts: {
            "*": allTypes,
            text: "text/plain",
            html: "text/html",
            xml: "application/xml, text/xml",
            json: "application/json, text/javascript",
          },

          contents: {
            xml: /xml/,
            html: /html/,
            json: /json/,
          },

          responseFields: {
            xml: "responseXML",
            text: "responseText",
            json: "responseJSON",
          },

          // Data converters
          // Keys separate source (or catchall "*") and destination types with a single space
          converters: {
            // Convert anything to text
            "* text": String,

            // Text to html (true = no transformation)
            "text html": true,

            // Evaluate text as a json expression
            "text json": jQuery.parseJSON,

            // Parse text as xml
            "text xml": jQuery.parseXML,
          },

          // For options that shouldn't be deep extended:
          // you can add your own custom options here if
          // and when you create one that shouldn't be
          // deep extended (see ajaxExtend)
          flatOptions: {
            url: true,
            context: true,
          },
        },

        // Creates a full fledged settings object into target
        // with both ajaxSettings and settings fields.
        // If target is omitted, writes into ajaxSettings.
        ajaxSetup: function (target, settings) {
          return settings
            ? // Building a settings object
              ajaxExtend(ajaxExtend(target, jQuery.ajaxSettings), settings)
            : // Extending ajaxSettings
              ajaxExtend(jQuery.ajaxSettings, target);
        },

        ajaxPrefilter: addToPrefiltersOrTransports(prefilters),
        ajaxTransport: addToPrefiltersOrTransports(transports),

        // Main method
        ajax: function (url, options) {
          // If url is an object, simulate pre-1.5 signature
          if (typeof url === "object") {
            options = url;
            url = undefined;
          }

          // Force options to be an object
          options = options || {};

          var transport,
            // URL without anti-cache param
            cacheURL,
            // Response headers
            responseHeadersString,
            responseHeaders,
            // timeout handle
            timeoutTimer,
            // Cross-domain detection vars
            parts,
            // To know if global events are to be dispatched
            fireGlobals,
            // Loop variable
            i,
            // Create the final options object
            s = jQuery.ajaxSetup({}, options),
            // Callbacks context
            callbackContext = s.context || s,
            // Context for global events is callbackContext if it is a DOM node or jQuery collection
            globalEventContext =
              s.context && (callbackContext.nodeType || callbackContext.jquery)
                ? jQuery(callbackContext)
                : jQuery.event,
            // Deferreds
            deferred = jQuery.Deferred(),
            completeDeferred = jQuery.Callbacks("once memory"),
            // Status-dependent callbacks
            statusCode = s.statusCode || {},
            // Headers (they are sent all at once)
            requestHeaders = {},
            requestHeadersNames = {},
            // The jqXHR state
            state = 0,
            // Default abort message
            strAbort = "canceled",
            // Fake xhr
            jqXHR = {
              readyState: 0,

              // Builds headers hashtable if needed
              getResponseHeader: function (key) {
                var match;
                if (state === 2) {
                  if (!responseHeaders) {
                    responseHeaders = {};
                    while ((match = rheaders.exec(responseHeadersString))) {
                      responseHeaders[match[1].toLowerCase()] = match[2];
                    }
                  }
                  match = responseHeaders[key.toLowerCase()];
                }
                return match == null ? null : match;
              },

              // Raw string
              getAllResponseHeaders: function () {
                return state === 2 ? responseHeadersString : null;
              },

              // Caches the header
              setRequestHeader: function (name, value) {
                var lname = name.toLowerCase();
                if (!state) {
                  name = requestHeadersNames[lname] =
                    requestHeadersNames[lname] || name;
                  requestHeaders[name] = value;
                }
                return this;
              },

              // Overrides response content-type header
              overrideMimeType: function (type) {
                if (!state) {
                  s.mimeType = type;
                }
                return this;
              },

              // Status-dependent callbacks
              statusCode: function (map) {
                var code;
                if (map) {
                  if (state < 2) {
                    for (code in map) {
                      // Lazy-add the new callback in a way that preserves old ones
                      statusCode[code] = [statusCode[code], map[code]];
                    }
                  } else {
                    // Execute the appropriate callbacks
                    jqXHR.always(map[jqXHR.status]);
                  }
                }
                return this;
              },

              // Cancel the request
              abort: function (statusText) {
                var finalText = statusText || strAbort;
                if (transport) {
                  transport.abort(finalText);
                }
                done(0, finalText);
                return this;
              },
            };

          // Attach deferreds
          deferred.promise(jqXHR).complete = completeDeferred.add;
          jqXHR.success = jqXHR.done;
          jqXHR.error = jqXHR.fail;

          // Remove hash character (#7531: and string promotion)
          // Add protocol if not provided (prefilters might expect it)
          // Handle falsy url in the settings object (#10093: consistency with old signature)
          // We also use the url parameter if available
          s.url = ((url || s.url || ajaxLocation) + "")
            .replace(rhash, "")
            .replace(rprotocol, ajaxLocParts[1] + "//");

          // Alias method option to type as per ticket #12004
          s.type = options.method || options.type || s.method || s.type;

          // Extract dataTypes list
          s.dataTypes = jQuery
            .trim(s.dataType || "*")
            .toLowerCase()
            .match(rnotwhite) || [""];

          // A cross-domain request is in order when we have a protocol:host:port mismatch
          if (s.crossDomain == null) {
            parts = rurl.exec(s.url.toLowerCase());
            s.crossDomain = !!(
              parts &&
              (parts[1] !== ajaxLocParts[1] ||
                parts[2] !== ajaxLocParts[2] ||
                (parts[3] || (parts[1] === "http:" ? "80" : "443")) !==
                  (ajaxLocParts[3] ||
                    (ajaxLocParts[1] === "http:" ? "80" : "443")))
            );
          }

          // Convert data if not already a string
          if (s.data && s.processData && typeof s.data !== "string") {
            s.data = jQuery.param(s.data, s.traditional);
          }

          // Apply prefilters
          inspectPrefiltersOrTransports(prefilters, s, options, jqXHR);

          // If request was aborted inside a prefilter, stop there
          if (state === 2) {
            return jqXHR;
          }

          // We can fire global events as of now if asked to
          fireGlobals = s.global;

          // Watch for a new set of requests
          if (fireGlobals && jQuery.active++ === 0) {
            jQuery.event.trigger("ajaxStart");
          }

          // Uppercase the type
          s.type = s.type.toUpperCase();

          // Determine if request has content
          s.hasContent = !rnoContent.test(s.type);

          // Save the URL in case we're toying with the If-Modified-Since
          // and/or If-None-Match header later on
          cacheURL = s.url;

          // More options handling for requests with no content
          if (!s.hasContent) {
            // If data is available, append data to url
            if (s.data) {
              cacheURL = s.url += (rquery.test(cacheURL) ? "&" : "?") + s.data;
              // #9682: remove data so that it's not used in an eventual retry
              delete s.data;
            }

            // Add anti-cache in url if needed
            if (s.cache === false) {
              s.url = rts.test(cacheURL)
                ? // If there is already a '_' parameter, set its value
                  cacheURL.replace(rts, "$1_=" + nonce++)
                : // Otherwise add one to the end
                  cacheURL +
                  (rquery.test(cacheURL) ? "&" : "?") +
                  "_=" +
                  nonce++;
            }
          }

          // Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
          if (s.ifModified) {
            if (jQuery.lastModified[cacheURL]) {
              jqXHR.setRequestHeader(
                "If-Modified-Since",
                jQuery.lastModified[cacheURL],
              );
            }
            if (jQuery.etag[cacheURL]) {
              jqXHR.setRequestHeader("If-None-Match", jQuery.etag[cacheURL]);
            }
          }

          // Set the correct header, if data is being sent
          if (
            (s.data && s.hasContent && s.contentType !== false) ||
            options.contentType
          ) {
            jqXHR.setRequestHeader("Content-Type", s.contentType);
          }

          // Set the Accepts header for the server, depending on the dataType
          jqXHR.setRequestHeader(
            "Accept",
            s.dataTypes[0] && s.accepts[s.dataTypes[0]]
              ? s.accepts[s.dataTypes[0]] +
                  (s.dataTypes[0] !== "*" ? ", " + allTypes + "; q=0.01" : "")
              : s.accepts["*"],
          );

          // Check for headers option
          for (i in s.headers) {
            jqXHR.setRequestHeader(i, s.headers[i]);
          }

          // Allow custom headers/mimetypes and early abort
          if (
            s.beforeSend &&
            (s.beforeSend.call(callbackContext, jqXHR, s) === false ||
              state === 2)
          ) {
            // Abort if not done already and return
            return jqXHR.abort();
          }

          // aborting is no longer a cancellation
          strAbort = "abort";

          // Install callbacks on deferreds
          for (i in { success: 1, error: 1, complete: 1 }) {
            jqXHR[i](s[i]);
          }

          // Get transport
          transport = inspectPrefiltersOrTransports(
            transports,
            s,
            options,
            jqXHR,
          );

          // If no transport, we auto-abort
          if (!transport) {
            done(-1, "No Transport");
          } else {
            jqXHR.readyState = 1;

            // Send global event
            if (fireGlobals) {
              globalEventContext.trigger("ajaxSend", [jqXHR, s]);
            }
            // Timeout
            if (s.async && s.timeout > 0) {
              timeoutTimer = setTimeout(function () {
                jqXHR.abort("timeout");
              }, s.timeout);
            }

            try {
              state = 1;
              transport.send(requestHeaders, done);
            } catch (e) {
              // Propagate exception as error if not done
              if (state < 2) {
                done(-1, e);
                // Simply rethrow otherwise
              } else {
                throw e;
              }
            }
          }

          // Callback for when everything is done
          function done(status, nativeStatusText, responses, headers) {
            var isSuccess,
              success,
              error,
              response,
              modified,
              statusText = nativeStatusText;

            // Called once
            if (state === 2) {
              return;
            }

            // State is "done" now
            state = 2;

            // Clear timeout if it exists
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
            }

            // Dereference transport for early garbage collection
            // (no matter how long the jqXHR object will be used)
            transport = undefined;

            // Cache response headers
            responseHeadersString = headers || "";

            // Set readyState
            jqXHR.readyState = status > 0 ? 4 : 0;

            // Determine if successful
            isSuccess = (status >= 200 && status < 300) || status === 304;

            // Get response data
            if (responses) {
              response = ajaxHandleResponses(s, jqXHR, responses);
            }

            // Convert no matter what (that way responseXXX fields are always set)
            response = ajaxConvert(s, response, jqXHR, isSuccess);

            // If successful, handle type chaining
            if (isSuccess) {
              // Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
              if (s.ifModified) {
                modified = jqXHR.getResponseHeader("Last-Modified");
                if (modified) {
                  jQuery.lastModified[cacheURL] = modified;
                }
                modified = jqXHR.getResponseHeader("etag");
                if (modified) {
                  jQuery.etag[cacheURL] = modified;
                }
              }

              // if no content
              if (status === 204 || s.type === "HEAD") {
                statusText = "nocontent";

                // if not modified
              } else if (status === 304) {
                statusText = "notmodified";

                // If we have data, let's convert it
              } else {
                statusText = response.state;
                success = response.data;
                error = response.error;
                isSuccess = !error;
              }
            } else {
              // We extract error from statusText
              // then normalize statusText and status for non-aborts
              error = statusText;
              if (status || !statusText) {
                statusText = "error";
                if (status < 0) {
                  status = 0;
                }
              }
            }

            // Set data for the fake xhr object
            jqXHR.status = status;
            jqXHR.statusText = (nativeStatusText || statusText) + "";

            // Success/Error
            if (isSuccess) {
              deferred.resolveWith(callbackContext, [
                success,
                statusText,
                jqXHR,
              ]);
            } else {
              deferred.rejectWith(callbackContext, [jqXHR, statusText, error]);
            }

            // Status-dependent callbacks
            jqXHR.statusCode(statusCode);
            statusCode = undefined;

            if (fireGlobals) {
              globalEventContext.trigger(
                isSuccess ? "ajaxSuccess" : "ajaxError",
                [jqXHR, s, isSuccess ? success : error],
              );
            }

            // Complete
            completeDeferred.fireWith(callbackContext, [jqXHR, statusText]);

            if (fireGlobals) {
              globalEventContext.trigger("ajaxComplete", [jqXHR, s]);
              // Handle the global AJAX counter
              if (!--jQuery.active) {
                jQuery.event.trigger("ajaxStop");
              }
            }
          }

          return jqXHR;
        },

        getJSON: function (url, data, callback) {
          return jQuery.get(url, data, callback, "json");
        },

        getScript: function (url, callback) {
          return jQuery.get(url, undefined, callback, "script");
        },
      });

      jQuery.each(["get", "post"], function (i, method) {
        jQuery[method] = function (url, data, callback, type) {
          // shift arguments if data argument was omitted
          if (jQuery.isFunction(data)) {
            type = type || callback;
            callback = data;
            data = undefined;
          }

          return jQuery.ajax({
            url: url,
            type: method,
            dataType: type,
            data: data,
            success: callback,
          });
        };
      });

      // Attach a bunch of functions for handling common AJAX events
      jQuery.each(
        [
          "ajaxStart",
          "ajaxStop",
          "ajaxComplete",
          "ajaxError",
          "ajaxSuccess",
          "ajaxSend",
        ],
        function (i, type) {
          jQuery.fn[type] = function (fn) {
            return this.on(type, fn);
          };
        },
      );

      jQuery._evalUrl = function (url) {
        return jQuery.ajax({
          url: url,
          type: "GET",
          dataType: "script",
          async: false,
          global: false,
          throws: true,
        });
      };

      jQuery.fn.extend({
        wrapAll: function (html) {
          var wrap;

          if (jQuery.isFunction(html)) {
            return this.each(function (i) {
              jQuery(this).wrapAll(html.call(this, i));
            });
          }

          if (this[0]) {
            // The elements to wrap the target around
            wrap = jQuery(html, this[0].ownerDocument).eq(0).clone(true);

            if (this[0].parentNode) {
              wrap.insertBefore(this[0]);
            }

            wrap
              .map(function () {
                var elem = this;

                while (elem.firstElementChild) {
                  elem = elem.firstElementChild;
                }

                return elem;
              })
              .append(this);
          }

          return this;
        },

        wrapInner: function (html) {
          if (jQuery.isFunction(html)) {
            return this.each(function (i) {
              jQuery(this).wrapInner(html.call(this, i));
            });
          }

          return this.each(function () {
            var self = jQuery(this),
              contents = self.contents();

            if (contents.length) {
              contents.wrapAll(html);
            } else {
              self.append(html);
            }
          });
        },

        wrap: function (html) {
          var isFunction = jQuery.isFunction(html);

          return this.each(function (i) {
            jQuery(this).wrapAll(isFunction ? html.call(this, i) : html);
          });
        },

        unwrap: function () {
          return this.parent()
            .each(function () {
              if (!jQuery.nodeName(this, "body")) {
                jQuery(this).replaceWith(this.childNodes);
              }
            })
            .end();
        },
      });

      jQuery.expr.filters.hidden = function (elem) {
        // Support: Opera <= 12.12
        // Opera reports offsetWidths and offsetHeights less than zero on some elements
        return elem.offsetWidth <= 0 && elem.offsetHeight <= 0;
      };
      jQuery.expr.filters.visible = function (elem) {
        return !jQuery.expr.filters.hidden(elem);
      };

      var r20 = /%20/g,
        rbracket = /\[\]$/,
        rCRLF = /\r?\n/g,
        rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
        rsubmittable = /^(?:input|select|textarea|keygen)/i;

      function buildParams(prefix, obj, traditional, add) {
        var name;

        if (jQuery.isArray(obj)) {
          // Serialize array item.
          jQuery.each(obj, function (i, v) {
            if (traditional || rbracket.test(prefix)) {
              // Treat each array item as a scalar.
              add(prefix, v);
            } else {
              // Item is non-scalar (array or object), encode its numeric index.
              buildParams(
                prefix + "[" + (typeof v === "object" ? i : "") + "]",
                v,
                traditional,
                add,
              );
            }
          });
        } else if (!traditional && jQuery.type(obj) === "object") {
          // Serialize object item.
          for (name in obj) {
            buildParams(prefix + "[" + name + "]", obj[name], traditional, add);
          }
        } else {
          // Serialize scalar item.
          add(prefix, obj);
        }
      }

      // Serialize an array of form elements or a set of
      // key/values into a query string
      jQuery.param = function (a, traditional) {
        var prefix,
          s = [],
          add = function (key, value) {
            // If value is a function, invoke it and return its value
            value = jQuery.isFunction(value)
              ? value()
              : value == null
                ? ""
                : value;
            s[s.length] =
              encodeURIComponent(key) + "=" + encodeURIComponent(value);
          };

        // Set traditional to true for jQuery <= 1.3.2 behavior.
        if (traditional === undefined) {
          traditional = jQuery.ajaxSettings && jQuery.ajaxSettings.traditional;
        }

        // If an array was passed in, assume that it is an array of form elements.
        if (jQuery.isArray(a) || (a.jquery && !jQuery.isPlainObject(a))) {
          // Serialize the form elements
          jQuery.each(a, function () {
            add(this.name, this.value);
          });
        } else {
          // If traditional, encode the "old" way (the way 1.3.2 or older
          // did it), otherwise encode params recursively.
          for (prefix in a) {
            buildParams(prefix, a[prefix], traditional, add);
          }
        }

        // Return the resulting serialization
        return s.join("&").replace(r20, "+");
      };

      jQuery.fn.extend({
        serialize: function () {
          return jQuery.param(this.serializeArray());
        },
        serializeArray: function () {
          return this.map(function () {
            // Can add propHook for "elements" to filter or add form elements
            var elements = jQuery.prop(this, "elements");
            return elements ? jQuery.makeArray(elements) : this;
          })
            .filter(function () {
              var type = this.type;

              // Use .is( ":disabled" ) so that fieldset[disabled] works
              return (
                this.name &&
                !jQuery(this).is(":disabled") &&
                rsubmittable.test(this.nodeName) &&
                !rsubmitterTypes.test(type) &&
                (this.checked || !rcheckableType.test(type))
              );
            })
            .map(function (i, elem) {
              var val = jQuery(this).val();

              return val == null
                ? null
                : jQuery.isArray(val)
                  ? jQuery.map(val, function (val) {
                      return {
                        name: elem.name,
                        value: val.replace(rCRLF, "\r\n"),
                      };
                    })
                  : { name: elem.name, value: val.replace(rCRLF, "\r\n") };
            })
            .get();
        },
      });

      jQuery.ajaxSettings.xhr = function () {
        try {
          return new XMLHttpRequest();
        } catch (e) {}
      };

      var xhrId = 0,
        xhrCallbacks = {},
        xhrSuccessStatus = {
          // file protocol always yields status code 0, assume 200
          0: 200,
          // Support: IE9
          // #1450: sometimes IE returns 1223 when it should be 204
          1223: 204,
        },
        xhrSupported = jQuery.ajaxSettings.xhr();

      // Support: IE9
      // Open requests must be manually aborted on unload (#5280)
      if (window.ActiveXObject) {
        jQuery(window).on("unload", function () {
          for (var key in xhrCallbacks) {
            xhrCallbacks[key]();
          }
        });
      }

      support.cors = !!xhrSupported && "withCredentials" in xhrSupported;
      support.ajax = xhrSupported = !!xhrSupported;

      jQuery.ajaxTransport(function (options) {
        var callback;

        // Cross domain only allowed if supported through XMLHttpRequest
        if (support.cors || (xhrSupported && !options.crossDomain)) {
          return {
            send: function (headers, complete) {
              var i,
                xhr = options.xhr(),
                id = ++xhrId;

              xhr.open(
                options.type,
                options.url,
                options.async,
                options.username,
                options.password,
              );

              // Apply custom fields if provided
              if (options.xhrFields) {
                for (i in options.xhrFields) {
                  xhr[i] = options.xhrFields[i];
                }
              }

              // Override mime type if needed
              if (options.mimeType && xhr.overrideMimeType) {
                xhr.overrideMimeType(options.mimeType);
              }

              // X-Requested-With header
              // For cross-domain requests, seeing as conditions for a preflight are
              // akin to a jigsaw puzzle, we simply never set it to be sure.
              // (it can always be set on a per-request basis or even using ajaxSetup)
              // For same-domain requests, won't change header if already provided.
              if (!options.crossDomain && !headers["X-Requested-With"]) {
                headers["X-Requested-With"] = "XMLHttpRequest";
              }

              // Set headers
              for (i in headers) {
                xhr.setRequestHeader(i, headers[i]);
              }

              // Callback
              callback = function (type) {
                return function () {
                  if (callback) {
                    delete xhrCallbacks[id];
                    callback = xhr.onload = xhr.onerror = null;

                    if (type === "abort") {
                      xhr.abort();
                    } else if (type === "error") {
                      complete(
                        // file: protocol always yields status 0; see #8605, #14207
                        xhr.status,
                        xhr.statusText,
                      );
                    } else {
                      complete(
                        xhrSuccessStatus[xhr.status] || xhr.status,
                        xhr.statusText,
                        // Support: IE9
                        // Accessing binary-data responseText throws an exception
                        // (#11426)
                        typeof xhr.responseText === "string"
                          ? {
                              text: xhr.responseText,
                            }
                          : undefined,
                        xhr.getAllResponseHeaders(),
                      );
                    }
                  }
                };
              };

              // Listen to events
              xhr.onload = callback();
              xhr.onerror = callback("error");

              // Create the abort callback
              callback = xhrCallbacks[id] = callback("abort");

              // Do send the request
              // This may raise an exception which is actually
              // handled in jQuery.ajax (so no try/catch here)
              xhr.send((options.hasContent && options.data) || null);
            },

            abort: function () {
              if (callback) {
                callback();
              }
            },
          };
        }
      });

      // Install script dataType
      jQuery.ajaxSetup({
        accepts: {
          script:
            "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript",
        },
        contents: {
          script: /(?:java|ecma)script/,
        },
        converters: {
          "text script": function (text) {
            jQuery.globalEval(text);
            return text;
          },
        },
      });

      // Handle cache's special case and crossDomain
      jQuery.ajaxPrefilter("script", function (s) {
        if (s.cache === undefined) {
          s.cache = false;
        }
        if (s.crossDomain) {
          s.type = "GET";
        }
      });

      // Bind script tag hack transport
      jQuery.ajaxTransport("script", function (s) {
        // This transport only deals with cross domain requests
        if (s.crossDomain) {
          var script, callback;
          return {
            send: function (_, complete) {
              script = jQuery("<script>")
                .prop({
                  async: true,
                  charset: s.scriptCharset,
                  src: s.url,
                })
                .on(
                  "load error",
                  (callback = function (evt) {
                    script.remove();
                    callback = null;
                    if (evt) {
                      complete(evt.type === "error" ? 404 : 200, evt.type);
                    }
                  }),
                );
              document.head.appendChild(script[0]);
            },
            abort: function () {
              if (callback) {
                callback();
              }
            },
          };
        }
      });

      var oldCallbacks = [],
        rjsonp = /(=)\?(?=&|$)|\?\?/;

      // Default jsonp settings
      jQuery.ajaxSetup({
        jsonp: "callback",
        jsonpCallback: function () {
          var callback = oldCallbacks.pop() || jQuery.expando + "_" + nonce++;
          this[callback] = true;
          return callback;
        },
      });

      // Detect, normalize options and install callbacks for jsonp requests
      jQuery.ajaxPrefilter("json jsonp", function (s, originalSettings, jqXHR) {
        var callbackName,
          overwritten,
          responseContainer,
          jsonProp =
            s.jsonp !== false &&
            (rjsonp.test(s.url)
              ? "url"
              : typeof s.data === "string" &&
                !(s.contentType || "").indexOf(
                  "application/x-www-form-urlencoded",
                ) &&
                rjsonp.test(s.data) &&
                "data");

        // Handle iff the expected data type is "jsonp" or we have a parameter to set
        if (jsonProp || s.dataTypes[0] === "jsonp") {
          // Get callback name, remembering preexisting value associated with it
          callbackName = s.jsonpCallback = jQuery.isFunction(s.jsonpCallback)
            ? s.jsonpCallback()
            : s.jsonpCallback;

          // Insert callback into url or form data
          if (jsonProp) {
            s[jsonProp] = s[jsonProp].replace(rjsonp, "$1" + callbackName);
          } else if (s.jsonp !== false) {
            s.url +=
              (rquery.test(s.url) ? "&" : "?") + s.jsonp + "=" + callbackName;
          }

          // Use data converter to retrieve json after script execution
          s.converters["script json"] = function () {
            if (!responseContainer) {
              jQuery.error(callbackName + " was not called");
            }
            return responseContainer[0];
          };

          // force json dataType
          s.dataTypes[0] = "json";

          // Install callback
          overwritten = window[callbackName];
          window[callbackName] = function () {
            responseContainer = arguments;
          };

          // Clean-up function (fires after converters)
          jqXHR.always(function () {
            // Restore preexisting value
            window[callbackName] = overwritten;

            // Save back as free
            if (s[callbackName]) {
              // make sure that re-using the options doesn't screw things around
              s.jsonpCallback = originalSettings.jsonpCallback;

              // save the callback name for future use
              oldCallbacks.push(callbackName);
            }

            // Call if it was a function and we have a response
            if (responseContainer && jQuery.isFunction(overwritten)) {
              overwritten(responseContainer[0]);
            }

            responseContainer = overwritten = undefined;
          });

          // Delegate to script
          return "script";
        }
      });

      // data: string of html
      // context (optional): If specified, the fragment will be created in this context, defaults to document
      // keepScripts (optional): If true, will include scripts passed in the html string
      jQuery.parseHTML = function (data, context, keepScripts) {
        if (!data || typeof data !== "string") {
          return null;
        }
        if (typeof context === "boolean") {
          keepScripts = context;
          context = false;
        }
        context = context || document;

        var parsed = rsingleTag.exec(data),
          scripts = !keepScripts && [];

        // Single tag
        if (parsed) {
          return [context.createElement(parsed[1])];
        }

        parsed = jQuery.buildFragment([data], context, scripts);

        if (scripts && scripts.length) {
          jQuery(scripts).remove();
        }

        return jQuery.merge([], parsed.childNodes);
      };

      // Keep a copy of the old load method
      var _load = jQuery.fn.load;

      /**
       * Load a url into a page
       */
      jQuery.fn.load = function (url, params, callback) {
        if (typeof url !== "string" && _load) {
          return _load.apply(this, arguments);
        }

        var selector,
          type,
          response,
          self = this,
          off = url.indexOf(" ");

        if (off >= 0) {
          selector = url.slice(off);
          url = url.slice(0, off);
        }

        // If it's a function
        if (jQuery.isFunction(params)) {
          // We assume that it's the callback
          callback = params;
          params = undefined;

          // Otherwise, build a param string
        } else if (params && typeof params === "object") {
          type = "POST";
        }

        // If we have elements to modify, make the request
        if (self.length > 0) {
          jQuery
            .ajax({
              url: url,

              // if "type" variable is undefined, then "GET" method will be used
              type: type,
              dataType: "html",
              data: params,
            })
            .done(function (responseText) {
              // Save response for use in complete callback
              response = arguments;

              self.html(
                selector
                  ? // If a selector was specified, locate the right elements in a dummy div
                    // Exclude scripts to avoid IE 'Permission Denied' errors
                    jQuery("<div>")
                      .append(jQuery.parseHTML(responseText))
                      .find(selector)
                  : // Otherwise use the full result
                    responseText,
              );
            })
            .complete(
              callback &&
                function (jqXHR, status) {
                  self.each(
                    callback,
                    response || [jqXHR.responseText, status, jqXHR],
                  );
                },
            );
        }

        return this;
      };

      jQuery.expr.filters.animated = function (elem) {
        return jQuery.grep(jQuery.timers, function (fn) {
          return elem === fn.elem;
        }).length;
      };

      var docElem = window.document.documentElement;

      /**
       * Gets a window from an element
       */
      function getWindow(elem) {
        return jQuery.isWindow(elem)
          ? elem
          : elem.nodeType === 9 && elem.defaultView;
      }

      jQuery.offset = {
        setOffset: function (elem, options, i) {
          var curPosition,
            curLeft,
            curCSSTop,
            curTop,
            curOffset,
            curCSSLeft,
            calculatePosition,
            position = jQuery.css(elem, "position"),
            curElem = jQuery(elem),
            props = {};

          // Set position first, in-case top/left are set even on static elem
          if (position === "static") {
            elem.style.position = "relative";
          }

          curOffset = curElem.offset();
          curCSSTop = jQuery.css(elem, "top");
          curCSSLeft = jQuery.css(elem, "left");
          calculatePosition =
            (position === "absolute" || position === "fixed") &&
            (curCSSTop + curCSSLeft).indexOf("auto") > -1;

          // Need to be able to calculate position if either top or left is auto and position is either absolute or fixed
          if (calculatePosition) {
            curPosition = curElem.position();
            curTop = curPosition.top;
            curLeft = curPosition.left;
          } else {
            curTop = parseFloat(curCSSTop) || 0;
            curLeft = parseFloat(curCSSLeft) || 0;
          }

          if (jQuery.isFunction(options)) {
            options = options.call(elem, i, curOffset);
          }

          if (options.top != null) {
            props.top = options.top - curOffset.top + curTop;
          }
          if (options.left != null) {
            props.left = options.left - curOffset.left + curLeft;
          }

          if ("using" in options) {
            options.using.call(elem, props);
          } else {
            curElem.css(props);
          }
        },
      };

      jQuery.fn.extend({
        offset: function (options) {
          if (arguments.length) {
            return options === undefined
              ? this
              : this.each(function (i) {
                  jQuery.offset.setOffset(this, options, i);
                });
          }

          var docElem,
            win,
            elem = this[0],
            box = { top: 0, left: 0 },
            doc = elem && elem.ownerDocument;

          if (!doc) {
            return;
          }

          docElem = doc.documentElement;

          // Make sure it's not a disconnected DOM node
          if (!jQuery.contains(docElem, elem)) {
            return box;
          }

          // If we don't have gBCR, just use 0,0 rather than error
          // BlackBerry 5, iOS 3 (original iPhone)
          if (typeof elem.getBoundingClientRect !== strundefined) {
            box = elem.getBoundingClientRect();
          }
          win = getWindow(doc);
          return {
            top: box.top + win.pageYOffset - docElem.clientTop,
            left: box.left + win.pageXOffset - docElem.clientLeft,
          };
        },

        position: function () {
          if (!this[0]) {
            return;
          }

          var offsetParent,
            offset,
            elem = this[0],
            parentOffset = { top: 0, left: 0 };

          // Fixed elements are offset from window (parentOffset = {top:0, left: 0}, because it is its only offset parent
          if (jQuery.css(elem, "position") === "fixed") {
            // We assume that getBoundingClientRect is available when computed position is fixed
            offset = elem.getBoundingClientRect();
          } else {
            // Get *real* offsetParent
            offsetParent = this.offsetParent();

            // Get correct offsets
            offset = this.offset();
            if (!jQuery.nodeName(offsetParent[0], "html")) {
              parentOffset = offsetParent.offset();
            }

            // Add offsetParent borders
            parentOffset.top += jQuery.css(
              offsetParent[0],
              "borderTopWidth",
              true,
            );
            parentOffset.left += jQuery.css(
              offsetParent[0],
              "borderLeftWidth",
              true,
            );
          }

          // Subtract parent offsets and element margins
          return {
            top:
              offset.top -
              parentOffset.top -
              jQuery.css(elem, "marginTop", true),
            left:
              offset.left -
              parentOffset.left -
              jQuery.css(elem, "marginLeft", true),
          };
        },

        offsetParent: function () {
          return this.map(function () {
            var offsetParent = this.offsetParent || docElem;

            while (
              offsetParent &&
              !jQuery.nodeName(offsetParent, "html") &&
              jQuery.css(offsetParent, "position") === "static"
            ) {
              offsetParent = offsetParent.offsetParent;
            }

            return offsetParent || docElem;
          });
        },
      });

      // Create scrollLeft and scrollTop methods
      jQuery.each(
        { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" },
        function (method, prop) {
          var top = "pageYOffset" === prop;

          jQuery.fn[method] = function (val) {
            return access(
              this,
              function (elem, method, val) {
                var win = getWindow(elem);

                if (val === undefined) {
                  return win ? win[prop] : elem[method];
                }

                if (win) {
                  win.scrollTo(
                    !top ? val : window.pageXOffset,
                    top ? val : window.pageYOffset,
                  );
                } else {
                  elem[method] = val;
                }
              },
              method,
              val,
              arguments.length,
              null,
            );
          };
        },
      );

      // Add the top/left cssHooks using jQuery.fn.position
      // Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
      // getComputedStyle returns percent when specified for top/left/bottom/right
      // rather than make the css module depend on the offset module, we just check for it here
      jQuery.each(["top", "left"], function (i, prop) {
        jQuery.cssHooks[prop] = addGetHookIf(
          support.pixelPosition,
          function (elem, computed) {
            if (computed) {
              computed = curCSS(elem, prop);
              // if curCSS returns percentage, fallback to offset
              return rnumnonpx.test(computed)
                ? jQuery(elem).position()[prop] + "px"
                : computed;
            }
          },
        );
      });

      // Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
      jQuery.each({ Height: "height", Width: "width" }, function (name, type) {
        jQuery.each(
          { padding: "inner" + name, content: type, "": "outer" + name },
          function (defaultExtra, funcName) {
            // margin is only for outerHeight, outerWidth
            jQuery.fn[funcName] = function (margin, value) {
              var chainable =
                  arguments.length &&
                  (defaultExtra || typeof margin !== "boolean"),
                extra =
                  defaultExtra ||
                  (margin === true || value === true ? "margin" : "border");

              return access(
                this,
                function (elem, type, value) {
                  var doc;

                  if (jQuery.isWindow(elem)) {
                    // As of 5/8/2012 this will yield incorrect results for Mobile Safari, but there
                    // isn't a whole lot we can do. See pull request at this URL for discussion:
                    // https://github.com/jquery/jquery/pull/764
                    return elem.document.documentElement["client" + name];
                  }

                  // Get document width or height
                  if (elem.nodeType === 9) {
                    doc = elem.documentElement;

                    // Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
                    // whichever is greatest
                    return Math.max(
                      elem.body["scroll" + name],
                      doc["scroll" + name],
                      elem.body["offset" + name],
                      doc["offset" + name],
                      doc["client" + name],
                    );
                  }

                  return value === undefined
                    ? // Get width or height on the element, requesting but not forcing parseFloat
                      jQuery.css(elem, type, extra)
                    : // Set width or height on the element
                      jQuery.style(elem, type, value, extra);
                },
                type,
                chainable ? margin : undefined,
                chainable,
                null,
              );
            };
          },
        );
      });

      // The number of elements contained in the matched element set
      jQuery.fn.size = function () {
        return this.length;
      };

      jQuery.fn.andSelf = jQuery.fn.addBack;

      // Register as a named AMD module, since jQuery can be concatenated with other
      // files that may use define, but not via a proper concatenation script that
      // understands anonymous AMD modules. A named AMD is safest and most robust
      // way to register. Lowercase jquery is used because AMD module names are
      // derived from file names, and jQuery is normally delivered in a lowercase
      // file name. Do this after creating the global so that if an AMD module wants
      // to call noConflict to hide this version of jQuery, it will work.
      if (typeof define === "function" && define.amd) {
        define("jquery", [], function () {
          return jQuery;
        });
      }

      var // Map over jQuery in case of overwrite
        _jQuery = window.jQuery,
        // Map over the $ in case of overwrite
        _$ = window.$;

      jQuery.noConflict = function (deep) {
        if (window.$ === jQuery) {
          window.$ = _$;
        }

        if (deep && window.jQuery === jQuery) {
          window.jQuery = _jQuery;
        }

        return jQuery;
      };

      // Expose jQuery and $ identifiers, even in
      // AMD (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
      // and CommonJS for browser emulators (#13566)
      if (typeof noGlobal === strundefined) {
        window.jQuery = window.$ = jQuery;
      }

      return jQuery;
    },
  );

  /**
   * @license
   * lodash 3.1.0 (Custom Build) <https://lodash.com/>
   * Build: `lodash modern -o ./lodash.js`
   * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
   * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
   * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   * Available under MIT license <https://lodash.com/license>
   */
  (function () {
    /** Used as a safe reference for `undefined` in pre-ES5 environments. */
    var undefined;

    /** Used as the semantic version number. */
    var VERSION = "3.1.0";

    /** Used to compose bitmasks for wrapper metadata. */
    var BIND_FLAG = 1,
      BIND_KEY_FLAG = 2,
      CURRY_BOUND_FLAG = 4,
      CURRY_FLAG = 8,
      CURRY_RIGHT_FLAG = 16,
      PARTIAL_FLAG = 32,
      PARTIAL_RIGHT_FLAG = 64,
      REARG_FLAG = 128,
      ARY_FLAG = 256;

    /** Used as default options for `_.trunc`. */
    var DEFAULT_TRUNC_LENGTH = 30,
      DEFAULT_TRUNC_OMISSION = "...";

    /** Used to detect when a function becomes hot. */
    var HOT_COUNT = 150,
      HOT_SPAN = 16;

    /** Used to indicate the type of lazy iteratees. */
    var LAZY_FILTER_FLAG = 0,
      LAZY_MAP_FLAG = 1,
      LAZY_WHILE_FLAG = 2;

    /** Used as the `TypeError` message for "Functions" methods. */
    var FUNC_ERROR_TEXT = "Expected a function";

    /** Used as the internal argument placeholder. */
    var PLACEHOLDER = "__lodash_placeholder__";

    /** `Object#toString` result references. */
    var argsTag = "[object Arguments]",
      arrayTag = "[object Array]",
      boolTag = "[object Boolean]",
      dateTag = "[object Date]",
      errorTag = "[object Error]",
      funcTag = "[object Function]",
      mapTag = "[object Map]",
      numberTag = "[object Number]",
      objectTag = "[object Object]",
      regexpTag = "[object RegExp]",
      setTag = "[object Set]",
      stringTag = "[object String]",
      weakMapTag = "[object WeakMap]";

    var arrayBufferTag = "[object ArrayBuffer]",
      float32Tag = "[object Float32Array]",
      float64Tag = "[object Float64Array]",
      int8Tag = "[object Int8Array]",
      int16Tag = "[object Int16Array]",
      int32Tag = "[object Int32Array]",
      uint8Tag = "[object Uint8Array]",
      uint8ClampedTag = "[object Uint8ClampedArray]",
      uint16Tag = "[object Uint16Array]",
      uint32Tag = "[object Uint32Array]";

    /** Used to match empty string literals in compiled template source. */
    var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

    /** Used to match HTML entities and HTML characters. */
    var reEscapedHtml = /&(?:amp|lt|gt|quot|#39|#96);/g,
      reUnescapedHtml = /[&<>"'`]/g,
      reHasEscapedHtml = RegExp(reEscapedHtml.source),
      reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

    /** Used to match template delimiters. */
    var reEscape = /<%-([\s\S]+?)%>/g,
      reEvaluate = /<%([\s\S]+?)%>/g,
      reInterpolate = /<%=([\s\S]+?)%>/g;

    /**
     * Used to match ES template delimiters.
     * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-template-literal-lexical-components)
     * for more details.
     */
    var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

    /** Used to match `RegExp` flags from their coerced string values. */
    var reFlags = /\w*$/;

    /** Used to detect named functions. */
    var reFuncName = /^\s*function[ \n\r\t]+\w/;

    /** Used to detect hexadecimal string values. */
    var reHexPrefix = /^0[xX]/;

    /** Used to detect host constructors (Safari > 5). */
    var reHostCtor = /^\[object .+?Constructor\]$/;

    /** Used to match latin-1 supplementary letters (excluding mathematical operators). */
    var reLatin1 = /[\xc0-\xd6\xd8-\xde\xdf-\xf6\xf8-\xff]/g;

    /** Used to ensure capturing order of template delimiters. */
    var reNoMatch = /($^)/;

    /**
     * Used to match `RegExp` special characters.
     * See this [article on `RegExp` characters](http://www.regular-expressions.info/characters.html#special)
     * for more details.
     */
    var reRegExpChars = /[.*+?^${}()|[\]\/\\]/g,
      reHasRegExpChars = RegExp(reRegExpChars.source);

    /** Used to detect functions containing a `this` reference. */
    var reThis = /\bthis\b/;

    /** Used to match unescaped characters in compiled string literals. */
    var reUnescapedString = /['\n\r\u2028\u2029\\]/g;

    /** Used to match words to create compound words. */
    var reWords = (function () {
      var upper = "[A-Z\\xc0-\\xd6\\xd8-\\xde]",
        lower = "[a-z\\xdf-\\xf6\\xf8-\\xff]+";

      return RegExp(
        upper +
          "{2,}(?=" +
          upper +
          lower +
          ")|" +
          upper +
          "?" +
          lower +
          "|" +
          upper +
          "+|[0-9]+",
        "g",
      );
    })();

    /** Used to detect and test for whitespace. */
    var whitespace =
      // Basic whitespace characters.
      " \t\x0b\f\xa0\ufeff" +
      // Line terminators.
      "\n\r\u2028\u2029" +
      // Unicode category "Zs" space separators.
      "\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000";

    /** Used to assign default `context` object properties. */
    var contextProps = [
      "Array",
      "ArrayBuffer",
      "Date",
      "Error",
      "Float32Array",
      "Float64Array",
      "Function",
      "Int8Array",
      "Int16Array",
      "Int32Array",
      "Math",
      "Number",
      "Object",
      "RegExp",
      "Set",
      "String",
      "_",
      "clearTimeout",
      "document",
      "isFinite",
      "parseInt",
      "setTimeout",
      "TypeError",
      "Uint8Array",
      "Uint8ClampedArray",
      "Uint16Array",
      "Uint32Array",
      "WeakMap",
      "window",
      "WinRTError",
    ];

    /** Used to make template sourceURLs easier to identify. */
    var templateCounter = -1;

    /** Used to identify `toStringTag` values of typed arrays. */
    var typedArrayTags = {};
    typedArrayTags[float32Tag] =
      typedArrayTags[float64Tag] =
      typedArrayTags[int8Tag] =
      typedArrayTags[int16Tag] =
      typedArrayTags[int32Tag] =
      typedArrayTags[uint8Tag] =
      typedArrayTags[uint8ClampedTag] =
      typedArrayTags[uint16Tag] =
      typedArrayTags[uint32Tag] =
        true;
    typedArrayTags[argsTag] =
      typedArrayTags[arrayTag] =
      typedArrayTags[arrayBufferTag] =
      typedArrayTags[boolTag] =
      typedArrayTags[dateTag] =
      typedArrayTags[errorTag] =
      typedArrayTags[funcTag] =
      typedArrayTags[mapTag] =
      typedArrayTags[numberTag] =
      typedArrayTags[objectTag] =
      typedArrayTags[regexpTag] =
      typedArrayTags[setTag] =
      typedArrayTags[stringTag] =
      typedArrayTags[weakMapTag] =
        false;

    /** Used to identify `toStringTag` values supported by `_.clone`. */
    var cloneableTags = {};
    cloneableTags[argsTag] =
      cloneableTags[arrayTag] =
      cloneableTags[arrayBufferTag] =
      cloneableTags[boolTag] =
      cloneableTags[dateTag] =
      cloneableTags[float32Tag] =
      cloneableTags[float64Tag] =
      cloneableTags[int8Tag] =
      cloneableTags[int16Tag] =
      cloneableTags[int32Tag] =
      cloneableTags[numberTag] =
      cloneableTags[objectTag] =
      cloneableTags[regexpTag] =
      cloneableTags[stringTag] =
      cloneableTags[uint8Tag] =
      cloneableTags[uint8ClampedTag] =
      cloneableTags[uint16Tag] =
      cloneableTags[uint32Tag] =
        true;
    cloneableTags[errorTag] =
      cloneableTags[funcTag] =
      cloneableTags[mapTag] =
      cloneableTags[setTag] =
      cloneableTags[weakMapTag] =
        false;

    /** Used as an internal `_.debounce` options object by `_.throttle`. */
    var debounceOptions = {
      leading: false,
      maxWait: 0,
      trailing: false,
    };

    /** Used to map latin-1 supplementary letters to basic latin letters. */
    var deburredLetters = {
      "\xc0": "A",
      "\xc1": "A",
      "\xc2": "A",
      "\xc3": "A",
      "\xc4": "A",
      "\xc5": "A",
      "\xe0": "a",
      "\xe1": "a",
      "\xe2": "a",
      "\xe3": "a",
      "\xe4": "a",
      "\xe5": "a",
      "\xc7": "C",
      "\xe7": "c",
      "\xd0": "D",
      "\xf0": "d",
      "\xc8": "E",
      "\xc9": "E",
      "\xca": "E",
      "\xcb": "E",
      "\xe8": "e",
      "\xe9": "e",
      "\xea": "e",
      "\xeb": "e",
      "\xcC": "I",
      "\xcd": "I",
      "\xce": "I",
      "\xcf": "I",
      "\xeC": "i",
      "\xed": "i",
      "\xee": "i",
      "\xef": "i",
      "\xd1": "N",
      "\xf1": "n",
      "\xd2": "O",
      "\xd3": "O",
      "\xd4": "O",
      "\xd5": "O",
      "\xd6": "O",
      "\xd8": "O",
      "\xf2": "o",
      "\xf3": "o",
      "\xf4": "o",
      "\xf5": "o",
      "\xf6": "o",
      "\xf8": "o",
      "\xd9": "U",
      "\xda": "U",
      "\xdb": "U",
      "\xdc": "U",
      "\xf9": "u",
      "\xfa": "u",
      "\xfb": "u",
      "\xfc": "u",
      "\xdd": "Y",
      "\xfd": "y",
      "\xff": "y",
      "\xc6": "Ae",
      "\xe6": "ae",
      "\xde": "Th",
      "\xfe": "th",
      "\xdf": "ss",
    };

    /** Used to map characters to HTML entities. */
    var htmlEscapes = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "`": "&#96;",
    };

    /** Used to map HTML entities to characters. */
    var htmlUnescapes = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&#96;": "`",
    };

    /** Used to determine if values are of the language type `Object`. */
    var objectTypes = {
      function: true,
      object: true,
    };

    /** Used to escape characters for inclusion in compiled string literals. */
    var stringEscapes = {
      "\\": "\\",
      "'": "'",
      "\n": "n",
      "\r": "r",
      "\u2028": "u2028",
      "\u2029": "u2029",
    };

    /**
     * Used as a reference to the global object.
     *
     * The `this` value is used if it is the global object to avoid Greasemonkey's
     * restricted `window` object, otherwise the `window` object is used.
     */
    var root =
      objectTypes[typeof window] && window !== (this && this.window)
        ? window
        : this;

    /** Detect free variable `exports`. */
    var freeExports =
      objectTypes[typeof exports] && exports && !exports.nodeType && exports;

    /** Detect free variable `module`. */
    var freeModule =
      objectTypes[typeof module] && module && !module.nodeType && module;

    /** Detect free variable `global` from Node.js or Browserified code and use it as `root`. */
    var freeGlobal =
      freeExports && freeModule && typeof global == "object" && global;
    if (
      freeGlobal &&
      (freeGlobal.global === freeGlobal ||
        freeGlobal.window === freeGlobal ||
        freeGlobal.self === freeGlobal)
    ) {
      root = freeGlobal;
    }

    /** Detect the popular CommonJS extension `module.exports`. */
    var moduleExports =
      freeModule && freeModule.exports === freeExports && freeExports;

    /*--------------------------------------------------------------------------*/

    /**
     * The base implementation of `compareAscending` which compares values and
     * sorts them in ascending order without guaranteeing a stable sort.
     *
     * @private
     * @param {*} value The value to compare to `other`.
     * @param {*} other The value to compare to `value`.
     * @returns {number} Returns the sort order indicator for `value`.
     */
    function baseCompareAscending(value, other) {
      if (value !== other) {
        var valIsReflexive = value === value,
          othIsReflexive = other === other;

        if (
          value > other ||
          !valIsReflexive ||
          (typeof value == "undefined" && othIsReflexive)
        ) {
          return 1;
        }
        if (
          value < other ||
          !othIsReflexive ||
          (typeof other == "undefined" && valIsReflexive)
        ) {
          return -1;
        }
      }
      return 0;
    }

    /**
     * The base implementation of `_.indexOf` without support for binary searches.
     *
     * @private
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=0] The index to search from.
     * @returns {number} Returns the index of the matched value, else `-1`.
     */
    function baseIndexOf(array, value, fromIndex) {
      if (value !== value) {
        return indexOfNaN(array, fromIndex);
      }
      var index = (fromIndex || 0) - 1,
        length = array.length;

      while (++index < length) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * The base implementation of `_.sortBy` and `_.sortByAll` which uses `comparer`
     * to define the sort order of `array` and replaces criteria objects with their
     * corresponding values.
     *
     * @private
     * @param {Array} array The array to sort.
     * @param {Function} comparer The function to define sort order.
     * @returns {Array} Returns `array`.
     */
    function baseSortBy(array, comparer) {
      var length = array.length;

      array.sort(comparer);
      while (length--) {
        array[length] = array[length].value;
      }
      return array;
    }

    /**
     * Converts `value` to a string if it is not one. An empty string is returned
     * for `null` or `undefined` values.
     *
     * @private
     * @param {*} value The value to process.
     * @returns {string} Returns the string.
     */
    function baseToString(value) {
      if (typeof value == "string") {
        return value;
      }
      return value == null ? "" : value + "";
    }

    /**
     * Used by `_.max` and `_.min` as the default callback for string values.
     *
     * @private
     * @param {string} string The string to inspect.
     * @returns {number} Returns the code unit of the first character of the string.
     */
    function charAtCallback(string) {
      return string.charCodeAt(0);
    }

    /**
     * Used by `_.trim` and `_.trimLeft` to get the index of the first character
     * of `string` that is not found in `chars`.
     *
     * @private
     * @param {string} string The string to inspect.
     * @param {string} chars The characters to find.
     * @returns {number} Returns the index of the first character not found in `chars`.
     */
    function charsLeftIndex(string, chars) {
      var index = -1,
        length = string.length;

      while (++index < length && chars.indexOf(string.charAt(index)) > -1) {}
      return index;
    }

    /**
     * Used by `_.trim` and `_.trimRight` to get the index of the last character
     * of `string` that is not found in `chars`.
     *
     * @private
     * @param {string} string The string to inspect.
     * @param {string} chars The characters to find.
     * @returns {number} Returns the index of the last character not found in `chars`.
     */
    function charsRightIndex(string, chars) {
      var index = string.length;

      while (index-- && chars.indexOf(string.charAt(index)) > -1) {}
      return index;
    }

    /**
     * Used by `_.sortBy` to compare transformed elements of a collection and stable
     * sort them in ascending order.
     *
     * @private
     * @param {Object} object The object to compare to `other`.
     * @param {Object} other The object to compare to `object`.
     * @returns {number} Returns the sort order indicator for `object`.
     */
    function compareAscending(object, other) {
      return (
        baseCompareAscending(object.criteria, other.criteria) ||
        object.index - other.index
      );
    }

    /**
     * Used by `_.sortByAll` to compare multiple properties of each element
     * in a collection and stable sort them in ascending order.
     *
     * @private
     * @param {Object} object The object to compare to `other`.
     * @param {Object} other The object to compare to `object`.
     * @returns {number} Returns the sort order indicator for `object`.
     */
    function compareMultipleAscending(object, other) {
      var index = -1,
        objCriteria = object.criteria,
        othCriteria = other.criteria,
        length = objCriteria.length;

      while (++index < length) {
        var result = baseCompareAscending(
          objCriteria[index],
          othCriteria[index],
        );
        if (result) {
          return result;
        }
      }
      // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
      // that causes it, under certain circumstances, to provide the same value for
      // `object` and `other`. See https://github.com/jashkenas/underscore/pull/1247
      // for more details.
      //
      // This also ensures a stable sort in V8 and other engines.
      // See https://code.google.com/p/v8/issues/detail?id=90 for more details.
      return object.index - other.index;
    }

    /**
     * Used by `_.deburr` to convert latin-1 supplementary letters to basic latin letters.
     *
     * @private
     * @param {string} letter The matched letter to deburr.
     * @returns {string} Returns the deburred letter.
     */
    function deburrLetter(letter) {
      return deburredLetters[letter];
    }

    /**
     * Used by `_.escape` to convert characters to HTML entities.
     *
     * @private
     * @param {string} chr The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeHtmlChar(chr) {
      return htmlEscapes[chr];
    }

    /**
     * Used by `_.template` to escape characters for inclusion in compiled
     * string literals.
     *
     * @private
     * @param {string} chr The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeStringChar(chr) {
      return "\\" + stringEscapes[chr];
    }

    /**
     * Gets the index at which the first occurrence of `NaN` is found in `array`.
     * If `fromRight` is provided elements of `array` are iterated from right to left.
     *
     * @private
     * @param {Array} array The array to search.
     * @param {number} [fromIndex] The index to search from.
     * @param {boolean} [fromRight] Specify iterating from right to left.
     * @returns {number} Returns the index of the matched `NaN`, else `-1`.
     */
    function indexOfNaN(array, fromIndex, fromRight) {
      var length = array.length,
        index = fromRight ? fromIndex || length : (fromIndex || 0) - 1;

      while (fromRight ? index-- : ++index < length) {
        var other = array[index];
        if (other !== other) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Checks if `value` is object-like.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
     */
    function isObjectLike(value) {
      return (value && typeof value == "object") || false;
    }

    /**
     * Used by `trimmedLeftIndex` and `trimmedRightIndex` to determine if a
     * character code is whitespace.
     *
     * @private
     * @param {number} charCode The character code to inspect.
     * @returns {boolean} Returns `true` if `charCode` is whitespace, else `false`.
     */
    function isSpace(charCode) {
      return (
        (charCode <= 160 && charCode >= 9 && charCode <= 13) ||
        charCode == 32 ||
        charCode == 160 ||
        charCode == 5760 ||
        charCode == 6158 ||
        (charCode >= 8192 &&
          (charCode <= 8202 ||
            charCode == 8232 ||
            charCode == 8233 ||
            charCode == 8239 ||
            charCode == 8287 ||
            charCode == 12288 ||
            charCode == 65279))
      );
    }

    /**
     * Replaces all `placeholder` elements in `array` with an internal placeholder
     * and returns an array of their indexes.
     *
     * @private
     * @param {Array} array The array to modify.
     * @param {*} placeholder The placeholder to replace.
     * @returns {Array} Returns the new array of placeholder indexes.
     */
    function replaceHolders(array, placeholder) {
      var index = -1,
        length = array.length,
        resIndex = -1,
        result = [];

      while (++index < length) {
        if (array[index] === placeholder) {
          array[index] = PLACEHOLDER;
          result[++resIndex] = index;
        }
      }
      return result;
    }

    /**
     * An implementation of `_.uniq` optimized for sorted arrays without support
     * for callback shorthands and `this` binding.
     *
     * @private
     * @param {Array} array The array to inspect.
     * @param {Function} [iteratee] The function invoked per iteration.
     * @returns {Array} Returns the new duplicate-value-free array.
     */
    function sortedUniq(array, iteratee) {
      var seen,
        index = -1,
        length = array.length,
        resIndex = -1,
        result = [];

      while (++index < length) {
        var value = array[index],
          computed = iteratee ? iteratee(value, index, array) : value;

        if (!index || seen !== computed) {
          seen = computed;
          result[++resIndex] = value;
        }
      }
      return result;
    }

    /**
     * Used by `_.trim` and `_.trimLeft` to get the index of the first non-whitespace
     * character of `string`.
     *
     * @private
     * @param {string} string The string to inspect.
     * @returns {number} Returns the index of the first non-whitespace character.
     */
    function trimmedLeftIndex(string) {
      var index = -1,
        length = string.length;

      while (++index < length && isSpace(string.charCodeAt(index))) {}
      return index;
    }

    /**
     * Used by `_.trim` and `_.trimRight` to get the index of the last non-whitespace
     * character of `string`.
     *
     * @private
     * @param {string} string The string to inspect.
     * @returns {number} Returns the index of the last non-whitespace character.
     */
    function trimmedRightIndex(string) {
      var index = string.length;

      while (index-- && isSpace(string.charCodeAt(index))) {}
      return index;
    }

    /**
     * Used by `_.unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {string} chr The matched character to unescape.
     * @returns {string} Returns the unescaped character.
     */
    function unescapeHtmlChar(chr) {
      return htmlUnescapes[chr];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Create a new pristine `lodash` function using the given `context` object.
     *
     * @static
     * @memberOf _
     * @category Utility
     * @param {Object} [context=root] The context object.
     * @returns {Function} Returns a new `lodash` function.
     * @example
     *
     * _.mixin({ 'add': function(a, b) { return a + b; } });
     *
     * var lodash = _.runInContext();
     * lodash.mixin({ 'sub': function(a, b) { return a - b; } });
     *
     * _.isFunction(_.add);
     * // => true
     * _.isFunction(_.sub);
     * // => false
     *
     * lodash.isFunction(lodash.add);
     * // => false
     * lodash.isFunction(lodash.sub);
     * // => true
     *
     * // using `context` to mock `Date#getTime` use in `_.now`
     * var mock = _.runInContext({
     *   'Date': function() {
     *     return { 'getTime': getTimeMock };
     *   }
     * });
     *
     * // or creating a suped-up `defer` in Node.js
     * var defer = _.runInContext({ 'setTimeout': setImmediate }).defer;
     */
    function runInContext(context) {
      // Avoid issues with some ES3 environments that attempt to use values, named
      // after built-in constructors like `Object`, for the creation of literals.
      // ES5 clears this up by stating that literals must use built-in constructors.
      // See https://es5.github.io/#x11.1.5 for more details.
      context = context
        ? _.defaults(root.Object(), context, _.pick(root, contextProps))
        : root;

      /** Native constructor references. */
      var Array = context.Array,
        Date = context.Date,
        Error = context.Error,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

      /** Used for native method references. */
      var arrayProto = Array.prototype,
        objectProto = Object.prototype;

      /** Used to detect DOM support. */
      var document = (document = context.window) && document.document;

      /** Used to resolve the decompiled source of functions. */
      var fnToString = Function.prototype.toString;

      /** Used to the length of n-tuples for `_.unzip`. */
      var getLength = baseProperty("length");

      /** Used to check objects for own properties. */
      var hasOwnProperty = objectProto.hasOwnProperty;

      /** Used to generate unique IDs. */
      var idCounter = 0;

      /**
       * Used to resolve the `toStringTag` of values.
       * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
       * for more details.
       */
      var objToString = objectProto.toString;

      /** Used to restore the original `_` reference in `_.noConflict`. */
      var oldDash = context._;

      /** Used to detect if a method is native. */
      var reNative = RegExp(
        "^" +
          escapeRegExp(objToString).replace(
            /toString|(function).*?(?=\\\()| for .+?(?=\\\])/g,
            "$1.*?",
          ) +
          "$",
      );

      /** Native method references. */
      var ArrayBuffer =
          isNative((ArrayBuffer = context.ArrayBuffer)) && ArrayBuffer,
        bufferSlice =
          isNative((bufferSlice = ArrayBuffer && new ArrayBuffer(0).slice)) &&
          bufferSlice,
        ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        floor = Math.floor,
        getPrototypeOf =
          isNative((getPrototypeOf = Object.getPrototypeOf)) && getPrototypeOf,
        push = arrayProto.push,
        propertyIsEnumerable = objectProto.propertyIsEnumerable,
        Set = isNative((Set = context.Set)) && Set,
        setTimeout = context.setTimeout,
        splice = arrayProto.splice,
        Uint8Array = isNative((Uint8Array = context.Uint8Array)) && Uint8Array,
        unshift = arrayProto.unshift,
        WeakMap = isNative((WeakMap = context.WeakMap)) && WeakMap;

      /** Used to clone array buffers. */
      var Float64Array = (function () {
        // Safari 5 errors when using an array buffer to initialize a typed array
        // where the array buffer's `byteLength` is not a multiple of the typed
        // array's `BYTES_PER_ELEMENT`.
        try {
          var func = isNative((func = context.Float64Array)) && func,
            result = new func(new ArrayBuffer(10), 0, 1) && func;
        } catch (e) {}
        return result;
      })();

      /* Native method references for those with the same name as other `lodash` methods. */
      var nativeIsArray =
          isNative((nativeIsArray = Array.isArray)) && nativeIsArray,
        nativeCreate = isNative((nativeCreate = Object.create)) && nativeCreate,
        nativeIsFinite = context.isFinite,
        nativeKeys = isNative((nativeKeys = Object.keys)) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeNow = isNative((nativeNow = Date.now)) && nativeNow,
        nativeNumIsFinite =
          isNative((nativeNumIsFinite = Number.isFinite)) && nativeNumIsFinite,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

      /** Used as references for `-Infinity` and `Infinity`. */
      var NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY,
        POSITIVE_INFINITY = Number.POSITIVE_INFINITY;

      /** Used as references for the maximum length and index of an array. */
      var MAX_ARRAY_LENGTH = Math.pow(2, 32) - 1,
        MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1,
        HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;

      /** Used as the size, in bytes, of each `Float64Array` element. */
      var FLOAT64_BYTES_PER_ELEMENT = Float64Array
        ? Float64Array.BYTES_PER_ELEMENT
        : 0;

      /**
       * Used as the maximum length of an array-like value.
       * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
       * for more details.
       */
      var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;

      /** Used to store function metadata. */
      var metaMap = WeakMap && new WeakMap();

      /*------------------------------------------------------------------------*/

      /**
       * Creates a `lodash` object which wraps `value` to enable intuitive chaining.
       * Methods that operate on and return arrays, collections, and functions can
       * be chained together. Methods that return a boolean or single value will
       * automatically end the chain returning the unwrapped value. Explicit chaining
       * may be enabled using `_.chain`. The execution of chained methods is lazy,
       * that is, execution is deferred until `_#value` is implicitly or explicitly
       * called.
       *
       * Lazy evaluation allows several methods to support shortcut fusion. Shortcut
       * fusion is an optimization that merges iteratees to avoid creating intermediate
       * arrays and reduce the number of iteratee executions.
       *
       * Chaining is supported in custom builds as long as the `_#value` method is
       * directly or indirectly included in the build.
       *
       * In addition to lodash methods, wrappers also have the following `Array` methods:
       * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
       * and `unshift`
       *
       * The wrapper functions that support shortcut fusion are:
       * `drop`, `dropRight`, `dropRightWhile`, `dropWhile`, `filter`, `first`,
       * `initial`, `last`, `map`, `pluck`, `reject`, `rest`, `reverse`, `slice`,
       * `take`, `takeRight`, `takeRightWhile`, `takeWhile`, and `where`
       *
       * The chainable wrapper functions are:
       * `after`, `ary`, `assign`, `at`, `before`, `bind`, `bindAll`, `bindKey`,
       * `callback`, `chain`, `chunk`, `compact`, `concat`, `constant`, `countBy`,
       * `create`, `curry`, `debounce`, `defaults`, `defer`, `delay`, `difference`,
       * `drop`, `dropRight`, `dropRightWhile`, `dropWhile`, `filter`, `flatten`,
       * `flattenDeep`, `flow`, `flowRight`, `forEach`, `forEachRight`, `forIn`,
       * `forInRight`, `forOwn`, `forOwnRight`, `functions`, `groupBy`, `indexBy`,
       * `initial`, `intersection`, `invert`, `invoke`, `keys`, `keysIn`, `map`,
       * `mapValues`, `matches`, `memoize`, `merge`, `mixin`, `negate`, `noop`,
       * `omit`, `once`, `pairs`, `partial`, `partialRight`, `partition`, `pick`,
       * `pluck`, `property`, `propertyOf`, `pull`, `pullAt`, `push`, `range`,
       * `rearg`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
       * `sortBy`, `sortByAll`, `splice`, `take`, `takeRight`, `takeRightWhile`,
       * `takeWhile`, `tap`, `throttle`, `thru`, `times`, `toArray`, `toPlainObject`,
       * `transform`, `union`, `uniq`, `unshift`, `unzip`, `values`, `valuesIn`,
       * `where`, `without`, `wrap`, `xor`, `zip`, and `zipObject`
       *
       * The wrapper functions that are **not** chainable by default are:
       * `attempt`, `camelCase`, `capitalize`, `clone`, `cloneDeep`, `deburr`,
       * `endsWith`, `escape`, `escapeRegExp`, `every`, `find`, `findIndex`, `findKey`,
       * `findLast`, `findLastIndex`, `findLastKey`, `findWhere`, `first`, `has`,
       * `identity`, `includes`, `indexOf`, `isArguments`, `isArray`, `isBoolean`,
       * `isDate`, `isElement`, `isEmpty`, `isEqual`, `isError`, `isFinite`,
       * `isFunction`, `isMatch`, `isNative`, `isNaN`, `isNull`, `isNumber`,
       * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`,
       * `isTypedArray`, `join`, `kebabCase`, `last`, `lastIndexOf`, `max`, `min`,
       * `noConflict`, `now`, `pad`, `padLeft`, `padRight`, `parseInt`, `pop`,
       * `random`, `reduce`, `reduceRight`, `repeat`, `result`, `runInContext`,
       * `shift`, `size`, `snakeCase`, `some`, `sortedIndex`, `sortedLastIndex`,
       * `startCase`, `startsWith`, `template`, `trim`, `trimLeft`, `trimRight`,
       * `trunc`, `unescape`, `uniqueId`, `value`, and `words`
       *
       * The wrapper function `sample` will return a wrapped value when `n` is provided,
       * otherwise an unwrapped value is returned.
       *
       * @name _
       * @constructor
       * @category Chain
       * @param {*} value The value to wrap in a `lodash` instance.
       * @returns {Object} Returns a `lodash` instance.
       * @example
       *
       * var wrapped = _([1, 2, 3]);
       *
       * // returns an unwrapped value
       * wrapped.reduce(function(sum, n) { return sum + n; });
       * // => 6
       *
       * // returns a wrapped value
       * var squares = wrapped.map(function(n) { return n * n; });
       *
       * _.isArray(squares);
       * // => false
       *
       * _.isArray(squares.value());
       * // => true
       */
      function lodash(value) {
        if (isObjectLike(value) && !isArray(value)) {
          if (value instanceof LodashWrapper) {
            return value;
          }
          if (hasOwnProperty.call(value, "__wrapped__")) {
            return new LodashWrapper(
              value.__wrapped__,
              value.__chain__,
              arrayCopy(value.__actions__),
            );
          }
        }
        return new LodashWrapper(value);
      }

      /**
       * The base constructor for creating `lodash` wrapper objects.
       *
       * @private
       * @param {*} value The value to wrap.
       * @param {boolean} [chainAll] Enable chaining for all wrapper methods.
       * @param {Array} [actions=[]] Actions to peform to resolve the unwrapped value.
       */
      function LodashWrapper(value, chainAll, actions) {
        this.__actions__ = actions || [];
        this.__chain__ = !!chainAll;
        this.__wrapped__ = value;
      }

      /**
       * An object environment feature flags.
       *
       * @static
       * @memberOf _
       * @type Object
       */
      var support = (lodash.support = {});

      (function (x) {
        /**
         * Detect if functions can be decompiled by `Function#toString`
         * (all but Firefox OS certified apps, older Opera mobile browsers, and
         * the PlayStation 3; forced `false` for Windows 8 apps).
         *
         * @memberOf _.support
         * @type boolean
         */
        support.funcDecomp =
          !isNative(context.WinRTError) && reThis.test(runInContext);

        /**
         * Detect if `Function#name` is supported (all but IE).
         *
         * @memberOf _.support
         * @type boolean
         */
        support.funcNames = typeof Function.name == "string";

        /**
         * Detect if the DOM is supported.
         *
         * @memberOf _.support
         * @type boolean
         */
        try {
          support.dom = document.createDocumentFragment().nodeType === 11;
        } catch (e) {
          support.dom = false;
        }

        /**
         * Detect if `arguments` object indexes are non-enumerable.
         *
         * In Firefox < 4, IE < 9, PhantomJS, and Safari < 5.1 `arguments` object
         * indexes are non-enumerable. Chrome < 25 and Node.js < 0.11.0 treat
         * `arguments` object indexes as non-enumerable and fail `hasOwnProperty`
         * checks for indexes that exceed their function's formal parameters with
         * associated values of `0`.
         *
         * @memberOf _.support
         * @type boolean
         */
        try {
          support.nonEnumArgs = !propertyIsEnumerable.call(arguments, 1);
        } catch (e) {
          support.nonEnumArgs = true;
        }
      })(0, 0);

      /**
       * By default, the template delimiters used by lodash are like those in
       * embedded Ruby (ERB). Change the following template settings to use
       * alternative delimiters.
       *
       * @static
       * @memberOf _
       * @type Object
       */
      lodash.templateSettings = {
        /**
         * Used to detect `data` property values to be HTML-escaped.
         *
         * @memberOf _.templateSettings
         * @type RegExp
         */
        escape: reEscape,

        /**
         * Used to detect code to be evaluated.
         *
         * @memberOf _.templateSettings
         * @type RegExp
         */
        evaluate: reEvaluate,

        /**
         * Used to detect `data` property values to inject.
         *
         * @memberOf _.templateSettings
         * @type RegExp
         */
        interpolate: reInterpolate,

        /**
         * Used to reference the data object in the template text.
         *
         * @memberOf _.templateSettings
         * @type string
         */
        variable: "",

        /**
         * Used to import variables into the compiled template.
         *
         * @memberOf _.templateSettings
         * @type Object
         */
        imports: {
          /**
           * A reference to the `lodash` function.
           *
           * @memberOf _.templateSettings.imports
           * @type Function
           */
          _: lodash,
        },
      };

      /*------------------------------------------------------------------------*/

      /**
       * Creates a lazy wrapper object which wraps `value` to enable lazy evaluation.
       *
       * @private
       * @param {*} value The value to wrap.
       */
      function LazyWrapper(value) {
        this.actions = null;
        this.dir = 1;
        this.dropCount = 0;
        this.filtered = false;
        this.iteratees = null;
        this.takeCount = POSITIVE_INFINITY;
        this.views = null;
        this.wrapped = value;
      }

      /**
       * Creates a clone of the lazy wrapper object.
       *
       * @private
       * @name clone
       * @memberOf LazyWrapper
       * @returns {Object} Returns the cloned `LazyWrapper` object.
       */
      function lazyClone() {
        var actions = this.actions,
          iteratees = this.iteratees,
          views = this.views,
          result = new LazyWrapper(this.wrapped);

        result.actions = actions ? arrayCopy(actions) : null;
        result.dir = this.dir;
        result.dropCount = this.dropCount;
        result.filtered = this.filtered;
        result.iteratees = iteratees ? arrayCopy(iteratees) : null;
        result.takeCount = this.takeCount;
        result.views = views ? arrayCopy(views) : null;
        return result;
      }

      /**
       * Reverses the direction of lazy iteration.
       *
       * @private
       * @name reverse
       * @memberOf LazyWrapper
       * @returns {Object} Returns the new reversed `LazyWrapper` object.
       */
      function lazyReverse() {
        if (this.filtered) {
          var result = new LazyWrapper(this);
          result.dir = -1;
          result.filtered = true;
        } else {
          result = this.clone();
          result.dir *= -1;
        }
        return result;
      }

      /**
       * Extracts the unwrapped value from its lazy wrapper.
       *
       * @private
       * @name value
       * @memberOf LazyWrapper
       * @returns {*} Returns the unwrapped value.
       */
      function lazyValue() {
        var array = this.wrapped.value();
        if (!isArray(array)) {
          return baseWrapperValue(array, this.actions);
        }
        var dir = this.dir,
          isRight = dir < 0,
          view = getView(0, array.length, this.views),
          start = view.start,
          end = view.end,
          length = end - start,
          dropCount = this.dropCount,
          takeCount = nativeMin(length, this.takeCount - dropCount),
          index = isRight ? end : start - 1,
          iteratees = this.iteratees,
          iterLength = iteratees ? iteratees.length : 0,
          resIndex = 0,
          result = [];

        outer: while (length-- && resIndex < takeCount) {
          index += dir;

          var iterIndex = -1,
            value = array[index];

          while (++iterIndex < iterLength) {
            var data = iteratees[iterIndex],
              iteratee = data.iteratee,
              computed = iteratee(value, index, array),
              type = data.type;

            if (type == LAZY_MAP_FLAG) {
              value = computed;
            } else if (!computed) {
              if (type == LAZY_FILTER_FLAG) {
                continue outer;
              } else {
                break outer;
              }
            }
          }
          if (dropCount) {
            dropCount--;
          } else {
            result[resIndex++] = value;
          }
        }
        return result;
      }

      /*------------------------------------------------------------------------*/

      /**
       * Creates a cache object to store key/value pairs.
       *
       * @private
       * @static
       * @name Cache
       * @memberOf _.memoize
       */
      function MapCache() {
        this.__data__ = {};
      }

      /**
       * Removes `key` and its value from the cache.
       *
       * @private
       * @name delete
       * @memberOf _.memoize.Cache
       * @param {string} key The key of the value to remove.
       * @returns {boolean} Returns `true` if the entry was removed successfully, else `false`.
       */
      function mapDelete(key) {
        return this.has(key) && delete this.__data__[key];
      }

      /**
       * Gets the cached value for `key`.
       *
       * @private
       * @name get
       * @memberOf _.memoize.Cache
       * @param {string} key The key of the value to get.
       * @returns {*} Returns the cached value.
       */
      function mapGet(key) {
        return key == "__proto__" ? undefined : this.__data__[key];
      }

      /**
       * Checks if a cached value for `key` exists.
       *
       * @private
       * @name has
       * @memberOf _.memoize.Cache
       * @param {string} key The key of the entry to check.
       * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
       */
      function mapHas(key) {
        return key != "__proto__" && hasOwnProperty.call(this.__data__, key);
      }

      /**
       * Adds `value` to `key` of the cache.
       *
       * @private
       * @name set
       * @memberOf _.memoize.Cache
       * @param {string} key The key of the value to cache.
       * @param {*} value The value to cache.
       * @returns {Object} Returns the cache object.
       */
      function mapSet(key, value) {
        if (key != "__proto__") {
          this.__data__[key] = value;
        }
        return this;
      }

      /*------------------------------------------------------------------------*/

      /**
       *
       * Creates a cache object to store unique values.
       *
       * @private
       * @param {Array} [values] The values to cache.
       */
      function SetCache(values) {
        var length = values ? values.length : 0;

        this.data = { hash: nativeCreate(null), set: new Set() };
        while (length--) {
          this.push(values[length]);
        }
      }

      /**
       * Checks if `value` is in `cache` mimicking the return signature of
       * `_.indexOf` by returning `0` if the value is found, else `-1`.
       *
       * @private
       * @param {Object} cache The cache to search.
       * @param {*} value The value to search for.
       * @returns {number} Returns `0` if `value` is found, else `-1`.
       */
      function cacheIndexOf(cache, value) {
        var data = cache.data,
          result =
            typeof value == "string" || isObject(value)
              ? data.set.has(value)
              : data.hash[value];

        return result ? 0 : -1;
      }

      /**
       * Adds `value` to the cache.
       *
       * @private
       * @name push
       * @memberOf SetCache
       * @param {*} value The value to cache.
       */
      function cachePush(value) {
        var data = this.data;
        if (typeof value == "string" || isObject(value)) {
          data.set.add(value);
        } else {
          data.hash[value] = true;
        }
      }

      /*------------------------------------------------------------------------*/

      /**
       * Copies the values of `source` to `array`.
       *
       * @private
       * @param {Array} source The array to copy values from.
       * @param {Array} [array=[]] The array to copy values to.
       * @returns {Array} Returns `array`.
       */
      function arrayCopy(source, array) {
        var index = -1,
          length = source.length;

        array || (array = Array(length));
        while (++index < length) {
          array[index] = source[index];
        }
        return array;
      }

      /**
       * A specialized version of `_.forEach` for arrays without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns `array`.
       */
      function arrayEach(array, iteratee) {
        var index = -1,
          length = array.length;

        while (++index < length) {
          if (iteratee(array[index], index, array) === false) {
            break;
          }
        }
        return array;
      }

      /**
       * A specialized version of `_.forEachRight` for arrays without support for
       * callback shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns `array`.
       */
      function arrayEachRight(array, iteratee) {
        var length = array.length;

        while (length--) {
          if (iteratee(array[length], length, array) === false) {
            break;
          }
        }
        return array;
      }

      /**
       * A specialized version of `_.every` for arrays without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {boolean} Returns `true` if all elements pass the predicate check,
       *  else `false`.
       */
      function arrayEvery(array, predicate) {
        var index = -1,
          length = array.length;

        while (++index < length) {
          if (!predicate(array[index], index, array)) {
            return false;
          }
        }
        return true;
      }

      /**
       * A specialized version of `_.filter` for arrays without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {Array} Returns the new filtered array.
       */
      function arrayFilter(array, predicate) {
        var index = -1,
          length = array.length,
          resIndex = -1,
          result = [];

        while (++index < length) {
          var value = array[index];
          if (predicate(value, index, array)) {
            result[++resIndex] = value;
          }
        }
        return result;
      }

      /**
       * A specialized version of `_.map` for arrays without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns the new mapped array.
       */
      function arrayMap(array, iteratee) {
        var index = -1,
          length = array.length,
          result = Array(length);

        while (++index < length) {
          result[index] = iteratee(array[index], index, array);
        }
        return result;
      }

      /**
       * A specialized version of `_.max` for arrays without support for iteratees.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @returns {*} Returns the maximum value.
       */
      function arrayMax(array) {
        var index = -1,
          length = array.length,
          result = NEGATIVE_INFINITY;

        while (++index < length) {
          var value = array[index];
          if (value > result) {
            result = value;
          }
        }
        return result;
      }

      /**
       * A specialized version of `_.min` for arrays without support for iteratees.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @returns {*} Returns the minimum value.
       */
      function arrayMin(array) {
        var index = -1,
          length = array.length,
          result = POSITIVE_INFINITY;

        while (++index < length) {
          var value = array[index];
          if (value < result) {
            result = value;
          }
        }
        return result;
      }

      /**
       * A specialized version of `_.reduce` for arrays without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {*} [accumulator] The initial value.
       * @param {boolean} [initFromArray] Specify using the first element of `array`
       *  as the initial value.
       * @returns {*} Returns the accumulated value.
       */
      function arrayReduce(array, iteratee, accumulator, initFromArray) {
        var index = -1,
          length = array.length;

        if (initFromArray && length) {
          accumulator = array[++index];
        }
        while (++index < length) {
          accumulator = iteratee(accumulator, array[index], index, array);
        }
        return accumulator;
      }

      /**
       * A specialized version of `_.reduceRight` for arrays without support for
       * callback shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {*} [accumulator] The initial value.
       * @param {boolean} [initFromArray] Specify using the last element of `array`
       *  as the initial value.
       * @returns {*} Returns the accumulated value.
       */
      function arrayReduceRight(array, iteratee, accumulator, initFromArray) {
        var length = array.length;
        if (initFromArray && length) {
          accumulator = array[--length];
        }
        while (length--) {
          accumulator = iteratee(accumulator, array[length], length, array);
        }
        return accumulator;
      }

      /**
       * A specialized version of `_.some` for arrays without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array} array The array to iterate over.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {boolean} Returns `true` if any element passes the predicate check,
       *  else `false`.
       */
      function arraySome(array, predicate) {
        var index = -1,
          length = array.length;

        while (++index < length) {
          if (predicate(array[index], index, array)) {
            return true;
          }
        }
        return false;
      }

      /**
       * Used by `_.defaults` to customize its `_.assign` use.
       *
       * @private
       * @param {*} objectValue The destination object property value.
       * @param {*} sourceValue The source object property value.
       * @returns {*} Returns the value to assign to the destination object.
       */
      function assignDefaults(objectValue, sourceValue) {
        return typeof objectValue == "undefined" ? sourceValue : objectValue;
      }

      /**
       * Used by `_.template` to customize its `_.assign` use.
       *
       * **Note:** This method is like `assignDefaults` except that it ignores
       * inherited property values when checking if a property is `undefined`.
       *
       * @private
       * @param {*} objectValue The destination object property value.
       * @param {*} sourceValue The source object property value.
       * @param {string} key The key associated with the object and source values.
       * @param {Object} object The destination object.
       * @returns {*} Returns the value to assign to the destination object.
       */
      function assignOwnDefaults(objectValue, sourceValue, key, object) {
        return typeof objectValue == "undefined" ||
          !hasOwnProperty.call(object, key)
          ? sourceValue
          : objectValue;
      }

      /**
       * The base implementation of `_.assign` without support for argument juggling,
       * multiple sources, and `this` binding `customizer` functions.
       *
       * @private
       * @param {Object} object The destination object.
       * @param {Object} source The source object.
       * @param {Function} [customizer] The function to customize assigning values.
       * @returns {Object} Returns the destination object.
       */
      function baseAssign(object, source, customizer) {
        var props = keys(source);
        if (!customizer) {
          return baseCopy(source, object, props);
        }
        var index = -1,
          length = props.length;

        while (++index < length) {
          var key = props[index],
            value = object[key],
            result = customizer(value, source[key], key, object, source);

          if (
            (result === result ? result !== value : value === value) ||
            (typeof value == "undefined" && !(key in object))
          ) {
            object[key] = result;
          }
        }
        return object;
      }

      /**
       * The base implementation of `_.at` without support for strings and individual
       * key arguments.
       *
       * @private
       * @param {Array|Object} collection The collection to iterate over.
       * @param {number[]|string[]} [props] The property names or indexes of elements to pick.
       * @returns {Array} Returns the new array of picked elements.
       */
      function baseAt(collection, props) {
        var index = -1,
          length = collection.length,
          isArr = isLength(length),
          propsLength = props.length,
          result = Array(propsLength);

        while (++index < propsLength) {
          var key = props[index];
          if (isArr) {
            key = parseFloat(key);
            result[index] = isIndex(key, length) ? collection[key] : undefined;
          } else {
            result[index] = collection[key];
          }
        }
        return result;
      }

      /**
       * Copies the properties of `source` to `object`.
       *
       * @private
       * @param {Object} source The object to copy properties from.
       * @param {Object} [object={}] The object to copy properties to.
       * @param {Array} props The property names to copy.
       * @returns {Object} Returns `object`.
       */
      function baseCopy(source, object, props) {
        if (!props) {
          props = object;
          object = {};
        }
        var index = -1,
          length = props.length;

        while (++index < length) {
          var key = props[index];
          object[key] = source[key];
        }
        return object;
      }

      /**
       * The base implementation of `_.bindAll` without support for individual
       * method name arguments.
       *
       * @private
       * @param {Object} object The object to bind and assign the bound methods to.
       * @param {string[]} methodNames The object method names to bind.
       * @returns {Object} Returns `object`.
       */
      function baseBindAll(object, methodNames) {
        var index = -1,
          length = methodNames.length;

        while (++index < length) {
          var key = methodNames[index];
          object[key] = createWrapper(object[key], BIND_FLAG, object);
        }
        return object;
      }

      /**
       * The base implementation of `_.callback` which supports specifying the
       * number of arguments to provide to `func`.
       *
       * @private
       * @param {*} [func=_.identity] The value to convert to a callback.
       * @param {*} [thisArg] The `this` binding of `func`.
       * @param {number} [argCount] The number of arguments to provide to `func`.
       * @returns {Function} Returns the callback.
       */
      function baseCallback(func, thisArg, argCount) {
        var type = typeof func;
        if (type == "function") {
          return typeof thisArg != "undefined" && isBindable(func)
            ? bindCallback(func, thisArg, argCount)
            : func;
        }
        if (func == null) {
          return identity;
        }
        // Handle "_.property" and "_.matches" style callback shorthands.
        return type == "object" ? baseMatches(func) : baseProperty(func + "");
      }

      /**
       * The base implementation of `_.clone` without support for argument juggling
       * and `this` binding `customizer` functions.
       *
       * @private
       * @param {*} value The value to clone.
       * @param {boolean} [isDeep] Specify a deep clone.
       * @param {Function} [customizer] The function to customize cloning values.
       * @param {string} [key] The key of `value`.
       * @param {Object} [object] The object `value` belongs to.
       * @param {Array} [stackA=[]] Tracks traversed source objects.
       * @param {Array} [stackB=[]] Associates clones with source counterparts.
       * @returns {*} Returns the cloned value.
       */
      function baseClone(
        value,
        isDeep,
        customizer,
        key,
        object,
        stackA,
        stackB,
      ) {
        var result;
        if (customizer) {
          result = object ? customizer(value, key, object) : customizer(value);
        }
        if (typeof result != "undefined") {
          return result;
        }
        if (!isObject(value)) {
          return value;
        }
        var isArr = isArray(value);
        if (isArr) {
          result = initCloneArray(value);
          if (!isDeep) {
            return arrayCopy(value, result);
          }
        } else {
          var tag = objToString.call(value),
            isFunc = tag == funcTag;

          if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
            result = initCloneObject(isFunc ? {} : value);
            if (!isDeep) {
              return baseCopy(value, result, keys(value));
            }
          } else {
            return cloneableTags[tag]
              ? initCloneByTag(value, tag, isDeep)
              : object
                ? value
                : {};
          }
        }
        // Check for circular references and return corresponding clone.
        stackA || (stackA = []);
        stackB || (stackB = []);

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == value) {
            return stackB[length];
          }
        }
        // Add the source value to the stack of traversed objects and associate it with its clone.
        stackA.push(value);
        stackB.push(result);

        // Recursively populate clone (susceptible to call stack limits).
        (isArr ? arrayEach : baseForOwn)(value, function (subValue, key) {
          result[key] = baseClone(
            subValue,
            isDeep,
            customizer,
            key,
            value,
            stackA,
            stackB,
          );
        });
        return result;
      }

      /**
       * The base implementation of `_.create` without support for assigning
       * properties to the created object.
       *
       * @private
       * @param {Object} prototype The object to inherit from.
       * @returns {Object} Returns the new object.
       */
      var baseCreate = (function () {
        function Object() {}
        return function (prototype) {
          if (isObject(prototype)) {
            Object.prototype = prototype;
            var result = new Object();
            Object.prototype = null;
          }
          return result || context.Object();
        };
      })();

      /**
       * The base implementation of `_.delay` and `_.defer` which accepts an index
       * of where to slice the arguments to provide to `func`.
       *
       * @private
       * @param {Function} func The function to delay.
       * @param {number} wait The number of milliseconds to delay invocation.
       * @param {Object} args The `arguments` object to slice and provide to `func`.
       * @returns {number} Returns the timer id.
       */
      function baseDelay(func, wait, args, fromIndex) {
        if (!isFunction(func)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        return setTimeout(function () {
          func.apply(undefined, baseSlice(args, fromIndex));
        }, wait);
      }

      /**
       * The base implementation of `_.difference` which accepts a single array
       * of values to exclude.
       *
       * @private
       * @param {Array} array The array to inspect.
       * @param {Array} values The values to exclude.
       * @returns {Array} Returns the new array of filtered values.
       */
      function baseDifference(array, values) {
        var length = array ? array.length : 0,
          result = [];

        if (!length) {
          return result;
        }
        var index = -1,
          indexOf = getIndexOf(),
          isCommon = indexOf == baseIndexOf,
          cache = isCommon && values.length >= 200 && createCache(values),
          valuesLength = values.length;

        if (cache) {
          indexOf = cacheIndexOf;
          isCommon = false;
          values = cache;
        }
        outer: while (++index < length) {
          var value = array[index];

          if (isCommon && value === value) {
            var valuesIndex = valuesLength;
            while (valuesIndex--) {
              if (values[valuesIndex] === value) {
                continue outer;
              }
            }
            result.push(value);
          } else if (indexOf(values, value) < 0) {
            result.push(value);
          }
        }
        return result;
      }

      /**
       * The base implementation of `_.forEach` without support for callback
       * shorthands and `this` binding.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array|Object|string} Returns `collection`.
       */
      function baseEach(collection, iteratee) {
        var length = collection ? collection.length : 0;
        if (!isLength(length)) {
          return baseForOwn(collection, iteratee);
        }
        var index = -1,
          iterable = toObject(collection);

        while (++index < length) {
          if (iteratee(iterable[index], index, iterable) === false) {
            break;
          }
        }
        return collection;
      }

      /**
       * The base implementation of `_.forEachRight` without support for callback
       * shorthands and `this` binding.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array|Object|string} Returns `collection`.
       */
      function baseEachRight(collection, iteratee) {
        var length = collection ? collection.length : 0;
        if (!isLength(length)) {
          return baseForOwnRight(collection, iteratee);
        }
        var iterable = toObject(collection);
        while (length--) {
          if (iteratee(iterable[length], length, iterable) === false) {
            break;
          }
        }
        return collection;
      }

      /**
       * The base implementation of `_.every` without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {boolean} Returns `true` if all elements pass the predicate check,
       *  else `false`
       */
      function baseEvery(collection, predicate) {
        var result = true;
        baseEach(collection, function (value, index, collection) {
          result = !!predicate(value, index, collection);
          return result;
        });
        return result;
      }

      /**
       * The base implementation of `_.filter` without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {Array} Returns the new filtered array.
       */
      function baseFilter(collection, predicate) {
        var result = [];
        baseEach(collection, function (value, index, collection) {
          if (predicate(value, index, collection)) {
            result.push(value);
          }
        });
        return result;
      }

      /**
       * The base implementation of `_.find`, `_.findLast`, `_.findKey`, and `_.findLastKey`,
       * without support for callback shorthands and `this` binding, which iterates
       * over `collection` using the provided `eachFunc`.
       *
       * @private
       * @param {Array|Object|string} collection The collection to search.
       * @param {Function} predicate The function invoked per iteration.
       * @param {Function} eachFunc The function to iterate over `collection`.
       * @param {boolean} [retKey] Specify returning the key of the found element
       *  instead of the element itself.
       * @returns {*} Returns the found element or its key, else `undefined`.
       */
      function baseFind(collection, predicate, eachFunc, retKey) {
        var result;
        eachFunc(collection, function (value, key, collection) {
          if (predicate(value, key, collection)) {
            result = retKey ? key : value;
            return false;
          }
        });
        return result;
      }

      /**
       * The base implementation of `_.flatten` with added support for restricting
       * flattening and specifying the start index.
       *
       * @private
       * @param {Array} array The array to flatten.
       * @param {boolean} [isDeep] Specify a deep flatten.
       * @param {boolean} [isStrict] Restrict flattening to arrays and `arguments` objects.
       * @param {number} [fromIndex=0] The index to start from.
       * @returns {Array} Returns the new flattened array.
       */
      function baseFlatten(array, isDeep, isStrict, fromIndex) {
        var index = (fromIndex || 0) - 1,
          length = array.length,
          resIndex = -1,
          result = [];

        while (++index < length) {
          var value = array[index];

          if (
            isObjectLike(value) &&
            isLength(value.length) &&
            (isArray(value) || isArguments(value))
          ) {
            if (isDeep) {
              // Recursively flatten arrays (susceptible to call stack limits).
              value = baseFlatten(value, isDeep, isStrict);
            }
            var valIndex = -1,
              valLength = value.length;

            result.length += valLength;
            while (++valIndex < valLength) {
              result[++resIndex] = value[valIndex];
            }
          } else if (!isStrict) {
            result[++resIndex] = value;
          }
        }
        return result;
      }

      /**
       * The base implementation of `baseForIn` and `baseForOwn` which iterates
       * over `object` properties returned by `keysFunc` invoking `iteratee` for
       * each property. Iterator functions may exit iteration early by explicitly
       * returning `false`.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {Function} keysFunc The function to get the keys of `object`.
       * @returns {Object} Returns `object`.
       */
      function baseFor(object, iteratee, keysFunc) {
        var index = -1,
          iterable = toObject(object),
          props = keysFunc(object),
          length = props.length;

        while (++index < length) {
          var key = props[index];
          if (iteratee(iterable[key], key, iterable) === false) {
            break;
          }
        }
        return object;
      }

      /**
       * This function is like `baseFor` except that it iterates over properties
       * in the opposite order.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {Function} keysFunc The function to get the keys of `object`.
       * @returns {Object} Returns `object`.
       */
      function baseForRight(object, iteratee, keysFunc) {
        var iterable = toObject(object),
          props = keysFunc(object),
          length = props.length;

        while (length--) {
          var key = props[length];
          if (iteratee(iterable[key], key, iterable) === false) {
            break;
          }
        }
        return object;
      }

      /**
       * The base implementation of `_.forIn` without support for callback
       * shorthands and `this` binding.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Object} Returns `object`.
       */
      function baseForIn(object, iteratee) {
        return baseFor(object, iteratee, keysIn);
      }

      /**
       * The base implementation of `_.forOwn` without support for callback
       * shorthands and `this` binding.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Object} Returns `object`.
       */
      function baseForOwn(object, iteratee) {
        return baseFor(object, iteratee, keys);
      }

      /**
       * The base implementation of `_.forOwnRight` without support for callback
       * shorthands and `this` binding.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Object} Returns `object`.
       */
      function baseForOwnRight(object, iteratee) {
        return baseForRight(object, iteratee, keys);
      }

      /**
       * The base implementation of `_.functions` which creates an array of
       * `object` function property names filtered from those provided.
       *
       * @private
       * @param {Object} object The object to inspect.
       * @param {Array} props The property names to filter.
       * @returns {Array} Returns the new array of filtered property names.
       */
      function baseFunctions(object, props) {
        var index = -1,
          length = props.length,
          resIndex = -1,
          result = [];

        while (++index < length) {
          var key = props[index];
          if (isFunction(object[key])) {
            result[++resIndex] = key;
          }
        }
        return result;
      }

      /**
       * The base implementation of `_.invoke` which requires additional arguments
       * to be provided as an array of arguments rather than individually.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|string} methodName The name of the method to invoke or
       *  the function invoked per iteration.
       * @param {Array} [args] The arguments to invoke the method with.
       * @returns {Array} Returns the array of results.
       */
      function baseInvoke(collection, methodName, args) {
        var index = -1,
          isFunc = typeof methodName == "function",
          length = collection ? collection.length : 0,
          result = isLength(length) ? Array(length) : [];

        baseEach(collection, function (value) {
          var func = isFunc ? methodName : value != null && value[methodName];
          result[++index] = func ? func.apply(value, args) : undefined;
        });
        return result;
      }

      /**
       * The base implementation of `_.isEqual` without support for `this` binding
       * `customizer` functions.
       *
       * @private
       * @param {*} value The value to compare.
       * @param {*} other The other value to compare.
       * @param {Function} [customizer] The function to customize comparing values.
       * @param {boolean} [isWhere] Specify performing partial comparisons.
       * @param {Array} [stackA] Tracks traversed `value` objects.
       * @param {Array} [stackB] Tracks traversed `other` objects.
       * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
       */
      function baseIsEqual(value, other, customizer, isWhere, stackA, stackB) {
        // Exit early for identical values.
        if (value === other) {
          // Treat `+0` vs. `-0` as not equal.
          return value !== 0 || 1 / value == 1 / other;
        }
        var valType = typeof value,
          othType = typeof other;

        // Exit early for unlike primitive values.
        if (
          (valType != "function" &&
            valType != "object" &&
            othType != "function" &&
            othType != "object") ||
          value == null ||
          other == null
        ) {
          // Return `false` unless both values are `NaN`.
          return value !== value && other !== other;
        }
        return baseIsEqualDeep(
          value,
          other,
          baseIsEqual,
          customizer,
          isWhere,
          stackA,
          stackB,
        );
      }

      /**
       * A specialized version of `baseIsEqual` for arrays and objects which performs
       * deep comparisons and tracks traversed objects enabling objects with circular
       * references to be compared.
       *
       * @private
       * @param {Object} object The object to compare.
       * @param {Object} other The other object to compare.
       * @param {Function} equalFunc The function to determine equivalents of values.
       * @param {Function} [customizer] The function to customize comparing objects.
       * @param {boolean} [isWhere] Specify performing partial comparisons.
       * @param {Array} [stackA=[]] Tracks traversed `value` objects.
       * @param {Array} [stackB=[]] Tracks traversed `other` objects.
       * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
       */
      function baseIsEqualDeep(
        object,
        other,
        equalFunc,
        customizer,
        isWhere,
        stackA,
        stackB,
      ) {
        var objIsArr = isArray(object),
          othIsArr = isArray(other),
          objTag = arrayTag,
          othTag = arrayTag;

        if (!objIsArr) {
          objTag = objToString.call(object);
          if (objTag == argsTag) {
            objTag = objectTag;
          } else if (objTag != objectTag) {
            objIsArr = isTypedArray(object);
          }
        }
        if (!othIsArr) {
          othTag = objToString.call(other);
          if (othTag == argsTag) {
            othTag = objectTag;
          } else if (othTag != objectTag) {
            othIsArr = isTypedArray(other);
          }
        }
        var objIsObj = objTag == objectTag,
          othIsObj = othTag == objectTag,
          isSameTag = objTag == othTag;

        if (isSameTag && !(objIsArr || objIsObj)) {
          return equalByTag(object, other, objTag);
        }
        var valWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"),
          othWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");

        if (valWrapped || othWrapped) {
          return equalFunc(
            valWrapped ? object.value() : object,
            othWrapped ? other.value() : other,
            customizer,
            isWhere,
            stackA,
            stackB,
          );
        }
        if (!isSameTag) {
          return false;
        }
        // Assume cyclic values are equal.
        // For more information on detecting circular references see https://es5.github.io/#JO.
        stackA || (stackA = []);
        stackB || (stackB = []);

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == object) {
            return stackB[length] == other;
          }
        }
        // Add `object` and `other` to the stack of traversed objects.
        stackA.push(object);
        stackB.push(other);

        var result = (objIsArr ? equalArrays : equalObjects)(
          object,
          other,
          equalFunc,
          customizer,
          isWhere,
          stackA,
          stackB,
        );

        stackA.pop();
        stackB.pop();

        return result;
      }

      /**
       * The base implementation of `_.isMatch` without support for callback
       * shorthands or `this` binding.
       *
       * @private
       * @param {Object} source The object to inspect.
       * @param {Array} props The source property names to match.
       * @param {Array} values The source values to match.
       * @param {Array} strictCompareFlags Strict comparison flags for source values.
       * @param {Function} [customizer] The function to customize comparing objects.
       * @returns {boolean} Returns `true` if `object` is a match, else `false`.
       */
      function baseIsMatch(
        object,
        props,
        values,
        strictCompareFlags,
        customizer,
      ) {
        var length = props.length;
        if (object == null) {
          return !length;
        }
        var index = -1,
          noCustomizer = !customizer;

        while (++index < length) {
          if (
            noCustomizer && strictCompareFlags[index]
              ? values[index] !== object[props[index]]
              : !hasOwnProperty.call(object, props[index])
          ) {
            return false;
          }
        }
        index = -1;
        while (++index < length) {
          var key = props[index];
          if (noCustomizer && strictCompareFlags[index]) {
            var result = hasOwnProperty.call(object, key);
          } else {
            var objValue = object[key],
              srcValue = values[index];

            result = customizer
              ? customizer(objValue, srcValue, key)
              : undefined;
            if (typeof result == "undefined") {
              result = baseIsEqual(srcValue, objValue, customizer, true);
            }
          }
          if (!result) {
            return false;
          }
        }
        return true;
      }

      /**
       * The base implementation of `_.map` without support for callback shorthands
       * or `this` binding.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns the new mapped array.
       */
      function baseMap(collection, iteratee) {
        var result = [];
        baseEach(collection, function (value, key, collection) {
          result.push(iteratee(value, key, collection));
        });
        return result;
      }

      /**
       * The base implementation of `_.matches` which supports specifying whether
       * `source` should be cloned.
       *
       * @private
       * @param {Object} source The object of property values to match.
       * @returns {Function} Returns the new function.
       */
      function baseMatches(source) {
        var props = keys(source),
          length = props.length;

        if (length == 1) {
          var key = props[0],
            value = source[key];

          if (isStrictComparable(value)) {
            return function (object) {
              return (
                object != null &&
                value === object[key] &&
                hasOwnProperty.call(object, key)
              );
            };
          }
        }
        var values = Array(length),
          strictCompareFlags = Array(length);

        while (length--) {
          value = source[props[length]];
          values[length] = value;
          strictCompareFlags[length] = isStrictComparable(value);
        }
        return function (object) {
          return baseIsMatch(object, props, values, strictCompareFlags);
        };
      }

      /**
       * The base implementation of `_.merge` without support for argument juggling,
       * multiple sources, and `this` binding `customizer` functions.
       *
       * @private
       * @param {Object} object The destination object.
       * @param {Object} source The source object.
       * @param {Function} [customizer] The function to customize merging properties.
       * @param {Array} [stackA=[]] Tracks traversed source objects.
       * @param {Array} [stackB=[]] Associates values with source counterparts.
       * @returns {Object} Returns the destination object.
       */
      function baseMerge(object, source, customizer, stackA, stackB) {
        var isSrcArr =
          isLength(source.length) && (isArray(source) || isTypedArray(source));

        (isSrcArr ? arrayEach : baseForOwn)(
          source,
          function (srcValue, key, source) {
            if (isObjectLike(srcValue)) {
              stackA || (stackA = []);
              stackB || (stackB = []);
              return baseMergeDeep(
                object,
                source,
                key,
                baseMerge,
                customizer,
                stackA,
                stackB,
              );
            }
            var value = object[key],
              result = customizer
                ? customizer(value, srcValue, key, object, source)
                : undefined,
              isCommon = typeof result == "undefined";

            if (isCommon) {
              result = srcValue;
            }
            if (
              (isSrcArr || typeof result != "undefined") &&
              (isCommon ||
                (result === result ? result !== value : value === value))
            ) {
              object[key] = result;
            }
          },
        );
        return object;
      }

      /**
       * A specialized version of `baseMerge` for arrays and objects which performs
       * deep merges and tracks traversed objects enabling objects with circular
       * references to be merged.
       *
       * @private
       * @param {Object} object The destination object.
       * @param {Object} source The source object.
       * @param {string} key The key of the value to merge.
       * @param {Function} mergeFunc The function to merge values.
       * @param {Function} [customizer] The function to customize merging properties.
       * @param {Array} [stackA=[]] Tracks traversed source objects.
       * @param {Array} [stackB=[]] Associates values with source counterparts.
       * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
       */
      function baseMergeDeep(
        object,
        source,
        key,
        mergeFunc,
        customizer,
        stackA,
        stackB,
      ) {
        var length = stackA.length,
          srcValue = source[key];

        while (length--) {
          if (stackA[length] == srcValue) {
            object[key] = stackB[length];
            return;
          }
        }
        var value = object[key],
          result = customizer
            ? customizer(value, srcValue, key, object, source)
            : undefined,
          isCommon = typeof result == "undefined";

        if (isCommon) {
          result = srcValue;
          if (
            isLength(srcValue.length) &&
            (isArray(srcValue) || isTypedArray(srcValue))
          ) {
            result = isArray(value) ? value : value ? arrayCopy(value) : [];
          } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
            result = isArguments(value)
              ? toPlainObject(value)
              : isPlainObject(value)
                ? value
                : {};
          } else {
            isCommon = false;
          }
        }
        // Add the source value to the stack of traversed objects and associate
        // it with its merged value.
        stackA.push(srcValue);
        stackB.push(result);

        if (isCommon) {
          // Recursively merge objects and arrays (susceptible to call stack limits).
          object[key] = mergeFunc(result, srcValue, customizer, stackA, stackB);
        } else if (result === result ? result !== value : value === value) {
          object[key] = result;
        }
      }

      /**
       * The base implementation of `_.property` which does not coerce `key` to a string.
       *
       * @private
       * @param {string} key The key of the property to get.
       * @returns {Function} Returns the new function.
       */
      function baseProperty(key) {
        return function (object) {
          return object == null ? undefined : object[key];
        };
      }

      /**
       * The base implementation of `_.pullAt` without support for individual
       * index arguments.
       *
       * @private
       * @param {Array} array The array to modify.
       * @param {number[]} indexes The indexes of elements to remove.
       * @returns {Array} Returns the new array of removed elements.
       */
      function basePullAt(array, indexes) {
        var length = indexes.length,
          result = baseAt(array, indexes);

        indexes.sort(baseCompareAscending);
        while (length--) {
          var index = parseFloat(indexes[length]);
          if (index != previous && isIndex(index)) {
            var previous = index;
            splice.call(array, index, 1);
          }
        }
        return result;
      }

      /**
       * The base implementation of `_.random` without support for argument juggling
       * and returning floating-point numbers.
       *
       * @private
       * @param {number} min The minimum possible value.
       * @param {number} max The maximum possible value.
       * @returns {number} Returns the random number.
       */
      function baseRandom(min, max) {
        return min + floor(nativeRandom() * (max - min + 1));
      }

      /**
       * The base implementation of `_.reduce` and `_.reduceRight` without support
       * for callback shorthands or `this` binding, which iterates over `collection`
       * using the provided `eachFunc`.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {*} accumulator The initial value.
       * @param {boolean} initFromCollection Specify using the first or last element
       *  of `collection` as the initial value.
       * @param {Function} eachFunc The function to iterate over `collection`.
       * @returns {*} Returns the accumulated value.
       */
      function baseReduce(
        collection,
        iteratee,
        accumulator,
        initFromCollection,
        eachFunc,
      ) {
        eachFunc(collection, function (value, index, collection) {
          accumulator = initFromCollection
            ? ((initFromCollection = false), value)
            : iteratee(accumulator, value, index, collection);
        });
        return accumulator;
      }

      /**
       * The base implementation of `setData` without support for hot loop detection.
       *
       * @private
       * @param {Function} func The function to associate metadata with.
       * @param {*} data The metadata.
       * @returns {Function} Returns `func`.
       */
      var baseSetData = !metaMap
        ? identity
        : function (func, data) {
            metaMap.set(func, data);
            return func;
          };

      /**
       * The base implementation of `_.slice` without an iteratee call guard.
       *
       * @private
       * @param {Array} array The array to slice.
       * @param {number} [start=0] The start position.
       * @param {number} [end=array.length] The end position.
       * @returns {Array} Returns the slice of `array`.
       */
      function baseSlice(array, start, end) {
        var index = -1,
          length = array.length;

        start = start == null ? 0 : +start || 0;
        if (start < 0) {
          start = -start > length ? 0 : length + start;
        }
        end = typeof end == "undefined" || end > length ? length : +end || 0;
        if (end < 0) {
          end += length;
        }
        length = start > end ? 0 : (end - start) >>> 0;
        start >>>= 0;

        var result = Array(length);
        while (++index < length) {
          result[index] = array[index + start];
        }
        return result;
      }

      /**
       * The base implementation of `_.some` without support for callback shorthands
       * or `this` binding.
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {boolean} Returns `true` if any element passes the predicate check,
       *  else `false`.
       */
      function baseSome(collection, predicate) {
        var result;

        baseEach(collection, function (value, index, collection) {
          result = predicate(value, index, collection);
          return !result;
        });
        return !!result;
      }

      /**
       * The base implementation of `_.uniq` without support for callback shorthands
       * and `this` binding.
       *
       * @private
       * @param {Array} array The array to inspect.
       * @param {Function} [iteratee] The function invoked per iteration.
       * @returns {Array} Returns the new duplicate-value-free array.
       */
      function baseUniq(array, iteratee) {
        var index = -1,
          indexOf = getIndexOf(),
          length = array.length,
          isCommon = indexOf == baseIndexOf,
          isLarge = isCommon && length >= 200,
          seen = isLarge && createCache(),
          result = [];

        if (seen) {
          indexOf = cacheIndexOf;
          isCommon = false;
        } else {
          isLarge = false;
          seen = iteratee ? [] : result;
        }
        outer: while (++index < length) {
          var value = array[index],
            computed = iteratee ? iteratee(value, index, array) : value;

          if (isCommon && value === value) {
            var seenIndex = seen.length;
            while (seenIndex--) {
              if (seen[seenIndex] === computed) {
                continue outer;
              }
            }
            if (iteratee) {
              seen.push(computed);
            }
            result.push(value);
          } else if (indexOf(seen, computed) < 0) {
            if (iteratee || isLarge) {
              seen.push(computed);
            }
            result.push(value);
          }
        }
        return result;
      }

      /**
       * The base implementation of `_.values` and `_.valuesIn` which creates an
       * array of `object` property values corresponding to the property names
       * returned by `keysFunc`.
       *
       * @private
       * @param {Object} object The object to query.
       * @param {Array} props The property names to get values for.
       * @returns {Object} Returns the array of property values.
       */
      function baseValues(object, props) {
        var index = -1,
          length = props.length,
          result = Array(length);

        while (++index < length) {
          result[index] = object[props[index]];
        }
        return result;
      }

      /**
       * The base implementation of `wrapperValue` which returns the result of
       * performing a sequence of actions on the unwrapped `value`, where each
       * successive action is supplied the return value of the previous.
       *
       * @private
       * @param {*} value The unwrapped value.
       * @param {Array} actions Actions to peform to resolve the unwrapped value.
       * @returns {*} Returns the resolved unwrapped value.
       */
      function baseWrapperValue(value, actions) {
        var result = value;
        if (result instanceof LazyWrapper) {
          result = result.value();
        }
        var index = -1,
          length = actions.length;

        while (++index < length) {
          var args = [result],
            action = actions[index];

          push.apply(args, action.args);
          result = action.func.apply(action.thisArg, args);
        }
        return result;
      }

      /**
       * Performs a binary search of `array` to determine the index at which `value`
       * should be inserted into `array` in order to maintain its sort order.
       *
       * @private
       * @param {Array} array The sorted array to inspect.
       * @param {*} value The value to evaluate.
       * @param {boolean} [retHighest] Specify returning the highest, instead
       *  of the lowest, index at which a value should be inserted into `array`.
       * @returns {number} Returns the index at which `value` should be inserted
       *  into `array`.
       */
      function binaryIndex(array, value, retHighest) {
        var low = 0,
          high = array ? array.length : low;

        if (
          typeof value == "number" &&
          value === value &&
          high <= HALF_MAX_ARRAY_LENGTH
        ) {
          while (low < high) {
            var mid = (low + high) >>> 1,
              computed = array[mid];

            if (retHighest ? computed <= value : computed < value) {
              low = mid + 1;
            } else {
              high = mid;
            }
          }
          return high;
        }
        return binaryIndexBy(array, value, identity, retHighest);
      }

      /**
       * This function is like `binaryIndex` except that it invokes `iteratee` for
       * `value` and each element of `array` to compute their sort ranking. The
       * iteratee is invoked with one argument; (value).
       *
       * @private
       * @param {Array} array The sorted array to inspect.
       * @param {*} value The value to evaluate.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {boolean} [retHighest] Specify returning the highest, instead
       *  of the lowest, index at which a value should be inserted into `array`.
       * @returns {number} Returns the index at which `value` should be inserted
       *  into `array`.
       */
      function binaryIndexBy(array, value, iteratee, retHighest) {
        value = iteratee(value);

        var low = 0,
          high = array ? array.length : 0,
          valIsNaN = value !== value,
          valIsUndef = typeof value == "undefined";

        while (low < high) {
          var mid = floor((low + high) / 2),
            computed = iteratee(array[mid]),
            isReflexive = computed === computed;

          if (valIsNaN) {
            var setLow = isReflexive || retHighest;
          } else if (valIsUndef) {
            setLow =
              isReflexive && (retHighest || typeof computed != "undefined");
          } else {
            setLow = retHighest ? computed <= value : computed < value;
          }
          if (setLow) {
            low = mid + 1;
          } else {
            high = mid;
          }
        }
        return nativeMin(high, MAX_ARRAY_INDEX);
      }

      /**
       * A specialized version of `baseCallback` which only supports `this` binding
       * and specifying the number of arguments to provide to `func`.
       *
       * @private
       * @param {Function} func The function to bind.
       * @param {*} thisArg The `this` binding of `func`.
       * @param {number} [argCount] The number of arguments to provide to `func`.
       * @returns {Function} Returns the callback.
       */
      function bindCallback(func, thisArg, argCount) {
        if (typeof func != "function") {
          return identity;
        }
        if (typeof thisArg == "undefined") {
          return func;
        }
        switch (argCount) {
          case 1:
            return function (value) {
              return func.call(thisArg, value);
            };
          case 3:
            return function (value, index, collection) {
              return func.call(thisArg, value, index, collection);
            };
          case 4:
            return function (accumulator, value, index, collection) {
              return func.call(thisArg, accumulator, value, index, collection);
            };
          case 5:
            return function (value, other, key, object, source) {
              return func.call(thisArg, value, other, key, object, source);
            };
        }
        return function () {
          return func.apply(thisArg, arguments);
        };
      }

      /**
       * Creates a clone of the given array buffer.
       *
       * @private
       * @param {ArrayBuffer} buffer The array buffer to clone.
       * @returns {ArrayBuffer} Returns the cloned array buffer.
       */
      function bufferClone(buffer) {
        return bufferSlice.call(buffer, 0);
      }
      if (!bufferSlice) {
        // PhantomJS has `ArrayBuffer` and `Uint8Array` but not `Float64Array`.
        bufferClone = !(ArrayBuffer && Uint8Array)
          ? constant(null)
          : function (buffer) {
              var byteLength = buffer.byteLength,
                floatLength = Float64Array
                  ? floor(byteLength / FLOAT64_BYTES_PER_ELEMENT)
                  : 0,
                offset = floatLength * FLOAT64_BYTES_PER_ELEMENT,
                result = new ArrayBuffer(byteLength);

              if (floatLength) {
                var view = new Float64Array(result, 0, floatLength);
                view.set(new Float64Array(buffer, 0, floatLength));
              }
              if (byteLength != offset) {
                view = new Uint8Array(result, offset);
                view.set(new Uint8Array(buffer, offset));
              }
              return result;
            };
      }

      /**
       * Creates an array that is the composition of partially applied arguments,
       * placeholders, and provided arguments into a single array of arguments.
       *
       * @private
       * @param {Array|Object} args The provided arguments.
       * @param {Array} partials The arguments to prepend to those provided.
       * @param {Array} holders The `partials` placeholder indexes.
       * @returns {Array} Returns the new array of composed arguments.
       */
      function composeArgs(args, partials, holders) {
        var holdersLength = holders.length,
          argsIndex = -1,
          argsLength = nativeMax(args.length - holdersLength, 0),
          leftIndex = -1,
          leftLength = partials.length,
          result = Array(argsLength + leftLength);

        while (++leftIndex < leftLength) {
          result[leftIndex] = partials[leftIndex];
        }
        while (++argsIndex < holdersLength) {
          result[holders[argsIndex]] = args[argsIndex];
        }
        while (argsLength--) {
          result[leftIndex++] = args[argsIndex++];
        }
        return result;
      }

      /**
       * This function is like `composeArgs` except that the arguments composition
       * is tailored for `_.partialRight`.
       *
       * @private
       * @param {Array|Object} args The provided arguments.
       * @param {Array} partials The arguments to append to those provided.
       * @param {Array} holders The `partials` placeholder indexes.
       * @returns {Array} Returns the new array of composed arguments.
       */
      function composeArgsRight(args, partials, holders) {
        var holdersIndex = -1,
          holdersLength = holders.length,
          argsIndex = -1,
          argsLength = nativeMax(args.length - holdersLength, 0),
          rightIndex = -1,
          rightLength = partials.length,
          result = Array(argsLength + rightLength);

        while (++argsIndex < argsLength) {
          result[argsIndex] = args[argsIndex];
        }
        var pad = argsIndex;
        while (++rightIndex < rightLength) {
          result[pad + rightIndex] = partials[rightIndex];
        }
        while (++holdersIndex < holdersLength) {
          result[pad + holders[holdersIndex]] = args[argsIndex++];
        }
        return result;
      }

      /**
       * Creates a function that aggregates a collection, creating an accumulator
       * object composed from the results of running each element in the collection
       * through an iteratee. The `setter` sets the keys and values of the accumulator
       * object. If `initializer` is provided initializes the accumulator object.
       *
       * @private
       * @param {Function} setter The function to set keys and values of the accumulator object.
       * @param {Function} [initializer] The function to initialize the accumulator object.
       * @returns {Function} Returns the new aggregator function.
       */
      function createAggregator(setter, initializer) {
        return function (collection, iteratee, thisArg) {
          var result = initializer ? initializer() : {};
          iteratee = getCallback(iteratee, thisArg, 3);

          if (isArray(collection)) {
            var index = -1,
              length = collection.length;

            while (++index < length) {
              var value = collection[index];
              setter(
                result,
                value,
                iteratee(value, index, collection),
                collection,
              );
            }
          } else {
            baseEach(collection, function (value, key, collection) {
              setter(
                result,
                value,
                iteratee(value, key, collection),
                collection,
              );
            });
          }
          return result;
        };
      }

      /**
       * Creates a function that assigns properties of source object(s) to a given
       * destination object.
       *
       * @private
       * @param {Function} assigner The function to assign values.
       * @returns {Function} Returns the new assigner function.
       */
      function createAssigner(assigner) {
        return function () {
          var length = arguments.length,
            object = arguments[0];

          if (length < 2 || object == null) {
            return object;
          }
          if (
            length > 3 &&
            isIterateeCall(arguments[1], arguments[2], arguments[3])
          ) {
            length = 2;
          }
          // Juggle arguments.
          if (length > 3 && typeof arguments[length - 2] == "function") {
            var customizer = bindCallback(
              arguments[--length - 1],
              arguments[length--],
              5,
            );
          } else if (length > 2 && typeof arguments[length - 1] == "function") {
            customizer = arguments[--length];
          }
          var index = 0;
          while (++index < length) {
            var source = arguments[index];
            if (source) {
              assigner(object, source, customizer);
            }
          }
          return object;
        };
      }

      /**
       * Creates a function that wraps `func` and invokes it with the `this`
       * binding of `thisArg`.
       *
       * @private
       * @param {Function} func The function to bind.
       * @param {*} [thisArg] The `this` binding of `func`.
       * @returns {Function} Returns the new bound function.
       */
      function createBindWrapper(func, thisArg) {
        var Ctor = createCtorWrapper(func);

        function wrapper() {
          return (this instanceof wrapper ? Ctor : func).apply(
            thisArg,
            arguments,
          );
        }
        return wrapper;
      }

      /**
       * Creates a `Set` cache object to optimize linear searches of large arrays.
       *
       * @private
       * @param {Array} [values] The values to cache.
       * @returns {null|Object} Returns the new cache object if `Set` is supported, else `null`.
       */
      var createCache = !(nativeCreate && Set)
        ? constant(null)
        : function (values) {
            return new SetCache(values);
          };

      /**
       * Creates a function that produces compound words out of the words in a
       * given string.
       *
       * @private
       * @param {Function} callback The function to combine each word.
       * @returns {Function} Returns the new compounder function.
       */
      function createCompounder(callback) {
        return function (string) {
          var index = -1,
            array = words(deburr(string)),
            length = array.length,
            result = "";

          while (++index < length) {
            result = callback(result, array[index], index);
          }
          return result;
        };
      }

      /**
       * Creates a function that produces an instance of `Ctor` regardless of
       * whether it was invoked as part of a `new` expression or by `call` or `apply`.
       *
       * @private
       * @param {Function} Ctor The constructor to wrap.
       * @returns {Function} Returns the new wrapped function.
       */
      function createCtorWrapper(Ctor) {
        return function () {
          var thisBinding = baseCreate(Ctor.prototype),
            result = Ctor.apply(thisBinding, arguments);

          // Mimic the constructor's `return` behavior.
          // See https://es5.github.io/#x13.2.2 for more details.
          return isObject(result) ? result : thisBinding;
        };
      }

      /**
       * Creates a function that gets the extremum value of a collection.
       *
       * @private
       * @param {Function} arrayFunc The function to get the extremum value from an array.
       * @param {boolean} [isMin] Specify returning the minimum, instead of the maximum,
       *  extremum value.
       * @returns {Function} Returns the new extremum function.
       */
      function createExtremum(arrayFunc, isMin) {
        return function (collection, iteratee, thisArg) {
          if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
            iteratee = null;
          }
          var func = getCallback(),
            noIteratee = iteratee == null;

          if (!(func === baseCallback && noIteratee)) {
            noIteratee = false;
            iteratee = func(iteratee, thisArg, 3);
          }
          if (noIteratee) {
            var isArr = isArray(collection);
            if (!isArr && isString(collection)) {
              iteratee = charAtCallback;
            } else {
              return arrayFunc(isArr ? collection : toIterable(collection));
            }
          }
          return extremumBy(collection, iteratee, isMin);
        };
      }

      /**
       * Creates a function that wraps `func` and invokes it with optional `this`
       * binding of, partial application, and currying.
       *
       * @private
       * @param {Function|string} func The function or method name to reference.
       * @param {number} bitmask The bitmask of flags. See `createWrapper` for more details.
       * @param {*} [thisArg] The `this` binding of `func`.
       * @param {Array} [partials] The arguments to prepend to those provided to the new function.
       * @param {Array} [holders] The `partials` placeholder indexes.
       * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
       * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
       * @param {Array} [argPos] The argument positions of the new function.
       * @param {number} [ary] The arity cap of `func`.
       * @param {number} [arity] The arity of `func`.
       * @returns {Function} Returns the new wrapped function.
       */
      function createHybridWrapper(
        func,
        bitmask,
        thisArg,
        partials,
        holders,
        partialsRight,
        holdersRight,
        argPos,
        ary,
        arity,
      ) {
        var isAry = bitmask & ARY_FLAG,
          isBind = bitmask & BIND_FLAG,
          isBindKey = bitmask & BIND_KEY_FLAG,
          isCurry = bitmask & CURRY_FLAG,
          isCurryBound = bitmask & CURRY_BOUND_FLAG,
          isCurryRight = bitmask & CURRY_RIGHT_FLAG;

        var Ctor = !isBindKey && createCtorWrapper(func),
          key = func;

        function wrapper() {
          // Avoid `arguments` object use disqualifying optimizations by
          // converting it to an array before providing it to other functions.
          var length = arguments.length,
            index = length,
            args = Array(length);

          while (index--) {
            args[index] = arguments[index];
          }
          if (partials) {
            args = composeArgs(args, partials, holders);
          }
          if (partialsRight) {
            args = composeArgsRight(args, partialsRight, holdersRight);
          }
          if (isCurry || isCurryRight) {
            var placeholder = wrapper.placeholder,
              argsHolders = replaceHolders(args, placeholder);

            length -= argsHolders.length;
            if (length < arity) {
              var newArgPos = argPos ? arrayCopy(argPos) : null,
                newArity = nativeMax(arity - length, 0),
                newsHolders = isCurry ? argsHolders : null,
                newHoldersRight = isCurry ? null : argsHolders,
                newPartials = isCurry ? args : null,
                newPartialsRight = isCurry ? null : args;

              bitmask |= isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG;
              bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

              if (!isCurryBound) {
                bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
              }
              var result = createHybridWrapper(
                func,
                bitmask,
                thisArg,
                newPartials,
                newsHolders,
                newPartialsRight,
                newHoldersRight,
                newArgPos,
                ary,
                newArity,
              );
              result.placeholder = placeholder;
              return result;
            }
          }
          var thisBinding = isBind ? thisArg : this;
          if (isBindKey) {
            func = thisBinding[key];
          }
          if (argPos) {
            args = reorder(args, argPos);
          }
          if (isAry && ary < args.length) {
            args.length = ary;
          }
          return (
            this instanceof wrapper ? Ctor || createCtorWrapper(func) : func
          ).apply(thisBinding, args);
        }
        return wrapper;
      }

      /**
       * Creates the pad required for `string` based on the given padding length.
       * The `chars` string may be truncated if the number of padding characters
       * exceeds the padding length.
       *
       * @private
       * @param {string} string The string to create padding for.
       * @param {number} [length=0] The padding length.
       * @param {string} [chars=' '] The string used as padding.
       * @returns {string} Returns the pad for `string`.
       */
      function createPad(string, length, chars) {
        var strLength = string.length;
        length = +length;

        if (strLength >= length || !nativeIsFinite(length)) {
          return "";
        }
        var padLength = length - strLength;
        chars = chars == null ? " " : chars + "";
        return repeat(chars, ceil(padLength / chars.length)).slice(
          0,
          padLength,
        );
      }

      /**
       * Creates a function that wraps `func` and invokes it with the optional `this`
       * binding of `thisArg` and the `partials` prepended to those provided to
       * the wrapper.
       *
       * @private
       * @param {Function} func The function to partially apply arguments to.
       * @param {number} bitmask The bitmask of flags. See `createWrapper` for more details.
       * @param {*} thisArg The `this` binding of `func`.
       * @param {Array} partials The arguments to prepend to those provided to the new function.
       * @returns {Function} Returns the new bound function.
       */
      function createPartialWrapper(func, bitmask, thisArg, partials) {
        var isBind = bitmask & BIND_FLAG,
          Ctor = createCtorWrapper(func);

        function wrapper() {
          // Avoid `arguments` object use disqualifying optimizations by
          // converting it to an array before providing it `func`.
          var argsIndex = -1,
            argsLength = arguments.length,
            leftIndex = -1,
            leftLength = partials.length,
            args = Array(argsLength + leftLength);

          while (++leftIndex < leftLength) {
            args[leftIndex] = partials[leftIndex];
          }
          while (argsLength--) {
            args[leftIndex++] = arguments[++argsIndex];
          }
          return (this instanceof wrapper ? Ctor : func).apply(
            isBind ? thisArg : this,
            args,
          );
        }
        return wrapper;
      }

      /**
       * Creates a function that either curries or invokes `func` with optional
       * `this` binding and partially applied arguments.
       *
       * @private
       * @param {Function|string} func The function or method name to reference.
       * @param {number} bitmask The bitmask of flags.
       *  The bitmask may be composed of the following flags:
       *     1 - `_.bind`
       *     2 - `_.bindKey`
       *     4 - `_.curry` or `_.curryRight` of a bound function
       *     8 - `_.curry`
       *    16 - `_.curryRight`
       *    32 - `_.partial`
       *    64 - `_.partialRight`
       *   128 - `_.rearg`
       *   256 - `_.ary`
       * @param {*} [thisArg] The `this` binding of `func`.
       * @param {Array} [partials] The arguments to be partially applied.
       * @param {Array} [holders] The `partials` placeholder indexes.
       * @param {Array} [argPos] The argument positions of the new function.
       * @param {number} [ary] The arity cap of `func`.
       * @param {number} [arity] The arity of `func`.
       * @returns {Function} Returns the new wrapped function.
       */
      function createWrapper(
        func,
        bitmask,
        thisArg,
        partials,
        holders,
        argPos,
        ary,
        arity,
      ) {
        var isBindKey = bitmask & BIND_KEY_FLAG;
        if (!isBindKey && !isFunction(func)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        var length = partials ? partials.length : 0;
        if (!length) {
          bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
          partials = holders = null;
        }
        length -= holders ? holders.length : 0;
        if (bitmask & PARTIAL_RIGHT_FLAG) {
          var partialsRight = partials,
            holdersRight = holders;

          partials = holders = null;
        }
        var data = !isBindKey && getData(func),
          newData = [
            func,
            bitmask,
            thisArg,
            partials,
            holders,
            partialsRight,
            holdersRight,
            argPos,
            ary,
            arity,
          ];

        if (data && data !== true) {
          mergeData(newData, data);
          bitmask = newData[1];
          arity = newData[9];
        }
        newData[9] =
          arity == null
            ? isBindKey
              ? 0
              : func.length
            : nativeMax(arity - length, 0) || 0;

        if (bitmask == BIND_FLAG) {
          var result = createBindWrapper(newData[0], newData[2]);
        } else if (
          (bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) &&
          !newData[4].length
        ) {
          result = createPartialWrapper.apply(null, newData);
        } else {
          result = createHybridWrapper.apply(null, newData);
        }
        var setter = data ? baseSetData : setData;
        return setter(result, newData);
      }

      /**
       * A specialized version of `baseIsEqualDeep` for arrays with support for
       * partial deep comparisons.
       *
       * @private
       * @param {Array} array The array to compare.
       * @param {Array} other The other array to compare.
       * @param {Function} equalFunc The function to determine equivalents of values.
       * @param {Function} [customizer] The function to customize comparing arrays.
       * @param {boolean} [isWhere] Specify performing partial comparisons.
       * @param {Array} [stackA] Tracks traversed `value` objects.
       * @param {Array} [stackB] Tracks traversed `other` objects.
       * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
       */
      function equalArrays(
        array,
        other,
        equalFunc,
        customizer,
        isWhere,
        stackA,
        stackB,
      ) {
        var index = -1,
          arrLength = array.length,
          othLength = other.length,
          result = true;

        if (arrLength != othLength && !(isWhere && othLength > arrLength)) {
          return false;
        }
        // Deep compare the contents, ignoring non-numeric properties.
        while (result && ++index < arrLength) {
          var arrValue = array[index],
            othValue = other[index];

          result = undefined;
          if (customizer) {
            result = isWhere
              ? customizer(othValue, arrValue, index)
              : customizer(arrValue, othValue, index);
          }
          if (typeof result == "undefined") {
            // Recursively compare arrays (susceptible to call stack limits).
            if (isWhere) {
              var othIndex = othLength;
              while (othIndex--) {
                othValue = other[othIndex];
                result =
                  (arrValue && arrValue === othValue) ||
                  equalFunc(
                    arrValue,
                    othValue,
                    customizer,
                    isWhere,
                    stackA,
                    stackB,
                  );
                if (result) {
                  break;
                }
              }
            } else {
              result =
                (arrValue && arrValue === othValue) ||
                equalFunc(
                  arrValue,
                  othValue,
                  customizer,
                  isWhere,
                  stackA,
                  stackB,
                );
            }
          }
        }
        return !!result;
      }

      /**
       * A specialized version of `baseIsEqualDeep` for comparing objects of
       * the same `toStringTag`.
       *
       * **Note:** This function only supports comparing values with tags of
       * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
       *
       * @private
       * @param {Object} value The object to compare.
       * @param {Object} other The other object to compare.
       * @param {string} tag The `toStringTag` of the objects to compare.
       * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
       */
      function equalByTag(object, other, tag) {
        switch (tag) {
          case boolTag:
          case dateTag:
            // Coerce dates and booleans to numbers, dates to milliseconds and booleans
            // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
            return +object == +other;

          case errorTag:
            return object.name == other.name && object.message == other.message;

          case numberTag:
            // Treat `NaN` vs. `NaN` as equal.
            return object != +object
              ? other != +other
              : // But, treat `-0` vs. `+0` as not equal.
                object == 0
                ? 1 / object == 1 / other
                : object == +other;

          case regexpTag:
          case stringTag:
            // Coerce regexes to strings and treat strings primitives and string
            // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
            return object == other + "";
        }
        return false;
      }

      /**
       * A specialized version of `baseIsEqualDeep` for objects with support for
       * partial deep comparisons.
       *
       * @private
       * @param {Object} object The object to compare.
       * @param {Object} other The other object to compare.
       * @param {Function} equalFunc The function to determine equivalents of values.
       * @param {Function} [customizer] The function to customize comparing values.
       * @param {boolean} [isWhere] Specify performing partial comparisons.
       * @param {Array} [stackA] Tracks traversed `value` objects.
       * @param {Array} [stackB] Tracks traversed `other` objects.
       * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
       */
      function equalObjects(
        object,
        other,
        equalFunc,
        customizer,
        isWhere,
        stackA,
        stackB,
      ) {
        var objProps = keys(object),
          objLength = objProps.length,
          othProps = keys(other),
          othLength = othProps.length;

        if (objLength != othLength && !isWhere) {
          return false;
        }
        var hasCtor,
          index = -1;

        while (++index < objLength) {
          var key = objProps[index],
            result = hasOwnProperty.call(other, key);

          if (result) {
            var objValue = object[key],
              othValue = other[key];

            result = undefined;
            if (customizer) {
              result = isWhere
                ? customizer(othValue, objValue, key)
                : customizer(objValue, othValue, key);
            }
            if (typeof result == "undefined") {
              // Recursively compare objects (susceptible to call stack limits).
              result =
                (objValue && objValue === othValue) ||
                equalFunc(
                  objValue,
                  othValue,
                  customizer,
                  isWhere,
                  stackA,
                  stackB,
                );
            }
          }
          if (!result) {
            return false;
          }
          hasCtor || (hasCtor = key == "constructor");
        }
        if (!hasCtor) {
          var objCtor = object.constructor,
            othCtor = other.constructor;

          // Non `Object` object instances with different constructors are not equal.
          if (
            objCtor != othCtor &&
            "constructor" in object &&
            "constructor" in other &&
            !(
              typeof objCtor == "function" &&
              objCtor instanceof objCtor &&
              typeof othCtor == "function" &&
              othCtor instanceof othCtor
            )
          ) {
            return false;
          }
        }
        return true;
      }

      /**
       * Gets the extremum value of `collection` invoking `iteratee` for each value
       * in `collection` to generate the criterion by which the value is ranked.
       * The `iteratee` is invoked with three arguments; (value, index, collection).
       *
       * @private
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {boolean} [isMin] Specify returning the minimum, instead of the
       *  maximum, extremum value.
       * @returns {*} Returns the extremum value.
       */
      function extremumBy(collection, iteratee, isMin) {
        var exValue = isMin ? POSITIVE_INFINITY : NEGATIVE_INFINITY,
          computed = exValue,
          result = computed;

        baseEach(collection, function (value, index, collection) {
          var current = iteratee(value, index, collection);
          if (
            (isMin ? current < computed : current > computed) ||
            (current === exValue && current === result)
          ) {
            computed = current;
            result = value;
          }
        });
        return result;
      }

      /**
       * Gets the appropriate "callback" function. If the `_.callback` method is
       * customized this function returns the custom method, otherwise it returns
       * the `baseCallback` function. If arguments are provided the chosen function
       * is invoked with them and its result is returned.
       *
       * @private
       * @returns {Function} Returns the chosen function or its result.
       */
      function getCallback(func, thisArg, argCount) {
        var result = lodash.callback || callback;
        result = result === callback ? baseCallback : result;
        return argCount ? result(func, thisArg, argCount) : result;
      }

      /**
       * Gets metadata for `func`.
       *
       * @private
       * @param {Function} func The function to query.
       * @returns {*} Returns the metadata for `func`.
       */
      var getData = !metaMap
        ? noop
        : function (func) {
            return metaMap.get(func);
          };

      /**
       * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
       * customized this function returns the custom method, otherwise it returns
       * the `baseIndexOf` function. If arguments are provided the chosen function
       * is invoked with them and its result is returned.
       *
       * @private
       * @returns {Function|number} Returns the chosen function or its result.
       */
      function getIndexOf(collection, target, fromIndex) {
        var result = lodash.indexOf || indexOf;
        result = result === indexOf ? baseIndexOf : result;
        return collection ? result(collection, target, fromIndex) : result;
      }

      /**
       * Gets the view, applying any `transforms` to the `start` and `end` positions.
       *
       * @private
       * @param {number} start The start of the view.
       * @param {number} end The end of the view.
       * @param {Array} [transforms] The transformations to apply to the view.
       * @returns {Object} Returns an object containing the `start` and `end`
       *  positions of the view.
       */
      function getView(start, end, transforms) {
        var index = -1,
          length = transforms ? transforms.length : 0;

        while (++index < length) {
          var data = transforms[index],
            size = data.size;

          switch (data.type) {
            case "drop":
              start += size;
              break;
            case "dropRight":
              end -= size;
              break;
            case "take":
              end = nativeMin(end, start + size);
              break;
            case "takeRight":
              start = nativeMax(start, end - size);
              break;
          }
        }
        return { start: start, end: end };
      }

      /**
       * Initializes an array clone.
       *
       * @private
       * @param {Array} array The array to clone.
       * @returns {Array} Returns the initialized clone.
       */
      function initCloneArray(array) {
        var length = array.length,
          result = new array.constructor(length);

        // Add array properties assigned by `RegExp#exec`.
        if (
          length &&
          typeof array[0] == "string" &&
          hasOwnProperty.call(array, "index")
        ) {
          result.index = array.index;
          result.input = array.input;
        }
        return result;
      }

      /**
       * Initializes an object clone.
       *
       * @private
       * @param {Object} object The object to clone.
       * @returns {Object} Returns the initialized clone.
       */
      function initCloneObject(object) {
        var Ctor = object.constructor;
        if (!(typeof Ctor == "function" && Ctor instanceof Ctor)) {
          Ctor = Object;
        }
        return new Ctor();
      }

      /**
       * Initializes an object clone based on its `toStringTag`.
       *
       * **Note:** This function only supports cloning values with tags of
       * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
       *
       *
       * @private
       * @param {Object} object The object to clone.
       * @param {string} tag The `toStringTag` of the object to clone.
       * @param {boolean} [isDeep] Specify a deep clone.
       * @returns {Object} Returns the initialized clone.
       */
      function initCloneByTag(object, tag, isDeep) {
        var Ctor = object.constructor;
        switch (tag) {
          case arrayBufferTag:
            return bufferClone(object);

          case boolTag:
          case dateTag:
            return new Ctor(+object);

          case float32Tag:
          case float64Tag:
          case int8Tag:
          case int16Tag:
          case int32Tag:
          case uint8Tag:
          case uint8ClampedTag:
          case uint16Tag:
          case uint32Tag:
            var buffer = object.buffer;
            return new Ctor(
              isDeep ? bufferClone(buffer) : buffer,
              object.byteOffset,
              object.length,
            );

          case numberTag:
          case stringTag:
            return new Ctor(object);

          case regexpTag:
            var result = new Ctor(object.source, reFlags.exec(object));
            result.lastIndex = object.lastIndex;
        }
        return result;
      }

      /**
       * Checks if `func` is eligible for `this` binding.
       *
       * @private
       * @param {Function} func The function to check.
       * @returns {boolean} Returns `true` if `func` is eligible, else `false`.
       */
      function isBindable(func) {
        var support = lodash.support,
          result = !(support.funcNames ? func.name : support.funcDecomp);

        if (!result) {
          var source = fnToString.call(func);
          if (!support.funcNames) {
            result = !reFuncName.test(source);
          }
          if (!result) {
            // Check if `func` references the `this` keyword and store the result.
            result = reThis.test(source) || isNative(func);
            baseSetData(func, result);
          }
        }
        return result;
      }

      /**
       * Checks if `value` is a valid array-like index.
       *
       * @private
       * @param {*} value The value to check.
       * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
       * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
       */
      function isIndex(value, length) {
        value = +value;
        length = length == null ? MAX_SAFE_INTEGER : length;
        return value > -1 && value % 1 == 0 && value < length;
      }

      /**
       * Checks if the provided arguments are from an iteratee call.
       *
       * @private
       * @param {*} value The potential iteratee value argument.
       * @param {*} index The potential iteratee index or key argument.
       * @param {*} object The potential iteratee object argument.
       * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
       */
      function isIterateeCall(value, index, object) {
        if (!isObject(object)) {
          return false;
        }
        var type = typeof index;
        if (type == "number") {
          var length = object.length,
            prereq = isLength(length) && isIndex(index, length);
        } else {
          prereq = type == "string" && index in object;
        }
        return prereq && object[index] === value;
      }

      /**
       * Checks if `value` is a valid array-like length.
       *
       * **Note:** This function is based on ES `ToLength`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength)
       * for more details.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
       */
      function isLength(value) {
        return (
          typeof value == "number" &&
          value > -1 &&
          value % 1 == 0 &&
          value <= MAX_SAFE_INTEGER
        );
      }

      /**
       * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` if suitable for strict
       *  equality comparisons, else `false`.
       */
      function isStrictComparable(value) {
        return (
          value === value && (value === 0 ? 1 / value > 0 : !isObject(value))
        );
      }

      /**
       * Merges the function metadata of `source` into `data`.
       *
       * Merging metadata reduces the number of wrappers required to invoke a function.
       * This is possible because methods like `_.bind`, `_.curry`, and `_.partial`
       * may be applied regardless of execution order. Methods like `_.ary` and `_.rearg`
       * augment function arguments, making the order in which they are executed important,
       * preventing the merging of metadata. However, we make an exception for a safe
       * common case where curried functions have `_.ary` and or `_.rearg` applied.
       *
       * @private
       * @param {Array} data The destination metadata.
       * @param {Array} source The source metadata.
       * @returns {Array} Returns `data`.
       */
      function mergeData(data, source) {
        var bitmask = data[1],
          srcBitmask = source[1],
          newBitmask = bitmask | srcBitmask;

        var arityFlags = ARY_FLAG | REARG_FLAG,
          bindFlags = BIND_FLAG | BIND_KEY_FLAG,
          comboFlags =
            arityFlags | bindFlags | CURRY_BOUND_FLAG | CURRY_RIGHT_FLAG;

        var isAry = bitmask & ARY_FLAG && !(srcBitmask & ARY_FLAG),
          isRearg = bitmask & REARG_FLAG && !(srcBitmask & REARG_FLAG),
          argPos = (isRearg ? data : source)[7],
          ary = (isAry ? data : source)[8];

        var isCommon =
          !(bitmask >= REARG_FLAG && srcBitmask > bindFlags) &&
          !(bitmask > bindFlags && srcBitmask >= REARG_FLAG);

        var isCombo =
          newBitmask >= arityFlags &&
          newBitmask <= comboFlags &&
          (bitmask < REARG_FLAG ||
            ((isRearg || isAry) && argPos.length <= ary));

        // Exit early if metadata can't be merged.
        if (!(isCommon || isCombo)) {
          return data;
        }
        // Use source `thisArg` if available.
        if (srcBitmask & BIND_FLAG) {
          data[2] = source[2];
          // Set when currying a bound function.
          newBitmask |= bitmask & BIND_FLAG ? 0 : CURRY_BOUND_FLAG;
        }
        // Compose partial arguments.
        var value = source[3];
        if (value) {
          var partials = data[3];
          data[3] = partials
            ? composeArgs(partials, value, source[4])
            : arrayCopy(value);
          data[4] = partials
            ? replaceHolders(data[3], PLACEHOLDER)
            : arrayCopy(source[4]);
        }
        // Compose partial right arguments.
        value = source[5];
        if (value) {
          partials = data[5];
          data[5] = partials
            ? composeArgsRight(partials, value, source[6])
            : arrayCopy(value);
          data[6] = partials
            ? replaceHolders(data[5], PLACEHOLDER)
            : arrayCopy(source[6]);
        }
        // Use source `argPos` if available.
        value = source[7];
        if (value) {
          data[7] = arrayCopy(value);
        }
        // Use source `ary` if it's smaller.
        if (srcBitmask & ARY_FLAG) {
          data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
        }
        // Use source `arity` if one is not provided.
        if (data[9] == null) {
          data[9] = source[9];
        }
        // Use source `func` and merge bitmasks.
        data[0] = source[0];
        data[1] = newBitmask;

        return data;
      }

      /**
       * A specialized version of `_.pick` that picks `object` properties specified
       * by the `props` array.
       *
       * @private
       * @param {Object} object The source object.
       * @param {string[]} props The property names to pick.
       * @returns {Object} Returns the new object.
       */
      function pickByArray(object, props) {
        object = toObject(object);

        var index = -1,
          length = props.length,
          result = {};

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
        return result;
      }

      /**
       * A specialized version of `_.pick` that picks `object` properties `predicate`
       * returns truthy for.
       *
       * @private
       * @param {Object} object The source object.
       * @param {Function} predicate The function invoked per iteration.
       * @returns {Object} Returns the new object.
       */
      function pickByCallback(object, predicate) {
        var result = {};
        baseForIn(object, function (value, key, object) {
          if (predicate(value, key, object)) {
            result[key] = value;
          }
        });
        return result;
      }

      /**
       * Reorder `array` according to the specified indexes where the element at
       * the first index is assigned as the first element, the element at
       * the second index is assigned as the second element, and so on.
       *
       * @private
       * @param {Array} array The array to reorder.
       * @param {Array} indexes The arranged array indexes.
       * @returns {Array} Returns `array`.
       */
      function reorder(array, indexes) {
        var arrLength = array.length,
          length = nativeMin(indexes.length, arrLength),
          oldArray = arrayCopy(array);

        while (length--) {
          var index = indexes[length];
          array[length] = isIndex(index, arrLength)
            ? oldArray[index]
            : undefined;
        }
        return array;
      }

      /**
       * Sets metadata for `func`.
       *
       * **Note:** If this function becomes hot, i.e. is invoked a lot in a short
       * period of time, it will trip its breaker and transition to an identity function
       * to avoid garbage collection pauses in V8. See [V8 issue 2070](https://code.google.com/p/v8/issues/detail?id=2070)
       * for more details.
       *
       * @private
       * @param {Function} func The function to associate metadata with.
       * @param {*} data The metadata.
       * @returns {Function} Returns `func`.
       */
      var setData = (function () {
        var count = 0,
          lastCalled = 0;

        return function (key, value) {
          var stamp = now(),
            remaining = HOT_SPAN - (stamp - lastCalled);

          lastCalled = stamp;
          if (remaining > 0) {
            if (++count >= HOT_COUNT) {
              return key;
            }
          } else {
            count = 0;
          }
          return baseSetData(key, value);
        };
      })();

      /**
       * A fallback implementation of `_.isPlainObject` which checks if `value`
       * is an object created by the `Object` constructor or has a `[[Prototype]]`
       * of `null`.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
       */
      function shimIsPlainObject(value) {
        var Ctor,
          support = lodash.support;

        // Exit early for non `Object` objects.
        if (
          !(isObjectLike(value) && objToString.call(value) == objectTag) ||
          (!hasOwnProperty.call(value, "constructor") &&
            ((Ctor = value.constructor),
            typeof Ctor == "function" && !(Ctor instanceof Ctor)))
        ) {
          return false;
        }
        // IE < 9 iterates inherited properties before own properties. If the first
        // iterated property is an object's own property then there are no inherited
        // enumerable properties.
        var result;
        // In most environments an object's own properties are iterated before
        // its inherited properties. If the last iterated property is an object's
        // own property then there are no inherited enumerable properties.
        baseForIn(value, function (subValue, key) {
          result = key;
        });
        return (
          typeof result == "undefined" || hasOwnProperty.call(value, result)
        );
      }

      /**
       * A fallback implementation of `Object.keys` which creates an array of the
       * own enumerable property names of `object`.
       *
       * @private
       * @param {Object} object The object to inspect.
       * @returns {Array} Returns the array of property names.
       */
      function shimKeys(object) {
        var props = keysIn(object),
          propsLength = props.length,
          length = propsLength && object.length,
          support = lodash.support;

        var allowIndexes =
          length &&
          isLength(length) &&
          (isArray(object) || (support.nonEnumArgs && isArguments(object)));

        var index = -1,
          result = [];

        while (++index < propsLength) {
          var key = props[index];
          if (
            (allowIndexes && isIndex(key, length)) ||
            hasOwnProperty.call(object, key)
          ) {
            result.push(key);
          }
        }
        return result;
      }

      /**
       * Converts `value` to an array-like object if it is not one.
       *
       * @private
       * @param {*} value The value to process.
       * @returns {Array|Object} Returns the array-like object.
       */
      function toIterable(value) {
        if (value == null) {
          return [];
        }
        if (!isLength(value.length)) {
          return values(value);
        }
        return isObject(value) ? value : Object(value);
      }

      /**
       * Converts `value` to an object if it is not one.
       *
       * @private
       * @param {*} value The value to process.
       * @returns {Object} Returns the object.
       */
      function toObject(value) {
        return isObject(value) ? value : Object(value);
      }

      /*------------------------------------------------------------------------*/

      /**
       * Creates an array of elements split into groups the length of `size`.
       * If `collection` can't be split evenly, the final chunk will be the remaining
       * elements.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to process.
       * @param {numer} [size=1] The length of each chunk.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the new array containing chunks.
       * @example
       *
       * _.chunk(['a', 'b', 'c', 'd'], 2);
       * // => [['a', 'b'], ['c', 'd']]
       *
       * _.chunk(['a', 'b', 'c', 'd'], 3);
       * // => [['a', 'b', 'c'], ['d']]
       */
      function chunk(array, size, guard) {
        if (guard ? isIterateeCall(array, size, guard) : size == null) {
          size = 1;
        } else {
          size = nativeMax(+size || 1, 1);
        }
        var index = 0,
          length = array ? array.length : 0,
          resIndex = -1,
          result = Array(ceil(length / size));

        while (index < length) {
          result[++resIndex] = baseSlice(array, index, (index += size));
        }
        return result;
      }

      /**
       * Creates an array with all falsey values removed. The values `false`, `null`,
       * `0`, `""`, `undefined`, and `NaN` are falsey.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to compact.
       * @returns {Array} Returns the new array of filtered values.
       * @example
       *
       * _.compact([0, 1, false, 2, '', 3]);
       * // => [1, 2, 3]
       */
      function compact(array) {
        var index = -1,
          length = array ? array.length : 0,
          resIndex = -1,
          result = [];

        while (++index < length) {
          var value = array[index];
          if (value) {
            result[++resIndex] = value;
          }
        }
        return result;
      }

      /**
       * Creates an array excluding all values of the provided arrays using
       * `SameValueZero` for equality comparisons.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to inspect.
       * @param {...Array} [values] The arrays of values to exclude.
       * @returns {Array} Returns the new array of filtered values.
       * @example
       *
       * _.difference([1, 2, 3], [5, 2, 10]);
       * // => [1, 3]
       */
      function difference() {
        var index = -1,
          length = arguments.length;

        while (++index < length) {
          var value = arguments[index];
          if (isArray(value) || isArguments(value)) {
            break;
          }
        }
        return baseDifference(
          value,
          baseFlatten(arguments, false, true, ++index),
        );
      }

      /**
       * Creates a slice of `array` with `n` elements dropped from the beginning.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {number} [n=1] The number of elements to drop.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.drop([1, 2, 3]);
       * // => [2, 3]
       *
       * _.drop([1, 2, 3], 2);
       * // => [3]
       *
       * _.drop([1, 2, 3], 5);
       * // => []
       *
       * _.drop([1, 2, 3], 0);
       * // => [1, 2, 3]
       */
      function drop(array, n, guard) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        if (guard ? isIterateeCall(array, n, guard) : n == null) {
          n = 1;
        }
        return baseSlice(array, n < 0 ? 0 : n);
      }

      /**
       * Creates a slice of `array` with `n` elements dropped from the end.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {number} [n=1] The number of elements to drop.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.dropRight([1, 2, 3]);
       * // => [1, 2]
       *
       * _.dropRight([1, 2, 3], 2);
       * // => [1]
       *
       * _.dropRight([1, 2, 3], 5);
       * // => []
       *
       * _.dropRight([1, 2, 3], 0);
       * // => [1, 2, 3]
       */
      function dropRight(array, n, guard) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        if (guard ? isIterateeCall(array, n, guard) : n == null) {
          n = 1;
        }
        n = length - (+n || 0);
        return baseSlice(array, 0, n < 0 ? 0 : n);
      }

      /**
       * Creates a slice of `array` excluding elements dropped from the end.
       * Elements are dropped until `predicate` returns falsey. The predicate is
       * bound to `thisArg` and invoked with three arguments; (value, index, array).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per element.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.dropRightWhile([1, 2, 3], function(n) { return n > 1; });
       * // => [1]
       *
       * var users = [
       *   { 'user': 'barney',  'status': 'busy', 'active': false },
       *   { 'user': 'fred',    'status': 'busy', 'active': true },
       *   { 'user': 'pebbles', 'status': 'away', 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.dropRightWhile(users, 'active'), 'user');
       * // => ['barney']
       *
       * // using the "_.matches" callback shorthand
       * _.pluck(_.dropRightWhile(users, { 'status': 'away' }), 'user');
       * // => ['barney', 'fred']
       */
      function dropRightWhile(array, predicate, thisArg) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        predicate = getCallback(predicate, thisArg, 3);
        while (length-- && predicate(array[length], length, array)) {}
        return baseSlice(array, 0, length + 1);
      }

      /**
       * Creates a slice of `array` excluding elements dropped from the beginning.
       * Elements are dropped until `predicate` returns falsey. The predicate is
       * bound to `thisArg` and invoked with three arguments; (value, index, array).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per element.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.dropWhile([1, 2, 3], function(n) { return n < 3; });
       * // => [3]
       *
       * var users = [
       *   { 'user': 'barney',  'status': 'busy', 'active': true },
       *   { 'user': 'fred',    'status': 'busy', 'active': false },
       *   { 'user': 'pebbles', 'status': 'away', 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.dropWhile(users, 'active'), 'user');
       * // => ['fred', 'pebbles']
       *
       * // using the "_.matches" callback shorthand
       * _.pluck(_.dropWhile(users, { 'status': 'busy' }), 'user');
       * // => ['pebbles']
       */
      function dropWhile(array, predicate, thisArg) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        var index = -1;
        predicate = getCallback(predicate, thisArg, 3);
        while (++index < length && predicate(array[index], index, array)) {}
        return baseSlice(array, index);
      }

      /**
       * This method is like `_.find` except that it returns the index of the first
       * element `predicate` returns truthy for, instead of the element itself.
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to search.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {number} Returns the index of the found element, else `-1`.
       * @example
       *
       * var users = [
       *   { 'user': 'barney',  'age': 36, 'active': false },
       *   { 'user': 'fred',    'age': 40, 'active': true },
       *   { 'user': 'pebbles', 'age': 1,  'active': false }
       * ];
       *
       * _.findIndex(users, function(chr) { return chr.age < 40; });
       * // => 0
       *
       * // using the "_.matches" callback shorthand
       * _.findIndex(users, { 'age': 1 });
       * // => 2
       *
       * // using the "_.property" callback shorthand
       * _.findIndex(users, 'active');
       * // => 1
       */
      function findIndex(array, predicate, thisArg) {
        var index = -1,
          length = array ? array.length : 0;

        predicate = getCallback(predicate, thisArg, 3);
        while (++index < length) {
          if (predicate(array[index], index, array)) {
            return index;
          }
        }
        return -1;
      }

      /**
       * This method is like `_.findIndex` except that it iterates over elements
       * of `collection` from right to left.
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to search.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {number} Returns the index of the found element, else `-1`.
       * @example
       *
       * var users = [
       *   { 'user': 'barney',  'age': 36, 'active': true },
       *   { 'user': 'fred',    'age': 40, 'active': false },
       *   { 'user': 'pebbles', 'age': 1,  'active': false }
       * ];
       *
       * _.findLastIndex(users, function(chr) { return chr.age < 40; });
       * // => 2
       *
       * // using the "_.matches" callback shorthand
       * _.findLastIndex(users, { 'age': 40 });
       * // => 1
       *
       * // using the "_.property" callback shorthand
       * _.findLastIndex(users, 'active');
       * // => 0
       */
      function findLastIndex(array, predicate, thisArg) {
        var length = array ? array.length : 0;
        predicate = getCallback(predicate, thisArg, 3);
        while (length--) {
          if (predicate(array[length], length, array)) {
            return length;
          }
        }
        return -1;
      }

      /**
       * Gets the first element of `array`.
       *
       * @static
       * @memberOf _
       * @alias head
       * @category Array
       * @param {Array} array The array to query.
       * @returns {*} Returns the first element of `array`.
       * @example
       *
       * _.first([1, 2, 3]);
       * // => 1
       *
       * _.first([]);
       * // => undefined
       */
      function first(array) {
        return array ? array[0] : undefined;
      }

      /**
       * Flattens a nested array. If `isDeep` is `true` the array is recursively
       * flattened, otherwise it is only flattened a single level.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to flatten.
       * @param {boolean} [isDeep] Specify a deep flatten.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the new flattened array.
       * @example
       *
       * _.flatten([1, [2], [3, [[4]]]]);
       * // => [1, 2, 3, [[4]]];
       *
       * // using `isDeep`
       * _.flatten([1, [2], [3, [[4]]]], true);
       * // => [1, 2, 3, 4];
       */
      function flatten(array, isDeep, guard) {
        var length = array ? array.length : 0;
        if (guard && isIterateeCall(array, isDeep, guard)) {
          isDeep = false;
        }
        return length ? baseFlatten(array, isDeep) : [];
      }

      /**
       * Recursively flattens a nested array.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to recursively flatten.
       * @returns {Array} Returns the new flattened array.
       * @example
       *
       * _.flattenDeep([1, [2], [3, [[4]]]]);
       * // => [1, 2, 3, 4];
       */
      function flattenDeep(array) {
        var length = array ? array.length : 0;
        return length ? baseFlatten(array, true) : [];
      }

      /**
       * Gets the index at which the first occurrence of `value` is found in `array`
       * using `SameValueZero` for equality comparisons. If `fromIndex` is negative,
       * it is used as the offset from the end of `array`. If `array` is sorted
       * providing `true` for `fromIndex` performs a faster binary search.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to search.
       * @param {*} value The value to search for.
       * @param {boolean|number} [fromIndex=0] The index to search from or `true`
       *  to perform a binary search on a sorted array.
       * @returns {number} Returns the index of the matched value, else `-1`.
       * @example
       *
       * _.indexOf([1, 2, 3, 1, 2, 3], 2);
       * // => 1
       *
       * // using `fromIndex`
       * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
       * // => 4
       *
       * // performing a binary search
       * _.indexOf([4, 4, 5, 5, 6, 6], 5, true);
       * // => 2
       */
      function indexOf(array, value, fromIndex) {
        var length = array ? array.length : 0;
        if (!length) {
          return -1;
        }
        if (typeof fromIndex == "number") {
          fromIndex =
            fromIndex < 0 ? nativeMax(length + fromIndex, 0) : fromIndex || 0;
        } else if (fromIndex) {
          var index = binaryIndex(array, value),
            other = array[index];

          return (value === value ? value === other : other !== other)
            ? index
            : -1;
        }
        return baseIndexOf(array, value, fromIndex);
      }

      /**
       * Gets all but the last element of `array`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to query.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.initial([1, 2, 3]);
       * // => [1, 2]
       */
      function initial(array) {
        return dropRight(array, 1);
      }

      /**
       * Creates an array of unique values in all provided arrays using `SameValueZero`
       * for equality comparisons.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {...Array} [arrays] The arrays to inspect.
       * @returns {Array} Returns the new array of shared values.
       * @example
       *
       * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
       * // => [1, 2]
       */
      function intersection() {
        var args = [],
          argsIndex = -1,
          argsLength = arguments.length,
          caches = [],
          indexOf = getIndexOf(),
          isCommon = indexOf == baseIndexOf;

        while (++argsIndex < argsLength) {
          var value = arguments[argsIndex];
          if (isArray(value) || isArguments(value)) {
            args.push(value);
            caches.push(
              isCommon &&
                value.length >= 120 &&
                createCache(argsIndex && value),
            );
          }
        }
        argsLength = args.length;
        var array = args[0],
          index = -1,
          length = array ? array.length : 0,
          result = [],
          seen = caches[0];

        outer: while (++index < length) {
          value = array[index];
          if ((seen ? cacheIndexOf(seen, value) : indexOf(result, value)) < 0) {
            argsIndex = argsLength;
            while (--argsIndex) {
              var cache = caches[argsIndex];
              if (
                (cache
                  ? cacheIndexOf(cache, value)
                  : indexOf(args[argsIndex], value)) < 0
              ) {
                continue outer;
              }
            }
            if (seen) {
              seen.push(value);
            }
            result.push(value);
          }
        }
        return result;
      }

      /**
       * Gets the last element of `array`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to query.
       * @returns {*} Returns the last element of `array`.
       * @example
       *
       * _.last([1, 2, 3]);
       * // => 3
       */
      function last(array) {
        var length = array ? array.length : 0;
        return length ? array[length - 1] : undefined;
      }

      /**
       * This method is like `_.indexOf` except that it iterates over elements of
       * `array` from right to left.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to search.
       * @param {*} value The value to search for.
       * @param {boolean|number} [fromIndex=array.length-1] The index to search from
       *  or `true` to perform a binary search on a sorted array.
       * @returns {number} Returns the index of the matched value, else `-1`.
       * @example
       *
       * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
       * // => 4
       *
       * // using `fromIndex`
       * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
       * // => 1
       *
       * // performing a binary search
       * _.lastIndexOf([4, 4, 5, 5, 6, 6], 5, true);
       * // => 3
       */
      function lastIndexOf(array, value, fromIndex) {
        var length = array ? array.length : 0;
        if (!length) {
          return -1;
        }
        var index = length;
        if (typeof fromIndex == "number") {
          index =
            (fromIndex < 0
              ? nativeMax(length + fromIndex, 0)
              : nativeMin(fromIndex || 0, length - 1)) + 1;
        } else if (fromIndex) {
          index = binaryIndex(array, value, true) - 1;
          var other = array[index];
          return (value === value ? value === other : other !== other)
            ? index
            : -1;
        }
        if (value !== value) {
          return indexOfNaN(array, index, true);
        }
        while (index--) {
          if (array[index] === value) {
            return index;
          }
        }
        return -1;
      }

      /**
       * Removes all provided values from `array` using `SameValueZero` for equality
       * comparisons.
       *
       * **Notes:**
       *  - Unlike `_.without`, this method mutates `array`.
       *  - `SameValueZero` comparisons are like strict equality comparisons, e.g. `===`,
       *    except that `NaN` matches `NaN`. See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       *    for more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to modify.
       * @param {...*} [values] The values to remove.
       * @returns {Array} Returns `array`.
       * @example
       *
       * var array = [1, 2, 3, 1, 2, 3];
       * _.pull(array, 2, 3);
       * console.log(array);
       * // => [1, 1]
       */
      function pull() {
        var array = arguments[0];
        if (!(array && array.length)) {
          return array;
        }
        var index = 0,
          indexOf = getIndexOf(),
          length = arguments.length;

        while (++index < length) {
          var fromIndex = 0,
            value = arguments[index];

          while ((fromIndex = indexOf(array, value, fromIndex)) > -1) {
            splice.call(array, fromIndex, 1);
          }
        }
        return array;
      }

      /**
       * Removes elements from `array` corresponding to the given indexes and returns
       * an array of the removed elements. Indexes may be specified as an array of
       * indexes or as individual arguments.
       *
       * **Note:** Unlike `_.at`, this method mutates `array`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to modify.
       * @param {...(number|number[])} [indexes] The indexes of elements to remove,
       *  specified as individual indexes or arrays of indexes.
       * @returns {Array} Returns the new array of removed elements.
       * @example
       *
       * var array = [5, 10, 15, 20];
       * var evens = _.pullAt(array, [1, 3]);
       *
       * console.log(array);
       * // => [5, 15]
       *
       * console.log(evens);
       * // => [10, 20]
       */
      function pullAt(array) {
        return basePullAt(array || [], baseFlatten(arguments, false, false, 1));
      }

      /**
       * Removes all elements from `array` that `predicate` returns truthy for
       * and returns an array of the removed elements. The predicate is bound to
       * `thisArg` and invoked with three arguments; (value, index, array).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * **Note:** Unlike `_.filter`, this method mutates `array`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to modify.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the new array of removed elements.
       * @example
       *
       * var array = [1, 2, 3, 4];
       * var evens = _.remove(array, function(n) { return n % 2 == 0; });
       *
       * console.log(array);
       * // => [1, 3]
       *
       * console.log(evens);
       * // => [2, 4]
       */
      function remove(array, predicate, thisArg) {
        var index = -1,
          length = array ? array.length : 0,
          result = [];

        predicate = getCallback(predicate, thisArg, 3);
        while (++index < length) {
          var value = array[index];
          if (predicate(value, index, array)) {
            result.push(value);
            splice.call(array, index--, 1);
            length--;
          }
        }
        return result;
      }

      /**
       * Gets all but the first element of `array`.
       *
       * @static
       * @memberOf _
       * @alias tail
       * @category Array
       * @param {Array} array The array to query.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.rest([1, 2, 3]);
       * // => [2, 3]
       */
      function rest(array) {
        return drop(array, 1);
      }

      /**
       * Creates a slice of `array` from `start` up to, but not including, `end`.
       *
       * **Note:** This function is used instead of `Array#slice` to support node
       * lists in IE < 9 and to ensure dense arrays are returned.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to slice.
       * @param {number} [start=0] The start position.
       * @param {number} [end=array.length] The end position.
       * @returns {Array} Returns the slice of `array`.
       */
      function slice(array, start, end) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        if (
          end &&
          typeof end != "number" &&
          isIterateeCall(array, start, end)
        ) {
          start = 0;
          end = length;
        }
        return baseSlice(array, start, end);
      }

      /**
       * Uses a binary search to determine the lowest index at which `value` should
       * be inserted into `array` in order to maintain its sort order. If an iteratee
       * function is provided it is invoked for `value` and each element of `array`
       * to compute their sort ranking. The iteratee is bound to `thisArg` and
       * invoked with one argument; (value).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The sorted array to inspect.
       * @param {*} value The value to evaluate.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {number} Returns the index at which `value` should be inserted
       *  into `array`.
       * @example
       *
       * _.sortedIndex([30, 50], 40);
       * // => 1
       *
       * _.sortedIndex([4, 4, 5, 5, 6, 6], 5);
       * // => 2
       *
       * var dict = { 'data': { 'thirty': 30, 'forty': 40, 'fifty': 50 } };
       *
       * // using an iteratee function
       * _.sortedIndex(['thirty', 'fifty'], 'forty', function(word) {
       *   return this.data[word];
       * }, dict);
       * // => 1
       *
       * // using the "_.property" callback shorthand
       * _.sortedIndex([{ 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
       * // => 1
       */
      function sortedIndex(array, value, iteratee, thisArg) {
        var func = getCallback(iteratee);
        return func === baseCallback && iteratee == null
          ? binaryIndex(array, value)
          : binaryIndexBy(array, value, func(iteratee, thisArg, 1));
      }

      /**
       * This method is like `_.sortedIndex` except that it returns the highest
       * index at which `value` should be inserted into `array` in order to
       * maintain its sort order.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The sorted array to inspect.
       * @param {*} value The value to evaluate.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {number} Returns the index at which `value` should be inserted
       *  into `array`.
       * @example
       *
       * _.sortedLastIndex([4, 4, 5, 5, 6, 6], 5);
       * // => 4
       */
      function sortedLastIndex(array, value, iteratee, thisArg) {
        var func = getCallback(iteratee);
        return func === baseCallback && iteratee == null
          ? binaryIndex(array, value, true)
          : binaryIndexBy(array, value, func(iteratee, thisArg, 1), true);
      }

      /**
       * Creates a slice of `array` with `n` elements taken from the beginning.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {number} [n=1] The number of elements to take.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.take([1, 2, 3]);
       * // => [1]
       *
       * _.take([1, 2, 3], 2);
       * // => [1, 2]
       *
       * _.take([1, 2, 3], 5);
       * // => [1, 2, 3]
       *
       * _.take([1, 2, 3], 0);
       * // => []
       */
      function take(array, n, guard) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        if (guard ? isIterateeCall(array, n, guard) : n == null) {
          n = 1;
        }
        return baseSlice(array, 0, n < 0 ? 0 : n);
      }

      /**
       * Creates a slice of `array` with `n` elements taken from the end.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {number} [n=1] The number of elements to take.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.takeRight([1, 2, 3]);
       * // => [3]
       *
       * _.takeRight([1, 2, 3], 2);
       * // => [2, 3]
       *
       * _.takeRight([1, 2, 3], 5);
       * // => [1, 2, 3]
       *
       * _.takeRight([1, 2, 3], 0);
       * // => []
       */
      function takeRight(array, n, guard) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        if (guard ? isIterateeCall(array, n, guard) : n == null) {
          n = 1;
        }
        n = length - (+n || 0);
        return baseSlice(array, n < 0 ? 0 : n);
      }

      /**
       * Creates a slice of `array` with elements taken from the end. Elements are
       * taken until `predicate` returns falsey. The predicate is bound to `thisArg`
       * and invoked with three arguments; (value, index, array).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per element.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.takeRightWhile([1, 2, 3], function(n) { return n > 1; });
       * // => [2, 3]
       *
       * var users = [
       *   { 'user': 'barney',  'status': 'busy', 'active': false },
       *   { 'user': 'fred',    'status': 'busy', 'active': true },
       *   { 'user': 'pebbles', 'status': 'away', 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.takeRightWhile(users, 'active'), 'user');
       * // => ['fred', 'pebbles']
       *
       * // using the "_.matches" callback shorthand
       * _.pluck(_.takeRightWhile(users, { 'status': 'away' }), 'user');
       * // => ['pebbles']
       */
      function takeRightWhile(array, predicate, thisArg) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        predicate = getCallback(predicate, thisArg, 3);
        while (length-- && predicate(array[length], length, array)) {}
        return baseSlice(array, length + 1);
      }

      /**
       * Creates a slice of `array` with elements taken from the beginning. Elements
       * are taken until `predicate` returns falsey. The predicate is bound to
       * `thisArg` and invoked with three arguments; (value, index, array).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Array
       * @param {Array} array The array to query.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per element.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the slice of `array`.
       * @example
       *
       * _.takeWhile([1, 2, 3], function(n) { return n < 3; });
       * // => [1, 2]
       *
       * var users = [
       *   { 'user': 'barney',  'status': 'busy', 'active': true },
       *   { 'user': 'fred',    'status': 'busy', 'active': false },
       *   { 'user': 'pebbles', 'status': 'away', 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.takeWhile(users, 'active'), 'user');
       * // => ['barney']
       *
       * // using the "_.matches" callback shorthand
       * _.pluck(_.takeWhile(users, { 'status': 'busy' }), 'user');
       * // => ['barney', 'fred']
       */
      function takeWhile(array, predicate, thisArg) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        var index = -1;
        predicate = getCallback(predicate, thisArg, 3);
        while (++index < length && predicate(array[index], index, array)) {}
        return baseSlice(array, 0, index);
      }

      /**
       * Creates an array of unique values, in order, of the provided arrays using
       * `SameValueZero` for equality comparisons.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {...Array} [arrays] The arrays to inspect.
       * @returns {Array} Returns the new array of combined values.
       * @example
       *
       * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
       * // => [1, 2, 3, 5, 4]
       */
      function union() {
        return baseUniq(baseFlatten(arguments, false, true));
      }

      /**
       * Creates a duplicate-value-free version of an array using `SameValueZero`
       * for equality comparisons. Providing `true` for `isSorted` performs a faster
       * search algorithm for sorted arrays. If an iteratee function is provided it
       * is invoked for each value in the array to generate the criterion by which
       * uniqueness is computed. The `iteratee` is bound to `thisArg` and invoked
       * with three arguments; (value, index, array).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @alias unique
       * @category Array
       * @param {Array} array The array to inspect.
       * @param {boolean} [isSorted] Specify the array is sorted.
       * @param {Function|Object|string} [iteratee] The function invoked per iteration.
       *  If a property name or object is provided it is used to create a "_.property"
       *  or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Array} Returns the new duplicate-value-free array.
       * @example
       *
       * _.uniq([1, 2, 1]);
       * // => [1, 2]
       *
       * // using `isSorted`
       * _.uniq([1, 1, 2], true);
       * // => [1, 2]
       *
       * // using an iteratee function
       * _.uniq([1, 2.5, 1.5, 2], function(n) { return this.floor(n); }, Math);
       * // => [1, 2.5]
       *
       * // using the "_.property" callback shorthand
       * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
       * // => [{ 'x': 1 }, { 'x': 2 }]
       */
      function uniq(array, isSorted, iteratee, thisArg) {
        var length = array ? array.length : 0;
        if (!length) {
          return [];
        }
        // Juggle arguments.
        if (typeof isSorted != "boolean" && isSorted != null) {
          thisArg = iteratee;
          iteratee = isIterateeCall(array, isSorted, thisArg) ? null : isSorted;
          isSorted = false;
        }
        var func = getCallback();
        if (!(func === baseCallback && iteratee == null)) {
          iteratee = func(iteratee, thisArg, 3);
        }
        return isSorted && getIndexOf() == baseIndexOf
          ? sortedUniq(array, iteratee)
          : baseUniq(array, iteratee);
      }

      /**
       * This method is like `_.zip` except that it accepts an array of grouped
       * elements and creates an array regrouping the elements to their pre-`_.zip`
       * configuration.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array of grouped elements to process.
       * @returns {Array} Returns the new array of regrouped elements.
       * @example
       *
       * var zipped = _.zip(['fred', 'barney'], [30, 40], [true, false]);
       * // => [['fred', 30, true], ['barney', 40, false]]
       *
       * _.unzip(zipped);
       * // => [['fred', 'barney'], [30, 40], [true, false]]
       */
      function unzip(array) {
        var index = -1,
          length =
            (array && array.length && arrayMax(arrayMap(array, getLength))) >>>
            0,
          result = Array(length);

        while (++index < length) {
          result[index] = arrayMap(array, baseProperty(index));
        }
        return result;
      }

      /**
       * Creates an array excluding all provided values using `SameValueZero` for
       * equality comparisons.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {Array} array The array to filter.
       * @param {...*} [values] The values to exclude.
       * @returns {Array} Returns the new array of filtered values.
       * @example
       *
       * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
       * // => [2, 3, 4]
       */
      function without(array) {
        return baseDifference(array, baseSlice(arguments, 1));
      }

      /**
       * Creates an array that is the symmetric difference of the provided arrays.
       * See [Wikipedia](https://en.wikipedia.org/wiki/Symmetric_difference) for
       * more details.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {...Array} [arrays] The arrays to inspect.
       * @returns {Array} Returns the new array of values.
       * @example
       *
       * _.xor([1, 2, 3], [5, 2, 1, 4]);
       * // => [3, 5, 4]
       *
       * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
       * // => [1, 4, 5]
       */
      function xor() {
        var index = -1,
          length = arguments.length;

        while (++index < length) {
          var array = arguments[index];
          if (isArray(array) || isArguments(array)) {
            var result = result
              ? baseDifference(result, array).concat(
                  baseDifference(array, result),
                )
              : array;
          }
        }
        return result ? baseUniq(result) : [];
      }

      /**
       * Creates an array of grouped elements, the first of which contains the first
       * elements of the given arrays, the second of which contains the second elements
       * of the given arrays, and so on.
       *
       * @static
       * @memberOf _
       * @category Array
       * @param {...Array} [arrays] The arrays to process.
       * @returns {Array} Returns the new array of grouped elements.
       * @example
       *
       * _.zip(['fred', 'barney'], [30, 40], [true, false]);
       * // => [['fred', 30, true], ['barney', 40, false]]
       */
      function zip() {
        var length = arguments.length,
          array = Array(length);

        while (length--) {
          array[length] = arguments[length];
        }
        return unzip(array);
      }

      /**
       * Creates an object composed from arrays of property names and values. Provide
       * either a single two dimensional array, e.g. `[[key1, value1], [key2, value2]]`
       * or two arrays, one of property names and one of corresponding values.
       *
       * @static
       * @memberOf _
       * @alias object
       * @category Array
       * @param {Array} props The property names.
       * @param {Array} [values=[]] The property values.
       * @returns {Object} Returns the new object.
       * @example
       *
       * _.zipObject(['fred', 'barney'], [30, 40]);
       * // => { 'fred': 30, 'barney': 40 }
       */
      function zipObject(props, values) {
        var index = -1,
          length = props ? props.length : 0,
          result = {};

        if (length && !values && !isArray(props[0])) {
          values = [];
        }
        while (++index < length) {
          var key = props[index];
          if (values) {
            result[key] = values[index];
          } else if (key) {
            result[key[0]] = key[1];
          }
        }
        return result;
      }

      /*------------------------------------------------------------------------*/

      /**
       * Creates a `lodash` object that wraps `value` with explicit method
       * chaining enabled.
       *
       * @static
       * @memberOf _
       * @category Chain
       * @param {*} value The value to wrap.
       * @returns {Object} Returns the new `lodash` object.
       * @example
       *
       * var users = [
       *   { 'user': 'barney',  'age': 36 },
       *   { 'user': 'fred',    'age': 40 },
       *   { 'user': 'pebbles', 'age': 1 }
       * ];
       *
       * var youngest = _.chain(users)
       *   .sortBy('age')
       *   .map(function(chr) { return chr.user + ' is ' + chr.age; })
       *   .first()
       *   .value();
       * // => 'pebbles is 1'
       */
      function chain(value) {
        var result = lodash(value);
        result.__chain__ = true;
        return result;
      }

      /**
       * This method invokes `interceptor` and returns `value`. The interceptor is
       * bound to `thisArg` and invoked with one argument; (value). The purpose of
       * this method is to "tap into" a method chain in order to perform operations
       * on intermediate results within the chain.
       *
       * @static
       * @memberOf _
       * @category Chain
       * @param {*} value The value to provide to `interceptor`.
       * @param {Function} interceptor The function to invoke.
       * @param {*} [thisArg] The `this` binding of `interceptor`.
       * @returns {*} Returns `value`.
       * @example
       *
       * _([1, 2, 3])
       *  .tap(function(array) { array.pop(); })
       *  .reverse()
       *  .value();
       * // => [2, 1]
       */
      function tap(value, interceptor, thisArg) {
        interceptor.call(thisArg, value);
        return value;
      }

      /**
       * This method is like `_.tap` except that it returns the result of `interceptor`.
       *
       * @static
       * @memberOf _
       * @category Chain
       * @param {*} value The value to provide to `interceptor`.
       * @param {Function} interceptor The function to invoke.
       * @param {*} [thisArg] The `this` binding of `interceptor`.
       * @returns {*} Returns the result of `interceptor`.
       * @example
       *
       * _([1, 2, 3])
       *  .last()
       *  .thru(function(value) { return [value]; })
       *  .value();
       * // => [3]
       */
      function thru(value, interceptor, thisArg) {
        return interceptor.call(thisArg, value);
      }

      /**
       * Enables explicit method chaining on the wrapper object.
       *
       * @name chain
       * @memberOf _
       * @category Chain
       * @returns {*} Returns the `lodash` object.
       * @example
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 }
       * ];
       *
       * // without explicit chaining
       * _(users).first();
       * // => { 'user': 'barney', 'age': 36 }
       *
       * // with explicit chaining
       * _(users).chain()
       *   .first()
       *   .pick('user')
       *   .value();
       * // => { 'user': 'barney' }
       */
      function wrapperChain() {
        return chain(this);
      }

      /**
       * Reverses the wrapped array so the first element becomes the last, the
       * second element becomes the second to last, and so on.
       *
       * **Note:** This method mutates the wrapped array.
       *
       * @name reverse
       * @memberOf _
       * @category Chain
       * @returns {Object} Returns the new reversed `lodash` object.
       * @example
       *
       * var array = [1, 2, 3];
       *
       * _(array).reverse().value()
       * // => [3, 2, 1]
       *
       * console.log(array);
       * // => [3, 2, 1]
       */
      function wrapperReverse() {
        var value = this.__wrapped__;
        if (value instanceof LazyWrapper) {
          if (this.__actions__.length) {
            value = new LazyWrapper(this);
          }
          return new LodashWrapper(value.reverse());
        }
        return this.thru(function (value) {
          return value.reverse();
        });
      }

      /**
       * Produces the result of coercing the unwrapped value to a string.
       *
       * @name toString
       * @memberOf _
       * @category Chain
       * @returns {string} Returns the coerced string value.
       * @example
       *
       * _([1, 2, 3]).toString();
       * // => '1,2,3'
       */
      function wrapperToString() {
        return this.value() + "";
      }

      /**
       * Executes the chained sequence to extract the unwrapped value.
       *
       * @name value
       * @memberOf _
       * @alias toJSON, valueOf
       * @category Chain
       * @returns {*} Returns the resolved unwrapped value.
       * @example
       *
       * _([1, 2, 3]).value();
       * // => [1, 2, 3]
       */
      function wrapperValue() {
        return baseWrapperValue(this.__wrapped__, this.__actions__);
      }

      /*------------------------------------------------------------------------*/

      /**
       * Creates an array of elements corresponding to the given keys, or indexes,
       * of `collection`. Keys may be specified as individual arguments or as arrays
       * of keys.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {...(number|number[]|string|string[])} [props] The property names
       *  or indexes of elements to pick, specified individually or in arrays.
       * @returns {Array} Returns the new array of picked elements.
       * @example
       *
       * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
       * // => ['a', 'c', 'e']
       *
       * _.at(['fred', 'barney', 'pebbles'], 0, 2);
       * // => ['fred', 'pebbles']
       */
      function at(collection) {
        var length = collection ? collection.length : 0;
        if (isLength(length)) {
          collection = toIterable(collection);
        }
        return baseAt(collection, baseFlatten(arguments, false, false, 1));
      }

      /**
       * Checks if `value` is in `collection` using `SameValueZero` for equality
       * comparisons. If `fromIndex` is negative, it is used as the offset from
       * the end of `collection`.
       *
       * **Note:** `SameValueZero` comparisons are like strict equality comparisons,
       * e.g. `===`, except that `NaN` matches `NaN`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-samevaluezero)
       * for more details.
       *
       * @static
       * @memberOf _
       * @alias contains, include
       * @category Collection
       * @param {Array|Object|string} collection The collection to search.
       * @param {*} target The value to search for.
       * @param {number} [fromIndex=0] The index to search from.
       * @returns {boolean} Returns `true` if a matching element is found, else `false`.
       * @example
       *
       * _.includes([1, 2, 3], 1);
       * // => true
       *
       * _.includes([1, 2, 3], 1, 2);
       * // => false
       *
       * _.includes({ 'user': 'fred', 'age': 40 }, 'fred');
       * // => true
       *
       * _.includes('pebbles', 'eb');
       * // => true
       */
      function includes(collection, target, fromIndex) {
        var length = collection ? collection.length : 0;
        if (!isLength(length)) {
          collection = values(collection);
          length = collection.length;
        }
        if (!length) {
          return false;
        }
        if (typeof fromIndex == "number") {
          fromIndex =
            fromIndex < 0 ? nativeMax(length + fromIndex, 0) : fromIndex || 0;
        } else {
          fromIndex = 0;
        }
        return typeof collection == "string" ||
          (!isArray(collection) && isString(collection))
          ? fromIndex < length && collection.indexOf(target, fromIndex) > -1
          : getIndexOf(collection, target, fromIndex) > -1;
      }

      /**
       * Creates an object composed of keys generated from the results of running
       * each element of `collection` through `iteratee`. The corresponding value
       * of each key is the number of times the key was returned by `iteratee`.
       * The `iteratee` is bound to `thisArg` and invoked with three arguments;
       * (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns the composed aggregate object.
       * @example
       *
       * _.countBy([4.3, 6.1, 6.4], function(n) { return Math.floor(n); });
       * // => { '4': 1, '6': 2 }
       *
       * _.countBy([4.3, 6.1, 6.4], function(n) { return this.floor(n); }, Math);
       * // => { '4': 1, '6': 2 }
       *
       * _.countBy(['one', 'two', 'three'], 'length');
       * // => { '3': 2, '5': 1 }
       */
      var countBy = createAggregator(function (result, value, key) {
        hasOwnProperty.call(result, key) ? ++result[key] : (result[key] = 1);
      });

      /**
       * Checks if `predicate` returns truthy for **all** elements of `collection`.
       * The predicate is bound to `thisArg` and invoked with three arguments;
       * (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @alias all
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {boolean} Returns `true` if all elements pass the predicate check,
       *  else `false`.
       * @example
       *
       * _.every([true, 1, null, 'yes']);
       * // => false
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.every(users, 'age');
       * // => true
       *
       * // using the "_.matches" callback shorthand
       * _.every(users, { 'age': 36 });
       * // => false
       */
      function every(collection, predicate, thisArg) {
        var func = isArray(collection) ? arrayEvery : baseEvery;
        if (typeof predicate != "function" || typeof thisArg != "undefined") {
          predicate = getCallback(predicate, thisArg, 3);
        }
        return func(collection, predicate);
      }

      /**
       * Iterates over elements of `collection`, returning an array of all elements
       * `predicate` returns truthy for. The predicate is bound to `thisArg` and
       * invoked with three arguments; (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @alias select
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the new filtered array.
       * @example
       *
       * var evens = _.filter([1, 2, 3, 4], function(n) { return n % 2 == 0; });
       * // => [2, 4]
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36, 'active': false },
       *   { 'user': 'fred',   'age': 40, 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.filter(users, 'active'), 'user');
       * // => ['fred']
       *
       * // using the "_.matches" callback shorthand
       * _.pluck(_.filter(users, { 'age': 36 }), 'user');
       * // => ['barney']
       */
      function filter(collection, predicate, thisArg) {
        var func = isArray(collection) ? arrayFilter : baseFilter;
        predicate = getCallback(predicate, thisArg, 3);
        return func(collection, predicate);
      }

      /**
       * Iterates over elements of `collection`, returning the first element
       * `predicate` returns truthy for. The predicate is bound to `thisArg` and
       * invoked with three arguments; (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @alias detect
       * @category Collection
       * @param {Array|Object|string} collection The collection to search.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {*} Returns the matched element, else `undefined`.
       * @example
       *
       * var users = [
       *   { 'user': 'barney',  'age': 36, 'active': false },
       *   { 'user': 'fred',    'age': 40, 'active': true },
       *   { 'user': 'pebbles', 'age': 1,  'active': false }
       * ];
       *
       * _.result(_.find(users, function(chr) { return chr.age < 40; }), 'user');
       * // => 'barney'
       *
       * // using the "_.matches" callback shorthand
       * _.result(_.find(users, { 'age': 1 }), 'user');
       * // => 'pebbles'
       *
       * // using the "_.property" callback shorthand
       * _.result(_.find(users, 'active'), 'user');
       * // => 'fred'
       */
      function find(collection, predicate, thisArg) {
        if (isArray(collection)) {
          var index = findIndex(collection, predicate, thisArg);
          return index > -1 ? collection[index] : undefined;
        }
        predicate = getCallback(predicate, thisArg, 3);
        return baseFind(collection, predicate, baseEach);
      }

      /**
       * This method is like `_.find` except that it iterates over elements of
       * `collection` from right to left.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to search.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {*} Returns the matched element, else `undefined`.
       * @example
       *
       * _.findLast([1, 2, 3, 4], function(n) { return n % 2 == 1; });
       * // => 3
       */
      function findLast(collection, predicate, thisArg) {
        predicate = getCallback(predicate, thisArg, 3);
        return baseFind(collection, predicate, baseEachRight);
      }

      /**
       * Performs a deep comparison between each element in `collection` and the
       * source object, returning the first element that has equivalent property
       * values.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to search.
       * @param {Object} source The object of property values to match.
       * @returns {*} Returns the matched element, else `undefined`.
       * @example
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36, 'status': 'busy' },
       *   { 'user': 'fred',   'age': 40, 'status': 'busy' }
       * ];
       *
       * _.result(_.findWhere(users, { 'status': 'busy' }), 'user');
       * // => 'barney'
       *
       * _.result(_.findWhere(users, { 'age': 40 }), 'user');
       * // => 'fred'
       */
      function findWhere(collection, source) {
        return find(collection, baseMatches(source));
      }

      /**
       * Iterates over elements of `collection` invoking `iteratee` for each element.
       * The `iteratee` is bound to `thisArg` and invoked with three arguments;
       * (value, index|key, collection). Iterator functions may exit iteration early
       * by explicitly returning `false`.
       *
       * **Note:** As with other "Collections" methods, objects with a `length` property
       * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
       * may be used for object iteration.
       *
       * @static
       * @memberOf _
       * @alias each
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Array|Object|string} Returns `collection`.
       * @example
       *
       * _([1, 2, 3]).forEach(function(n) { console.log(n); }).value();
       * // => logs each value from left to right and returns the array
       *
       * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(n, key) { console.log(n, key); });
       * // => logs each value-key pair and returns the object (iteration order is not guaranteed)
       */
      function forEach(collection, iteratee, thisArg) {
        return typeof iteratee == "function" &&
          typeof thisArg == "undefined" &&
          isArray(collection)
          ? arrayEach(collection, iteratee)
          : baseEach(collection, bindCallback(iteratee, thisArg, 3));
      }

      /**
       * This method is like `_.forEach` except that it iterates over elements of
       * `collection` from right to left.
       *
       * @static
       * @memberOf _
       * @alias eachRight
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Array|Object|string} Returns `collection`.
       * @example
       *
       * _([1, 2, 3]).forEachRight(function(n) { console.log(n); }).join(',');
       * // => logs each value from right to left and returns the array
       */
      function forEachRight(collection, iteratee, thisArg) {
        return typeof iteratee == "function" &&
          typeof thisArg == "undefined" &&
          isArray(collection)
          ? arrayEachRight(collection, iteratee)
          : baseEachRight(collection, bindCallback(iteratee, thisArg, 3));
      }

      /**
       * Creates an object composed of keys generated from the results of running
       * each element of `collection` through `iteratee`. The corresponding value
       * of each key is an array of the elements responsible for generating the key.
       * The `iteratee` is bound to `thisArg` and invoked with three arguments;
       * (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns the composed aggregate object.
       * @example
       *
       * _.groupBy([4.2, 6.1, 6.4], function(n) { return Math.floor(n); });
       * // => { '4': [4.2], '6': [6.1, 6.4] }
       *
       * _.groupBy([4.2, 6.1, 6.4], function(n) { return this.floor(n); }, Math);
       * // => { '4': [4.2], '6': [6.1, 6.4] }
       *
       * // using the "_.property" callback shorthand
       * _.groupBy(['one', 'two', 'three'], 'length');
       * // => { '3': ['one', 'two'], '5': ['three'] }
       */
      var groupBy = createAggregator(function (result, value, key) {
        if (hasOwnProperty.call(result, key)) {
          result[key].push(value);
        } else {
          result[key] = [value];
        }
      });

      /**
       * Creates an object composed of keys generated from the results of running
       * each element of `collection` through `iteratee`. The corresponding value
       * of each key is the last element responsible for generating the key. The
       * iteratee function is bound to `thisArg` and invoked with three arguments;
       * (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns the composed aggregate object.
       * @example
       *
       * var keyData = [
       *   { 'dir': 'left', 'code': 97 },
       *   { 'dir': 'right', 'code': 100 }
       * ];
       *
       * _.indexBy(keyData, 'dir');
       * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
       *
       * _.indexBy(keyData, function(object) { return String.fromCharCode(object.code); });
       * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
       *
       * _.indexBy(keyData, function(object) { return this.fromCharCode(object.code); }, String);
       * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
       */
      var indexBy = createAggregator(function (result, value, key) {
        result[key] = value;
      });

      /**
       * Invokes the method named by `methodName` on each element in `collection`,
       * returning an array of the results of each invoked method. Any additional
       * arguments are provided to each invoked method. If `methodName` is a function
       * it is invoked for, and `this` bound to, each element in `collection`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|string} methodName The name of the method to invoke or
       *  the function invoked per iteration.
       * @param {...*} [args] The arguments to invoke the method with.
       * @returns {Array} Returns the array of results.
       * @example
       *
       * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
       * // => [[1, 5, 7], [1, 2, 3]]
       *
       * _.invoke([123, 456], String.prototype.split, '');
       * // => [['1', '2', '3'], ['4', '5', '6']]
       */
      function invoke(collection, methodName) {
        return baseInvoke(collection, methodName, baseSlice(arguments, 2));
      }

      /**
       * Creates an array of values by running each element in `collection` through
       * `iteratee`. The `iteratee` is bound to `thisArg` and invoked with three
       * arguments; (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @alias collect
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Array} Returns the new mapped array.
       * @example
       *
       * _.map([1, 2, 3], function(n) { return n * 3; });
       * // => [3, 6, 9]
       *
       * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(n) { return n * 3; });
       * // => [3, 6, 9] (iteration order is not guaranteed)
       *
       * var users = [
       *   { 'user': 'barney' },
       *   { 'user': 'fred' }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.map(users, 'user');
       * // => ['barney', 'fred']
       */
      function map(collection, iteratee, thisArg) {
        var func = isArray(collection) ? arrayMap : baseMap;
        iteratee = getCallback(iteratee, thisArg, 3);
        return func(collection, iteratee);
      }

      /**
       * Gets the maximum value of `collection`. If `collection` is empty or falsey
       * `-Infinity` is returned. If an iteratee function is provided it is invoked
       * for each value in `collection` to generate the criterion by which the value
       * is ranked. The `iteratee` is bound to `thisArg` and invoked with three
       * arguments; (value, index, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [iteratee] The function invoked per iteration.
       *  If a property name or object is provided it is used to create a "_.property"
       *  or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {*} Returns the maximum value.
       * @example
       *
       * _.max([4, 2, 8, 6]);
       * // => 8
       *
       * _.max([]);
       * // => -Infinity
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 }
       * ];
       *
       * _.max(users, function(chr) { return chr.age; });
       * // => { 'user': 'fred', 'age': 40 };
       *
       * // using the "_.property" callback shorthand
       * _.max(users, 'age');
       * // => { 'user': 'fred', 'age': 40 };
       */
      var max = createExtremum(arrayMax);

      /**
       * Gets the minimum value of `collection`. If `collection` is empty or falsey
       * `Infinity` is returned. If an iteratee function is provided it is invoked
       * for each value in `collection` to generate the criterion by which the value
       * is ranked. The `iteratee` is bound to `thisArg` and invoked with three
       * arguments; (value, index, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [iteratee] The function invoked per iteration.
       *  If a property name or object is provided it is used to create a "_.property"
       *  or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {*} Returns the minimum value.
       * @example
       *
       * _.min([4, 2, 8, 6]);
       * // => 2
       *
       * _.min([]);
       * // => Infinity
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 }
       * ];
       *
       * _.min(users, function(chr) { return chr.age; });
       * // => { 'user': 'barney', 'age': 36 };
       *
       * // using the "_.property" callback shorthand
       * _.min(users, 'age');
       * // => { 'user': 'barney', 'age': 36 };
       */
      var min = createExtremum(arrayMin, true);

      /**
       * Creates an array of elements split into two groups, the first of which
       * contains elements `predicate` returns truthy for, while the second of which
       * contains elements `predicate` returns falsey for. The predicate is bound
       * to `thisArg` and invoked with three arguments; (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the array of grouped elements.
       * @example
       *
       * _.partition([1, 2, 3], function(n) { return n % 2; });
       * // => [[1, 3], [2]]
       *
       * _.partition([1.2, 2.3, 3.4], function(n) { return this.floor(n) % 2; }, Math);
       * // => [[1, 3], [2]]
       *
       * var users = [
       *   { 'user': 'barney',  'age': 36, 'active': false },
       *   { 'user': 'fred',    'age': 40, 'active': true },
       *   { 'user': 'pebbles', 'age': 1,  'active': false }
       * ];
       *
       * // using the "_.matches" callback shorthand
       * _.map(_.partition(users, { 'age': 1 }), function(array) { return _.pluck(array, 'user'); });
       * // => [['pebbles'], ['barney', 'fred']]
       *
       * // using the "_.property" callback shorthand
       * _.map(_.partition(users, 'active'), function(array) { return _.pluck(array, 'user'); });
       * // => [['fred'], ['barney', 'pebbles']]
       */
      var partition = createAggregator(
        function (result, value, key) {
          result[key ? 0 : 1].push(value);
        },
        function () {
          return [[], []];
        },
      );

      /**
       * Gets the value of `key` from all elements in `collection`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {string} key The key of the property to pluck.
       * @returns {Array} Returns the property values.
       * @example
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 }
       * ];
       *
       * _.pluck(users, 'user');
       * // => ['barney', 'fred']
       *
       * var userIndex = _.indexBy(users, 'user');
       * _.pluck(userIndex, 'age');
       * // => [36, 40] (iteration order is not guaranteed)
       */
      function pluck(collection, key) {
        return map(collection, baseProperty(key + ""));
      }

      /**
       * Reduces `collection` to a value which is the accumulated result of running
       * each element in `collection` through `iteratee`, where each successive
       * invocation is supplied the return value of the previous. If `accumulator`
       * is not provided the first element of `collection` is used as the initial
       * value. The `iteratee` is bound to `thisArg`and invoked with four arguments;
       * (accumulator, value, index|key, collection).
       *
       * @static
       * @memberOf _
       * @alias foldl, inject
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [accumulator] The initial value.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {*} Returns the accumulated value.
       * @example
       *
       * var sum = _.reduce([1, 2, 3], function(sum, n) { return sum + n; });
       * // => 6
       *
       * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, n, key) {
       *   result[key] = n * 3;
       *   return result;
       * }, {});
       * // => { 'a': 3, 'b': 6, 'c': 9 } (iteration order is not guaranteed)
       */
      function reduce(collection, iteratee, accumulator, thisArg) {
        var func = isArray(collection) ? arrayReduce : baseReduce;
        return func(
          collection,
          getCallback(iteratee, thisArg, 4),
          accumulator,
          arguments.length < 3,
          baseEach,
        );
      }

      /**
       * This method is like `_.reduce` except that it iterates over elements of
       * `collection` from right to left.
       *
       * @static
       * @memberOf _
       * @alias foldr
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [accumulator] The initial value.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {*} Returns the accumulated value.
       * @example
       *
       * var array = [[0, 1], [2, 3], [4, 5]];
       * _.reduceRight(array, function(flattened, other) { return flattened.concat(other); }, []);
       * // => [4, 5, 2, 3, 0, 1]
       */
      function reduceRight(collection, iteratee, accumulator, thisArg) {
        var func = isArray(collection) ? arrayReduceRight : baseReduce;
        return func(
          collection,
          getCallback(iteratee, thisArg, 4),
          accumulator,
          arguments.length < 3,
          baseEachRight,
        );
      }

      /**
       * The opposite of `_.filter`; this method returns the elements of `collection`
       * that `predicate` does **not** return truthy for.
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Array} Returns the new filtered array.
       * @example
       *
       * var odds = _.reject([1, 2, 3, 4], function(n) { return n % 2 == 0; });
       * // => [1, 3]
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36, 'active': false },
       *   { 'user': 'fred',   'age': 40, 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.reject(users, 'active'), 'user');
       * // => ['barney']
       *
       * // using the "_.matches" callback shorthand
       * _.pluck(_.reject(users, { 'age': 36 }), 'user');
       * // => ['fred']
       */
      function reject(collection, predicate, thisArg) {
        var func = isArray(collection) ? arrayFilter : baseFilter;
        predicate = getCallback(predicate, thisArg, 3);
        return func(collection, function (value, index, collection) {
          return !predicate(value, index, collection);
        });
      }

      /**
       * Gets a random element or `n` random elements from a collection.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to sample.
       * @param {number} [n] The number of elements to sample.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {*} Returns the random sample(s).
       * @example
       *
       * _.sample([1, 2, 3, 4]);
       * // => 2
       *
       * _.sample([1, 2, 3, 4], 2);
       * // => [3, 1]
       */
      function sample(collection, n, guard) {
        if (guard ? isIterateeCall(collection, n, guard) : n == null) {
          collection = toIterable(collection);
          var length = collection.length;
          return length > 0 ? collection[baseRandom(0, length - 1)] : undefined;
        }
        var result = shuffle(collection);
        result.length = nativeMin(n < 0 ? 0 : +n || 0, result.length);
        return result;
      }

      /**
       * Creates an array of shuffled values, using a version of the Fisher-Yates
       * shuffle. See [Wikipedia](https://en.wikipedia.org/wiki/Fisher-Yates_shuffle)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to shuffle.
       * @returns {Array} Returns the new shuffled array.
       * @example
       *
       * _.shuffle([1, 2, 3, 4]);
       * // => [4, 1, 3, 2]
       */
      function shuffle(collection) {
        collection = toIterable(collection);

        var index = -1,
          length = collection.length,
          result = Array(length);

        while (++index < length) {
          var rand = baseRandom(0, index);
          if (index != rand) {
            result[index] = result[rand];
          }
          result[rand] = collection[index];
        }
        return result;
      }

      /**
       * Gets the size of `collection` by returning `collection.length` for
       * array-like values or the number of own enumerable properties for objects.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to inspect.
       * @returns {number} Returns the size of `collection`.
       * @example
       *
       * _.size([1, 2]);
       * // => 2
       *
       * _.size({ 'one': 1, 'two': 2, 'three': 3 });
       * // => 3
       *
       * _.size('pebbles');
       * // => 7
       */
      function size(collection) {
        var length = collection ? collection.length : 0;
        return isLength(length) ? length : keys(collection).length;
      }

      /**
       * Checks if `predicate` returns truthy for **any** element of `collection`.
       * The function returns as soon as it finds a passing value and does not iterate
       * over the entire collection. The predicate is bound to `thisArg` and invoked
       * with three arguments; (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @alias any
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {boolean} Returns `true` if any element passes the predicate check,
       *  else `false`.
       * @example
       *
       * _.some([null, 0, 'yes', false], Boolean);
       * // => true
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36, 'active': false },
       *   { 'user': 'fred',   'age': 40, 'active': true }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.some(users, 'active');
       * // => true
       *
       * // using the "_.matches" callback shorthand
       * _.some(users, { 'age': 1 });
       * // => false
       */
      function some(collection, predicate, thisArg) {
        var func = isArray(collection) ? arraySome : baseSome;
        if (typeof predicate != "function" || typeof thisArg != "undefined") {
          predicate = getCallback(predicate, thisArg, 3);
        }
        return func(collection, predicate);
      }

      /**
       * Creates an array of elements, sorted in ascending order by the results of
       * running each element in a collection through `iteratee`. This method performs
       * a stable sort, that is, it preserves the original sort order of equal elements.
       * The `iteratee` is bound to `thisArg` and invoked with three arguments;
       * (value, index|key, collection).
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {Array|Function|Object|string} [iteratee=_.identity] The function
       *  invoked per iteration. If a property name or an object is provided it is
       *  used to create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Array} Returns the new sorted array.
       * @example
       *
       * _.sortBy([1, 2, 3], function(n) { return Math.sin(n); });
       * // => [3, 1, 2]
       *
       * _.sortBy([1, 2, 3], function(n) { return this.sin(n); }, Math);
       * // => [3, 1, 2]
       *
       * var users = [
       *   { 'user': 'fred' },
       *   { 'user': 'pebbles' },
       *   { 'user': 'barney' }
       * ];
       *
       * // using the "_.property" callback shorthand
       * _.pluck(_.sortBy(users, 'user'), 'user');
       * // => ['barney', 'fred', 'pebbles']
       */
      function sortBy(collection, iteratee, thisArg) {
        var index = -1,
          length = collection ? collection.length : 0,
          result = isLength(length) ? Array(length) : [];

        if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
          iteratee = null;
        }
        iteratee = getCallback(iteratee, thisArg, 3);
        baseEach(collection, function (value, key, collection) {
          result[++index] = {
            criteria: iteratee(value, key, collection),
            index: index,
            value: value,
          };
        });
        return baseSortBy(result, compareAscending);
      }

      /**
       * This method is like `_.sortBy` except that it sorts by property names
       * instead of an iteratee function.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to iterate over.
       * @param {...(string|string[])} props The property names to sort by,
       *  specified as individual property names or arrays of property names.
       * @returns {Array} Returns the new sorted array.
       * @example
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 },
       *   { 'user': 'barney', 'age': 26 },
       *   { 'user': 'fred',   'age': 30 }
       * ];
       *
       * _.map(_.sortByAll(users, ['user', 'age']), _.values);
       * // => [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
       */
      function sortByAll(collection) {
        var args = arguments;
        if (args.length > 3 && isIterateeCall(args[1], args[2], args[3])) {
          args = [collection, args[1]];
        }
        var index = -1,
          length = collection ? collection.length : 0,
          props = baseFlatten(args, false, false, 1),
          result = isLength(length) ? Array(length) : [];

        baseEach(collection, function (value, key, collection) {
          var length = props.length,
            criteria = Array(length);

          while (length--) {
            criteria[length] = value == null ? undefined : value[props[length]];
          }
          result[++index] = { criteria: criteria, index: index, value: value };
        });
        return baseSortBy(result, compareMultipleAscending);
      }

      /**
       * Performs a deep comparison between each element in `collection` and the
       * source object, returning an array of all elements that have equivalent
       * property values.
       *
       * @static
       * @memberOf _
       * @category Collection
       * @param {Array|Object|string} collection The collection to search.
       * @param {Object} source The object of property values to match.
       * @returns {Array} Returns the new filtered array.
       * @example
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36, 'status': 'busy', 'pets': ['hoppy'] },
       *   { 'user': 'fred',   'age': 40, 'status': 'busy', 'pets': ['baby puss', 'dino'] }
       * ];
       *
       * _.pluck(_.where(users, { 'age': 36 }), 'user');
       * // => ['barney']
       *
       * _.pluck(_.where(users, { 'pets': ['dino'] }), 'user');
       * // => ['fred']
       *
       * _.pluck(_.where(users, { 'status': 'busy' }), 'user');
       * // => ['barney', 'fred']
       */
      function where(collection, source) {
        return filter(collection, baseMatches(source));
      }

      /*------------------------------------------------------------------------*/

      /**
       * Gets the number of milliseconds that have elapsed since the Unix epoch
       * (1 January 1970 00:00:00 UTC).
       *
       * @static
       * @memberOf _
       * @category Date
       * @example
       *
       * _.defer(function(stamp) { console.log(_.now() - stamp); }, _.now());
       * // => logs the number of milliseconds it took for the deferred function to be invoked
       */
      var now =
        nativeNow ||
        function () {
          return new Date().getTime();
        };

      /*------------------------------------------------------------------------*/

      /**
       * The opposite of `_.before`; this method creates a function that invokes
       * `func` once it is called `n` or more times.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {number} n The number of calls before `func` is invoked.
       * @param {Function} func The function to restrict.
       * @returns {Function} Returns the new restricted function.
       * @example
       *
       * var saves = ['profile', 'settings'];
       *
       * var done = _.after(saves.length, function() {
       *   console.log('done saving!');
       * });
       *
       * _.forEach(saves, function(type) {
       *   asyncSave({ 'type': type, 'complete': done });
       * });
       * // => logs 'done saving!' after the two async saves have completed
       */
      function after(n, func) {
        if (!isFunction(func)) {
          if (isFunction(n)) {
            var temp = n;
            n = func;
            func = temp;
          } else {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
        }
        n = nativeIsFinite((n = +n)) ? n : 0;
        return function () {
          if (--n < 1) {
            return func.apply(this, arguments);
          }
        };
      }

      /**
       * Creates a function that accepts up to `n` arguments ignoring any
       * additional arguments.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to cap arguments for.
       * @param {number} [n=func.length] The arity cap.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Function} Returns the new function.
       * @example
       *
       * _.map(['6', '8', '10'], _.ary(parseInt, 1));
       * // => [6, 8, 10]
       */
      function ary(func, n, guard) {
        if (guard && isIterateeCall(func, n, guard)) {
          n = null;
        }
        n = func && n == null ? func.length : nativeMax(+n || 0, 0);
        return createWrapper(func, ARY_FLAG, null, null, null, null, n);
      }

      /**
       * Creates a function that invokes `func`, with the `this` binding and arguments
       * of the created function, while it is called less than `n` times. Subsequent
       * calls to the created function return the result of the last `func` invocation.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {number} n The number of calls at which `func` is no longer invoked.
       * @param {Function} func The function to restrict.
       * @returns {Function} Returns the new restricted function.
       * @example
       *
       * jQuery('#add').on('click', _.before(5, addContactToList));
       * // => allows adding up to 4 contacts to the list
       */
      function before(n, func) {
        var result;
        if (!isFunction(func)) {
          if (isFunction(n)) {
            var temp = n;
            n = func;
            func = temp;
          } else {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
        }
        return function () {
          if (--n > 0) {
            result = func.apply(this, arguments);
          } else {
            func = null;
          }
          return result;
        };
      }

      /**
       * Creates a function that invokes `func` with the `this` binding of `thisArg`
       * and prepends any additional `_.bind` arguments to those provided to the
       * bound function.
       *
       * The `_.bind.placeholder` value, which defaults to `_` in monolithic builds,
       * may be used as a placeholder for partially applied arguments.
       *
       * **Note:** Unlike native `Function#bind` this method does not set the `length`
       * property of bound functions.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to bind.
       * @param {*} thisArg The `this` binding of `func`.
       * @param {...*} [args] The arguments to be partially applied.
       * @returns {Function} Returns the new bound function.
       * @example
       *
       * var greet = function(greeting, punctuation) {
       *   return greeting + ' ' + this.user + punctuation;
       * };
       *
       * var object = { 'user': 'fred' };
       *
       * var bound = _.bind(greet, object, 'hi');
       * bound('!');
       * // => 'hi fred!'
       *
       * // using placeholders
       * var bound = _.bind(greet, object, _, '!');
       * bound('hi');
       * // => 'hi fred!'
       */
      function bind(func, thisArg) {
        var bitmask = BIND_FLAG;
        if (arguments.length > 2) {
          var partials = baseSlice(arguments, 2),
            holders = replaceHolders(partials, bind.placeholder);

          bitmask |= PARTIAL_FLAG;
        }
        return createWrapper(func, bitmask, thisArg, partials, holders);
      }

      /**
       * Binds methods of an object to the object itself, overwriting the existing
       * method. Method names may be specified as individual arguments or as arrays
       * of method names. If no method names are provided all enumerable function
       * properties, own and inherited, of `object` are bound.
       *
       * **Note:** This method does not set the `length` property of bound functions.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Object} object The object to bind and assign the bound methods to.
       * @param {...(string|string[])} [methodNames] The object method names to bind,
       *  specified as individual method names or arrays of method names.
       * @returns {Object} Returns `object`.
       * @example
       *
       * var view = {
       *   'label': 'docs',
       *   'onClick': function() { console.log('clicked ' + this.label); }
       * };
       *
       * _.bindAll(view);
       * jQuery('#docs').on('click', view.onClick);
       * // => logs 'clicked docs' when the element is clicked
       */
      function bindAll(object) {
        return baseBindAll(
          object,
          arguments.length > 1
            ? baseFlatten(arguments, false, false, 1)
            : functions(object),
        );
      }

      /**
       * Creates a function that invokes the method at `object[key]` and prepends
       * any additional `_.bindKey` arguments to those provided to the bound function.
       *
       * This method differs from `_.bind` by allowing bound functions to reference
       * methods that may be redefined or don't yet exist.
       * See [Peter Michaux's article](http://michaux.ca/articles/lazy-function-definition-pattern)
       * for more details.
       *
       * The `_.bindKey.placeholder` value, which defaults to `_` in monolithic
       * builds, may be used as a placeholder for partially applied arguments.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Object} object The object the method belongs to.
       * @param {string} key The key of the method.
       * @param {...*} [args] The arguments to be partially applied.
       * @returns {Function} Returns the new bound function.
       * @example
       *
       * var object = {
       *   'user': 'fred',
       *   'greet': function(greeting, punctuation) {
       *     return greeting + ' ' + this.user + punctuation;
       *   }
       * };
       *
       * var bound = _.bindKey(object, 'greet', 'hi');
       * bound('!');
       * // => 'hi fred!'
       *
       * object.greet = function(greeting, punctuation) {
       *   return greeting + 'ya ' + this.user + punctuation;
       * };
       *
       * bound('!');
       * // => 'hiya fred!'
       *
       * // using placeholders
       * var bound = _.bindKey(object, 'greet', _, '!');
       * bound('hi');
       * // => 'hiya fred!'
       */
      function bindKey(object, key) {
        var bitmask = BIND_FLAG | BIND_KEY_FLAG;
        if (arguments.length > 2) {
          var partials = baseSlice(arguments, 2),
            holders = replaceHolders(partials, bindKey.placeholder);

          bitmask |= PARTIAL_FLAG;
        }
        return createWrapper(key, bitmask, object, partials, holders);
      }

      /**
       * Creates a function that accepts one or more arguments of `func` that when
       * called either invokes `func` returning its result, if all `func` arguments
       * have been provided, or returns a function that accepts one or more of the
       * remaining `func` arguments, and so on. The arity of `func` may be specified
       * if `func.length` is not sufficient.
       *
       * The `_.curry.placeholder` value, which defaults to `_` in monolithic builds,
       * may be used as a placeholder for provided arguments.
       *
       * **Note:** This method does not set the `length` property of curried functions.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to curry.
       * @param {number} [arity=func.length] The arity of `func`.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Function} Returns the new curried function.
       * @example
       *
       * var abc = function(a, b, c) {
       *   return [a, b, c];
       * };
       *
       * var curried = _.curry(abc);
       *
       * curried(1)(2)(3);
       * // => [1, 2, 3]
       *
       * curried(1, 2)(3);
       * // => [1, 2, 3]
       *
       * curried(1, 2, 3);
       * // => [1, 2, 3]
       *
       * // using placeholders
       * curried(1)(_, 3)(2);
       * // => [1, 2, 3]
       */
      function curry(func, arity, guard) {
        if (guard && isIterateeCall(func, arity, guard)) {
          arity = null;
        }
        var result = createWrapper(
          func,
          CURRY_FLAG,
          null,
          null,
          null,
          null,
          null,
          arity,
        );
        result.placeholder = curry.placeholder;
        return result;
      }

      /**
       * This method is like `_.curry` except that arguments are applied to `func`
       * in the manner of `_.partialRight` instead of `_.partial`.
       *
       * The `_.curryRight.placeholder` value, which defaults to `_` in monolithic
       * builds, may be used as a placeholder for provided arguments.
       *
       * **Note:** This method does not set the `length` property of curried functions.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to curry.
       * @param {number} [arity=func.length] The arity of `func`.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Function} Returns the new curried function.
       * @example
       *
       * var abc = function(a, b, c) {
       *   return [a, b, c];
       * };
       *
       * var curried = _.curryRight(abc);
       *
       * curried(3)(2)(1);
       * // => [1, 2, 3]
       *
       * curried(2, 3)(1);
       * // => [1, 2, 3]
       *
       * curried(1, 2, 3);
       * // => [1, 2, 3]
       *
       * // using placeholders
       * curried(3)(1, _)(2);
       * // => [1, 2, 3]
       */
      function curryRight(func, arity, guard) {
        if (guard && isIterateeCall(func, arity, guard)) {
          arity = null;
        }
        var result = createWrapper(
          func,
          CURRY_RIGHT_FLAG,
          null,
          null,
          null,
          null,
          null,
          arity,
        );
        result.placeholder = curryRight.placeholder;
        return result;
      }

      /**
       * Creates a function that delays invoking `func` until after `wait` milliseconds
       * have elapsed since the last time it was invoked. The created function comes
       * with a `cancel` method to cancel delayed invocations. Provide an options
       * object to indicate that `func` should be invoked on the leading and/or
       * trailing edge of the `wait` timeout. Subsequent calls to the debounced
       * function return the result of the last `func` invocation.
       *
       * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
       * on the trailing edge of the timeout only if the the debounced function is
       * invoked more than once during the `wait` timeout.
       *
       * See [David Corbacho's article](http://drupalmotion.com/article/debounce-and-throttle-visual-explanation)
       * for details over the differences between `_.debounce` and `_.throttle`.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to debounce.
       * @param {number} wait The number of milliseconds to delay.
       * @param {Object} [options] The options object.
       * @param {boolean} [options.leading=false] Specify invoking on the leading
       *  edge of the timeout.
       * @param {number} [options.maxWait] The maximum time `func` is allowed to be
       *  delayed before it is invoked.
       * @param {boolean} [options.trailing=true] Specify invoking on the trailing
       *  edge of the timeout.
       * @returns {Function} Returns the new debounced function.
       * @example
       *
       * // avoid costly calculations while the window size is in flux
       * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
       *
       * // invoke `sendMail` when the click event is fired, debouncing subsequent calls
       * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
       *   'leading': true,
       *   'trailing': false
       * }));
       *
       * // ensure `batchLog` is invoked once after 1 second of debounced calls
       * var source = new EventSource('/stream');
       * jQuery(source).on('message', _.debounce(batchLog, 250, {
       *   'maxWait': 1000
       * }));
       *
       * // cancel a debounced call
       * var todoChanges = _.debounce(batchLog, 1000);
       * Object.observe(models.todo, todoChanges);
       *
       * Object.observe(models, function(changes) {
       *   if (_.find(changes, { 'user': 'todo', 'type': 'delete'})) {
       *     todoChanges.cancel();
       *   }
       * }, ['delete']);
       *
       * // ...at some point `models.todo` is changed
       * models.todo.completed = true;
       *
       * // ...before 1 second has passed `models.todo` is deleted
       * // which cancels the debounced `todoChanges` call
       * delete models.todo;
       */
      function debounce(func, wait, options) {
        var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

        if (!isFunction(func)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        wait = wait < 0 ? 0 : wait;
        if (options === true) {
          var leading = true;
          trailing = false;
        } else if (isObject(options)) {
          leading = options.leading;
          maxWait =
            "maxWait" in options && nativeMax(+options.maxWait || 0, wait);
          trailing = "trailing" in options ? options.trailing : trailing;
        }

        function cancel() {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          maxTimeoutId = timeoutId = trailingCall = undefined;
        }

        function delayed() {
          var remaining = wait - (now() - stamp);
          if (remaining <= 0 || remaining > wait) {
            if (maxTimeoutId) {
              clearTimeout(maxTimeoutId);
            }
            var isCalled = trailingCall;
            maxTimeoutId = timeoutId = trailingCall = undefined;
            if (isCalled) {
              lastCalled = now();
              result = func.apply(thisArg, args);
              if (!timeoutId && !maxTimeoutId) {
                args = thisArg = null;
              }
            }
          } else {
            timeoutId = setTimeout(delayed, remaining);
          }
        }

        function maxDelayed() {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (trailing || maxWait !== wait) {
            lastCalled = now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        }

        function debounced() {
          args = arguments;
          stamp = now();
          thisArg = this;
          trailingCall = trailing && (timeoutId || !leading);

          if (maxWait === false) {
            var leadingCall = leading && !timeoutId;
          } else {
            if (!maxTimeoutId && !leading) {
              lastCalled = stamp;
            }
            var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0 || remaining > maxWait;

            if (isCalled) {
              if (maxTimeoutId) {
                maxTimeoutId = clearTimeout(maxTimeoutId);
              }
              lastCalled = stamp;
              result = func.apply(thisArg, args);
            } else if (!maxTimeoutId) {
              maxTimeoutId = setTimeout(maxDelayed, remaining);
            }
          }
          if (isCalled && timeoutId) {
            timeoutId = clearTimeout(timeoutId);
          } else if (!timeoutId && wait !== maxWait) {
            timeoutId = setTimeout(delayed, wait);
          }
          if (leadingCall) {
            isCalled = true;
            result = func.apply(thisArg, args);
          }
          if (isCalled && !timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
          return result;
        }
        debounced.cancel = cancel;
        return debounced;
      }

      /**
       * Defers invoking the `func` until the current call stack has cleared. Any
       * additional arguments are provided to `func` when it is invoked.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to defer.
       * @param {...*} [args] The arguments to invoke the function with.
       * @returns {number} Returns the timer id.
       * @example
       *
       * _.defer(function(text) { console.log(text); }, 'deferred');
       * // logs 'deferred' after one or more milliseconds
       */
      function defer(func) {
        return baseDelay(func, 1, arguments, 1);
      }

      /**
       * Invokes `func` after `wait` milliseconds. Any additional arguments are
       * provided to `func` when it is invoked.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to delay.
       * @param {number} wait The number of milliseconds to delay invocation.
       * @param {...*} [args] The arguments to invoke the function with.
       * @returns {number} Returns the timer id.
       * @example
       *
       * _.delay(function(text) { console.log(text); }, 1000, 'later');
       * // => logs 'later' after one second
       */
      function delay(func, wait) {
        return baseDelay(func, wait, arguments, 2);
      }

      /**
       * Creates a function that returns the result of invoking the provided
       * functions with the `this` binding of the created function, where each
       * successive invocation is supplied the return value of the previous.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {...Function} [funcs] Functions to invoke.
       * @returns {Function} Returns the new function.
       * @example
       *
       * function add(x, y) {
       *   return x + y;
       * }
       *
       * function square(n) {
       *   return n * n;
       * }
       *
       * var addSquare = _.flow(add, square);
       * addSquare(1, 2);
       * // => 9
       */
      function flow() {
        var funcs = arguments,
          length = funcs.length;

        if (!length) {
          return function () {};
        }
        if (!arrayEvery(funcs, isFunction)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        return function () {
          var index = 0,
            result = funcs[index].apply(this, arguments);

          while (++index < length) {
            result = funcs[index].call(this, result);
          }
          return result;
        };
      }

      /**
       * This method is like `_.flow` except that it creates a function that
       * invokes the provided functions from right to left.
       *
       * @static
       * @memberOf _
       * @alias backflow, compose
       * @category Function
       * @param {...Function} [funcs] Functions to invoke.
       * @returns {Function} Returns the new function.
       * @example
       *
       * function add(x, y) {
       *   return x + y;
       * }
       *
       * function square(n) {
       *   return n * n;
       * }
       *
       * var addSquare = _.flowRight(square, add);
       * addSquare(1, 2);
       * // => 9
       */
      function flowRight() {
        var funcs = arguments,
          fromIndex = funcs.length - 1;

        if (fromIndex < 0) {
          return function () {};
        }
        if (!arrayEvery(funcs, isFunction)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        return function () {
          var index = fromIndex,
            result = funcs[index].apply(this, arguments);

          while (index--) {
            result = funcs[index].call(this, result);
          }
          return result;
        };
      }

      /**
       * Creates a function that memoizes the result of `func`. If `resolver` is
       * provided it determines the cache key for storing the result based on the
       * arguments provided to the memoized function. By default, the first argument
       * provided to the memoized function is coerced to a string and used as the
       * cache key. The `func` is invoked with the `this` binding of the memoized
       * function.
       *
       * **Note:** The cache is exposed as the `cache` property on the memoized
       * function. Its creation may be customized by replacing the `_.memoize.Cache`
       * constructor with one whose instances implement the ES `Map` method interface
       * of `get`, `has`, and `set`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-properties-of-the-map-prototype-object)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to have its output memoized.
       * @param {Function} [resolver] The function to resolve the cache key.
       * @returns {Function} Returns the new memoizing function.
       * @example
       *
       * var upperCase = _.memoize(function(string) {
       *   return string.toUpperCase();
       * });
       *
       * upperCase('fred');
       * // => 'FRED'
       *
       * // modifying the result cache
       * upperCase.cache.set('fred', 'BARNEY');
       * upperCase('fred');
       * // => 'BARNEY'
       *
       * // replacing `_.memoize.Cache`
       * var object = { 'user': 'fred' };
       * var other = { 'user': 'barney' };
       * var identity = _.memoize(_.identity);
       *
       * identity(object);
       * // => { 'user': 'fred' }
       * identity(other);
       * // => { 'user': 'fred' }
       *
       * _.memoize.Cache = WeakMap;
       * var identity = _.memoize(_.identity);
       *
       * identity(object);
       * // => { 'user': 'fred' }
       * identity(other);
       * // => { 'user': 'barney' }
       */
      function memoize(func, resolver) {
        if (!isFunction(func) || (resolver && !isFunction(resolver))) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        var memoized = function () {
          var cache = memoized.cache,
            key = resolver ? resolver.apply(this, arguments) : arguments[0];

          if (cache.has(key)) {
            return cache.get(key);
          }
          var result = func.apply(this, arguments);
          cache.set(key, result);
          return result;
        };
        memoized.cache = new memoize.Cache();
        return memoized;
      }

      /**
       * Creates a function that negates the result of the predicate `func`. The
       * `func` predicate is invoked with the `this` binding and arguments of the
       * created function.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} predicate The predicate to negate.
       * @returns {Function} Returns the new function.
       * @example
       *
       * function isEven(n) {
       *   return n % 2 == 0;
       * }
       *
       * _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
       * // => [1, 3, 5]
       */
      function negate(predicate) {
        if (!isFunction(predicate)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        return function () {
          return !predicate.apply(this, arguments);
        };
      }

      /**
       * Creates a function that is restricted to invoking `func` once. Repeat calls
       * to the function return the value of the first call. The `func` is invoked
       * with the `this` binding of the created function.
       *
       * @static
       * @memberOf _
       * @type Function
       * @category Function
       * @param {Function} func The function to restrict.
       * @returns {Function} Returns the new restricted function.
       * @example
       *
       * var initialize = _.once(createApplication);
       * initialize();
       * initialize();
       * // `initialize` invokes `createApplication` once
       */
      function once(func) {
        return before(func, 2);
      }

      /**
       * Creates a function that invokes `func` with `partial` arguments prepended
       * to those provided to the new function. This method is like `_.bind` except
       * it does **not** alter the `this` binding.
       *
       * The `_.partial.placeholder` value, which defaults to `_` in monolithic
       * builds, may be used as a placeholder for partially applied arguments.
       *
       * **Note:** This method does not set the `length` property of partially
       * applied functions.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to partially apply arguments to.
       * @param {...*} [args] The arguments to be partially applied.
       * @returns {Function} Returns the new partially applied function.
       * @example
       *
       * var greet = function(greeting, name) {
       *   return greeting + ' ' + name;
       * };
       *
       * var sayHelloTo = _.partial(greet, 'hello');
       * sayHelloTo('fred');
       * // => 'hello fred'
       *
       * // using placeholders
       * var greetFred = _.partial(greet, _, 'fred');
       * greetFred('hi');
       * // => 'hi fred'
       */
      function partial(func) {
        var partials = baseSlice(arguments, 1),
          holders = replaceHolders(partials, partial.placeholder);

        return createWrapper(func, PARTIAL_FLAG, null, partials, holders);
      }

      /**
       * This method is like `_.partial` except that partially applied arguments
       * are appended to those provided to the new function.
       *
       * The `_.partialRight.placeholder` value, which defaults to `_` in monolithic
       * builds, may be used as a placeholder for partially applied arguments.
       *
       * **Note:** This method does not set the `length` property of partially
       * applied functions.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to partially apply arguments to.
       * @param {...*} [args] The arguments to be partially applied.
       * @returns {Function} Returns the new partially applied function.
       * @example
       *
       * var greet = function(greeting, name) {
       *   return greeting + ' ' + name;
       * };
       *
       * var greetFred = _.partialRight(greet, 'fred');
       * greetFred('hi');
       * // => 'hi fred'
       *
       * // using placeholders
       * var sayHelloTo = _.partialRight(greet, 'hello', _);
       * sayHelloTo('fred');
       * // => 'hello fred'
       */
      function partialRight(func) {
        var partials = baseSlice(arguments, 1),
          holders = replaceHolders(partials, partialRight.placeholder);

        return createWrapper(func, PARTIAL_RIGHT_FLAG, null, partials, holders);
      }

      /**
       * Creates a function that invokes `func` with arguments arranged according
       * to the specified indexes where the argument value at the first index is
       * provided as the first argument, the argument value at the second index is
       * provided as the second argument, and so on.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to rearrange arguments for.
       * @param {...(number|number[])} indexes The arranged argument indexes,
       *  specified as individual indexes or arrays of indexes.
       * @returns {Function} Returns the new function.
       * @example
       *
       * var rearged = _.rearg(function(a, b, c) {
       *   return [a, b, c];
       * }, 2, 0, 1);
       *
       * rearged('b', 'c', 'a')
       * // => ['a', 'b', 'c']
       *
       * var map = _.rearg(_.map, [1, 0]);
       * map(function(n) { return n * 3; }, [1, 2, 3]);
       * // => [3, 6, 9]
       */
      function rearg(func) {
        var indexes = baseFlatten(arguments, false, false, 1);
        return createWrapper(func, REARG_FLAG, null, null, null, indexes);
      }

      /**
       * Creates a function that only invokes `func` at most once per every `wait`
       * milliseconds. The created function comes with a `cancel` method to cancel
       * delayed invocations. Provide an options object to indicate that `func`
       * should be invoked on the leading and/or trailing edge of the `wait` timeout.
       * Subsequent calls to the throttled function return the result of the last
       * `func` call.
       *
       * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
       * on the trailing edge of the timeout only if the the throttled function is
       * invoked more than once during the `wait` timeout.
       *
       * See [David Corbacho's article](http://drupalmotion.com/article/debounce-and-throttle-visual-explanation)
       * for details over the differences between `_.throttle` and `_.debounce`.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {Function} func The function to throttle.
       * @param {number} wait The number of milliseconds to throttle invocations to.
       * @param {Object} [options] The options object.
       * @param {boolean} [options.leading=true] Specify invoking on the leading
       *  edge of the timeout.
       * @param {boolean} [options.trailing=true] Specify invoking on the trailing
       *  edge of the timeout.
       * @returns {Function} Returns the new throttled function.
       * @example
       *
       * // avoid excessively updating the position while scrolling
       * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
       *
       * // invoke `renewToken` when the click event is fired, but not more than once every 5 minutes
       * var throttled =  _.throttle(renewToken, 300000, { 'trailing': false })
       * jQuery('.interactive').on('click', throttled);
       *
       * // cancel a trailing throttled call
       * jQuery(window).on('popstate', throttled.cancel);
       */
      function throttle(func, wait, options) {
        var leading = true,
          trailing = true;

        if (!isFunction(func)) {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        if (options === false) {
          leading = false;
        } else if (isObject(options)) {
          leading = "leading" in options ? !!options.leading : leading;
          trailing = "trailing" in options ? !!options.trailing : trailing;
        }
        debounceOptions.leading = leading;
        debounceOptions.maxWait = +wait;
        debounceOptions.trailing = trailing;
        return debounce(func, wait, debounceOptions);
      }

      /**
       * Creates a function that provides `value` to the wrapper function as its
       * first argument. Any additional arguments provided to the function are
       * appended to those provided to the wrapper function. The wrapper is invoked
       * with the `this` binding of the created function.
       *
       * @static
       * @memberOf _
       * @category Function
       * @param {*} value The value to wrap.
       * @param {Function} wrapper The wrapper function.
       * @returns {Function} Returns the new function.
       * @example
       *
       * var p = _.wrap(_.escape, function(func, text) {
       *   return '<p>' + func(text) + '</p>';
       * });
       *
       * p('fred, barney, & pebbles');
       * // => '<p>fred, barney, &amp; pebbles</p>'
       */
      function wrap(value, wrapper) {
        wrapper = wrapper == null ? identity : wrapper;
        return createWrapper(wrapper, PARTIAL_FLAG, null, [value], []);
      }

      /*------------------------------------------------------------------------*/

      /**
       * Creates a clone of `value`. If `isDeep` is `true` nested objects are cloned,
       * otherwise they are assigned by reference. If `customizer` is provided it is
       * invoked to produce the cloned values. If `customizer` returns `undefined`
       * cloning is handled by the method instead. The `customizer` is bound to
       * `thisArg` and invoked with two argument; (value [, index|key, object]).
       *
       * **Note:** This method is loosely based on the structured clone algorithm.
       * The enumerable properties of `arguments` objects and objects created by
       * constructors other than `Object` are cloned to plain `Object` objects. An
       * empty object is returned for uncloneable values such as functions, DOM nodes,
       * Maps, Sets, and WeakMaps. See the [HTML5 specification](http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to clone.
       * @param {boolean} [isDeep] Specify a deep clone.
       * @param {Function} [customizer] The function to customize cloning values.
       * @param {*} [thisArg] The `this` binding of `customizer`.
       * @returns {*} Returns the cloned value.
       * @example
       *
       * var users = [
       *   { 'user': 'barney' },
       *   { 'user': 'fred' }
       * ];
       *
       * var shallow = _.clone(users);
       * shallow[0] === users[0];
       * // => true
       *
       * var deep = _.clone(users, true);
       * deep[0] === users[0];
       * // => false
       *
       * // using a customizer callback
       * var body = _.clone(document.body, function(value) {
       *   return _.isElement(value) ? value.cloneNode(false) : undefined;
       * });
       *
       * body === document.body
       * // => false
       * body.nodeName
       * // => BODY
       * body.childNodes.length;
       * // => 0
       */
      function clone(value, isDeep, customizer, thisArg) {
        // Juggle arguments.
        if (typeof isDeep != "boolean" && isDeep != null) {
          thisArg = customizer;
          customizer = isIterateeCall(value, isDeep, thisArg) ? null : isDeep;
          isDeep = false;
        }
        customizer =
          typeof customizer == "function" &&
          bindCallback(customizer, thisArg, 1);
        return baseClone(value, isDeep, customizer);
      }

      /**
       * Creates a deep clone of `value`. If `customizer` is provided it is invoked
       * to produce the cloned values. If `customizer` returns `undefined` cloning
       * is handled by the method instead. The `customizer` is bound to `thisArg`
       * and invoked with two argument; (value [, index|key, object]).
       *
       * **Note:** This method is loosely based on the structured clone algorithm.
       * The enumerable properties of `arguments` objects and objects created by
       * constructors other than `Object` are cloned to plain `Object` objects. An
       * empty object is returned for uncloneable values such as functions, DOM nodes,
       * Maps, Sets, and WeakMaps. See the [HTML5 specification](http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to deep clone.
       * @param {Function} [customizer] The function to customize cloning values.
       * @param {*} [thisArg] The `this` binding of `customizer`.
       * @returns {*} Returns the deep cloned value.
       * @example
       *
       * var users = [
       *   { 'user': 'barney' },
       *   { 'user': 'fred' }
       * ];
       *
       * var deep = _.cloneDeep(users);
       * deep[0] === users[0];
       * // => false
       *
       * // using a customizer callback
       * var el = _.cloneDeep(document.body, function(value) {
       *   return _.isElement(value) ? value.cloneNode(true) : undefined;
       * });
       *
       * body === document.body
       * // => false
       * body.nodeName
       * // => BODY
       * body.childNodes.length;
       * // => 20
       */
      function cloneDeep(value, customizer, thisArg) {
        customizer =
          typeof customizer == "function" &&
          bindCallback(customizer, thisArg, 1);
        return baseClone(value, true, customizer);
      }

      /**
       * Checks if `value` is classified as an `arguments` object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * (function() { return _.isArguments(arguments); })();
       * // => true
       *
       * _.isArguments([1, 2, 3]);
       * // => false
       */
      function isArguments(value) {
        var length = isObjectLike(value) ? value.length : undefined;
        return (
          (isLength(length) && objToString.call(value) == argsTag) || false
        );
      }

      /**
       * Checks if `value` is classified as an `Array` object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isArray([1, 2, 3]);
       * // => true
       *
       * (function() { return _.isArray(arguments); })();
       * // => false
       */
      var isArray =
        nativeIsArray ||
        function (value) {
          return (
            (isObjectLike(value) &&
              isLength(value.length) &&
              objToString.call(value) == arrayTag) ||
            false
          );
        };

      /**
       * Checks if `value` is classified as a boolean primitive or object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isBoolean(false);
       * // => true
       *
       * _.isBoolean(null);
       * // => false
       */
      function isBoolean(value) {
        return (
          value === true ||
          value === false ||
          (isObjectLike(value) && objToString.call(value) == boolTag) ||
          false
        );
      }

      /**
       * Checks if `value` is classified as a `Date` object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isDate(new Date);
       * // => true
       *
       * _.isDate('Mon April 23 2012');
       * // => false
       */
      function isDate(value) {
        return (
          (isObjectLike(value) && objToString.call(value) == dateTag) || false
        );
      }

      /**
       * Checks if `value` is a DOM element.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a DOM element, else `false`.
       * @example
       *
       * _.isElement(document.body);
       * // => true
       *
       * _.isElement('<body>');
       * // => false
       */
      function isElement(value) {
        return (
          (value &&
            value.nodeType === 1 &&
            isObjectLike(value) &&
            objToString.call(value).indexOf("Element") > -1) ||
          false
        );
      }
      // Fallback for environments without DOM support.
      if (!support.dom) {
        isElement = function (value) {
          return (
            (value &&
              value.nodeType === 1 &&
              isObjectLike(value) &&
              !isPlainObject(value)) ||
            false
          );
        };
      }

      /**
       * Checks if a value is empty. A value is considered empty unless it is an
       * `arguments` object, array, string, or jQuery-like collection with a length
       * greater than `0` or an object with own enumerable properties.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {Array|Object|string} value The value to inspect.
       * @returns {boolean} Returns `true` if `value` is empty, else `false`.
       * @example
       *
       * _.isEmpty(null);
       * // => true
       *
       * _.isEmpty(true);
       * // => true
       *
       * _.isEmpty(1);
       * // => true
       *
       * _.isEmpty([1, 2, 3]);
       * // => false
       *
       * _.isEmpty({ 'a': 1 });
       * // => false
       */
      function isEmpty(value) {
        if (value == null) {
          return true;
        }
        var length = value.length;
        if (
          isLength(length) &&
          (isArray(value) ||
            isString(value) ||
            isArguments(value) ||
            (isObjectLike(value) && isFunction(value.splice)))
        ) {
          return !length;
        }
        return !keys(value).length;
      }

      /**
       * Performs a deep comparison between two values to determine if they are
       * equivalent. If `customizer` is provided it is invoked to compare values.
       * If `customizer` returns `undefined` comparisons are handled by the method
       * instead. The `customizer` is bound to `thisArg` and invoked with three
       * arguments; (value, other [, index|key]).
       *
       * **Note:** This method supports comparing arrays, booleans, `Date` objects,
       * numbers, `Object` objects, regexes, and strings. Functions and DOM nodes
       * are **not** supported. Provide a customizer function to extend support
       * for comparing other values.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to compare.
       * @param {*} other The other value to compare.
       * @param {Function} [customizer] The function to customize comparing values.
       * @param {*} [thisArg] The `this` binding of `customizer`.
       * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
       * @example
       *
       * var object = { 'user': 'fred' };
       * var other = { 'user': 'fred' };
       *
       * object == other;
       * // => false
       *
       * _.isEqual(object, other);
       * // => true
       *
       * // using a customizer callback
       * var array = ['hello', 'goodbye'];
       * var other = ['hi', 'goodbye'];
       *
       * _.isEqual(array, other, function(value, other) {
       *   return _.every([value, other], RegExp.prototype.test, /^h(?:i|ello)$/) || undefined;
       * });
       * // => true
       */
      function isEqual(value, other, customizer, thisArg) {
        customizer =
          typeof customizer == "function" &&
          bindCallback(customizer, thisArg, 3);
        if (
          !customizer &&
          isStrictComparable(value) &&
          isStrictComparable(other)
        ) {
          return value === other;
        }
        var result = customizer ? customizer(value, other) : undefined;
        return typeof result == "undefined"
          ? baseIsEqual(value, other, customizer)
          : !!result;
      }

      /**
       * Checks if `value` is an `Error`, `EvalError`, `RangeError`, `ReferenceError`,
       * `SyntaxError`, `TypeError`, or `URIError` object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is an error object, else `false`.
       * @example
       *
       * _.isError(new Error);
       * // => true
       *
       * _.isError(Error);
       * // => false
       */
      function isError(value) {
        return (
          (isObjectLike(value) &&
            typeof value.message == "string" &&
            objToString.call(value) == errorTag) ||
          false
        );
      }

      /**
       * Checks if `value` is a finite primitive number.
       *
       * **Note:** This method is based on ES `Number.isFinite`. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.isfinite)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a finite number, else `false`.
       * @example
       *
       * _.isFinite(10);
       * // => true
       *
       * _.isFinite('10');
       * // => false
       *
       * _.isFinite(true);
       * // => false
       *
       * _.isFinite(Object(10));
       * // => false
       *
       * _.isFinite(Infinity);
       * // => false
       */
      var isFinite =
        nativeNumIsFinite ||
        function (value) {
          return typeof value == "number" && nativeIsFinite(value);
        };

      /**
       * Checks if `value` is classified as a `Function` object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isFunction(_);
       * // => true
       *
       * _.isFunction(/abc/);
       * // => false
       */
      function isFunction(value) {
        // Avoid a Chakra JIT bug in compatibility modes of IE 11.
        // See https://github.com/jashkenas/underscore/issues/1621 for more details.
        return typeof value == "function" || false;
      }
      // Fallback for environments that return incorrect `typeof` operator results.
      if (isFunction(/x/) || (Uint8Array && !isFunction(Uint8Array))) {
        isFunction = function (value) {
          // The use of `Object#toString` avoids issues with the `typeof` operator
          // in older versions of Chrome and Safari which return 'function' for regexes
          // and Safari 8 equivalents which return 'object' for typed array constructors.
          return objToString.call(value) == funcTag;
        };
      }

      /**
       * Checks if `value` is the language type of `Object`.
       * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
       *
       * **Note:** See the [ES5 spec](https://es5.github.io/#x8) for more details.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is an object, else `false`.
       * @example
       *
       * _.isObject({});
       * // => true
       *
       * _.isObject([1, 2, 3]);
       * // => true
       *
       * _.isObject(1);
       * // => false
       */
      function isObject(value) {
        // Avoid a V8 JIT bug in Chrome 19-20.
        // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
        var type = typeof value;
        return type == "function" || (value && type == "object") || false;
      }

      /**
       * Performs a deep comparison between `object` and `source` to determine if
       * `object` contains equivalent property values. If `customizer` is provided
       * it is invoked to compare values. If `customizer` returns `undefined`
       * comparisons are handled by the method instead. The `customizer` is bound
       * to `thisArg` and invoked with three arguments; (value, other, index|key).
       *
       * **Note:** This method supports comparing properties of arrays, booleans,
       * `Date` objects, numbers, `Object` objects, regexes, and strings. Functions
       * and DOM nodes are **not** supported. Provide a customizer function to extend
       * support for comparing other values.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {Object} source The object to inspect.
       * @param {Object} source The object of property values to match.
       * @param {Function} [customizer] The function to customize comparing values.
       * @param {*} [thisArg] The `this` binding of `customizer`.
       * @returns {boolean} Returns `true` if `object` is a match, else `false`.
       * @example
       *
       * var object = { 'user': 'fred', 'age': 40 };
       *
       * _.isMatch(object, { 'age': 40 });
       * // => true
       *
       * _.isMatch(object, { 'age': 36 });
       * // => false
       *
       * // using a customizer callback
       * var object = { 'greeting': 'hello' };
       * var source = { 'greeting': 'hi' };
       *
       * _.isMatch(object, source, function(value, other) {
       *   return _.every([value, other], RegExp.prototype.test, /^h(?:i|ello)$/) || undefined;
       * });
       * // => true
       */
      function isMatch(object, source, customizer, thisArg) {
        var props = keys(source),
          length = props.length;

        customizer =
          typeof customizer == "function" &&
          bindCallback(customizer, thisArg, 3);
        if (!customizer && length == 1) {
          var key = props[0],
            value = source[key];

          if (isStrictComparable(value)) {
            return (
              object != null &&
              value === object[key] &&
              hasOwnProperty.call(object, key)
            );
          }
        }
        var values = Array(length),
          strictCompareFlags = Array(length);

        while (length--) {
          value = values[length] = source[props[length]];
          strictCompareFlags[length] = isStrictComparable(value);
        }
        return baseIsMatch(
          object,
          props,
          values,
          strictCompareFlags,
          customizer,
        );
      }

      /**
       * Checks if `value` is `NaN`.
       *
       * **Note:** This method is not the same as native `isNaN` which returns `true`
       * for `undefined` and other non-numeric values. See the [ES5 spec](https://es5.github.io/#x15.1.2.4)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
       * @example
       *
       * _.isNaN(NaN);
       * // => true
       *
       * _.isNaN(new Number(NaN));
       * // => true
       *
       * isNaN(undefined);
       * // => true
       *
       * _.isNaN(undefined);
       * // => false
       */
      function isNaN(value) {
        // An `NaN` primitive is the only value that is not equal to itself.
        // Perform the `toStringTag` check first to avoid errors with some host objects in IE.
        return isNumber(value) && value != +value;
      }

      /**
       * Checks if `value` is a native function.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
       * @example
       *
       * _.isNative(Array.prototype.push);
       * // => true
       *
       * _.isNative(_);
       * // => false
       */
      function isNative(value) {
        if (value == null) {
          return false;
        }
        if (objToString.call(value) == funcTag) {
          return reNative.test(fnToString.call(value));
        }
        return (isObjectLike(value) && reHostCtor.test(value)) || false;
      }

      /**
       * Checks if `value` is `null`.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is `null`, else `false`.
       * @example
       *
       * _.isNull(null);
       * // => true
       *
       * _.isNull(void 0);
       * // => false
       */
      function isNull(value) {
        return value === null;
      }

      /**
       * Checks if `value` is classified as a `Number` primitive or object.
       *
       * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
       * as numbers, use the `_.isFinite` method.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isNumber(8.4);
       * // => true
       *
       * _.isNumber(NaN);
       * // => true
       *
       * _.isNumber('8.4');
       * // => false
       */
      function isNumber(value) {
        return (
          typeof value == "number" ||
          (isObjectLike(value) && objToString.call(value) == numberTag) ||
          false
        );
      }

      /**
       * Checks if `value` is a plain object, that is, an object created by the
       * `Object` constructor or one with a `[[Prototype]]` of `null`.
       *
       * **Note:** This method assumes objects created by the `Object` constructor
       * have no inherited enumerable properties.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       * }
       *
       * _.isPlainObject(new Foo);
       * // => false
       *
       * _.isPlainObject([1, 2, 3]);
       * // => false
       *
       * _.isPlainObject({ 'x': 0, 'y': 0 });
       * // => true
       *
       * _.isPlainObject(Object.create(null));
       * // => true
       */
      var isPlainObject = !getPrototypeOf
        ? shimIsPlainObject
        : function (value) {
            if (!(value && objToString.call(value) == objectTag)) {
              return false;
            }
            var valueOf = value.valueOf,
              objProto =
                isNative(valueOf) &&
                (objProto = getPrototypeOf(valueOf)) &&
                getPrototypeOf(objProto);

            return objProto
              ? value == objProto || getPrototypeOf(value) == objProto
              : shimIsPlainObject(value);
          };

      /**
       * Checks if `value` is classified as a `RegExp` object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isRegExp(/abc/);
       * // => true
       *
       * _.isRegExp('/abc/');
       * // => false
       */
      function isRegExp(value) {
        return (
          (isObjectLike(value) && objToString.call(value) == regexpTag) || false
        );
      }

      /**
       * Checks if `value` is classified as a `String` primitive or object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isString('abc');
       * // => true
       *
       * _.isString(1);
       * // => false
       */
      function isString(value) {
        return (
          typeof value == "string" ||
          (isObjectLike(value) && objToString.call(value) == stringTag) ||
          false
        );
      }

      /**
       * Checks if `value` is classified as a typed array.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
       * @example
       *
       * _.isTypedArray(new Uint8Array);
       * // => true
       *
       * _.isTypedArray([]);
       * // => false
       */
      function isTypedArray(value) {
        return (
          (isObjectLike(value) &&
            isLength(value.length) &&
            typedArrayTags[objToString.call(value)]) ||
          false
        );
      }

      /**
       * Checks if `value` is `undefined`.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
       * @example
       *
       * _.isUndefined(void 0);
       * // => true
       *
       * _.isUndefined(null);
       * // => false
       */
      function isUndefined(value) {
        return typeof value == "undefined";
      }

      /**
       * Converts `value` to an array.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to convert.
       * @returns {Array} Returns the converted array.
       * @example
       *
       * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3);
       * // => [2, 3]
       */
      function toArray(value) {
        var length = value ? value.length : 0;
        if (!isLength(length)) {
          return values(value);
        }
        if (!length) {
          return [];
        }
        return arrayCopy(value);
      }

      /**
       * Converts `value` to a plain object flattening inherited enumerable
       * properties of `value` to own properties of the plain object.
       *
       * @static
       * @memberOf _
       * @category Lang
       * @param {*} value The value to convert.
       * @returns {Object} Returns the converted plain object.
       * @example
       *
       * function Foo() {
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.assign({ 'a': 1 }, new Foo);
       * // => { 'a': 1, 'b': 2 }
       *
       * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
       * // => { 'a': 1, 'b': 2, 'c': 3 }
       */
      function toPlainObject(value) {
        return baseCopy(value, keysIn(value));
      }

      /*------------------------------------------------------------------------*/

      /**
       * Assigns own enumerable properties of source object(s) to the destination
       * object. Subsequent sources overwrite property assignments of previous sources.
       * If `customizer` is provided it is invoked to produce the assigned values.
       * The `customizer` is bound to `thisArg` and invoked with five arguments;
       * (objectValue, sourceValue, key, object, source).
       *
       * @static
       * @memberOf _
       * @alias extend
       * @category Object
       * @param {Object} object The destination object.
       * @param {...Object} [sources] The source objects.
       * @param {Function} [customizer] The function to customize assigning values.
       * @param {*} [thisArg] The `this` binding of `customizer`.
       * @returns {Object} Returns `object`.
       * @example
       *
       * _.assign({ 'user': 'barney' }, { 'age': 40 }, { 'user': 'fred' });
       * // => { 'user': 'fred', 'age': 40 }
       *
       * // using a customizer callback
       * var defaults = _.partialRight(_.assign, function(value, other) {
       *   return typeof value == 'undefined' ? other : value;
       * });
       *
       * defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
       * // => { 'user': 'barney', 'age': 36 }
       */
      var assign = createAssigner(baseAssign);

      /**
       * Creates an object that inherits from the given `prototype` object. If a
       * `properties` object is provided its own enumerable properties are assigned
       * to the created object.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} prototype The object to inherit from.
       * @param {Object} [properties] The properties to assign to the object.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Object} Returns the new object.
       * @example
       *
       * function Shape() {
       *   this.x = 0;
       *   this.y = 0;
       * }
       *
       * function Circle() {
       *   Shape.call(this);
       * }
       *
       * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
       *
       * var circle = new Circle;
       * circle instanceof Circle;
       * // => true
       *
       * circle instanceof Shape;
       * // => true
       */
      function create(prototype, properties, guard) {
        var result = baseCreate(prototype);
        if (guard && isIterateeCall(prototype, properties, guard)) {
          properties = null;
        }
        return properties
          ? baseCopy(properties, result, keys(properties))
          : result;
      }

      /**
       * Assigns own enumerable properties of source object(s) to the destination
       * object for all destination properties that resolve to `undefined`. Once a
       * property is set, additional defaults of the same property are ignored.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The destination object.
       * @param {...Object} [sources] The source objects.
       * @returns {Object} Returns `object`.
       * @example
       *
       * _.defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
       * // => { 'user': 'barney', 'age': 36 }
       */
      function defaults(object) {
        if (object == null) {
          return object;
        }
        var args = arrayCopy(arguments);
        args.push(assignDefaults);
        return assign.apply(undefined, args);
      }

      /**
       * This method is like `_.findIndex` except that it returns the key of the
       * first element `predicate` returns truthy for, instead of the element itself.
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to search.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {string|undefined} Returns the key of the matched element, else `undefined`.
       * @example
       *
       * var users = {
       *   'barney':  { 'age': 36, 'active': true },
       *   'fred':    { 'age': 40, 'active': false },
       *   'pebbles': { 'age': 1,  'active': true }
       * };
       *
       * _.findKey(users, function(chr) { return chr.age < 40; });
       * // => 'barney' (iteration order is not guaranteed)
       *
       * // using the "_.matches" callback shorthand
       * _.findKey(users, { 'age': 1 });
       * // => 'pebbles'
       *
       * // using the "_.property" callback shorthand
       * _.findKey(users, 'active');
       * // => 'barney'
       */
      function findKey(object, predicate, thisArg) {
        predicate = getCallback(predicate, thisArg, 3);
        return baseFind(object, predicate, baseForOwn, true);
      }

      /**
       * This method is like `_.findKey` except that it iterates over elements of
       * a collection in the opposite order.
       *
       * If a property name is provided for `predicate` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `predicate` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to search.
       * @param {Function|Object|string} [predicate=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {string|undefined} Returns the key of the matched element, else `undefined`.
       * @example
       *
       * var users = {
       *   'barney':  { 'age': 36, 'active': true },
       *   'fred':    { 'age': 40, 'active': false },
       *   'pebbles': { 'age': 1,  'active': true }
       * };
       *
       * _.findLastKey(users, function(chr) { return chr.age < 40; });
       * // => returns `pebbles` assuming `_.findKey` returns `barney`
       *
       * // using the "_.matches" callback shorthand
       * _.findLastKey(users, { 'age': 36 });
       * // => 'barney'
       *
       * // using the "_.property" callback shorthand
       * _.findLastKey(users, 'active');
       * // => 'pebbles'
       */
      function findLastKey(object, predicate, thisArg) {
        predicate = getCallback(predicate, thisArg, 3);
        return baseFind(object, predicate, baseForOwnRight, true);
      }

      /**
       * Iterates over own and inherited enumerable properties of an object invoking
       * `iteratee` for each property. The `iteratee` is bound to `thisArg` and invoked
       * with three arguments; (value, key, object). Iterator functions may exit
       * iteration early by explicitly returning `false`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns `object`.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.forIn(new Foo, function(value, key) {
       *   console.log(key);
       * });
       * // => logs 'a', 'b', and 'c' (iteration order is not guaranteed)
       */
      function forIn(object, iteratee, thisArg) {
        if (typeof iteratee != "function" || typeof thisArg != "undefined") {
          iteratee = bindCallback(iteratee, thisArg, 3);
        }
        return baseFor(object, iteratee, keysIn);
      }

      /**
       * This method is like `_.forIn` except that it iterates over properties of
       * `object` in the opposite order.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns `object`.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.forInRight(new Foo, function(value, key) {
       *   console.log(key);
       * });
       * // => logs 'c', 'b', and 'a' assuming `_.forIn ` logs 'a', 'b', and 'c'
       */
      function forInRight(object, iteratee, thisArg) {
        iteratee = bindCallback(iteratee, thisArg, 3);
        return baseForRight(object, iteratee, keysIn);
      }

      /**
       * Iterates over own enumerable properties of an object invoking `iteratee`
       * for each property. The `iteratee` is bound to `thisArg` and invoked with
       * three arguments; (value, key, object). Iterator functions may exit iteration
       * early by explicitly returning `false`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns `object`.
       * @example
       *
       * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(n, key) {
       *   console.log(key);
       * });
       * // => logs '0', '1', and 'length' (iteration order is not guaranteed)
       */
      function forOwn(object, iteratee, thisArg) {
        if (typeof iteratee != "function" || typeof thisArg != "undefined") {
          iteratee = bindCallback(iteratee, thisArg, 3);
        }
        return baseForOwn(object, iteratee);
      }

      /**
       * This method is like `_.forOwn` except that it iterates over properties of
       * `object` in the opposite order.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns `object`.
       * @example
       *
       * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(n, key) {
       *   console.log(key);
       * });
       * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
       */
      function forOwnRight(object, iteratee, thisArg) {
        iteratee = bindCallback(iteratee, thisArg, 3);
        return baseForRight(object, iteratee, keys);
      }

      /**
       * Creates an array of function property names from all enumerable properties,
       * own and inherited, of `object`.
       *
       * @static
       * @memberOf _
       * @alias methods
       * @category Object
       * @param {Object} object The object to inspect.
       * @returns {Array} Returns the new array of property names.
       * @example
       *
       * _.functions(_);
       * // => ['all', 'any', 'bind', ...]
       */
      function functions(object) {
        return baseFunctions(object, keysIn(object));
      }

      /**
       * Checks if `key` exists as a direct property of `object` instead of an
       * inherited property.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to inspect.
       * @param {string} key The key to check.
       * @returns {boolean} Returns `true` if `key` is a direct property, else `false`.
       * @example
       *
       * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
       * // => true
       */
      function has(object, key) {
        return object ? hasOwnProperty.call(object, key) : false;
      }

      /**
       * Creates an object composed of the inverted keys and values of `object`.
       * If `object` contains duplicate values, subsequent values overwrite property
       * assignments of previous values unless `multiValue` is `true`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to invert.
       * @param {boolean} [multiValue] Allow multiple values per key.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Object} Returns the new inverted object.
       * @example
       *
       * _.invert({ 'first': 'fred', 'second': 'barney' });
       * // => { 'fred': 'first', 'barney': 'second' }
       *
       * // without `multiValue`
       * _.invert({ 'first': 'fred', 'second': 'barney', 'third': 'fred' });
       * // => { 'fred': 'third', 'barney': 'second' }
       *
       * // with `multiValue`
       * _.invert({ 'first': 'fred', 'second': 'barney', 'third': 'fred' }, true);
       * // => { 'fred': ['first', 'third'], 'barney': ['second'] }
       */
      function invert(object, multiValue, guard) {
        if (guard && isIterateeCall(object, multiValue, guard)) {
          multiValue = null;
        }
        var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

        while (++index < length) {
          var key = props[index],
            value = object[key];

          if (multiValue) {
            if (hasOwnProperty.call(result, value)) {
              result[value].push(key);
            } else {
              result[value] = [key];
            }
          } else {
            result[value] = key;
          }
        }
        return result;
      }

      /**
       * Creates an array of the own enumerable property names of `object`.
       *
       * **Note:** Non-object values are coerced to objects. See the
       * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.keys)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to inspect.
       * @returns {Array} Returns the array of property names.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.keys(new Foo);
       * // => ['a', 'b'] (iteration order is not guaranteed)
       *
       * _.keys('hi');
       * // => ['0', '1']
       */
      var keys = !nativeKeys
        ? shimKeys
        : function (object) {
            if (object) {
              var Ctor = object.constructor,
                length = object.length;
            }
            if (
              (typeof Ctor == "function" && Ctor.prototype === object) ||
              (typeof object != "function" && length && isLength(length))
            ) {
              return shimKeys(object);
            }
            return isObject(object) ? nativeKeys(object) : [];
          };

      /**
       * Creates an array of the own and inherited enumerable property names of `object`.
       *
       * **Note:** Non-object values are coerced to objects.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to inspect.
       * @returns {Array} Returns the array of property names.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.keysIn(new Foo);
       * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
       */
      function keysIn(object) {
        if (object == null) {
          return [];
        }
        if (!isObject(object)) {
          object = Object(object);
        }
        var length = object.length;
        length =
          (length &&
            isLength(length) &&
            (isArray(object) || (support.nonEnumArgs && isArguments(object))) &&
            length) ||
          0;

        var Ctor = object.constructor,
          index = -1,
          isProto = typeof Ctor == "function" && Ctor.prototype == object,
          result = Array(length),
          skipIndexes = length > 0;

        while (++index < length) {
          result[index] = index + "";
        }
        for (var key in object) {
          if (
            !(skipIndexes && isIndex(key, length)) &&
            !(
              key == "constructor" &&
              (isProto || !hasOwnProperty.call(object, key))
            )
          ) {
            result.push(key);
          }
        }
        return result;
      }

      /**
       * Creates an object with the same keys as `object` and values generated by
       * running each own enumerable property of `object` through `iteratee`. The
       * iteratee function is bound to `thisArg` and invoked with three arguments;
       * (value, key, object).
       *
       * If a property name is provided for `iteratee` the created "_.property"
       * style callback returns the property value of the given element.
       *
       * If an object is provided for `iteratee` the created "_.matches" style
       * callback returns `true` for elements that have the properties of the given
       * object, else `false`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to iterate over.
       * @param {Function|Object|string} [iteratee=_.identity] The function invoked
       *  per iteration. If a property name or object is provided it is used to
       *  create a "_.property" or "_.matches" style callback respectively.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Object} Returns the new mapped object.
       * @example
       *
       * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(n) { return n * 3; });
       * // => { 'a': 3, 'b': 6, 'c': 9 }
       *
       * var users = {
       *   'fred':    { 'user': 'fred',    'age': 40 },
       *   'pebbles': { 'user': 'pebbles', 'age': 1 }
       * };
       *
       * // using the "_.property" callback shorthand
       * _.mapValues(users, 'age');
       * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
       */
      function mapValues(object, iteratee, thisArg) {
        var result = {};
        iteratee = getCallback(iteratee, thisArg, 3);

        baseForOwn(object, function (value, key, object) {
          result[key] = iteratee(value, key, object);
        });
        return result;
      }

      /**
       * Recursively merges own enumerable properties of the source object(s), that
       * don't resolve to `undefined` into the destination object. Subsequent sources
       * overwrite property assignments of previous sources. If `customizer` is
       * provided it is invoked to produce the merged values of the destination and
       * source properties. If `customizer` returns `undefined` merging is handled
       * by the method instead. The `customizer` is bound to `thisArg` and invoked
       * with five arguments; (objectValue, sourceValue, key, object, source).
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The destination object.
       * @param {...Object} [sources] The source objects.
       * @param {Function} [customizer] The function to customize merging properties.
       * @param {*} [thisArg] The `this` binding of `customizer`.
       * @returns {Object} Returns `object`.
       * @example
       *
       * var users = {
       *   'data': [{ 'user': 'barney' }, { 'user': 'fred' }]
       * };
       *
       * var ages = {
       *   'data': [{ 'age': 36 }, { 'age': 40 }]
       * };
       *
       * _.merge(users, ages);
       * // => { 'data': [{ 'user': 'barney', 'age': 36 }, { 'user': 'fred', 'age': 40 }] }
       *
       * // using a customizer callback
       * var object = {
       *   'fruits': ['apple'],
       *   'vegetables': ['beet']
       * };
       *
       * var other = {
       *   'fruits': ['banana'],
       *   'vegetables': ['carrot']
       * };
       *
       * _.merge(object, other, function(a, b) {
       *   return _.isArray(a) ? a.concat(b) : undefined;
       * });
       * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot'] }
       */
      var merge = createAssigner(baseMerge);

      /**
       * The opposite of `_.pick`; this method creates an object composed of the
       * own and inherited enumerable properties of `object` that are not omitted.
       * Property names may be specified as individual arguments or as arrays of
       * property names. If `predicate` is provided it is invoked for each property
       * of `object` omitting the properties `predicate` returns truthy for. The
       * predicate is bound to `thisArg` and invoked with three arguments;
       * (value, key, object).
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The source object.
       * @param {Function|...(string|string[])} [predicate] The function invoked per
       *  iteration or property names to omit, specified as individual property
       *  names or arrays of property names.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Object} Returns the new object.
       * @example
       *
       * var object = { 'user': 'fred', 'age': 40 };
       *
       * _.omit(object, 'age');
       * // => { 'user': 'fred' }
       *
       * _.omit(object, _.isNumber);
       * // => { 'user': 'fred' }
       */
      function omit(object, predicate, thisArg) {
        if (object == null) {
          return {};
        }
        if (typeof predicate != "function") {
          var props = arrayMap(baseFlatten(arguments, false, false, 1), String);
          return pickByArray(object, baseDifference(keysIn(object), props));
        }
        predicate = bindCallback(predicate, thisArg, 3);
        return pickByCallback(object, function (value, key, object) {
          return !predicate(value, key, object);
        });
      }

      /**
       * Creates a two dimensional array of the key-value pairs for `object`,
       * e.g. `[[key1, value1], [key2, value2]]`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to inspect.
       * @returns {Array} Returns the new array of key-value pairs.
       * @example
       *
       * _.pairs({ 'barney': 36, 'fred': 40 });
       * // => [['barney', 36], ['fred', 40]] (iteration order is not guaranteed)
       */
      function pairs(object) {
        var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

        while (++index < length) {
          var key = props[index];
          result[index] = [key, object[key]];
        }
        return result;
      }

      /**
       * Creates an object composed of the picked `object` properties. Property
       * names may be specified as individual arguments or as arrays of property
       * names. If `predicate` is provided it is invoked for each property of `object`
       * picking the properties `predicate` returns truthy for. The predicate is
       * bound to `thisArg` and invoked with three arguments; (value, key, object).
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The source object.
       * @param {Function|...(string|string[])} [predicate] The function invoked per
       *  iteration or property names to pick, specified as individual property
       *  names or arrays of property names.
       * @param {*} [thisArg] The `this` binding of `predicate`.
       * @returns {Object} Returns the new object.
       * @example
       *
       * var object = { 'user': 'fred', 'age': 40 };
       *
       * _.pick(object, 'user');
       * // => { 'user': 'fred' }
       *
       * _.pick(object, _.isString);
       * // => { 'user': 'fred' }
       */
      function pick(object, predicate, thisArg) {
        if (object == null) {
          return {};
        }
        return typeof predicate == "function"
          ? pickByCallback(object, bindCallback(predicate, thisArg, 3))
          : pickByArray(object, baseFlatten(arguments, false, false, 1));
      }

      /**
       * Resolves the value of property `key` on `object`. If the value of `key` is
       * a function it is invoked with the `this` binding of `object` and its result
       * is returned, else the property value is returned. If the property value is
       * `undefined` the `defaultValue` is used in its place.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to query.
       * @param {string} key The key of the property to resolve.
       * @param {*} [defaultValue] The value returned if the property value
       *  resolves to `undefined`.
       * @returns {*} Returns the resolved value.
       * @example
       *
       * var object = { 'user': 'fred', 'age': _.constant(40) };
       *
       * _.result(object, 'user');
       * // => 'fred'
       *
       * _.result(object, 'age');
       * // => 40
       *
       * _.result(object, 'status', 'busy');
       * // => 'busy'
       *
       * _.result(object, 'status', _.constant('busy'));
       * // => 'busy'
       */
      function result(object, key, defaultValue) {
        var value = object == null ? undefined : object[key];
        if (typeof value == "undefined") {
          value = defaultValue;
        }
        return isFunction(value) ? value.call(object) : value;
      }

      /**
       * An alternative to `_.reduce`; this method transforms `object` to a new
       * `accumulator` object which is the result of running each of its own enumerable
       * properties through `iteratee`, with each invocation potentially mutating
       * the `accumulator` object. The `iteratee` is bound to `thisArg` and invoked
       * with four arguments; (accumulator, value, key, object). Iterator functions
       * may exit iteration early by explicitly returning `false`.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Array|Object} object The object to iterate over.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [accumulator] The custom accumulator value.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {*} Returns the accumulated value.
       * @example
       *
       * var squares = _.transform([1, 2, 3, 4, 5, 6], function(result, n) {
       *   n *= n;
       *   if (n % 2) {
       *     return result.push(n) < 3;
       *   }
       * });
       * // => [1, 9, 25]
       *
       * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, n, key) {
       *   result[key] = n * 3;
       * });
       * // => { 'a': 3, 'b': 6, 'c': 9 }
       */
      function transform(object, iteratee, accumulator, thisArg) {
        var isArr = isArray(object) || isTypedArray(object);
        iteratee = getCallback(iteratee, thisArg, 4);

        if (accumulator == null) {
          if (isArr || isObject(object)) {
            var Ctor = object.constructor;
            if (isArr) {
              accumulator = isArray(object) ? new Ctor() : [];
            } else {
              accumulator = baseCreate(
                typeof Ctor == "function" && Ctor.prototype,
              );
            }
          } else {
            accumulator = {};
          }
        }
        (isArr ? arrayEach : baseForOwn)(
          object,
          function (value, index, object) {
            return iteratee(accumulator, value, index, object);
          },
        );
        return accumulator;
      }

      /**
       * Creates an array of the own enumerable property values of `object`.
       *
       * **Note:** Non-object values are coerced to objects.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to query.
       * @returns {Array} Returns the array of property values.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.values(new Foo);
       * // => [1, 2] (iteration order is not guaranteed)
       *
       * _.values('hi');
       * // => ['h', 'i']
       */
      function values(object) {
        return baseValues(object, keys(object));
      }

      /**
       * Creates an array of the own and inherited enumerable property values
       * of `object`.
       *
       * **Note:** Non-object values are coerced to objects.
       *
       * @static
       * @memberOf _
       * @category Object
       * @param {Object} object The object to query.
       * @returns {Array} Returns the array of property values.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.valuesIn(new Foo);
       * // => [1, 2, 3] (iteration order is not guaranteed)
       */
      function valuesIn(object) {
        return baseValues(object, keysIn(object));
      }

      /*------------------------------------------------------------------------*/

      /**
       * Produces a random number between `min` and `max` (inclusive). If only one
       * argument is provided a number between `0` and the given number is returned.
       * If `floating` is `true`, or either `min` or `max` are floats, a floating-point
       * number is returned instead of an integer.
       *
       * @static
       * @memberOf _
       * @category Number
       * @param {number} [min=0] The minimum possible value.
       * @param {number} [max=1] The maximum possible value.
       * @param {boolean} [floating] Specify returning a floating-point number.
       * @returns {number} Returns the random number.
       * @example
       *
       * _.random(0, 5);
       * // => an integer between 0 and 5
       *
       * _.random(5);
       * // => also an integer between 0 and 5
       *
       * _.random(5, true);
       * // => a floating-point number between 0 and 5
       *
       * _.random(1.2, 5.2);
       * // => a floating-point number between 1.2 and 5.2
       */
      function random(min, max, floating) {
        if (floating && isIterateeCall(min, max, floating)) {
          max = floating = null;
        }
        var noMin = min == null,
          noMax = max == null;

        if (floating == null) {
          if (noMax && typeof min == "boolean") {
            floating = min;
            min = 1;
          } else if (typeof max == "boolean") {
            floating = max;
            noMax = true;
          }
        }
        if (noMin && noMax) {
          max = 1;
          noMax = false;
        }
        min = +min || 0;
        if (noMax) {
          max = min;
          min = 0;
        } else {
          max = +max || 0;
        }
        if (floating || min % 1 || max % 1) {
          var rand = nativeRandom();
          return nativeMin(
            min +
              rand * (max - min + parseFloat("1e-" + ((rand + "").length - 1))),
            max,
          );
        }
        return baseRandom(min, max);
      }

      /*------------------------------------------------------------------------*/

      /**
       * Converts `string` to camel case.
       * See [Wikipedia](https://en.wikipedia.org/wiki/CamelCase) for more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to convert.
       * @returns {string} Returns the camel cased string.
       * @example
       *
       * _.camelCase('Foo Bar');
       * // => 'fooBar'
       *
       * _.camelCase('--foo-bar');
       * // => 'fooBar'
       *
       * _.camelCase('__foo_bar__');
       * // => 'fooBar'
       */
      var camelCase = createCompounder(function (result, word, index) {
        word = word.toLowerCase();
        return (
          result + (index ? word.charAt(0).toUpperCase() + word.slice(1) : word)
        );
      });

      /**
       * Capitalizes the first character of `string`.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to capitalize.
       * @returns {string} Returns the capitalized string.
       * @example
       *
       * _.capitalize('fred');
       * // => 'Fred'
       */
      function capitalize(string) {
        string = baseToString(string);
        return string && string.charAt(0).toUpperCase() + string.slice(1);
      }

      /**
       * Deburrs `string` by converting latin-1 supplementary letters to basic latin letters.
       * See [Wikipedia](https://en.wikipedia.org/wiki/Latin-1_Supplement_(Unicode_block)#Character_table)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to deburr.
       * @returns {string} Returns the deburred string.
       * @example
       *
       * _.deburr('dÃ©jÃ  vu');
       * // => 'deja vu'
       */
      function deburr(string) {
        string = baseToString(string);
        return string && string.replace(reLatin1, deburrLetter);
      }

      /**
       * Checks if `string` ends with the given target string.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to search.
       * @param {string} [target] The string to search for.
       * @param {number} [position=string.length] The position to search from.
       * @returns {boolean} Returns `true` if `string` ends with `target`, else `false`.
       * @example
       *
       * _.endsWith('abc', 'c');
       * // => true
       *
       * _.endsWith('abc', 'b');
       * // => false
       *
       * _.endsWith('abc', 'b', 2);
       * // => true
       */
      function endsWith(string, target, position) {
        string = baseToString(string);
        target = target + "";

        var length = string.length;
        position =
          (typeof position == "undefined"
            ? length
            : nativeMin(position < 0 ? 0 : +position || 0, length)) -
          target.length;
        return position >= 0 && string.indexOf(target, position) == position;
      }

      /**
       * Converts the characters "&", "<", ">", '"', "'", and '`', in `string` to
       * their corresponding HTML entities.
       *
       * **Note:** No other characters are escaped. To escape additional characters
       * use a third-party library like [_he_](https://mths.be/he).
       *
       * Though the ">" character is escaped for symmetry, characters like
       * ">" and "/" don't require escaping in HTML and have no special meaning
       * unless they're part of a tag or unquoted attribute value.
       * See [Mathias Bynens's article](https://mathiasbynens.be/notes/ambiguous-ampersands)
       * (under "semi-related fun fact") for more details.
       *
       * Backticks are escaped because in Internet Explorer < 9, they can break out
       * of attribute values or HTML comments. See [#102](https://html5sec.org/#102),
       * [#108](https://html5sec.org/#108), and [#133](https://html5sec.org/#133) of
       * the [HTML5 Security Cheatsheet](https://html5sec.org/) for more details.
       *
       * When working with HTML you should always quote attribute values to reduce
       * XSS vectors. See [Ryan Grove's article](http://wonko.com/post/html-escaping)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to escape.
       * @returns {string} Returns the escaped string.
       * @example
       *
       * _.escape('fred, barney, & pebbles');
       * // => 'fred, barney, &amp; pebbles'
       */
      function escape(string) {
        // Reset `lastIndex` because in IE < 9 `String#replace` does not.
        string = baseToString(string);
        return string && reHasUnescapedHtml.test(string)
          ? string.replace(reUnescapedHtml, escapeHtmlChar)
          : string;
      }

      /**
       * Escapes the `RegExp` special characters "\", "^", "$", ".", "|", "?", "*",
       * "+", "(", ")", "[", "]", "{" and "}" in `string`.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to escape.
       * @returns {string} Returns the escaped string.
       * @example
       *
       * _.escapeRegExp('[lodash](https://lodash.com/)');
       * // => '\[lodash\]\(https://lodash\.com/\)'
       */
      function escapeRegExp(string) {
        string = baseToString(string);
        return string && reHasRegExpChars.test(string)
          ? string.replace(reRegExpChars, "\\$&")
          : string;
      }

      /**
       * Converts `string` to kebab case (a.k.a. spinal case).
       * See [Wikipedia](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles) for
       * more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to convert.
       * @returns {string} Returns the kebab cased string.
       * @example
       *
       * _.kebabCase('Foo Bar');
       * // => 'foo-bar'
       *
       * _.kebabCase('fooBar');
       * // => 'foo-bar'
       *
       * _.kebabCase('__foo_bar__');
       * // => 'foo-bar'
       */
      var kebabCase = createCompounder(function (result, word, index) {
        return result + (index ? "-" : "") + word.toLowerCase();
      });

      /**
       * Pads `string` on the left and right sides if it is shorter then the given
       * padding length. The `chars` string may be truncated if the number of padding
       * characters can't be evenly divided by the padding length.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to pad.
       * @param {number} [length=0] The padding length.
       * @param {string} [chars=' '] The string used as padding.
       * @returns {string} Returns the padded string.
       * @example
       *
       * _.pad('abc', 8);
       * // => '  abc   '
       *
       * _.pad('abc', 8, '_-');
       * // => '_-abc_-_'
       *
       * _.pad('abc', 3);
       * // => 'abc'
       */
      function pad(string, length, chars) {
        string = baseToString(string);
        length = +length;

        var strLength = string.length;
        if (strLength >= length || !nativeIsFinite(length)) {
          return string;
        }
        var mid = (length - strLength) / 2,
          leftLength = floor(mid),
          rightLength = ceil(mid);

        chars = createPad("", rightLength, chars);
        return chars.slice(0, leftLength) + string + chars;
      }

      /**
       * Pads `string` on the left side if it is shorter then the given padding
       * length. The `chars` string may be truncated if the number of padding
       * characters exceeds the padding length.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to pad.
       * @param {number} [length=0] The padding length.
       * @param {string} [chars=' '] The string used as padding.
       * @returns {string} Returns the padded string.
       * @example
       *
       * _.padLeft('abc', 6);
       * // => '   abc'
       *
       * _.padLeft('abc', 6, '_-');
       * // => '_-_abc'
       *
       * _.padLeft('abc', 3);
       * // => 'abc'
       */
      function padLeft(string, length, chars) {
        string = baseToString(string);
        return string && createPad(string, length, chars) + string;
      }

      /**
       * Pads `string` on the right side if it is shorter then the given padding
       * length. The `chars` string may be truncated if the number of padding
       * characters exceeds the padding length.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to pad.
       * @param {number} [length=0] The padding length.
       * @param {string} [chars=' '] The string used as padding.
       * @returns {string} Returns the padded string.
       * @example
       *
       * _.padRight('abc', 6);
       * // => 'abc   '
       *
       * _.padRight('abc', 6, '_-');
       * // => 'abc_-_'
       *
       * _.padRight('abc', 3);
       * // => 'abc'
       */
      function padRight(string, length, chars) {
        string = baseToString(string);
        return string && string + createPad(string, length, chars);
      }

      /**
       * Converts `string` to an integer of the specified radix. If `radix` is
       * `undefined` or `0`, a `radix` of `10` is used unless `value` is a hexadecimal,
       * in which case a `radix` of `16` is used.
       *
       * **Note:** This method aligns with the ES5 implementation of `parseInt`.
       * See the [ES5 spec](https://es5.github.io/#E) for more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} string The string to convert.
       * @param {number} [radix] The radix to interpret `value` by.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {number} Returns the converted integer.
       * @example
       *
       * _.parseInt('08');
       * // => 8
       *
       * _.map(['6', '08', '10'], _.parseInt);
       * // => [6, 8, 10]
       */
      function parseInt(string, radix, guard) {
        if (guard && isIterateeCall(string, radix, guard)) {
          radix = 0;
        }
        return nativeParseInt(string, radix);
      }
      // Fallback for environments with pre-ES5 implementations.
      if (nativeParseInt(whitespace + "08") != 8) {
        parseInt = function (string, radix, guard) {
          // Firefox < 21 and Opera < 15 follow ES3 for `parseInt`.
          // Chrome fails to trim leading <BOM> whitespace characters.
          // See https://code.google.com/p/v8/issues/detail?id=3109 for more details.
          if (guard ? isIterateeCall(string, radix, guard) : radix == null) {
            radix = 0;
          } else if (radix) {
            radix = +radix;
          }
          string = trim(string);
          return nativeParseInt(
            string,
            radix || (reHexPrefix.test(string) ? 16 : 10),
          );
        };
      }

      /**
       * Repeats the given string `n` times.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to repeat.
       * @param {number} [n=0] The number of times to repeat the string.
       * @returns {string} Returns the repeated string.
       * @example
       *
       * _.repeat('*', 3);
       * // => '***'
       *
       * _.repeat('abc', 2);
       * // => 'abcabc'
       *
       * _.repeat('abc', 0);
       * // => ''
       */
      function repeat(string, n) {
        var result = "";
        string = baseToString(string);
        n = +n;
        if (n < 1 || !string || !nativeIsFinite(n)) {
          return result;
        }
        // Leverage the exponentiation by squaring algorithm for a faster repeat.
        // See https://en.wikipedia.org/wiki/Exponentiation_by_squaring for more details.
        do {
          if (n % 2) {
            result += string;
          }
          n = floor(n / 2);
          string += string;
        } while (n);

        return result;
      }

      /**
       * Converts `string` to snake case.
       * See [Wikipedia](https://en.wikipedia.org/wiki/Snake_case) for more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to convert.
       * @returns {string} Returns the snake cased string.
       * @example
       *
       * _.snakeCase('Foo Bar');
       * // => 'foo_bar'
       *
       * _.snakeCase('fooBar');
       * // => 'foo_bar'
       *
       * _.snakeCase('--foo-bar');
       * // => 'foo_bar'
       */
      var snakeCase = createCompounder(function (result, word, index) {
        return result + (index ? "_" : "") + word.toLowerCase();
      });

      /**
       * Converts `string` to start case.
       * See [Wikipedia](https://en.wikipedia.org/wiki/Letter_case#Stylistic_or_specialised_usage)
       * for more details.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to convert.
       * @returns {string} Returns the start cased string.
       * @example
       *
       * _.startCase('--foo-bar');
       * // => 'Foo Bar'
       *
       * _.startCase('fooBar');
       * // => 'Foo Bar'
       *
       * _.startCase('__foo_bar__');
       * // => 'Foo Bar'
       */
      var startCase = createCompounder(function (result, word, index) {
        return (
          result +
          (index ? " " : "") +
          (word.charAt(0).toUpperCase() + word.slice(1))
        );
      });

      /**
       * Checks if `string` starts with the given target string.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to search.
       * @param {string} [target] The string to search for.
       * @param {number} [position=0] The position to search from.
       * @returns {boolean} Returns `true` if `string` starts with `target`, else `false`.
       * @example
       *
       * _.startsWith('abc', 'a');
       * // => true
       *
       * _.startsWith('abc', 'b');
       * // => false
       *
       * _.startsWith('abc', 'b', 1);
       * // => true
       */
      function startsWith(string, target, position) {
        string = baseToString(string);
        position =
          position == null
            ? 0
            : nativeMin(position < 0 ? 0 : +position || 0, string.length);
        return string.lastIndexOf(target, position) == position;
      }

      /**
       * Creates a compiled template function that can interpolate data properties
       * in "interpolate" delimiters, HTML-escape interpolated data properties in
       * "escape" delimiters, and execute JavaScript in "evaluate" delimiters. Data
       * properties may be accessed as free variables in the template. If a setting
       * object is provided it takes precedence over `_.templateSettings` values.
       *
       * **Note:** In the development build `_.template` utilizes sourceURLs for easier debugging.
       * See the [HTML5 Rocks article on sourcemaps](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl)
       * for more details.
       *
       * For more information on precompiling templates see
       * [lodash's custom builds documentation](https://lodash.com/custom-builds).
       *
       * For more information on Chrome extension sandboxes see
       * [Chrome's extensions documentation](https://developer.chrome.com/extensions/sandboxingEval).
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The template string.
       * @param {Object} [options] The options object.
       * @param {RegExp} [options.escape] The HTML "escape" delimiter.
       * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
       * @param {Object} [options.imports] An object to import into the template as free variables.
       * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
       * @param {string} [options.sourceURL] The sourceURL of the template's compiled source.
       * @param {string} [options.variable] The data object variable name.
       * @param- {Object} [otherOptions] Enables the legacy `options` param signature.
       * @returns {Function} Returns the compiled template function.
       * @example
       *
       * // using the "interpolate" delimiter to create a compiled template
       * var compiled = _.template('hello <%= user %>!');
       * compiled({ 'user': 'fred' });
       * // => 'hello fred!'
       *
       * // using the HTML "escape" delimiter to escape data property values
       * var compiled = _.template('<b><%- value %></b>');
       * compiled({ 'value': '<script>' });
       * // => '<b>&lt;script&gt;</b>'
       *
       * // using the "evaluate" delimiter to execute JavaScript and generate HTML
       * var compiled = _.template('<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>');
       * compiled({ 'users': ['fred', 'barney'] });
       * // => '<li>fred</li><li>barney</li>'
       *
       * // using the internal `print` function in "evaluate" delimiters
       * var compiled = _.template('<% print("hello " + user); %>!');
       * compiled({ 'user': 'barney' });
       * // => 'hello barney!'
       *
       * // using the ES delimiter as an alternative to the default "interpolate" delimiter
       * var compiled = _.template('hello ${ user }!');
       * compiled({ 'user': 'pebbles' });
       * // => 'hello pebbles!'
       *
       * // using custom template delimiters
       * _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
       * var compiled = _.template('hello {{ user }}!');
       * compiled({ 'user': 'mustache' });
       * // => 'hello mustache!'
       *
       * // using backslashes to treat delimiters as plain text
       * var compiled = _.template('<%= "\\<%- value %\\>" %>');
       * compiled({ 'value': 'ignored' });
       * // => '<%- value %>'
       *
       * // using the `imports` option to import `jQuery` as `jq`
       * var text = '<% jq.each(users, function(user) { %><li><%- user %></li><% }); %>';
       * var compiled = _.template(text, { 'imports': { 'jq': jQuery } });
       * compiled({ 'users': ['fred', 'barney'] });
       * // => '<li>fred</li><li>barney</li>'
       *
       * // using the `sourceURL` option to specify a custom sourceURL for the template
       * var compiled = _.template('hello <%= user %>!', { 'sourceURL': '/basic/greeting.jst' });
       * compiled(data);
       * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
       *
       * // using the `variable` option to ensure a with-statement isn't used in the compiled template
       * var compiled = _.template('hi <%= data.user %>!', { 'variable': 'data' });
       * compiled.source;
       * // => function(data) {
       *   var __t, __p = '';
       *   __p += 'hi ' + ((__t = ( data.user )) == null ? '' : __t) + '!';
       *   return __p;
       * }
       *
       * // using the `source` property to inline compiled templates for meaningful
       * // line numbers in error messages and a stack trace
       * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
       *   var JST = {\
       *     "main": ' + _.template(mainText).source + '\
       *   };\
       * ');
       */
      function template(string, options, otherOptions) {
        // Based on John Resig's `tmpl` implementation (http://ejohn.org/blog/javascript-micro-templating/)
        // and Laura Doktorova's doT.js (https://github.com/olado/doT).
        var settings = lodash.templateSettings;

        if (otherOptions && isIterateeCall(string, options, otherOptions)) {
          options = otherOptions = null;
        }
        string = baseToString(string);
        options = baseAssign(
          baseAssign({}, otherOptions || options),
          settings,
          assignOwnDefaults,
        );

        var imports = baseAssign(
            baseAssign({}, options.imports),
            settings.imports,
            assignOwnDefaults,
          ),
          importsKeys = keys(imports),
          importsValues = baseValues(imports, importsKeys);

        var isEscaping,
          isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

        // Compile the regexp to match each delimiter.
        var reDelimiters = RegExp(
          (options.escape || reNoMatch).source +
            "|" +
            interpolate.source +
            "|" +
            (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source +
            "|" +
            (options.evaluate || reNoMatch).source +
            "|$",
          "g",
        );

        // Use a sourceURL for easier debugging.
        var sourceURL =
          "//# sourceURL=" +
          ("sourceURL" in options
            ? options.sourceURL
            : "lodash.templateSources[" + ++templateCounter + "]") +
          "\n";

        string.replace(
          reDelimiters,
          function (
            match,
            escapeValue,
            interpolateValue,
            esTemplateValue,
            evaluateValue,
            offset,
          ) {
            interpolateValue || (interpolateValue = esTemplateValue);

            // Escape characters that can't be included in string literals.
            source += string
              .slice(index, offset)
              .replace(reUnescapedString, escapeStringChar);

            // Replace delimiters with snippets.
            if (escapeValue) {
              isEscaping = true;
              source += "' +\n__e(" + escapeValue + ") +\n'";
            }
            if (evaluateValue) {
              isEvaluating = true;
              source += "';\n" + evaluateValue + ";\n__p += '";
            }
            if (interpolateValue) {
              source +=
                "' +\n((__t = (" +
                interpolateValue +
                ")) == null ? '' : __t) +\n'";
            }
            index = offset + match.length;

            // The JS engine embedded in Adobe products requires returning the `match`
            // string in order to produce the correct `offset` value.
            return match;
          },
        );

        source += "';\n";

        // If `variable` is not specified wrap a with-statement around the generated
        // code to add the data object to the top of the scope chain.
        var variable = options.variable;
        if (!variable) {
          source = "with (obj) {\n" + source + "\n}\n";
        }
        // Cleanup code by stripping empty strings.
        source = (
          isEvaluating ? source.replace(reEmptyStringLeading, "") : source
        )
          .replace(reEmptyStringMiddle, "$1")
          .replace(reEmptyStringTrailing, "$1;");

        // Frame code as the function body.
        source =
          "function(" +
          (variable || "obj") +
          ") {\n" +
          (variable ? "" : "obj || (obj = {});\n") +
          "var __t, __p = ''" +
          (isEscaping ? ", __e = _.escape" : "") +
          (isEvaluating
            ? ", __j = Array.prototype.join;\n" +
              "function print() { __p += __j.call(arguments, '') }\n"
            : ";\n") +
          source +
          "return __p\n}";

        var result = attempt(function () {
          return Function(importsKeys, sourceURL + "return " + source).apply(
            undefined,
            importsValues,
          );
        });

        // Provide the compiled function's source by its `toString` method or
        // the `source` property as a convenience for inlining compiled templates.
        result.source = source;
        if (isError(result)) {
          throw result;
        }
        return result;
      }

      /**
       * Removes leading and trailing whitespace or specified characters from `string`.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to trim.
       * @param {string} [chars=whitespace] The characters to trim.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {string} Returns the trimmed string.
       * @example
       *
       * _.trim('  abc  ');
       * // => 'abc'
       *
       * _.trim('-_-abc-_-', '_-');
       * // => 'abc'
       *
       * _.map(['  foo  ', '  bar  '], _.trim);
       * // => ['foo', 'bar]
       */
      function trim(string, chars, guard) {
        var value = string;
        string = baseToString(string);
        if (!string) {
          return string;
        }
        if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
          return string.slice(
            trimmedLeftIndex(string),
            trimmedRightIndex(string) + 1,
          );
        }
        chars = chars + "";
        return string.slice(
          charsLeftIndex(string, chars),
          charsRightIndex(string, chars) + 1,
        );
      }

      /**
       * Removes leading whitespace or specified characters from `string`.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to trim.
       * @param {string} [chars=whitespace] The characters to trim.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {string} Returns the trimmed string.
       * @example
       *
       * _.trimLeft('  abc  ');
       * // => 'abc  '
       *
       * _.trimLeft('-_-abc-_-', '_-');
       * // => 'abc-_-'
       */
      function trimLeft(string, chars, guard) {
        var value = string;
        string = baseToString(string);
        if (!string) {
          return string;
        }
        if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
          return string.slice(trimmedLeftIndex(string));
        }
        return string.slice(charsLeftIndex(string, chars + ""));
      }

      /**
       * Removes trailing whitespace or specified characters from `string`.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to trim.
       * @param {string} [chars=whitespace] The characters to trim.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {string} Returns the trimmed string.
       * @example
       *
       * _.trimRight('  abc  ');
       * // => '  abc'
       *
       * _.trimRight('-_-abc-_-', '_-');
       * // => '-_-abc'
       */
      function trimRight(string, chars, guard) {
        var value = string;
        string = baseToString(string);
        if (!string) {
          return string;
        }
        if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
          return string.slice(0, trimmedRightIndex(string) + 1);
        }
        return string.slice(0, charsRightIndex(string, chars + "") + 1);
      }

      /**
       * Truncates `string` if it is longer than the given maximum string length.
       * The last characters of the truncated string are replaced with the omission
       * string which defaults to "...".
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to truncate.
       * @param {Object|number} [options] The options object or maximum string length.
       * @param {number} [options.length=30] The maximum string length.
       * @param {string} [options.omission='...'] The string to indicate text is omitted.
       * @param {RegExp|string} [options.separator] The separator pattern to truncate to.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {string} Returns the truncated string.
       * @example
       *
       * _.trunc('hi-diddly-ho there, neighborino');
       * // => 'hi-diddly-ho there, neighbo...'
       *
       * _.trunc('hi-diddly-ho there, neighborino', 24);
       * // => 'hi-diddly-ho there, n...'
       *
       * _.trunc('hi-diddly-ho there, neighborino', { 'length': 24, 'separator': ' ' });
       * // => 'hi-diddly-ho there,...'
       *
       * _.trunc('hi-diddly-ho there, neighborino', { 'length': 24, 'separator': /,? +/ });
       * //=> 'hi-diddly-ho there...'
       *
       * _.trunc('hi-diddly-ho there, neighborino', { 'omission': ' [...]' });
       * // => 'hi-diddly-ho there, neig [...]'
       */
      function trunc(string, options, guard) {
        if (guard && isIterateeCall(string, options, guard)) {
          options = null;
        }
        var length = DEFAULT_TRUNC_LENGTH,
          omission = DEFAULT_TRUNC_OMISSION;

        if (options != null) {
          if (isObject(options)) {
            var separator =
              "separator" in options ? options.separator : separator;
            length = "length" in options ? +options.length || 0 : length;
            omission =
              "omission" in options ? baseToString(options.omission) : omission;
          } else {
            length = +options || 0;
          }
        }
        string = baseToString(string);
        if (length >= string.length) {
          return string;
        }
        var end = length - omission.length;
        if (end < 1) {
          return omission;
        }
        var result = string.slice(0, end);
        if (separator == null) {
          return result + omission;
        }
        if (isRegExp(separator)) {
          if (string.slice(end).search(separator)) {
            var match,
              newEnd,
              substring = string.slice(0, end);

            if (!separator.global) {
              separator = RegExp(
                separator.source,
                (reFlags.exec(separator) || "") + "g",
              );
            }
            separator.lastIndex = 0;
            while ((match = separator.exec(substring))) {
              newEnd = match.index;
            }
            result = result.slice(0, newEnd == null ? end : newEnd);
          }
        } else if (string.indexOf(separator, end) != end) {
          var index = result.lastIndexOf(separator);
          if (index > -1) {
            result = result.slice(0, index);
          }
        }
        return result + omission;
      }

      /**
       * The inverse of `_.escape`; this method converts the HTML entities
       * `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, and `&#96;` in `string` to their
       * corresponding characters.
       *
       * **Note:** No other HTML entities are unescaped. To unescape additional HTML
       * entities use a third-party library like [_he_](https://mths.be/he).
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to unescape.
       * @returns {string} Returns the unescaped string.
       * @example
       *
       * _.unescape('fred, barney, &amp; pebbles');
       * // => 'fred, barney, & pebbles'
       */
      function unescape(string) {
        string = baseToString(string);
        return string && reHasEscapedHtml.test(string)
          ? string.replace(reEscapedHtml, unescapeHtmlChar)
          : string;
      }

      /**
       * Splits `string` into an array of its words.
       *
       * @static
       * @memberOf _
       * @category String
       * @param {string} [string=''] The string to inspect.
       * @param {RegExp|string} [pattern] The pattern to match words.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Array} Returns the words of `string`.
       * @example
       *
       * _.words('fred, barney, & pebbles');
       * // => ['fred', 'barney', 'pebbles']
       *
       * _.words('fred, barney, & pebbles', /[^, ]+/g);
       * // => ['fred', 'barney', '&', 'pebbles']
       */
      function words(string, pattern, guard) {
        if (guard && isIterateeCall(string, pattern, guard)) {
          pattern = null;
        }
        string = baseToString(string);
        return string.match(pattern || reWords) || [];
      }

      /*------------------------------------------------------------------------*/

      /**
       * Attempts to invoke `func`, returning either the result or the caught
       * error object.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {*} func The function to attempt.
       * @returns {*} Returns the `func` result or error object.
       * @example
       *
       * // avoid throwing errors for invalid selectors
       * var elements = _.attempt(function() {
       *   return document.querySelectorAll(selector);
       * });
       *
       * if (_.isError(elements)) {
       *   elements = [];
       * }
       */
      function attempt(func) {
        try {
          return func();
        } catch (e) {
          return isError(e) ? e : Error(e);
        }
      }

      /**
       * Creates a function bound to an optional `thisArg`. If `func` is a property
       * name the created callback returns the property value for a given element.
       * If `func` is an object the created callback returns `true` for elements
       * that contain the equivalent object properties, otherwise it returns `false`.
       *
       * @static
       * @memberOf _
       * @alias iteratee
       * @category Utility
       * @param {*} [func=_.identity] The value to convert to a callback.
       * @param {*} [thisArg] The `this` binding of `func`.
       * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
       * @returns {Function} Returns the callback.
       * @example
       *
       * var users = [
       *   { 'user': 'barney', 'age': 36 },
       *   { 'user': 'fred',   'age': 40 }
       * ];
       *
       * // wrap to create custom callback shorthands
       * _.callback = _.wrap(_.callback, function(callback, func, thisArg) {
       *   var match = /^(.+?)__([gl]t)(.+)$/.exec(func);
       *   if (!match) {
       *     return callback(func, thisArg);
       *   }
       *   return function(object) {
       *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
       *   };
       * });
       *
       * _.filter(users, 'age__gt36');
       * // => [{ 'user': 'fred', 'age': 40 }]
       */
      function callback(func, thisArg, guard) {
        if (guard && isIterateeCall(func, thisArg, guard)) {
          thisArg = null;
        }
        return isObjectLike(func) ? matches(func) : baseCallback(func, thisArg);
      }

      /**
       * Creates a function that returns `value`.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {*} value The value to return from the new function.
       * @returns {Function} Returns the new function.
       * @example
       *
       * var object = { 'user': 'fred' };
       * var getter = _.constant(object);
       * getter() === object;
       * // => true
       */
      function constant(value) {
        return function () {
          return value;
        };
      }

      /**
       * This method returns the first argument provided to it.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {*} value Any value.
       * @returns {*} Returns `value`.
       * @example
       *
       * var object = { 'user': 'fred' };
       * _.identity(object) === object;
       * // => true
       */
      function identity(value) {
        return value;
      }

      /**
       * Creates a function which performs a deep comparison between a given object
       * and `source`, returning `true` if the given object has equivalent property
       * values, else `false`.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {Object} source The object of property values to match.
       * @returns {Function} Returns the new function.
       * @example
       *
       * var users = [
       *   { 'user': 'fred',   'age': 40 },
       *   { 'user': 'barney', 'age': 36 }
       * ];
       *
       * var matchesAge = _.matches({ 'age': 36 });
       *
       * _.filter(users, matchesAge);
       * // => [{ 'user': 'barney', 'age': 36 }]
       *
       * _.find(users, matchesAge);
       * // => { 'user': 'barney', 'age': 36 }
       */
      function matches(source) {
        return baseMatches(baseClone(source, true));
      }

      /**
       * Adds all own enumerable function properties of a source object to the
       * destination object. If `object` is a function then methods are added to
       * its prototype as well.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {Function|Object} [object=this] object The destination object.
       * @param {Object} source The object of functions to add.
       * @param {Object} [options] The options object.
       * @param {boolean} [options.chain=true] Specify whether the functions added
       *  are chainable.
       * @returns {Function|Object} Returns `object`.
       * @example
       *
       * function vowels(string) {
       *   return _.filter(string, function(v) {
       *     return /[aeiou]/i.test(v);
       *   });
       * }
       *
       * _.mixin({ 'vowels': vowels });
       * _.vowels('fred');
       * // => ['e']
       *
       * _('fred').vowels().value();
       * // => ['e']
       *
       * _.mixin({ 'vowels': vowels }, { 'chain': false });
       * _('fred').vowels();
       * // => ['e']
       */
      function mixin(object, source, options) {
        if (options == null) {
          var isObj = isObject(source),
            props = isObj && keys(source),
            methodNames = props && props.length && baseFunctions(source, props);

          if (!(methodNames ? methodNames.length : isObj)) {
            methodNames = false;
            options = source;
            source = object;
            object = this;
          }
        }
        if (!methodNames) {
          methodNames = baseFunctions(source, keys(source));
        }
        var chain = true,
          index = -1,
          isFunc = isFunction(object),
          length = methodNames.length;

        if (options === false) {
          chain = false;
        } else if (isObject(options) && "chain" in options) {
          chain = options.chain;
        }
        while (++index < length) {
          var methodName = methodNames[index],
            func = source[methodName];

          object[methodName] = func;
          if (isFunc) {
            object.prototype[methodName] = (function (func) {
              return function () {
                var chainAll = this.__chain__;
                if (chain || chainAll) {
                  var result = object(this.__wrapped__);
                  (result.__actions__ = arrayCopy(this.__actions__)).push({
                    func: func,
                    args: arguments,
                    thisArg: object,
                  });
                  result.__chain__ = chainAll;
                  return result;
                }
                var args = [this.value()];
                push.apply(args, arguments);
                return func.apply(object, args);
              };
            })(func);
          }
        }
        return object;
      }

      /**
       * Reverts the `_` variable to its previous value and returns a reference to
       * the `lodash` function.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @returns {Function} Returns the `lodash` function.
       * @example
       *
       * var lodash = _.noConflict();
       */
      function noConflict() {
        context._ = oldDash;
        return this;
      }

      /**
       * A no-operation function.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @example
       *
       * var object = { 'user': 'fred' };
       * _.noop(object) === undefined;
       * // => true
       */
      function noop() {
        // No operation performed.
      }

      /**
       * Creates a function which returns the property value of `key` on a given object.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {string} key The key of the property to get.
       * @returns {Function} Returns the new function.
       * @example
       *
       * var users = [
       *   { 'user': 'fred' },
       *   { 'user': 'barney' }
       * ];
       *
       * var getName = _.property('user');
       *
       * _.map(users, getName);
       * // => ['fred', barney']
       *
       * _.pluck(_.sortBy(users, getName), 'user');
       * // => ['barney', 'fred']
       */
      function property(key) {
        return baseProperty(key + "");
      }

      /**
       * The inverse of `_.property`; this method creates a function which returns
       * the property value of a given key on `object`.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {Object} object The object to inspect.
       * @returns {Function} Returns the new function.
       * @example
       *
       * var object = { 'user': 'fred', 'age': 40, 'active': true };
       * _.map(['active', 'user'], _.propertyOf(object));
       * // => [true, 'fred']
       *
       * var object = { 'a': 3, 'b': 1, 'c': 2 };
       * _.sortBy(['a', 'b', 'c'], _.propertyOf(object));
       * // => ['b', 'c', 'a']
       */
      function propertyOf(object) {
        return function (key) {
          return object == null ? undefined : object[key];
        };
      }

      /**
       * Creates an array of numbers (positive and/or negative) progressing from
       * `start` up to, but not including, `end`. If `start` is less than `end` a
       * zero-length range is created unless a negative `step` is specified.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {number} [start=0] The start of the range.
       * @param {number} end The end of the range.
       * @param {number} [step=1] The value to increment or decrement by.
       * @returns {Array} Returns the new array of numbers.
       * @example
       *
       * _.range(4);
       * // => [0, 1, 2, 3]
       *
       * _.range(1, 5);
       * // => [1, 2, 3, 4]
       *
       * _.range(0, 20, 5);
       * // => [0, 5, 10, 15]
       *
       * _.range(0, -4, -1);
       * // => [0, -1, -2, -3]
       *
       * _.range(1, 4, 0);
       * // => [1, 1, 1]
       *
       * _.range(0);
       * // => []
       */
      function range(start, end, step) {
        if (step && isIterateeCall(start, end, step)) {
          end = step = null;
        }
        start = +start || 0;
        step = step == null ? 1 : +step || 0;

        if (end == null) {
          end = start;
          start = 0;
        } else {
          end = +end || 0;
        }
        // Use `Array(length)` so engines like Chakra and V8 avoid slower modes.
        // See https://youtu.be/XAqIpGU8ZZk#t=17m25s for more details.
        var index = -1,
          length = nativeMax(ceil((end - start) / (step || 1)), 0),
          result = Array(length);

        while (++index < length) {
          result[index] = start;
          start += step;
        }
        return result;
      }

      /**
       * Invokes the iteratee function `n` times, returning an array of the results
       * of each invocation. The `iteratee` is bound to `thisArg` and invoked with
       * one argument; (index).
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {number} n The number of times to invoke `iteratee`.
       * @param {Function} [iteratee=_.identity] The function invoked per iteration.
       * @param {*} [thisArg] The `this` binding of `iteratee`.
       * @returns {Array} Returns the array of results.
       * @example
       *
       * var diceRolls = _.times(3, _.partial(_.random, 1, 6, false));
       * // => [3, 6, 4]
       *
       * _.times(3, function(n) { mage.castSpell(n); });
       * // => invokes `mage.castSpell(n)` three times with `n` of `0`, `1`, and `2` respectively
       *
       * _.times(3, function(n) { this.cast(n); }, mage);
       * // => also invokes `mage.castSpell(n)` three times
       */
      function times(n, iteratee, thisArg) {
        n = +n;

        // Exit early to avoid a JSC JIT bug in Safari 8
        // where `Array(0)` is treated as `Array(1)`.
        if (n < 1 || !nativeIsFinite(n)) {
          return [];
        }
        var index = -1,
          result = Array(nativeMin(n, MAX_ARRAY_LENGTH));

        iteratee = bindCallback(iteratee, thisArg, 1);
        while (++index < n) {
          if (index < MAX_ARRAY_LENGTH) {
            result[index] = iteratee(index);
          } else {
            iteratee(index);
          }
        }
        return result;
      }

      /**
       * Generates a unique ID. If `prefix` is provided the ID is appended to it.
       *
       * @static
       * @memberOf _
       * @category Utility
       * @param {string} [prefix] The value to prefix the ID with.
       * @returns {string} Returns the unique ID.
       * @example
       *
       * _.uniqueId('contact_');
       * // => 'contact_104'
       *
       * _.uniqueId();
       * // => '105'
       */
      function uniqueId(prefix) {
        var id = ++idCounter;
        return baseToString(prefix) + id;
      }

      /*------------------------------------------------------------------------*/

      // Ensure `new LodashWrapper` is an instance of `lodash`.
      LodashWrapper.prototype = lodash.prototype;

      // Add functions to the `Map` cache.
      MapCache.prototype["delete"] = mapDelete;
      MapCache.prototype.get = mapGet;
      MapCache.prototype.has = mapHas;
      MapCache.prototype.set = mapSet;

      // Add functions to the `Set` cache.
      SetCache.prototype.push = cachePush;

      // Assign cache to `_.memoize`.
      memoize.Cache = MapCache;

      // Add functions that return wrapped values when chaining.
      lodash.after = after;
      lodash.ary = ary;
      lodash.assign = assign;
      lodash.at = at;
      lodash.before = before;
      lodash.bind = bind;
      lodash.bindAll = bindAll;
      lodash.bindKey = bindKey;
      lodash.callback = callback;
      lodash.chain = chain;
      lodash.chunk = chunk;
      lodash.compact = compact;
      lodash.constant = constant;
      lodash.countBy = countBy;
      lodash.create = create;
      lodash.curry = curry;
      lodash.curryRight = curryRight;
      lodash.debounce = debounce;
      lodash.defaults = defaults;
      lodash.defer = defer;
      lodash.delay = delay;
      lodash.difference = difference;
      lodash.drop = drop;
      lodash.dropRight = dropRight;
      lodash.dropRightWhile = dropRightWhile;
      lodash.dropWhile = dropWhile;
      lodash.filter = filter;
      lodash.flatten = flatten;
      lodash.flattenDeep = flattenDeep;
      lodash.flow = flow;
      lodash.flowRight = flowRight;
      lodash.forEach = forEach;
      lodash.forEachRight = forEachRight;
      lodash.forIn = forIn;
      lodash.forInRight = forInRight;
      lodash.forOwn = forOwn;
      lodash.forOwnRight = forOwnRight;
      lodash.functions = functions;
      lodash.groupBy = groupBy;
      lodash.indexBy = indexBy;
      lodash.initial = initial;
      lodash.intersection = intersection;
      lodash.invert = invert;
      lodash.invoke = invoke;
      lodash.keys = keys;
      lodash.keysIn = keysIn;
      lodash.map = map;
      lodash.mapValues = mapValues;
      lodash.matches = matches;
      lodash.memoize = memoize;
      lodash.merge = merge;
      lodash.mixin = mixin;
      lodash.negate = negate;
      lodash.omit = omit;
      lodash.once = once;
      lodash.pairs = pairs;
      lodash.partial = partial;
      lodash.partialRight = partialRight;
      lodash.partition = partition;
      lodash.pick = pick;
      lodash.pluck = pluck;
      lodash.property = property;
      lodash.propertyOf = propertyOf;
      lodash.pull = pull;
      lodash.pullAt = pullAt;
      lodash.range = range;
      lodash.rearg = rearg;
      lodash.reject = reject;
      lodash.remove = remove;
      lodash.rest = rest;
      lodash.shuffle = shuffle;
      lodash.slice = slice;
      lodash.sortBy = sortBy;
      lodash.sortByAll = sortByAll;
      lodash.take = take;
      lodash.takeRight = takeRight;
      lodash.takeRightWhile = takeRightWhile;
      lodash.takeWhile = takeWhile;
      lodash.tap = tap;
      lodash.throttle = throttle;
      lodash.thru = thru;
      lodash.times = times;
      lodash.toArray = toArray;
      lodash.toPlainObject = toPlainObject;
      lodash.transform = transform;
      lodash.union = union;
      lodash.uniq = uniq;
      lodash.unzip = unzip;
      lodash.values = values;
      lodash.valuesIn = valuesIn;
      lodash.where = where;
      lodash.without = without;
      lodash.wrap = wrap;
      lodash.xor = xor;
      lodash.zip = zip;
      lodash.zipObject = zipObject;

      // Add aliases.
      lodash.backflow = flowRight;
      lodash.collect = map;
      lodash.compose = flowRight;
      lodash.each = forEach;
      lodash.eachRight = forEachRight;
      lodash.extend = assign;
      lodash.iteratee = callback;
      lodash.methods = functions;
      lodash.object = zipObject;
      lodash.select = filter;
      lodash.tail = rest;
      lodash.unique = uniq;

      // Add functions to `lodash.prototype`.
      mixin(lodash, lodash);

      /*------------------------------------------------------------------------*/

      // Add functions that return unwrapped values when chaining.
      lodash.attempt = attempt;
      lodash.camelCase = camelCase;
      lodash.capitalize = capitalize;
      lodash.clone = clone;
      lodash.cloneDeep = cloneDeep;
      lodash.deburr = deburr;
      lodash.endsWith = endsWith;
      lodash.escape = escape;
      lodash.escapeRegExp = escapeRegExp;
      lodash.every = every;
      lodash.find = find;
      lodash.findIndex = findIndex;
      lodash.findKey = findKey;
      lodash.findLast = findLast;
      lodash.findLastIndex = findLastIndex;
      lodash.findLastKey = findLastKey;
      lodash.findWhere = findWhere;
      lodash.first = first;
      lodash.has = has;
      lodash.identity = identity;
      lodash.includes = includes;
      lodash.indexOf = indexOf;
      lodash.isArguments = isArguments;
      lodash.isArray = isArray;
      lodash.isBoolean = isBoolean;
      lodash.isDate = isDate;
      lodash.isElement = isElement;
      lodash.isEmpty = isEmpty;
      lodash.isEqual = isEqual;
      lodash.isError = isError;
      lodash.isFinite = isFinite;
      lodash.isFunction = isFunction;
      lodash.isMatch = isMatch;
      lodash.isNaN = isNaN;
      lodash.isNative = isNative;
      lodash.isNull = isNull;
      lodash.isNumber = isNumber;
      lodash.isObject = isObject;
      lodash.isPlainObject = isPlainObject;
      lodash.isRegExp = isRegExp;
      lodash.isString = isString;
      lodash.isTypedArray = isTypedArray;
      lodash.isUndefined = isUndefined;
      lodash.kebabCase = kebabCase;
      lodash.last = last;
      lodash.lastIndexOf = lastIndexOf;
      lodash.max = max;
      lodash.min = min;
      lodash.noConflict = noConflict;
      lodash.noop = noop;
      lodash.now = now;
      lodash.pad = pad;
      lodash.padLeft = padLeft;
      lodash.padRight = padRight;
      lodash.parseInt = parseInt;
      lodash.random = random;
      lodash.reduce = reduce;
      lodash.reduceRight = reduceRight;
      lodash.repeat = repeat;
      lodash.result = result;
      lodash.runInContext = runInContext;
      lodash.size = size;
      lodash.snakeCase = snakeCase;
      lodash.some = some;
      lodash.sortedIndex = sortedIndex;
      lodash.sortedLastIndex = sortedLastIndex;
      lodash.startCase = startCase;
      lodash.startsWith = startsWith;
      lodash.template = template;
      lodash.trim = trim;
      lodash.trimLeft = trimLeft;
      lodash.trimRight = trimRight;
      lodash.trunc = trunc;
      lodash.unescape = unescape;
      lodash.uniqueId = uniqueId;
      lodash.words = words;

      // Add aliases.
      lodash.all = every;
      lodash.any = some;
      lodash.contains = includes;
      lodash.detect = find;
      lodash.foldl = reduce;
      lodash.foldr = reduceRight;
      lodash.head = first;
      lodash.include = includes;
      lodash.inject = reduce;

      mixin(
        lodash,
        (function () {
          var source = {};
          baseForOwn(lodash, function (func, methodName) {
            if (!lodash.prototype[methodName]) {
              source[methodName] = func;
            }
          });
          return source;
        })(),
        false,
      );

      /*------------------------------------------------------------------------*/

      // Add functions capable of returning wrapped and unwrapped values when chaining.
      lodash.sample = sample;

      lodash.prototype.sample = function (n) {
        if (!this.__chain__ && n == null) {
          return sample(this.value());
        }
        return this.thru(function (value) {
          return sample(value, n);
        });
      };

      /*------------------------------------------------------------------------*/

      /**
       * The semantic version number.
       *
       * @static
       * @memberOf _
       * @type string
       */
      lodash.VERSION = VERSION;

      // Assign default placeholders.
      arrayEach(
        ["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"],
        function (methodName) {
          lodash[methodName].placeholder = lodash;
        },
      );

      // Add `LazyWrapper` methods that accept an `iteratee` value.
      arrayEach(["filter", "map", "takeWhile"], function (methodName, index) {
        var isFilter = index == LAZY_FILTER_FLAG;

        LazyWrapper.prototype[methodName] = function (iteratee, thisArg) {
          var result = this.clone(),
            filtered = result.filtered,
            iteratees = result.iteratees || (result.iteratees = []);

          result.filtered =
            filtered ||
            isFilter ||
            (index == LAZY_WHILE_FLAG && result.dir < 0);
          iteratees.push({
            iteratee: getCallback(iteratee, thisArg, 3),
            type: index,
          });
          return result;
        };
      });

      // Add `LazyWrapper` methods for `_.drop` and `_.take` variants.
      arrayEach(["drop", "take"], function (methodName, index) {
        var countName = methodName + "Count",
          whileName = methodName + "While";

        LazyWrapper.prototype[methodName] = function (n) {
          n = n == null ? 1 : nativeMax(+n || 0, 0);

          var result = this.clone();
          if (result.filtered) {
            var value = result[countName];
            result[countName] = index ? nativeMin(value, n) : value + n;
          } else {
            var views = result.views || (result.views = []);
            views.push({
              size: n,
              type: methodName + (result.dir < 0 ? "Right" : ""),
            });
          }
          return result;
        };

        LazyWrapper.prototype[methodName + "Right"] = function (n) {
          return this.reverse()[methodName](n).reverse();
        };

        LazyWrapper.prototype[methodName + "RightWhile"] = function (
          predicate,
          thisArg,
        ) {
          return this.reverse()[whileName](predicate, thisArg).reverse();
        };
      });

      // Add `LazyWrapper` methods for `_.first` and `_.last`.
      arrayEach(["first", "last"], function (methodName, index) {
        var takeName = "take" + (index ? "Right" : "");

        LazyWrapper.prototype[methodName] = function () {
          return this[takeName](1).value()[0];
        };
      });

      // Add `LazyWrapper` methods for `_.initial` and `_.rest`.
      arrayEach(["initial", "rest"], function (methodName, index) {
        var dropName = "drop" + (index ? "" : "Right");

        LazyWrapper.prototype[methodName] = function () {
          return this[dropName](1);
        };
      });

      // Add `LazyWrapper` methods for `_.pluck` and `_.where`.
      arrayEach(["pluck", "where"], function (methodName, index) {
        var operationName = index ? "filter" : "map",
          createCallback = index ? baseMatches : baseProperty;

        LazyWrapper.prototype[methodName] = function (value) {
          return this[operationName](
            createCallback(index ? value : value + ""),
          );
        };
      });

      LazyWrapper.prototype.dropWhile = function (iteratee, thisArg) {
        var done,
          lastIndex,
          isRight = this.dir < 0;

        iteratee = getCallback(iteratee, thisArg, 3);
        return this.filter(function (value, index, array) {
          done = done && (isRight ? index < lastIndex : index > lastIndex);
          lastIndex = index;
          return done || (done = !iteratee(value, index, array));
        });
      };

      LazyWrapper.prototype.reject = function (iteratee, thisArg) {
        iteratee = getCallback(iteratee, thisArg, 3);
        return this.filter(function (value, index, array) {
          return !iteratee(value, index, array);
        });
      };

      LazyWrapper.prototype.slice = function (start, end) {
        start = start == null ? 0 : +start || 0;
        var result = start < 0 ? this.takeRight(-start) : this.drop(start);

        if (typeof end != "undefined") {
          end = +end || 0;
          result = end < 0 ? result.dropRight(-end) : result.take(end - start);
        }
        return result;
      };

      // Add `LazyWrapper` methods to `lodash.prototype`.
      baseForOwn(LazyWrapper.prototype, function (func, methodName) {
        var lodashFunc = lodash[methodName],
          retUnwrapped = /^(?:first|last)$/.test(methodName);

        lodash.prototype[methodName] = function () {
          var value = this.__wrapped__,
            args = arguments,
            chainAll = this.__chain__,
            isHybrid = !!this.__actions__.length,
            isLazy = value instanceof LazyWrapper,
            onlyLazy = isLazy && !isHybrid;

          if (retUnwrapped && !chainAll) {
            return onlyLazy
              ? func.call(value)
              : lodashFunc.call(lodash, this.value());
          }
          var interceptor = function (value) {
            var otherArgs = [value];
            push.apply(otherArgs, args);
            return lodashFunc.apply(lodash, otherArgs);
          };
          if (isLazy || isArray(value)) {
            var wrapper = onlyLazy ? value : new LazyWrapper(this),
              result = func.apply(wrapper, args);

            if (!retUnwrapped && (isHybrid || result.actions)) {
              var actions = result.actions || (result.actions = []);
              actions.push({
                func: thru,
                args: [interceptor],
                thisArg: lodash,
              });
            }
            return new LodashWrapper(result, chainAll);
          }
          return this.thru(interceptor);
        };
      });

      // Add `Array.prototype` functions to `lodash.prototype`.
      arrayEach(
        ["concat", "join", "pop", "push", "shift", "sort", "splice", "unshift"],
        function (methodName) {
          var func = arrayProto[methodName],
            chainName = /^(?:push|sort|unshift)$/.test(methodName)
              ? "tap"
              : "thru",
            retUnwrapped = /^(?:join|pop|shift)$/.test(methodName);

          lodash.prototype[methodName] = function () {
            var args = arguments;
            if (retUnwrapped && !this.__chain__) {
              return func.apply(this.value(), args);
            }
            return this[chainName](function (value) {
              return func.apply(value, args);
            });
          };
        },
      );

      // Add functions to the lazy wrapper.
      LazyWrapper.prototype.clone = lazyClone;
      LazyWrapper.prototype.reverse = lazyReverse;
      LazyWrapper.prototype.value = lazyValue;

      // Add chaining functions to the lodash wrapper.
      lodash.prototype.chain = wrapperChain;
      lodash.prototype.reverse = wrapperReverse;
      lodash.prototype.toString = wrapperToString;
      lodash.prototype.toJSON =
        lodash.prototype.valueOf =
        lodash.prototype.value =
          wrapperValue;

      // Add function aliases to the lodash wrapper.
      lodash.prototype.collect = lodash.prototype.map;
      lodash.prototype.head = lodash.prototype.first;
      lodash.prototype.select = lodash.prototype.filter;
      lodash.prototype.tail = lodash.prototype.rest;

      return lodash;
    }

    /*--------------------------------------------------------------------------*/

    // Export lodash.
    var _ = runInContext();

    // Some AMD build optimizers like r.js check for condition patterns like the following:
    if (
      typeof define == "function" &&
      typeof define.amd == "object" &&
      define.amd
    ) {
      // Expose lodash to the global object when an AMD loader is present to avoid
      // errors in cases where lodash is loaded by a script tag and not intended
      // as an AMD module. See http://requirejs.org/docs/errors.html#mismatch for
      // more details.
      root._ = _;

      // Define as an anonymous module so, through path mapping, it can be
      // referenced as the "underscore" module.
      define("underscore", [], function () {
        return _;
      });
    }
    // Check for `exports` after `define` in case a build optimizer adds an `exports` object.
    else if (freeExports && freeModule) {
      // Export for Node.js or RingoJS.
      if (moduleExports) {
        (freeModule.exports = _)._ = _;
      }
      // Export for Narwhal or Rhino -require.
      else {
        freeExports._ = _;
      }
    } else {
      // Export for a browser or Rhino.
      root._ = _;
    }
  }).call(this);

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/util/uuid", ["require"], function (require) {
    // Private array of chars to use
    var CHARS =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(
        "",
      );

    var uuid = function () {
      var uuid = "";
      var r;
      for (var i = 0; i < 46; i++) {
        r = 0 | (Math.random() * 36);
        uuid += CHARS[r];
      }

      return uuid;
    };

    return uuid;
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/SimCapiMessage", ["require"], function (require) {
    var SimCapiMessage = function (params) {
      // Ensure that params is initialized. This is just making code cleaner by avoiding lots of
      // null checks
      params = params || {};

      // The message type. Select from TYPES.
      this.type = params.type || null;

      /*
       * This is needed to create a handshake between stage and iframe. Without a handshake,
       * we can't identify the IFrame from which a message was sent.
       */
      this.handshake = params.handshake || {
        requestToken: null,
        authToken: null,
      };

      /*
       * Values is a map containing (key, CapiValue) pairs.
       */
      this.values = params.values || {};

      /*
       * Optional options object to be passed to the viewer
       */
      this.options = params.options || {};
    };

    /*
     * Define message type enums as a class variable.
     * Next number is 23
     */
    SimCapiMessage.TYPES = {
      HANDSHAKE_REQUEST: 1,
      HANDSHAKE_RESPONSE: 2,
      ON_READY: 3,
      VALUE_CHANGE: 4,
      CONFIG_CHANGE: 5,
      VALUE_CHANGE_REQUEST: 6,
      CHECK_REQUEST: 7,
      CHECK_COMPLETE_RESPONSE: 8,
      GET_DATA_REQUEST: 9,
      GET_DATA_RESPONSE: 10,
      SET_DATA_REQUEST: 11,
      SET_DATA_RESPONSE: 12,
      INITIAL_SETUP_COMPLETE: 14,
      CHECK_START_RESPONSE: 15,
      API_CALL_REQUEST: 16,
      API_CALL_RESPONSE: 17,
      RESIZE_PARENT_CONTAINER_REQUEST: 18,
      RESIZE_PARENT_CONTAINER_RESPONSE: 19,
      ALLOW_INTERNAL_ACCESS: 20,
      REGISTER_LOCAL_DATA_CHANGE_LISTENER: 21,
      REGISTERED_LOCAL_DATA_CHANGED: 22,
    };

    return SimCapiMessage;
  });

  !(function (a, b, c) {
    var d = function (a, b) {
        return (
          void 0 !== a &&
          null !== a &&
          b &&
          (a.constructor === b || a instanceof b)
        );
      },
      e = function (a, b, c) {
        if (a) throw new Error(a);
        var d = c.constructor.toString();
        throw (
          ((d = (typeof c).length < d.length ? typeof c : d),
          new Error(
            "Expected: " +
              c.name +
              ". Actual : " +
              (b ? b.constructor.name : b),
          ))
        );
      },
      f = function (a, b, c) {
        var f = !1;
        if (c.each) {
          var g =
            c.filterFn ||
            function () {
              return !0;
            };
          if ((f = d(a, Object) || d(a, Array)))
            for (var h in a) {
              if (!a.hasOwnProperty(h)) return;
              g(a[h], h) &&
                ((f = f && d(a[h], b)), !f && c.strict && e(c.msg, a, b));
            }
          else c.strict && e(c.msg, arg, b);
        } else (f = d(a, b)), !f && c.strict && e(c.msg, a, b);
        return f;
      },
      g = function (a, b, c) {
        return (a !== c && null !== a) || (b.strict && e(b.msg, a, c), !1);
      },
      h = function (a) {
        var b = { strict: !0 };
        if (!h.globals.on) {
          var c = function () {
              return this;
            },
            d = function () {
              return !0;
            };
          return {
            isString: d,
            isNumber: d,
            isBoolean: d,
            isArray: d,
            isObject: d,
            isFunction: d,
            isOfType: d,
            strict: c,
            passive: c,
            each: c,
            msg: c,
            isDefined: d,
          };
        }
        return {
          isString: function () {
            return f(a, String, b);
          },
          isNumber: function () {
            return f(a, Number, b);
          },
          isBoolean: function () {
            return f(a, Boolean, b);
          },
          isArray: function () {
            return f(a, Array, b);
          },
          isObject: function () {
            return f(a, Object, b);
          },
          isFunction: function () {
            return f(a, Function, b);
          },
          isOfType: function (c) {
            return f(a, c, b);
          },
          isDefined: function () {
            return g(a, b);
          },
          strict: function () {
            return (b.strict = !0), this;
          },
          passive: function () {
            return (b.strict = !1), this;
          },
          each: function (a) {
            return (b.each = !0), (b.filterFn = a), this;
          },
          msg: function (a) {
            return (b.msg = a), this;
          },
        };
      };
    (h.globals = { on: !0 }),
      "undefined" == typeof b && ((b = { exports: {} }), (c = b.exports)),
      "function" == typeof define &&
        define.amd &&
        define("check", [], function () {
          return h;
        }),
      (c = b.exports = h),
      "undefined" != typeof window && (window.check = b.exports);
  })(
    this,
    "undefined" != typeof module ? module : {},
    "undefined" != typeof exports ? exports : {},
  );
  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/SimCapiTypes", ["require"], function (require) {
    var SimCapiType = function (enumValue, stringValue) {
      this.enumValue = enumValue;
      this.stringValue = stringValue;
    };

    SimCapiType.prototype.valueOf = function () {
      return this.enumValue;
    };

    SimCapiType.prototype.toString = function () {
      return this.stringValue;
    };

    var SIMCAPI_TYPES = {
      NUMBER: new SimCapiType(1, "Number"),
      STRING: new SimCapiType(2, "String"),
      ARRAY: new SimCapiType(3, "Array"),
      BOOLEAN: new SimCapiType(4, "Boolean"),
      ENUM: new SimCapiType(5, "Enum"),
      MATH_EXPR: new SimCapiType(6, "MathExpression"),
      ARRAY_POINT: new SimCapiType(7, "Point Array"),
    };

    /*
     *  Returns key to enumValue map
     *   e.g., {
     *     NUMBER: 1,
     *     STRING: 2,
     *     ...
     *   }
     */
    var TYPES = Object.keys(SIMCAPI_TYPES).reduce(function (prev, key) {
      var value = SIMCAPI_TYPES[key];
      prev[key] = value.valueOf();
      return prev;
    }, {});

    /*
     * Returns enumValue to string map
     *   e.g., {
     *     1: 'Number',
     *     2: 'String',
     *     ...
     *   }
     */
    var STRING_MAP = Object.keys(SIMCAPI_TYPES).reduce(function (prev, key) {
      var value = SIMCAPI_TYPES[key];
      prev[value.valueOf()] = value.toString();
      return prev;
    }, {});

    /*
     * EnumValue to String
     *   e.g., SIMCAPI_TYPES.toString(SIMCAPI_TYPES.TYPES.STRING) returns 'String'
     */
    var toString = function (type) {
      return STRING_MAP[type];
    };

    return {
      TYPES: TYPES,
      toString: toString,
    };
  });
  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/SimCapiValue", ["check", "./SimCapiTypes"], function (
    check,
    SimCapiTypes,
  ) {
    function parseBoolean(value) {
      if (check(value).passive().isBoolean()) {
        return value;
      } else if (check(value).passive().isString()) {
        return value === "true";
      }
      return value;
    }

    function parseArray(value) {
      if (check(value).passive().isArray()) {
        return value;
      } else if (isArray(value)) {
        var elements = value.substring(1, value.length - 1).split(",");
        var isEmpty = elements.length === 1 && elements[0] === "";
        var parsedArray = isEmpty ? [] : elements;

        return parsedArray.map(function (element) {
          if (element.match(/^\s+$/)) {
            return element;
          } else {
            return element.trim();
          }
        });
      }

      return value;
    }

    function isArray(value) {
      return value.charAt(0) === "[" && value.charAt(value.length - 1) === "]";
    }

    var SimCapiValue = function (options) {
      var getType = function (value, allowedValues) {
        var passiveValue = check(value).passive();
        var type;

        if (allowedValues) {
          check(allowedValues).each().isString();
          type = SimCapiTypes.TYPES.ENUM;
        }
        //Booleans must be checked before strings.
        else if (passiveValue.isBoolean()) {
          type = SimCapiTypes.TYPES.BOOLEAN;
        } else if (passiveValue.isNumber()) {
          type = SimCapiTypes.TYPES.NUMBER;
        } else if (passiveValue.isArray() || isArray(value)) {
          type = SimCapiTypes.TYPES.ARRAY;
        } else if (passiveValue.isString()) {
          type = SimCapiTypes.TYPES.STRING;
        } else {
          throw new Error("can not determined type");
        }

        return type;
      };

      var parseValue = function (value, type, allowedValues) {
        switch (type) {
          case SimCapiTypes.TYPES.NUMBER:
            check(parseFloat(value)).isNumber();
            value = parseFloat(value);
            break;
          case SimCapiTypes.TYPES.STRING:
            value = String(value);
            break;
          case SimCapiTypes.TYPES.BOOLEAN:
            value = parseBoolean(value);
            check(value).isBoolean();
            break;
          case SimCapiTypes.TYPES.ARRAY:
            value = parseArray(value);
            check(value).isArray();
            break;
          case SimCapiTypes.TYPES.ENUM:
            check(value).isString();
            check(allowedValues).each().isString();

            if (allowedValues.indexOf(value) === -1) {
              throw new Error("value is not allowed.");
            }
            break;
          case SimCapiTypes.TYPES.MATH_EXPR:
            check(value).isString();
            break;
          case SimCapiTypes.TYPES.ARRAY_POINT:
            value = parseArray(value);
            check(value).isArray();
            break;
        }

        return value;
      };

      // Ensure that options is initialized. This is just making code cleaner by avoiding lots of
      // null checks
      options = options || {};

      /*
       *  The original attribute name associated with this SimCapiValue
       */
      this.key = options.key || null;
      check(this.key).isString();

      /*
       * The value type.
       */
      this.type = options.type || null;

      /*
       * The value of this object.
       */
      this.value =
        options.value !== undefined || options.value !== null
          ? options.value
          : null;

      /*
       * True if and only if, this value can NOT be written to. Any request to change
       * the value of this key, will be ignored.
       */
      this.readonly = options.readonly || false;

      /*
       * True if and only if, this value can NOT be read from.
       * This is not actually enforced, but only used for filtering the condition editor in the author.
       */
      this.writeonly = options.writeonly || false;

      /*
       * List of possible values for enum
       */
      this.allowedValues = options.allowedValues || null;

      /*
       * Optional. If provided a the name of a global capi property, this capi property's value will
       * bind to that property's value.
       */
      this.bindTo = options.bindTo || null;
      if (this.bindTo) {
        check(this.bindTo).isString();
      }

      if (this.type) {
        //we have a type so we only need to parse the value
        this.value = parseValue(this.value, this.type, this.allowedValues);
      } else if (this.value !== undefined && this.value !== null) {
        //we don't have a type but we have a value, we can infer the type
        this.type = getType(this.value, this.allowedValues);

        //If determined to be of type array but value is a string, convert it.
        if (
          this.type === SimCapiTypes.TYPES.ARRAY &&
          check(this.value).passive().isString()
        ) {
          this.value = parseArray(this.value);
        }
      } else {
        throw new Error("Value nor type was given");
      }

      this.setValue = function (value) {
        this.value = parseValue(value, this.type, this.allowedValues);
      };

      this.toString = function () {
        if (this.value === null || this.value === undefined) {
          return "null";
        }

        if (check(this.value).passive().isArray()) {
          return "[" + this.value.toString() + "]";
        }

        return this.value.toString();
      };
    };

    return SimCapiValue;
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/config/apiList", [], function () {
    return {
      ChemicalAPI: ["getStructure", "search"],
      DeviceAPI: ["listDevicesInGroup"],
      DataSyncAPI: [
        "createSession",
        "joinSession",
        "endSession",
        "setSessionData",
        "getSessionData",
      ],
      InchRepoService: ["search"],
      PeerResponseAPI: ["getPeerIds", "getResponses"],
    };
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/ApiInterface", [
    "require",
    "./config/apiList",
    "./SimCapiMessage",
    "api/snapshot/Transporter",
  ], function (require) {
    var apiList = require("./config/apiList");
    var SimCapiMessage = require("./SimCapiMessage");

    function ApiInterface() {
      this.apiCallUid = 0;
      this.responseQueue = {};
    }

    ApiInterface.create = function (transporter) {
      var Transporter = require("api/snapshot/Transporter").Transporter;
      if (!(transporter instanceof Transporter)) {
        throw new Error("Transporter not received");
      }

      var apiInterface = new ApiInterface();
      apiInterface.transporter = transporter;

      return apiInterface;
    };

    ApiInterface.prototype.apiCall = function (api, method, params, callback) {
      if (!apiList[api]) {
        throw new Error("Invalid api name provided: " + api);
      }
      if (apiList[api].indexOf(method) === -1) {
        throw new Error("Method does not exist on the api: " + method);
      }

      var uid = ++this.apiCallUid;
      var handshake = this.transporter.getHandshake();

      var message = new SimCapiMessage({
        type: SimCapiMessage.TYPES.API_CALL_REQUEST,
        handshake: handshake,
        values: {
          api: api,
          method: method,
          uid: uid,
          params: params,
        },
      });

      if (typeof callback === "function") {
        this.responseQueue[uid] = callback;
      }

      this.transporter.sendMessage(message);
    };

    ApiInterface.prototype.processResponse = function (response) {
      var callback = this.responseQueue[response.values.uid];
      if (!callback) {
        return;
      }

      callback(response.values.type, response.values.args);
      delete this.responseQueue[response.values.uid];
    };

    return ApiInterface;
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /*globals window, setTimeout, console*/
  define("api/snapshot/LocalData", [], function () {
    var LocalData = {
      getData: function (simId, key, onSuccess) {
        var response = {
          key: key,
          value: null,
          exists: false,
        };

        try {
          var simData = JSON.parse(window.sessionStorage.getItem(simId));
          if (simData && simData.hasOwnProperty(key)) {
            response.value = simData[key];
            response.exists = true;
          }
        } catch (err) {
          console.warn(
            "An error occurred while reading the date from sessionStorage.",
          );
        }
        asyncResponse(response, onSuccess);
      },
      setData: function (simId, key, value, onSuccess) {
        try {
          var simData = JSON.parse(window.sessionStorage.getItem(simId)) || {};
          simData[key] = value;
          window.sessionStorage.setItem(simId, JSON.stringify(simData));
        } catch (err) {
          console.warn(
            "An error occurred while trying to save the data to sessionStorage.",
          );
        }
        asyncResponse(null, onSuccess);
      },
    };

    function asyncResponse(response, callback) {
      setTimeout(sendResponse.bind(this, response, callback), 0);
    }

    function sendResponse(response, callback) {
      callback(response);
    }

    return LocalData;
  });
  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /*globals document*/
  define("api/snapshot/util/domain", [], function () {
    return {
      getDomain: function () {
        return document.domain;
      },
      setDomain: function (newDomain) {
        document.domain = newDomain;
      },
    };
  });
  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /*globals window, document*/
  define("api/snapshot/util/iframe", [], function () {
    return {
      isInIframe: function () {
        return window !== window.parent;
      },
      isInAuthor: function () {
        return document.referrer.indexOf("/bronte/author") !== -1;
      },
    };
  });
  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /*global window, document, setTimeout*/
  define("api/snapshot/Transporter", [
    "require",
    "jquery",
    "underscore",
    "./util/uuid",
    "./SimCapiMessage",
    "check",
    "./SimCapiValue",
    "./SimCapiTypes",
    "./ApiInterface",
    "./LocalData",
    "./util/domain",
    "./util/iframe",
  ], function (require) {
    var $ = require("jquery");
    var _ = require("underscore");
    var uuid = require("./util/uuid");
    var SimCapiMessage = require("./SimCapiMessage");
    var check = require("check");
    var SimCapiValue = require("./SimCapiValue");
    var SimCapiTypes = require("./SimCapiTypes");
    var ApiInterface = require("./ApiInterface");
    var LocalData = require("./LocalData");
    var domainUtil = require("./util/domain");

    var iframeUtil = require("./util/iframe");

    $.noConflict();
    _.noConflict();

    var Transporter = function (options) {
      // current version of Transporter
      var version = "3.0.6";

      // Ensure that options is initialized. This is just making code cleaner by avoiding lots of
      // null checks
      options = options || {};

      var self = this;

      // The mapping of watched 'attributes'
      var outgoingMap = options.outgoingMap || {};

      //The mapping of capi values that were recieved and are waiting to be applied.
      var toBeApplied = options.toBeApplied || {};

      //The list of change listeners
      var changeListeners = {};
      var configChangeListeners = {};
      var initialSetupCompleteListeners = [];
      var handshakeListeners = [];

      // Authentication handshake used for communicating to viewer
      var handshake = {
        requestToken: options.requestToken || uuid(),
        authToken: options.authToken || null,
        version: version,
      };

      // True if and only if we have a pending on ready message.
      var pendingOnReady = options.pendingOnReady || false;

      var pendingMessages = {
        forHandshake: [],
        forValueChange: [],
      };

      //tracks if check has been triggered.
      var checkTriggered = false;

      // holds callbacks that may be needed
      var callback = {
        check: {
          complete: [],
          start: [],
        },
        getData: null,
      };

      /* can be used to uniquely identify messages */
      this.lastMessageId = 0;
      /* can be used to keep track of the success and error callbacks for a given message */
      this.messageCallbacks = {};

      /* stored callbacks for registerLocalDataListener */
      this.localDataChangedCallbacks = {};

      /*
       * Gets/SetsRequest callbacks
       * simId -> { key -> { onSucess -> function, onError -> function } }
       */
      var getRequests = {};
      var setRequests = {};

      /*
       *   Throttles the value changed message to 25 milliseconds
       */
      var currentTimeout = null;
      var timeoutAmount = 25;

      this.apiInterface = ApiInterface.create(this);

      this.getHandshake = function () {
        return handshake;
      };

      /*
       * Helper to route messages to appropriate handlers
       */
      this.capiMessageHandler = function (message) {
        if (!message.handshake) {
          return;
        }

        switch (message.type) {
          case SimCapiMessage.TYPES.HANDSHAKE_RESPONSE:
            handleHandshakeResponse(message);
            break;
          case SimCapiMessage.TYPES.VALUE_CHANGE:
            handleValueChangeMessage(message);
            break;
          case SimCapiMessage.TYPES.CONFIG_CHANGE:
            handleConfigChangeMessage(message);
            break;
          case SimCapiMessage.TYPES.VALUE_CHANGE_REQUEST:
            handleValueChangeRequestMessage(message);
            break;
          case SimCapiMessage.TYPES.CHECK_COMPLETE_RESPONSE:
            handleCheckCompleteResponse(message);
            break;
          case SimCapiMessage.TYPES.CHECK_START_RESPONSE:
            handleCheckStartResponse(message);
            break;
          case SimCapiMessage.TYPES.GET_DATA_RESPONSE:
            handleGetDataResponse(message);
            break;
          case SimCapiMessage.TYPES.SET_DATA_RESPONSE:
            handleSetDataResponse(message);
            break;
          case SimCapiMessage.TYPES.API_CALL_RESPONSE:
            this.apiInterface.processResponse(message);
            break;
          case SimCapiMessage.TYPES.INITIAL_SETUP_COMPLETE:
            handleInitialSetupComplete(message);
            break;
          case SimCapiMessage.TYPES.RESIZE_PARENT_CONTAINER_RESPONSE:
            handleResizeParentContainerResponse(message);
            break;
          case SimCapiMessage.TYPES.ALLOW_INTERNAL_ACCESS:
            setDomainToShortform();
            break;
          case SimCapiMessage.TYPES.REGISTERED_LOCAL_DATA_CHANGED:
            handleLocalDataChange(message);
            break;
        }
      };

      function removeChangeListener(id) {
        delete changeListeners[id];
      }

      this.addChangeListener = function (changeListener) {
        var id = uuid();
        changeListeners[id] = changeListener;
        return removeChangeListener.bind(this, id);
      };

      this.removeAllChangeListeners = function () {
        changeListeners = {};
      };

      function removeConfigChangeListener(id) {
        delete configChangeListeners[id];
      }

      this.addConfigChangeListener = function (changeListener) {
        var id = uuid();
        configChangeListeners[id] = changeListener;
        return removeConfigChangeListener.bind(this, id);
      };

      this.removeAllConfigChangeListeners = function () {
        configChangeListeners = {};
      };

      /*
       * @since 0.55
       * Allows sims to watch for when the initial setup has been applied to the sim.
       *
       */
      var initialSetupComplete = false;
      this.addInitialSetupCompleteListener = function (listener) {
        if (initialSetupComplete) {
          throw new Error(
            "Initial setup already complete. This listener will never be called",
          );
        }
        initialSetupCompleteListeners.push(listener);
      };
      this.removeAllInitialSetupCompleteListeners = function () {
        initialSetupCompleteListeners = [];
      };
      var handleInitialSetupComplete = function (message) {
        if (
          initialSetupComplete ||
          message.handshake.authToken !== handshake.authToken
        ) {
          return;
        }
        for (var i = 0; i < initialSetupCompleteListeners.length; ++i) {
          initialSetupCompleteListeners[i](message);
        }
        initialSetupComplete = true;
      };

      /*
       * @since 0.6
       * Can listen to check complete event
       *
       */
      this.addCheckCompleteListener = function (listener, once) {
        callback.check.complete.push({
          handler: listener,
          once: once,
        });
      };

      this.addCheckStartListener = function (listener, once) {
        callback.check.start.push({
          handler: listener,
          once: once,
        });
      };

      var handshakeComplete = false;
      this.addHandshakeCompleteListener = function (listener) {
        if (handshakeComplete) {
          listener(handshake);
          return;
        }
        handshakeListeners.push(listener);
      };

      /*
       *   Handles the get data message
       */
      var handleGetDataResponse = function (message) {
        if (message.handshake.authToken === handshake.authToken) {
          if (message.values.responseType === "success") {
            getRequests[message.values.simId][message.values.key].onSuccess({
              key: message.values.key,
              value: message.values.value,
              exists: message.values.exists,
            });
          } else if (message.values.responseType === "error") {
            getRequests[message.values.simId][message.values.key].onError(
              message.values.error,
            );
          }

          var nextQueuedRequest =
            getRequests[message.values.simId][message.values.key].inQueue;

          delete getRequests[message.values.simId][message.values.key];

          if (nextQueuedRequest) {
            self.getDataRequest(
              message.values.simId,
              message.values.key,
              nextQueuedRequest.onSuccess,
              nextQueuedRequest.onError,
            );
          }
        }
      };

      /*
       *   Handles the set data message
       */
      var handleSetDataResponse = function (message) {
        if (message.handshake.authToken === handshake.authToken) {
          if (message.values.responseType === "success") {
            setRequests[message.values.simId][message.values.key].onSuccess({
              key: message.values.key,
              value: message.values.value,
            });
          } else if (message.values.responseType === "error") {
            setRequests[message.values.simId][message.values.key].onError(
              message.values.error,
            );
          }

          var nextQueuedRequest =
            setRequests[message.values.simId][message.values.key].inQueue;

          delete setRequests[message.values.simId][message.values.key];

          if (nextQueuedRequest) {
            self.setDataRequest(
              message.values.simId,
              message.values.key,
              nextQueuedRequest.value,
              nextQueuedRequest.onSuccess,
              nextQueuedRequest.onError,
              nextQueuedRequest.options,
            );
          }
        }
      };

      /*
       * Sends the GET_DATA Request
       */
      this.getDataRequest = function (simId, key, onSuccess, onError) {
        check(simId).isString();
        check(key).isString();

        onSuccess = onSuccess || function () {};
        onError = onError || function () {};

        if (!iframeUtil.isInIframe() || iframeUtil.isInAuthor()) {
          LocalData.getData(simId, key, onSuccess);
          return true;
        }

        var getDataRequestMsg = new SimCapiMessage({
          type: SimCapiMessage.TYPES.GET_DATA_REQUEST,
          handshake: handshake,
          values: {
            key: key,
            simId: simId,
          },
        });

        getRequests[simId] = getRequests[simId] || {};

        if (getRequests[simId][key]) {
          getRequests[simId][key].inQueue = {
            onSuccess: onSuccess,
            onError: onError,
          };

          return false;
        }

        getRequests[simId][key] = {
          onSuccess: onSuccess,
          onError: onError,
        };

        if (!handshake.authToken) {
          pendingMessages.forHandshake.push(getDataRequestMsg);
        } else {
          // send the message to the viewer
          self.sendMessage(getDataRequestMsg);
        }

        return true;
      };

      /*
       * Sends the SET_DATA Request
       */
      this.setDataRequest = function (
        simId,
        key,
        value,
        onSuccess,
        onError,
        options,
      ) {
        check(simId).isString();
        check(key).isString();
        check(value).isString();

        onSuccess = onSuccess || function () {};
        onError = onError || function () {};

        if (!iframeUtil.isInIframe() || iframeUtil.isInAuthor()) {
          LocalData.setData(simId, key, value, onSuccess);
          return true;
        }

        var setDataRequestMsg = new SimCapiMessage({
          type: SimCapiMessage.TYPES.SET_DATA_REQUEST,
          handshake: handshake,
          values: {
            key: key,
            value: value,
            simId: simId,
          },
          options: options,
        });

        setRequests[simId] = setRequests[simId] || {};

        if (setRequests[simId][key]) {
          setRequests[simId][key].inQueue = {
            value: value,
            onSuccess: onSuccess,
            onError: onError,
            options: options,
          };

          return false;
        }

        setRequests[simId][key] = {
          onSuccess: onSuccess,
          onError: onError,
        };

        if (!handshake.authToken) {
          pendingMessages.forHandshake.push(setDataRequestMsg);
        } else {
          // send the message to the viewer
          self.sendMessage(setDataRequestMsg);
        }

        return true;
      };

      /*
       * Handles check complete event
       */
      var handleCheckCompleteResponse = function (message) {
        handleCheckResponse("complete", message);

        checkTriggered = false;
      };

      /*
       * Handles check start event. Does not get invoked if the sim triggers the check event.
       */
      var handleCheckStartResponse = function (message) {
        handleCheckResponse("start", message);
      };

      var handleCheckResponse = function (eventName, message) {
        var toBeRemoved = [];

        for (var i in callback.check[eventName]) {
          if (!callback.check[eventName].hasOwnProperty(i)) {
            continue;
          }

          callback.check[eventName][i].handler(message);

          if (callback.check[eventName][i].once) {
            toBeRemoved.push(callback.check[eventName][i]);
          }
        }

        for (var r in toBeRemoved) {
          if (!toBeRemoved.hasOwnProperty(r)) {
            continue;
          }
          callback.check[eventName].splice(
            callback.check[eventName].indexOf(toBeRemoved[r]),
            1,
          );
        }
      };

      /*
       * Handles configuration changes to sharedsimdata
       */
      var handleConfigChangeMessage = function (message) {
        if (message.handshake.authToken === handshake.authToken) {
          handshake.config = message.handshake.config;
          callConfigChangeListeners(handshake.config);
        }
      };

      /*
       * Handles request to report about value changes
       */
      var handleValueChangeRequestMessage = function (message) {
        if (message.handshake.authToken === handshake.authToken) {
          self.notifyValueChange();
        }
      };

      /*
       * Handles value change messages and update the model accordingly. If the
       * authToken doesn't match our authToken, we ignore the message.
       */
      var handleValueChangeMessage = function (message) {
        if (message.handshake.authToken === handshake.authToken) {
          var changed = [];
          // enumerate through all received values @see SimCapiMessage.values
          _.each(message.values, function (capiValue, key) {
            // check if the key exists in the mapping and is writeable
            if (capiValue && !capiValue.readonly) {
              if (
                outgoingMap[key] &&
                outgoingMap[key].value !== capiValue.value
              ) {
                //By calling set value, we parse the string of capiValue.value
                //to whatever type the outgoingMap has stored
                outgoingMap[key].setValue(capiValue.value);
                changed.push(outgoingMap[key]);
              } else if (!outgoingMap[key]) {
                //key hasn't been exposed yet. Could be a dynamic capi property.
                toBeApplied[key] = capiValue.value;
                changed.push(
                  new SimCapiValue({ value: capiValue.value, key: key }),
                );
              }
            }
          });

          //Ensure that changed object has something in it.
          if (changed.length !== 0) {
            callChangeListeners(changed);
          }
        }
      };

      /*
       * Handles handshake response by storing the authtoken and sending an ON_READY message
       * if the requestToken matches our token. When the requestToken does not match,
       * the message wasn't intended for us so we just ignore it.
       */
      var handleHandshakeResponse = function (message) {
        if (message.handshake.requestToken === handshake.requestToken) {
          handshake.authToken = message.handshake.authToken;
          handshake.config = message.handshake.config;

          if (pendingOnReady) {
            self.notifyOnReady();

            //trigger queue
            for (var i = 0; i < pendingMessages.forHandshake.length; ++i) {
              self.sendMessage(pendingMessages.forHandshake[i]);
            }
            pendingMessages.forHandshake = [];
          }

          callConfigChangeListeners(handshake.config);
        }
      };

      /*
       * Send a HANDSHAKE_REQUEST message.
       */
      var requestHandshake = function () {
        var handshakeRequest = new SimCapiMessage({
          type: SimCapiMessage.TYPES.HANDSHAKE_REQUEST,
          handshake: handshake,
        });

        self.sendMessage(handshakeRequest);
      };

      /*
       * Send an ON_READY message to the viewer.
       */
      this.notifyOnReady = function () {
        if (!handshake.authToken) {
          pendingOnReady = true;

          // once everything is ready, we request a handshake from the viewer.
          requestHandshake();
        } else {
          var onReadyMsg = new SimCapiMessage({
            type: SimCapiMessage.TYPES.ON_READY,
            handshake: handshake,
          });

          // send the message to the viewer
          self.sendMessage(onReadyMsg);
          pendingOnReady = false;

          handshakeListeners.forEach(function (listener) {
            listener(handshake);
          });
          handshakeComplete = true;
          handshakeListeners = [];

          // send initial value snapshot
          self.notifyValueChange();
        }
        if (!iframeUtil.isInIframe()) {
          handleInitialSetupComplete({
            handshake: handshake,
          });
        }
      };

      /*
       * @since 0.4
       * Trigger a check event from the sim
       */
      this.triggerCheck = function (handlers) {
        if (checkTriggered) {
          throw new Error("You have already triggered a check event");
        }

        checkTriggered = true;

        handlers = handlers || {};

        if (handlers.complete) {
          self.addCheckCompleteListener(handlers.complete, true);
        }

        var triggerCheckMsg = new SimCapiMessage({
          type: SimCapiMessage.TYPES.CHECK_REQUEST,
          handshake: handshake,
        });

        pendingMessages.forValueChange.push(triggerCheckMsg);

        //Ensure that there are no more set value calls to be able to send the message.
        self.notifyValueChange();
      };

      this.requestParentContainerResize = function (options, onSuccess) {
        onSuccess = onSuccess || function () {};
        var messageId = ++self.lastMessageId;
        var message = new SimCapiMessage({
          type: SimCapiMessage.TYPES.RESIZE_PARENT_CONTAINER_REQUEST,
          handshake: handshake,
          values: {
            messageId: messageId,
            width: options.width,
            height: options.height,
          },
        });
        this.messageCallbacks[messageId] = {
          onSuccess: onSuccess,
        };
        if (!handshake.authToken) {
          pendingMessages.forHandshake.push(message);
        } else {
          self.sendMessage(message);
        }
      };
      var handleResizeParentContainerResponse = function (message) {
        var messageId = message.values.messageId;
        var callbacks = self.messageCallbacks[messageId];
        delete self.messageCallbacks[messageId];
        if (message.values.responseType === "success") {
          callbacks.onSuccess();
        }
      };
      var setDomainToShortform = function () {
        if (domainUtil.getDomain().indexOf("smartsparrow.com") === -1) {
          return;
        }
        domainUtil.setDomain("smartsparrow.com");
      };
      this.requestInternalViewerAccess = function () {
        var message = new SimCapiMessage({
          type: SimCapiMessage.TYPES.ALLOW_INTERNAL_ACCESS,
          handshake: this.getHandshake(),
        });
        self.sendMessage(message);
      };

      var handleLocalDataChange = function (message) {
        if (
          self.localDataChangedCallbacks[message.values.simId] &&
          self.localDataChangedCallbacks[message.values.simId][
            message.values.key
          ]
        ) {
          self.localDataChangedCallbacks[message.values.simId][
            message.values.key
          ](message.values.value);
        }
      };

      function unregisterLocalDataListener(simId, key) {
        delete self.localDataChangedCallbacks[simId][key];
      }

      /*
       * Register the sim to be notified when local data changes
       */
      this.registerLocalDataListener = function (simId, key, callback) {
        check(simId).isString();
        check(key).isString();

        var message = new SimCapiMessage({
          type: SimCapiMessage.TYPES.REGISTER_LOCAL_DATA_CHANGE_LISTENER,
          handshake: this.getHandshake(),
          values: {
            key: key,
            simId: simId,
          },
        });

        self.localDataChangedCallbacks[simId] =
          self.localDataChangedCallbacks[simId] || {};
        self.localDataChangedCallbacks[simId][key] = callback;

        self.sendMessage(message);

        return unregisterLocalDataListener.bind(this, simId, key);
      };

      /*
       * Send a VALUE_CHANGE message to the viewer with a dump of the model.
       */
      this.notifyValueChange = function () {
        if (handshake.authToken) {
          if (currentTimeout === null) {
            currentTimeout = setTimeout(function () {
              //retrieve the VALUE_CHANGE message
              var valueChangeMsg = self.createValueChangeMsg();

              // send the message to the viewer
              self.sendMessage(valueChangeMsg);

              currentTimeout = null;

              //trigger queue
              for (var i = 0; i < pendingMessages.forValueChange.length; ++i) {
                self.sendMessage(pendingMessages.forValueChange[i]);
              }
              pendingMessages.forValueChange = [];
            }, timeoutAmount);
          }
        }
        return null;
      };

      /*
       *   Creates the value change message
       */
      this.createValueChangeMsg = function () {
        //retrieve the VALUE_CHANGE message
        var valueChangeMsg = new SimCapiMessage({
          type: SimCapiMessage.TYPES.VALUE_CHANGE,
          handshake: self.getHandshake(),
        });

        // populate the message with the values of the entire model
        valueChangeMsg.values = outgoingMap;

        return valueChangeMsg;
      };

      this.setValue = function (simCapiValue) {
        check(simCapiValue).isOfType(SimCapiValue);

        outgoingMap[simCapiValue.key] = simCapiValue;

        this.notifyValueChange();
      };

      this.expose = function (simCapiValue) {
        check(simCapiValue).isOfType(SimCapiValue);

        var key = simCapiValue.key;
        var overwriteValue = checkForExistingValues(key);

        if (overwriteValue !== undefined) {
          simCapiValue.setValue(overwriteValue);
          callChangeListeners([simCapiValue]);

          if (
            simCapiValue.value instanceof Array &&
            (simCapiValue.type === SimCapiTypes.TYPES.ARRAY ||
              simCapiValue.type === SimCapiTypes.TYPES.ARRAY_POINT)
          ) {
            simCapiValue.value = simCapiValue.toString();
          }
        }

        outgoingMap[key] = simCapiValue;

        this.notifyValueChange();
      };

      var checkForExistingValues = function (key) {
        var noMapValue = toBeApplied[key],
          existingValue = outgoingMap[key],
          overwriteValue;

        if (noMapValue) {
          overwriteValue = noMapValue;
          delete toBeApplied[key];
        } else if (existingValue) {
          overwriteValue = existingValue.value;
        }

        return overwriteValue;
      };

      /*
       * key - the key of the SimCapiValue to be removed
       */
      this.removeValue = function (key) {
        outgoingMap[key] = null;

        this.notifyValueChange();
      };

      // Helper to send message to viewer
      this.sendMessage = function (message) {
        // window.parent can be itself if it's not inside an iframe
        if (iframeUtil.isInIframe()) {
          try {
            // console.log (window, window.parent)
            window.parent.postMessage(JSON.stringify(message), "*");
          } catch (error) {
            console.log(error);
          }
        }
      };

      // Calls all the changeListeners
      var callChangeListeners = function (values) {
        _.each(changeListeners, function (changeListener) {
          changeListener(values);
        });
      };

      // Calls all the configChangeListeners
      var callConfigChangeListeners = function (config) {
        _.each(configChangeListeners, function (changeListener) {
          changeListener(config);
        });
      };

      // Returns the initial configuration passed in the handshake
      this.getConfig = function () {
        return handshake.config;
      };

      // handler for postMessages received from the viewer
      var messageEventHandler = function (event) {
        var message;
        try {
          message = JSON.parse(event.data);
        } catch (e) {}

        if (message) {
          self.capiMessageHandler(message);
        }
      };

      // we have to wait until the dom is ready to attach anything or sometimes the js files
      // haven't finished loading and crap happens.
      $(document).ready(function () {
        // attach event listener for messages received from the viewer
        window.addEventListener("message", messageEventHandler);
      });
    };

    var _instance = null;
    var getInstance = function () {
      if (!_instance) {
        _instance = new Transporter();
      }

      return _instance;
    };

    // in reality, we want a singleton but not for testing.
    return {
      getInstance: getInstance,
      Transporter: Transporter,
    };
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/CapiModel", ["underscore"], function (_) {
    var CapiModel = function (attrs, methods) {
      _.extend(this, methods);
      this.attributes = _.clone(attrs || {});

      /*
       * key: change:prop
       * value: Array of functions
       */
      this._eventsMap = {};

      var bindGetterAndSetter = function (value, prop) {
        Object.defineProperty(this, prop, {
          get: function () {
            return this.attributes[prop];
          },
          set: function (val) {
            if (this.attributes[prop] !== val) {
              this.attributes[prop] = val;
              this.trigger("change:" + prop);
            }
          },
          enumerable: true,
        });
      };

      this.set = function (attrName, value) {
        if (!this.has(attrName) && !this.hasOwnProperty(attrName)) {
          this.attributes[attrName] = value;
          bindGetterAndSetter.call(this, value, attrName);
          this.trigger("change:" + attrName);
        } else {
          this[attrName] = value;
        }
      };

      this.get = function (attrName) {
        return this[attrName];
      };

      this.has = function (attrName) {
        return this.attributes[attrName] !== undefined;
      };

      this.on = function (eventNames, funct) {
        var eventNamesArray = eventNames.split(" ");

        _.each(
          eventNamesArray,
          function (eventName) {
            var array = this._eventsMap[eventName];

            if (array) {
              array.push(funct);
            } else {
              this._eventsMap[eventName] = [funct];
            }
          },
          this,
        );
      };

      this.off = function (eventNames, funct) {
        var eventNamesArray = eventNames.split(" ");

        _.each(
          eventNamesArray,
          function (eventName) {
            var array = this._eventsMap[eventName];

            if (array) {
              var indexOf = array.indexOf(funct);

              if (indexOf !== -1) {
                array.splice(indexOf, 1);
              }
            }
          },
          this,
        );
      };

      this.trigger = function (eventName) {
        if (this._eventsMap[eventName]) {
          _.each(
            this._eventsMap[eventName],
            function (funct) {
              var propName = eventName.replace("change:", "");

              funct.call(this, this, this.get(propName));
            },
            this,
          );
        }
      };

      /* Converts all attribute to getters and setters */
      _.each(this.attributes, bindGetterAndSetter, this);

      if (this.initialize) {
        this.initialize();
      }
    };

    return CapiModel;
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/adapters/CapiAdapter", [
    "underscore",
    "api/snapshot/Transporter",
    "api/snapshot/SimCapiMessage",
    "api/snapshot/SimCapiValue",
    "check",
    "api/snapshot/CapiModel",
    "api/snapshot/SimCapiTypes",
  ], function (
    _,
    Transporter,
    SimCapiMessage,
    SimCapiValue,
    check,
    CapiModel,
    SimCapiTypes,
  ) {
    var CapiAdapter = function (options) {
      options = options || {};

      var _transporter = options.transporter || Transporter.getInstance();

      var modelsMapping = options.modelsMapping || {};

      /*
       * Allows the 'attributes' to be exposed.
       * @param attrName - The 'attribute name'
       * @param parent - What the 'attribute' belongs to. Must also have a 'get' and 'set function.
       * @param params : {
       *      alias  : alias of the attributeName
       *      type : Type of the 'attribute'. @see SimCapiTypes.TYPES.
       *      readonly : True if and only if, the attribute cannot be changed.
       *      writeonly : True if and only if, the attribute is write-only.
       * }
       */
      this.expose = function (varName, parent, params) {
        params = params || {};

        if (parent.has(varName)) {
          var simCapiParams = params;
          var originalName = varName;
          var alias = params.alias || varName;

          var capiValue = new SimCapiValue({
            key: alias,
            value: parent.get(varName),
            type: params.type,
            readonly: params.readonly,
            writeonly: params.writeonly,
            allowedValues: params.allowedValues,
          });

          if (
            capiValue.type === SimCapiTypes.TYPES.ARRAY ||
            capiValue.type === SimCapiTypes.TYPES.ARRAY_POINT
          ) {
            capiValue.value = "[" + parent.get(originalName).toString() + "]";
          }

          var watchFunc = _.bind(function (m, value) {
            var capiValue = new SimCapiValue({
              key: alias,
              value: value,
              type: simCapiParams.type,
              readonly: simCapiParams.readonly,
              writeonly: simCapiParams.writeonly,
              allowedValues: params.allowedValues,
            });

            if (
              capiValue.type === SimCapiTypes.TYPES.ARRAY ||
              capiValue.type === SimCapiTypes.TYPES.ARRAY_POINT
            ) {
              capiValue.value = "[" + parent.get(originalName).toString() + "]";
            }

            _transporter.setValue(capiValue);
          }, this);

          // listen to the model by attaching event handler on the parent
          parent.on("change:" + varName, watchFunc);

          modelsMapping[alias] = {
            alias: alias,
            parent: parent,
            originalName: originalName,
            watchFunc: watchFunc,
          };

          _transporter.expose(capiValue);
        }
      };

      /*
       * Allows the 'attributes' to be unexposed.
       * @param attrName - the 'attribute name'
       * @param parent - the model the attribute belongs to
       */
      this.unexpose = function (varName, parent) {
        var modelMap;

        if (modelsMapping[varName]) {
          modelMap = modelsMapping[varName];
        } else {
          //could be under an alias
          modelMap = _.findWhere(modelsMapping, {
            originalName: varName,
          });
        }

        if (modelMap) {
          parent.off("change:" + varName, modelMap.watchFunc);

          _transporter.removeValue(modelMap.alias);

          delete modelsMapping[modelMap.alias];
        } else {
          throw new Error(varName + " doesn't exist on the model");
        }
      };

      /*
       * values - Array of SimCapiValue
       */
      this.handleValueChange = function (values) {
        // enumerate through all received values @see SimCapiMessage.values
        _.each(
          values,
          function (capiValue) {
            if (modelsMapping[capiValue.key]) {
              var parent = modelsMapping[capiValue.key].parent;
              var originalName = modelsMapping[capiValue.key].originalName;

              parent.set(originalName, capiValue.value);
            }
          },
          this,
        );
      };

      _transporter.addChangeListener(_.bind(this.handleValueChange, this));
    };

    var _instance = null;
    var getInstance = function () {
      if (!_instance) {
        _instance = new CapiAdapter();
        _instance.CapiModel = CapiModel;
      }
      return _instance;
    };

    // in reality, we want a singleton but not for testing.
    return {
      getInstance: getInstance,
      CapiAdapter: CapiAdapter,
    };
  });

  /**
   * @license
   * Adaptive E-Learning Sim Control API (CAPI).
   *
   * Copyright 2011 Smart Sparrow Pty. Ltd.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  define("api/snapshot/adapters/BackboneAdapter", [
    "underscore",
    "api/snapshot/Transporter",
    "api/snapshot/SimCapiMessage",
    "api/snapshot/SimCapiValue",
    "api/snapshot/SimCapiTypes",
    "check",
  ], function (
    _,
    Transporter,
    SimCapiMessage,
    SimCapiValue,
    SimCapiTypes,
    check,
  ) {
    var BackboneAdapter = function (options) {
      options = options || {};

      var _transporter = options.transporter || Transporter.getInstance();

      var modelsMapping = options.modelsMapping || {};

      /*
     * Allows the 'attributes' to be exposed.
     * @param attrName - The 'attribute name'
     * @param model - What the 'attribute' belongs to. Must also have a 'get' and 'set function.
     * @param params : {
     *      alias  : alias of the attributeName
     *      type : Type of the 'attribute'. @see SimCapiTypes.TYPES.
     *      readonly : True if and only if, the attribute cannot be changed.
     *      writeonly : True if and only if, the attribute is write-only.
            bindTo: optional - capi property (string) this property will bind to
     * }
     */
      this.expose = function (varName, model, params) {
        params = params || {};

        if (model.has(varName)) {
          var simCapiParams = params;
          var originalName = varName;
          var alias = params.alias || varName;

          var capiValue = new SimCapiValue({
            key: alias,
            value: model.get(varName),
            type: params.type,
            readonly: params.readonly,
            writeonly: params.writeonly,
            allowedValues: params.allowedValues,
            bindTo: params.bindTo,
          });

          if (
            capiValue.type === SimCapiTypes.TYPES.ARRAY ||
            capiValue.type === SimCapiTypes.TYPES.ARRAY_POINT
          ) {
            capiValue.value = "[" + model.get(originalName).toString() + "]";
          }

          var exposeFunc = _.bind(function () {
            var value = model.get(varName);
            var capiValue = new SimCapiValue({
              key: alias,
              value: value,
              type: simCapiParams.type,
              readonly: simCapiParams.readonly,
              writeonly: simCapiParams.writeonly,
              allowedValues: params.allowedValues,
            });

            if (
              capiValue.type === SimCapiTypes.TYPES.ARRAY ||
              capiValue.type === SimCapiTypes.TYPES.ARRAY_POINT
            ) {
              capiValue.value = "[" + model.get(originalName).toString() + "]";
            }

            _transporter.setValue(capiValue);
          }, this);

          // listen to the model by attaching event handler on the model
          model.on("change:" + varName, exposeFunc);

          modelsMapping[alias] = {
            alias: alias,
            model: model,
            originalName: originalName,
            exposeFunc: exposeFunc,
          };

          _transporter.expose(capiValue);
        }
      };

      /*
       * Allows the 'attributes' to be unexposed
       * @param attrName - The 'attribute name'
       * @param model - The model the attribute belongs to.
       */
      this.unexpose = function (varName, model) {
        var modelMap;

        if (modelsMapping[varName]) {
          modelMap = modelsMapping[varName];
        } else {
          //could be under an alias
          modelMap = _.findWhere(modelsMapping, {
            originalName: varName,
            model: model,
          });
        }

        if (modelMap) {
          model.off("change:" + modelMap.originalName, modelMap.exposeFunc);

          _transporter.removeValue(modelMap.alias);

          delete modelsMapping[modelMap.alias];
        } else {
          throw new Error(varName + " doesn't exist on the model.");
        }
      };

      /*
       * Exposes a whole model. Model must have property `capiProperties` for the options of each
       * attribute to be exposed.
       */
      this.exposeModel = function (model) {
        _.each(
          model.capiProperties,
          _.bind(function (params, varName) {
            params.model = model;
            this.expose(varName, params);
          }, this),
        );
      };

      /*
       * values - Array of SimCapiValue
       */
      this.handleValueChange = function (values) {
        // enumerate through all received values @see SimCapiMessage.values
        _.each(
          values,
          function (capiValue) {
            if (modelsMapping[capiValue.key]) {
              var model = modelsMapping[capiValue.key].model;
              var originalName = modelsMapping[capiValue.key].originalName;

              model.set(originalName, capiValue.value);
            }
          },
          this,
        );
      };

      _transporter.addChangeListener(_.bind(this.handleValueChange, this));
    };

    var _instance = null;
    var getInstance = function () {
      if (!_instance) {
        _instance = new BackboneAdapter();
      }
      return _instance;
    };

    // in reality, we want a singleton but not for testing.
    return {
      getInstance: getInstance,
      BackboneAdapter: BackboneAdapter,
    };
  });

  root.simcapi = {
    Transporter: require("api/snapshot/Transporter").getInstance(),
    BackboneAdapter:
      require("api/snapshot/adapters/BackboneAdapter").getInstance(),
    CapiAdapter: require("api/snapshot/adapters/CapiAdapter").getInstance(),
    noConflict: function () {
      root.simcapi = previousSimcapi;
      return root.simcapi;
    },
  };
}).call(this);
