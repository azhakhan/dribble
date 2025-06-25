import { memo, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useUnsavedChangesStore } from "@/shared/store/useUnsavedChangesStore";
import { useSourceStore } from "@/shared/store";
import { useCreateQuery } from "@/shared/hooks/useCreateQuery";
import { UnsavedChangesDialog } from "../../UnsavedChangesDialog";
import { TabHeader } from "./TabHeader";
import { OptimizedTabContent } from "./OptimizedTabContent";
import { NewQueryModal } from "./NewQueryModal";
import { Capybara } from "@/components/Capybara";

function QueryTabsComponent() {
  // Use selective subscriptions to prevent unnecessary re-renders
  const { openTabs, activeTabId } = useTabManagerStore();
  const { allSources: sources, selectedSource } = useSourceStore();
  const { createQueryAndOpenInTab } = useCreateQuery();

  // New query modal state
  const [isNewQueryModalOpen, setIsNewQueryModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  // Dialog state
  const { unsavedChangesDialog, hideUnsavedChangesDialog, handleDialogSave, handleDialogDiscard } =
    useUnsavedChangesStore();

  // Handle showing the new query modal
  const handleNewQuery = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setModalPosition({
      x: rect.left,
      y: rect.bottom + 5 // 5px below the button
    });
    setIsNewQueryModalOpen(true);
  }, []);

  // Handle creating a new query tab from modal
  const handleCreateQuery = useCallback(
    async (queryName: string, sourceId: string) => {
      await createQueryAndOpenInTab(sourceId, queryName);
    },
    [createQueryAndOpenInTab]
  );

  // If no tabs are open, show empty state
  if (openTabs.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Tab bar with new tab button */}
        <div className="flex-shrink-0 flex items-center border-b bg-muted/30 min-h-[40px]">
          <Button
            variant="ghost"
            size="sm"
            disabled={sources.length === 0}
            onClick={handleNewQuery}
            className="h-8 px-3 text-xs rounded-none border-r hover:bg-accent cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Query
          </Button>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Capybara />
            <p className="text-lg mb-2">No queries open</p>
            <p className="text-sm">
              {sources.length === 0
                ? "Connect a data source to create queries"
                : "Create a new query or double-click a table to get started"}
            </p>
          </div>
        </div>

        {/* New Query Modal */}
        <NewQueryModal
          isOpen={isNewQueryModalOpen}
          onClose={() => setIsNewQueryModalOpen(false)}
          onCreateQuery={handleCreateQuery}
          sources={sources.map((source) => ({ id: source.id, name: source.name }))}
          defaultSourceId={selectedSource?.id}
          position={modalPosition}
        />
      </div>
    );
  }

  // Find the active tab to render
  const activeTab = openTabs.find((tab) => tab.id === activeTabId) || openTabs[0];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <TabHeader />

      {/* Active tab content */}
      <div className="flex-1 min-h-0">
        {activeTab && <OptimizedTabContent key={activeTab.id} tabId={activeTab.id} />}
      </div>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={unsavedChangesDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            hideUnsavedChangesDialog();
          }
        }}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        tabTitle={unsavedChangesDialog.tabTitle}
        action={unsavedChangesDialog.action}
      />
    </div>
  );
}

export const QueryTabs = memo(QueryTabsComponent);
