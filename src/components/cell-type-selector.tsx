import clsx from "clsx";
import { Check, Hash, ListFilter, Lock, TextIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import useSpreadsheetStore, { CellContentType } from "../lib/store";
import { Icon } from "./Icon";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
interface CellTypeSelectorProps {
  value: CellContentType;
  onChange: (type: CellContentType) => void;
  selectOptions: string[];
  onSelectOptionsChange: (options: string[]) => void;
  disabled?: boolean;
  correctAnswer: string | null;
  onCorrectAnswerChange: (correctAnswer: string) => void;
  invisible?: boolean;
}

const cellTypeOptions = [
  { value: "not-editable", label: "Not Editable", icon: Lock },
  { value: "text", label: "Text input", icon: TextIcon },
  { value: "number", label: "Number input", icon: Hash },
  { value: "select", label: "Select input", icon: ListFilter },
];

export function CellTypeSelector({
  value,
  onChange,
  selectOptions,
  onSelectOptionsChange,
  disabled = false,
  correctAnswer,
  onCorrectAnswerChange,
  invisible = false,
}: CellTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const { setIsSelectOptionsDialogOpen, isSelectOptionsDialogOpen } =
    useSpreadsheetStore();
  const [optionsInput, setOptionsInput] = useState("");
  const [tempOptions, setTempOptions] = useState<string[]>([]);
  const [selectedCorrectAnswer, setSelectedCorrectAnswer] =
    useState(correctAnswer);

  useEffect(() => {
    setSelectedCorrectAnswer(correctAnswer);
  }, [correctAnswer]);

  useEffect(() => {
    setTempOptions([...selectOptions]);
  }, [selectOptions]);

  const handleTypeChange = (type: CellContentType) => {
    onChange(type);
    setOpen(false);

    // If changing to select type, open the options dialog
    if (type === "select") {
      setIsSelectOptionsDialogOpen(true);
    }
  };

  const handleAddOption = () => {
    if (optionsInput.trim() && !tempOptions.includes(optionsInput.trim())) {
      setTempOptions([...tempOptions, optionsInput.trim()]);
      setOptionsInput("");
    }
  };

  const handleCorrectAnswerChange = (value: string) => {
    setSelectedCorrectAnswer(value);
  };

  const handleRemoveOption = (option: string) => {
    setTempOptions(tempOptions.filter((o) => o !== option));

    if (option === selectedCorrectAnswer) {
      setSelectedCorrectAnswer(null);
    }
  };

  const handleSaveOptions = () => {
    if (!selectedCorrectAnswer || !tempOptions.length) return;

    onCorrectAnswerChange(selectedCorrectAnswer);
    onSelectOptionsChange(tempOptions);
    setIsSelectOptionsDialogOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    }
  };

  // Handle dialog close
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (!tempOptions.length) onChange("not-editable");
      setTempOptions([]);
      setSelectedCorrectAnswer(null);
      setIsSelectOptionsDialogOpen(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            id="cell-type-selector"
            size="icon"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={clsx(
              "border-none bg-transparent",
              invisible && "invisible",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon name="cell-type" className="h-10 w-10" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" style={{ zIndex: 9999 }}>
          <Command>
            <CommandList>
              <CommandGroup>
                {cellTypeOptions.map((type) => (
                  <CommandItem
                    key={type.value}
                    value={type.label}
                    onSelect={() =>
                      handleTypeChange(type.value as CellContentType)
                    }
                  >
                    <div className="flex items-center gap-2">
                      {type.icon && <type.icon className="h-4 w-4" />}
                      <span>{type.label}</span>
                    </div>
                    {value === type.value && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Dialog for configuring select options */}
      <Dialog
        open={isSelectOptionsDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Select Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="option-input">Add Option</Label>
                <Input
                  id="option-input"
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter option value"
                />
              </div>
              <Button type="button" onClick={handleAddOption}>
                Add
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Current Options</Label>
              {tempOptions.length === 0 ? (
                <div className="rounded-md border p-2 text-sm text-muted-foreground">
                  No options added. Add at least one option.
                </div>
              ) : (
                <div className="max-h-[200px] divide-y overflow-y-auto rounded-md border">
                  <RadioGroup
                    value={selectedCorrectAnswer}
                    onValueChange={handleCorrectAnswerChange}
                    className="w-full"
                  >
                    {tempOptions.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2"
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <RadioGroupItem
                            value={option}
                            id={`option-${index}`}
                          />
                          <Label
                            htmlFor={`option-${index}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            {option}
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOption(option)}
                          className="h-8 w-8 p-0"
                          disabled={tempOptions.length <= 1}
                        >
                          &times;
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSelectOptionsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={tempOptions.length === 0 || !selectedCorrectAnswer}
              onClick={handleSaveOptions}
            >
              Save Options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
