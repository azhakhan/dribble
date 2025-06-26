import { memo, useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { queryService } from "../../services/queryService";

interface NewQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateQuery: (name: string, sourceId: string) => void;
  sources: Array<{ id: string; name: string }>;
  defaultSourceId?: string;
  position?: { x: number; y: number } | null;
}

function NewQueryModalComponent({
  isOpen,
  onClose,
  onCreateQuery,
  sources,
  defaultSourceId,
  position
}: NewQueryModalProps) {
  const [queryName, setQueryName] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      setQueryName(queryService.generateQueryName());
      const sourceToSelect = defaultSourceId || (sources.length > 0 ? sources[0].id : "");
      setSelectedSourceId(sourceToSelect);

      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultSourceId, sources]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (queryName.trim() && selectedSourceId) {
        onCreateQuery(queryName.trim(), selectedSourceId);
        onClose();
      }
    },
    [queryName, selectedSourceId, onCreateQuery, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div
        className="absolute bg-background border rounded-lg shadow-lg p-4 w-72"
        style={{
          left: position?.x || 0,
          top: position?.y || 0
        }}
      >
        <h3 className="text-sm font-medium mb-3">Create New Query</h3>

        <form onSubmit={handleSubmit} className="space-y-3 pb-2">
          <div className="space-y-1">
            <Label htmlFor="queryName" className="text-xs font-medium">
              Query Name
            </Label>
            <Input
              ref={inputRef}
              id="queryName"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="Enter query name"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sourceSelect" className="text-xs font-medium">
              Data Source
            </Label>
            <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <SelectTrigger id="sourceSelect" className="h-8 text-xs w-full">
                <SelectValue placeholder="Select a data source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="xs" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="xs" disabled={!queryName.trim() || !selectedSourceId}>
              Create Query
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const NewQueryModal = memo(NewQueryModalComponent);
