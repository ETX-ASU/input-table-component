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

// Define our color palette using ETX colors
// Each array represents a variation level (from darkest to lightest)
// Order: Blue, Orange, Purple, Green, Red, Yellow, Dark Gray, Light Gray
const colorPalette = [
  // 100% variations (row 1)
  [
    "#006586",
    "#d77009",
    "#5b2778",
    "#195e2f",
    "#bd1f2e",
    "#fce300",
    "#333333",
    "#999999",
  ],
  // 80% variations (row 2)
  [
    "#3398b9",
    "#df8d3a",
    "#7c5293",
    "#477e59",
    "#ca4c58",
    "#fde933",
    "#484848",
    "#adadad",
  ],
  // 60% variations (row 3)
  [
    "#66b2cb",
    "#e7a96b",
    "#9d7dae",
    "#759e82",
    "#d77982",
    "#fdee66",
    "#5c5c5c",
    "#c2c2c2",
  ],
  // 40% variations (row 4)
  [
    "#99cbdc",
    "#efc69d",
    "#bda9c9",
    "#a3bfac",
    "#e5a5ab",
    "#fef4cc",
    "#717171",
    "#d6d6d6",
  ],
  // 20% variations (row 5)
  [
    "#cce5ee",
    "#ffe8cc",
    "#ded4e4",
    "#d1dfd5",
    "#f2d2d5",
    "#fef9cc",
    "#858585",
    "#ebebeb",
  ],
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
            <div className="grid grid-cols-8 gap-1">
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
    </div>
  );
}
