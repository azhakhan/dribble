import { useState, useEffect, useRef, useCallback } from "react";
import { renameSource } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface RenameSourceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const RenameSource = ({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  triggerRef
}: RenameSourceProps) => {
  const [newName, setNewName] = useState(sourceName);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const formRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Reset name when dialog opens or sourceName changes
  useEffect(() => {
    if (open) {
      setNewName(sourceName);

      // Calculate position relative to trigger
      if (triggerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: triggerRect.bottom + 4,
          left: triggerRect.left
        });
      }
    }
  }, [open, sourceName, triggerRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  // Ref callback to handle input focus and selection
  const inputRefCallback = useCallback((input: HTMLInputElement | null) => {
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === sourceName) {
      onOpenChange(false);
      return;
    }

    try {
      setLoading(true);
      await renameSource(sourceId, newName.trim());
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(`Source renamed to "${newName.trim()}"`);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" />

      {/* Positioned form */}
      <div
        ref={formRef}
        className="fixed z-50 bg-popover border rounded-md shadow-lg p-3"
        style={{
          top: position.top,
          left: position.left,
          minWidth: "200px"
        }}
      >
        <div className="flex items-center gap-2">
          <Input
            ref={inputRefCallback}
            value={newName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Enter source name..."
            className="text-xs h-7 flex-1"
          />
          <Button
            size="sm"
            onClick={handleRename}
            disabled={loading || !newName.trim()}
            className="h-7 w-7 p-0"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-7 w-7 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </>
  );
};
