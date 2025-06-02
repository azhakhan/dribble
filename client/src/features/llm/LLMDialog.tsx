import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LLMForm } from "@/features/llm/LLMForm";
import { useLLMStore } from "@/shared/store/useLLMStore";

export function LLMDialog() {
  const { isFormOpen, isEditing, closeForm } = useLLMStore();

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit LLM Configuration" : "Add New LLM"}</DialogTitle>
        </DialogHeader>
        <LLMForm onSuccess={closeForm} />
      </DialogContent>
    </Dialog>
  );
}
