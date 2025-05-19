import clsx from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface FontSizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
  disabled?: boolean;
  invisible?: boolean;
}

const sizes = [12, 14, 16, 20, 24, 30, 36];

function FontSizeSelector({
  value,
  onChange,
  disabled = false,
  invisible = false,
}: FontSizeSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div id="font-size-selector">
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={clsx(
              "w-[60px] justify-start overflow-hidden border-none bg-transparent",
              invisible && "invisible",
            )}
            disabled={disabled}
          >
            <div className="flex flex-1 items-center gap-2 truncate">
              <span className="truncate">{value}</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[100px] p-0" style={{ zIndex: 9999 }}>
          <Command>
            <CommandList>
              <CommandGroup>
                {sizes.map((size) => (
                  <CommandItem
                    key={size}
                    value={size.toString()}
                    onSelect={() => {
                      onChange(size);
                      setOpen(false);
                    }}
                  >
                    <span className="flex w-full items-center">{size}</span>
                    {value === size && <Check className="ml-auto h-4 w-4" />}
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

export { FontSizeSelector };
