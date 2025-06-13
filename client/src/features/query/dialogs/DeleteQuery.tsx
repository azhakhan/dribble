import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryStore } from "@/shared/store";
import { useQueryClient } from "@tanstack/react-query";
import type { Query } from "@/shared/lib/api";

interface DeleteQueryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: Query;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const DeleteQuery = ({ open, onOpenChange, query, triggerRef }: DeleteQueryProps) => {
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const { deleteQuery } = useQueryStore();
  const queryClient = useQueryClient();

  // Calculate position when opened
  useEffect(() => {
    if (open && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: triggerRect.bottom + 4,
        left: triggerRect.left
      });
    }
  }, [open, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteQuery(query.id);
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["queries"] });
      toast.success(
        `Query "${query.name || `Query ${query.id.slice(0, 8)}`}" deleted successfully`
      );
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to delete query");
      console.error("Failed to delete query:", error);
    } finally {
      setLoading(false);
    }
  };

  // Add keyboard event listener when dialog is open
  useEffect(() => {
    if (open) {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !loading) {
          e.preventDefault();
          handleDelete();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onOpenChange(false);
        }
      };

      document.addEventListener("keydown", handleGlobalKeyDown);
      return () => document.removeEventListener("keydown", handleGlobalKeyDown);
    }
  }, [open, loading]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" />

      {/* Positioned dialog */}
      <div
        ref={dialogRef}
        className="fixed z-50 bg-popover border rounded-md shadow-lg p-3"
        style={{
          top: position.top,
          left: position.left,
          minWidth: "280px",
          maxWidth: "320px"
        }}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm font-medium text-destructive">Delete Query</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-5 w-5 p-0 ml-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Query name */}
          <div className="text-xs bg-destructive/5 border border-destructive/20 rounded px-2 py-1">
            <span className="font-mono text-destructive">
              {query.name || `Query ${query.id.slice(0, 8)}`}
            </span>
          </div>

          {/* Warning text */}
          <p className="text-xs text-muted-foreground">
            You will not be able to access this query and all its versions after deletion.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="h-7 flex-1 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-7 px-3 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
