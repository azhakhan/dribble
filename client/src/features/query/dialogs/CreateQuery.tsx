import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryStore } from "@/shared/store";
import { generateQueryName } from "@/shared/lib/queryUtils";
import type { Source } from "@/shared/lib/api";

interface CreateQueryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Source;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onQueryCreated?: (queryId: string) => void;
}

export const CreateQuery = ({
  open,
  onOpenChange,
  source,
  triggerRef,
  onQueryCreated
}: CreateQueryProps) => {
  const [queryName, setQueryName] = useState("");
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const formRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { createNewQuery } = useQueryStore();
  const queryClient = useQueryClient();

  // Reset name when dialog opens
  useEffect(() => {
    if (open) {
      setQueryName(generateQueryName());

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
  }, [open, triggerRef]);

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

  const handleCreate = async () => {
    if (!queryName.trim()) {
      toast.error("Query name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const newQuery = await createNewQuery({
        sourceId: source.id,
        name: queryName.trim()
      });

      // Invalidate queries to refresh the QueryTree
      queryClient.invalidateQueries({ queryKey: ["queries"] });

      toast.success(`Query "${queryName.trim()}" created successfully`);
      onOpenChange(false);

      // Notify parent component that query was created
      if (onQueryCreated) {
        onQueryCreated(newQuery.id);
      }
    } catch (error) {
      toast.error("Failed to create query");
      console.error("Failed to create query:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryName(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" && !loading) {
      e.preventDefault();
      handleCreate();
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
            value={queryName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Enter query name..."
            className="text-xs h-7 flex-1"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={loading || !queryName.trim()}
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
