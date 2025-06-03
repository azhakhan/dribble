import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useLLMsQuery, useDeleteLLMMutation } from "@/shared/hooks/useLLMsQuery";
import { useLLMStore } from "@/shared/store/useLLMStore";
import type { LLMListItem } from "@/shared/lib/api";
import { useState } from "react";

interface LLMListProps {
  onLLMSelect?: (llm: LLMListItem) => void;
}

export function LLMList({ onLLMSelect }: LLMListProps) {
  const { data: llms, isLoading, error } = useLLMsQuery();
  const deleteMutation = useDeleteLLMMutation();
  const { openEditForm } = useLLMStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [llmToDelete, setLlmToDelete] = useState<LLMListItem | null>(null);

  const handleView = async (llm: LLMListItem) => {
    // Convert LLMListItem to LLM format for the store
    const fullLLM = {
      ...llm,
      base_url: undefined,
      api_version: undefined,
      settings: undefined,
      workspace_id: "",
      created_at: ""
    };
    openEditForm(fullLLM);
    onLLMSelect?.(llm);
  };

  const handleDeleteClick = (llm: LLMListItem) => {
    setLlmToDelete(llm);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!llmToDelete) return;

    try {
      await deleteMutation.mutateAsync(llmToDelete.id);
      toast.success("LLM configuration deleted successfully");
      setDeleteDialogOpen(false);
      setLlmToDelete(null);
    } catch (error) {
      console.error("Failed to delete LLM:", error);
      toast.error("Failed to delete LLM configuration");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setLlmToDelete(null);
  };

  const getProviderColor = (name: string) => {
    switch (name) {
      case "openai":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "anthropic":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "gemini":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "ollama":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading LLMs...</div>
      </div>
    );
  }

  if (error) {
    toast.error(`Failed to load LLMs: ${error.message}`);
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-destructive">Failed to load LLMs: {error.message}</div>
      </div>
    );
  }

  if (!llms || llms.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No LLMs configured yet.</p>
          <p className="text-sm text-muted-foreground">
            Add your first LLM configuration to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {llms.map((llm) => (
          <div
            key={llm.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-card"
          >
            <div className="flex items-center space-x-4">
              <Badge className={getProviderColor(llm.name)}>{llm.name.toUpperCase()}</Badge>
              <div>
                <h3 className="font-medium">{llm.model}</h3>
                <p className="text-sm text-muted-foreground">Provider: {llm.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => handleView(llm)}>
                View
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteClick(llm)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Delete LLM Configuration</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-left">
              Are you sure you want to delete the LLM configuration for{" "}
              <span className="font-semibold">{llmToDelete?.model}</span> ({llmToDelete?.name})?
              <br />
              <br />
              This action cannot be undone and will permanently remove this configuration.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" onClick={handleCancelDelete}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
