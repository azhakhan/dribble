import { Button } from "@/components/ui/button";
import { useLLMStore } from "@/shared/store/useLLMStore";
import { Suspense, lazy } from "react";

// Lazy load LLM components
const LLMList = lazy(() => import("@/features/llm/LLMList").then((m) => ({ default: m.LLMList })));
const LLMDialog = lazy(() =>
  import("@/features/llm/LLMDialog").then((m) => ({ default: m.LLMDialog }))
);

function SettingsPage() {
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
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
                </div>
              }
            >
              <LLMList />
            </Suspense>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <LLMDialog />
      </Suspense>
    </div>
  );
}

export default SettingsPage;
