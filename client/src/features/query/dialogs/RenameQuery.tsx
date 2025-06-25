import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";
import { QueryVersionService } from "@/shared/services";
import type { Query } from "@/shared/lib/api";

interface RenameQueryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: Query;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function RenameQuery({ open, onOpenChange, query, triggerRef }: RenameQueryProps) {
  const [newName, setNewName] = useState(query.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const formRef = useRef<HTMLDivElement>(null);

  // Reset name when dialog opens
  useEffect(() => {
    if (open) {
      setNewName(query.name || "");

      // Calculate position relative to trigger
      if (triggerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: triggerRect.bottom + 4,
          left: triggerRect.left
        });
      }
    }
  }, [open, query.name, triggerRef]);

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

  const handleSubmit = async () => {
    if (!newName.trim() || newName.trim() === query.name) {
      onOpenChange(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await QueryVersionService.updateQueryName(query.id, newName.trim());
      if (result.success) {
        onOpenChange(false);
      } else {
        console.error("Failed to rename query:", result.error);
      }
    } catch (error) {
      console.error("Failed to rename query:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !isLoading) {
      e.preventDefault();
      handleSubmit();
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
            value={newName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Enter query name..."
            className="text-xs h-7 flex-1"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !newName.trim()}
            className="h-7 w-7 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </>
  );
}
