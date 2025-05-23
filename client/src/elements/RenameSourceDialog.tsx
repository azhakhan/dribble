import { useState, useEffect } from "react";
import { renameSource } from "@/lib/api";
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
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface RenameSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
}

export const RenameSourceDialog = ({
  open,
  onOpenChange,
  sourceId,
  sourceName
}: RenameSourceDialogProps) => {
  const [newName, setNewName] = useState(sourceName);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Reset name when dialog opens or sourceName changes
  useEffect(() => {
    if (open) {
      setNewName(sourceName);
    }
  }, [open, sourceName]);

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("Source name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      await renameSource(sourceId, newName);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(`Source renamed to "${newName}"`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to rename source");
      console.error("Failed to rename source:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Source</DialogTitle>
          <DialogDescription>Enter a new name for the source.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="new-name" className="text-right text-sm font-medium">
              New Name
            </label>
            <Input
              id="new-name"
              className="col-span-3"
              value={newName}
              onChange={handleInputChange}
              disabled={loading}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleRename} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Renaming...
              </>
            ) : (
              "Rename"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
