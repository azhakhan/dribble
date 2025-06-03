import { Button } from "@/components/ui/button";
import { LLMList } from "@/features/llm/LLMList";
import { LLMDialog } from "@/features/llm/LLMDialog";
import { useLLMStore } from "@/shared/store/useLLMStore";

export function SettingsPage() {
  const { openCreateForm } = useLLMStore();

  return (
    <div className="flex-1 min-h-0 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">LLM Configurations</h2>
              <Button onClick={openCreateForm}>Add LLM</Button>
            </div>
            <p className="text-muted-foreground mb-6">
              Manage your Large Language Model configurations for the workspace.
            </p>
            <LLMList />
          </div>
        </div>
      </div>

      <LLMDialog />
    </div>
  );
}
