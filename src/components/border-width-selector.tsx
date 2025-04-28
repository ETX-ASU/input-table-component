import { FlagIcon as BorderAll } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface BorderWidthSelectorProps {
  value: number;
  onChange: (width: number) => void;
  disabled?: boolean;
}

// Border width options
const borderWidthOptions = [
  { value: 0.5, label: "Thin" },
  { value: 1, label: "Medium" },
  { value: 2, label: "Thick" },
];

export function BorderWidthSelector({
  value,
  onChange,
  disabled = false,
}: BorderWidthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div id="border-width-selector">
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative h-8 w-8 p-0"
            disabled={disabled}
          >
            <BorderAll className="h-4 w-4" />
            {/* Horizontal line indicator at the bottom of the button */}
            <div
              className="absolute right-1 bottom-1 left-1"
              style={{
                backgroundColor: "#000000",
                height: value,
              }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-40 p-2"
          style={{ zIndex: 9999 }}
          align="start"
          side="top"
          sideOffset={5}
          avoidCollisions={true}
          collisionPadding={20}
        >
          <div className="space-y-1">
            <div className="mb-1 text-sm font-medium">Border Width</div>
            {borderWidthOptions.map((option) => (
              <Button
                key={option.value}
                variant={value === option.value ? "default" : "outline"}
                className="h-8 w-full justify-start text-sm"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <div className="flex w-full items-center">
                  {/* Horizontal line representation */}
                  <div className="mr-2 flex h-6 w-6 items-center justify-center">
                    <div
                      className="w-full bg-black"
                      style={{ height: option.value }}
                    />
                  </div>
                  {option.label}
                </div>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
