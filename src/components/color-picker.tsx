import clsx from "clsx";
import { Palette, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  defaultColor: string;
  label?: string;
}

const blue = {
  dark80: "#00516B",
  dark60: "#003D50",
  100: "#006586",
  80: "#3398B9",
  60: "#66B2CB",
  40: "#99CBDC",
  20: "#CCE5EE",
} as const;

const orange = {
  dark80: "#AC5A07",
  dark60: "#814305",
  100: "#D77009",
  80: "#DF8D3A",
  60: "#E7A96B",
  40: "#EFC69D",
  20: "#FDE933",
} as const;

const purple = {
  dark80: "#491F60",
  dark60: "#371748",
  100: "#5B2778",
  80: "#7C5293",
  60: "#9D7DAE",
  40: "#BDA9C9",
  20: "#DED4E4",
} as const;

const green = {
  dark80: "#144B26",
  dark60: "#0F381C",
  100: "#195E2F",
  80: "#477E59",
  60: "#759E82",
  40: "#A3BFAC",
  20: "#D1DFD5",
} as const;

const red = {
  dark80: "#971925",
  dark60: "#71131C",
  100: "#BD1F2E",
  80: "#CA4C58",
  60: "#D77982",
  40: "#E5A5AB",
  20: "#F2D2D5",
} as const;

const yellow = {
  dark80: "#CAB600",
  dark60: "#978800",
  100: "#FCE300",
  80: "#FDE933",
  60: "#FDEE66",
  40: "#FEF4CC",
  20: "#FEF9CC",
} as const;

const gray = {
  dark80: "#000000",
  dark60: "#242424",
  100: "#333333",
  80: "#484848",
  60: "#5C5C5C",
  40: "#999999",
  20: "#ADADAD",
} as const;

const lightGray = {
  dark80: "#FFFFFF",
  dark60: "#F5F5F5",
  100: "#C2C2C2",
  80: "#CCCCCC",
  60: "#D6D6D6",
  40: "#E2E2E2",
  20: "#EBEBEB",
} as const;

// Define our color palette using ETX colors

const colorPalette = [
  blue,
  orange,
  purple,
  green,
  red,
  yellow,
  gray,
  lightGray,
].map((color) => [
  color[100],
  color[80],
  color[60],
  color[40],
  color[20],
  color.dark60,
  color.dark80,
]);

function ColorPicker({
  value,
  onChange,
  disabled = false,
  defaultColor,
  label = "Color Palette",
}: ColorPickerProps) {
  const [customColor, setCustomColor] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update custom color input when value changes
  useEffect(() => {
    setCustomColor(value);
  }, [value]);

  // Handle custom color input change
  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value);
  };

  // Handle custom color input blur
  const handleCustomColorBlur = () => {
    // Validate hex color format
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(customColor);
    if (isValidHex) {
      onChange(customColor);
    } else {
      setCustomColor(value);
    }
  };

  // Handle custom color input key down
  const handleCustomColorKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  // Handle reset to default color
  const handleReset = () => {
    onChange(defaultColor);
    setCustomColor(defaultColor);
    setIsOpen(false);
  };

  return (
    <div id="color-picker">
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative h-8 w-8 p-0"
            disabled={disabled}
          >
            <Palette className="h-4 w-4" />
            <div
              className="absolute right-0 bottom-0 left-0 h-1"
              style={{ backgroundColor: value }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-3"
          style={{ zIndex: 9999 }}
          align="start"
          side="top"
          sideOffset={5}
          avoidCollisions={true}
          collisionPadding={20}
        >
          <div className="space-y-3">
            <div className="flex">
              <div className="flex-1 text-sm font-medium">{label}</div>
              <div>
                <button className="cursor-pointer" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Color grid */}
            <div className="grid grid-cols-7 gap-1">
              {colorPalette.map((row, rowIndex) =>
                row.map((color, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={clsx(
                      "h-8 w-8 rounded-md",
                      color && "cursor-pointer border border-gray-200",
                    )}
                    style={{ backgroundColor: color || "transparent" }}
                    onClick={() => {
                      if (color) {
                        onChange(color);
                        setIsOpen(false);
                      }
                    }}
                    disabled={!color}
                    aria-label={color ? `Select color ${color}` : undefined}
                  />
                )),
              )}
            </div>

            <div className="pt-2">
              <div className="mb-1 text-sm font-medium">Custom Color</div>
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-md border border-gray-200"
                  style={{ backgroundColor: customColor }}
                />
                <Input
                  ref={inputRef}
                  value={customColor}
                  onChange={handleCustomColorChange}
                  onBlur={handleCustomColorBlur}
                  onKeyDown={handleCustomColorKeyDown}
                  placeholder="#RRGGBB"
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export {
  blue,
  ColorPicker,
  gray,
  green,
  lightGray,
  orange,
  purple,
  red,
  yellow,
};
