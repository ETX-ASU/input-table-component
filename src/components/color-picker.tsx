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

// Define our color palette - reorganized by variation
// Each array represents a variation level (from darkest to lightest)
// Each item in the array represents a color family (red, orange, yellow, green, blue, purple, neutral)
const colorPalette = [
  // Darkest variations (row 1)
  ["#EF5350", "#FFA726", "#FFEE58", "#66BB6A", "#42A5F5", "#AB47BC", "#000000"],
  // Dark variations (row 2)
  ["#E57373", "#FFB74D", "#FFF176", "#81C784", "#64B5F6", "#BA68C8", "#9E9E9E"],
  // Light variations (row 3)
  ["#EF9A9A", "#FFCC80", "#FFF59D", "#A5D6A7", "#90CAF9", "#CE93D8", "#E0E0E0"],
  // Lightest variations (row 4)
  ["#FFCDD2", "#FFE0B2", "#FFF9C4", "#C8E6C9", "#BBDEFB", "#E1BEE7", "#FFFFFF"],
];

export function ColorPicker({
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
                  className="h-8 w-8 cursor-pointer rounded-md border border-gray-200"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onChange(color);
                    setIsOpen(false);
                  }}
                  aria-label={`Select color ${color}`}
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
  );
}
