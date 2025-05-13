import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Icon } from "./Icon";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface BorderWidthSelectorProps {
  value: number;
  onChange: (width: number) => void;
  disabled?: boolean;
}

// Border width options
const borderWidthOptions = [
  { value: 0.5, label: "None" },
  { value: 1, label: "1px" },
  { value: 2, label: "2px" },
  { value: 3, label: "3px" },
  { value: 4, label: "4px" },
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
            <Icon name="cell-border-width" className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[200px] p-0"
          style={{ zIndex: 9999 }}
          align="start"
          side="top"
          sideOffset={5}
          avoidCollisions={true}
          collisionPadding={20}
        >
          <Command>
            <CommandList>
              <CommandGroup>
                {borderWidthOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {option.label !== "None" && (
                        <div className="flex h-6 w-10 items-center justify-center">
                          <div
                            className="w-full bg-black"
                            style={{ height: option.value }}
                          />
                        </div>
                      )}
                      <span>{option.label}</span>
                    </div>
                    {value === option.value && (
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
