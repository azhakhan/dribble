import { useState, useEffect } from "react";
import { deleteSource } from "@/shared/lib/api";
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
import { useSourceStore } from "@/shared/store";
import { toast } from "sonner";

interface DeleteSourceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
}

export const DeleteSource = ({ open, onOpenChange, sourceId, sourceName }: DeleteSourceProps) => {
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { loadSources } = useSourceStore();

  // Reset confirmation when dialog opens
  useEffect(() => {
    if (open) {
      setConfirmName("");
    }
  }, [open]);

  const handleDelete = async () => {
    if (confirmName !== sourceName) {
      toast.error("Source name doesn't match");
      return;
    }

    try {
      setLoading(true);
      await deleteSource(sourceId);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      await loadSources();
      toast.success(`Source "${sourceName}" deleted successfully`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to delete source");
      console.error("Failed to delete source:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmName(e.target.value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Source</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the source and all related
            data.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm">
            To confirm, type <span className="font-semibold">{sourceName}</span> below:
          </p>
          <Input value={confirmName} onChange={handleInputChange} disabled={loading} autoFocus />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading} size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || confirmName !== sourceName}
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
