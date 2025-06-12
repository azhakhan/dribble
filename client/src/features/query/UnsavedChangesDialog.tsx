import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Save, X } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  tabTitle: string;
  action?: "close" | "closeOthers" | "closeToRight" | null;
  loading?: boolean;
}

export const UnsavedChangesDialog = ({
  open,
  onOpenChange,
  onSave,
  onDiscard,
  tabTitle,
  action = "close",
  loading = false
}: UnsavedChangesDialogProps) => {
  const [saving, setSaving] = useState(false);

  // Get action-specific text
  const getActionText = () => {
    switch (action) {
      case "closeOthers":
        return "close other tabs";
      case "closeToRight":
        return "close tabs to the right";
      default:
        return "continue";
    }
  };

  const getDescription = () => {
    if (action === "closeOthers") {
      return `You have unsaved changes in "${tabTitle}" and possibly other tabs. What would you like to do with your changes before closing other tabs?`;
    } else if (action === "closeToRight") {
      return `You have unsaved changes in "${tabTitle}" and possibly other tabs. What would you like to do with your changes before closing tabs to the right?`;
    } else {
      return `You have unsaved changes in "${tabTitle}". What would you like to do with your changes?`;
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Unsaved Changes</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left">{getDescription()}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 items-center justify-center">
          <DialogClose asChild>
            <Button
              variant="outline"
              size="xs"
              className="cursor-pointer"
              disabled={saving || loading}
            >
              Keep Editing
            </Button>
          </DialogClose>
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={saving || loading}
            className="text-destructive hover:text-destructive cursor-pointer"
            size="xs"
          >
            <X className="h-4 w-4 mr-2" />
            Discard Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            size="xs"
            className="cursor-pointer"
          >
            {saving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-pulse" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save & {getActionText()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
