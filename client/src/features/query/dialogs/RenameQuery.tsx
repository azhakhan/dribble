import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryStore } from "@/shared/store";
import type { Query } from "@/shared/lib/api";

interface RenameQueryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: Query;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const RenameQuery = ({ open, onOpenChange, query, triggerRef }: RenameQueryProps) => {
  const [newName, setNewName] = useState(query.name || `Query ${query.id.slice(0, 8)}`);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const formRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateQueryName } = useQueryStore();

  // Reset name when dialog opens or query changes
  useEffect(() => {
    if (open) {
      setNewName(query.name || `Query ${query.id.slice(0, 8)}`);

      // Calculate position relative to trigger
      if (triggerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: triggerRect.bottom + 4,
          left: triggerRect.left
        });
      }

      // Focus input after a short delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [open, query.name, query.id, triggerRef]);

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

  const handleRename = async () => {
    if (!newName.trim()) {
      toast.error("Query name cannot be empty");
      return;
    }

    if (newName.trim() === query.name) {
      onOpenChange(false);
      return;
    }

    try {
      setLoading(true);
      await updateQueryName(query.id, newName.trim());
      toast.success(`Query renamed to "${newName.trim()}"`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to rename query");
      console.error("Failed to rename query:", error);
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
            ref={inputRef}
            value={newName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Enter query name..."
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
