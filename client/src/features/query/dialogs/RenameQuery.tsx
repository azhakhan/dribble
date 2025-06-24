import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryVersionService } from "@/shared/services";
import type { Query } from "@/shared/lib/api";
import { useEffect, useState } from "react";

interface RenameQueryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: Query;
}

export function RenameQuery({ open, onOpenChange, query }: RenameQueryProps) {
  const [newName, setNewName] = useState(query.name || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNewName(query.name || "");
    }
  }, [open, query.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      const result = await QueryVersionService.updateQueryName(query.id, newName.trim());
      if (result.success) {
        onOpenChange(false);
      } else {
        console.error("Failed to rename query:", result.error);
        // You might want to show a toast error here
      }
    } catch (error) {
      console.error("Failed to rename query:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Query</DialogTitle>
          <DialogDescription>Change the name of your query.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
                placeholder="Enter query name"
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !newName.trim()}>
              {isLoading ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
