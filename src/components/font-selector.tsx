import clsx from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
  disabled?: boolean;
  invisible?: boolean;
}

enum WebSafeFont {
  Arial = "Arial, sans-serif",
  Helvetica = "Helvetica, Arial, sans-serif",
  Verdana = "Verdana, Geneva, sans-serif",
  Tahoma = "Tahoma, Geneva, sans-serif",
  TrebuchetMS = "Trebuchet MS, sans-serif",
  TimesNewRoman = "Times New Roman, Times, serif",
  Georgia = "Georgia, serif",
  Garamond = "Garamond, serif",
  CourierNew = "Courier New, monospace",
  BrushScriptMT = "Brush Script MT, cursive",
}

const fontOptions: { value: WebSafeFont; label: string }[] = [
  { value: WebSafeFont.Arial, label: "Arial" },
  { value: WebSafeFont.Helvetica, label: "Helvetica" },
  { value: WebSafeFont.Verdana, label: "Verdana" },
  { value: WebSafeFont.Tahoma, label: "Tahoma" },
  { value: WebSafeFont.TrebuchetMS, label: "Trebuchet MS" },
  { value: WebSafeFont.TimesNewRoman, label: "Times New Roman" },
  { value: WebSafeFont.Georgia, label: "Georgia" },
  { value: WebSafeFont.Garamond, label: "Garamond" },
  { value: WebSafeFont.CourierNew, label: "Courier New" },
  { value: WebSafeFont.BrushScriptMT, label: "Brush Script MT" },
];

function FontSelector({
  value,
  onChange,
  disabled = false,
  invisible = false,
}: FontSelectorProps) {
  const [open, setOpen] = useState(false);

  // Find the current font label
  const currentFont =
    fontOptions.find((font) => font.value === value) || fontOptions[0];

  return (
    <div id="font-selector">
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={clsx(
              "w-[80px] justify-start overflow-hidden border-none bg-transparent",
              invisible && "invisible",
            )}
            disabled={disabled}
          >
            <div className="flex flex-1 items-center gap-2 truncate">
              <span className="truncate" style={{ fontFamily: value }}>
                {currentFont.label}
              </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-0" style={{ zIndex: 9999 }}>
          <Command>
            <CommandInput placeholder="Search font..." />
            <CommandList>
              <CommandEmpty>No font found.</CommandEmpty>
              <CommandGroup>
                {fontOptions.map((font) => (
                  <CommandItem
                    key={font.value}
                    value={font.label}
                    onSelect={() => {
                      onChange(font.value);
                      setOpen(false);
                    }}
                  >
                    <span
                      className="flex w-full items-center"
                      style={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </span>
                    {value === font.value && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { FontSelector, WebSafeFont };
