import { Link } from "lucide-react";
import { useEffect, useState } from "react";
import useSpreadsheetStore from "../lib/store";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Toggle } from "./ui/toggle";

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string | null) => void;
  initialUrl: string | null;
}

function LinkDialog({ isOpen, onClose, onSave, initialUrl }: LinkDialogProps) {
  const [url, setUrl] = useState<string>(initialUrl || "");

  // Update URL when initialUrl changes
  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl || "");
    }
  }, [isOpen, initialUrl]);

  const handleSave = () => {
    if (url.trim() === "") {
      onSave(null);
    } else {
      // Add protocol if missing
      let formattedUrl = url.trim();
      if (formattedUrl && !formattedUrl.match(/^https?:\/\//i)) {
        formattedUrl = "https://" + formattedUrl;
      }
      onSave(formattedUrl);
    }
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="url" className="text-right">
              URL
            </Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="col-span-3"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleRemove} type="button">
            Remove Link
          </Button>
          <div>
            <Button variant="outline" onClick={onClose} className="mr-2">
              Cancel
            </Button>
            <Button onClick={handleSave} type="submit">
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LinkButtonProps {
  link: string | null;
  disabled: boolean;
  onSave: (url: string | null) => void;
}

export function LinkButton({ link, disabled, onSave }: LinkButtonProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const { appMode } = useSpreadsheetStore();
  const isPreviewMode = appMode === "preview";

  return (
    <div id="link-button">
      <Toggle
        aria-label="Toggle link"
        pressed={link !== null}
        onPressedChange={() => {
          if (isPreviewMode) return;
          setIsLinkDialogOpen(true);
        }}
        disabled={disabled}
      >
        <Link className="h-4 w-4" />
      </Toggle>
      <LinkDialog
        isOpen={isLinkDialogOpen}
        onClose={() => setIsLinkDialogOpen(false)}
        onSave={onSave}
        initialUrl={link}
      />
    </div>
  );
}
