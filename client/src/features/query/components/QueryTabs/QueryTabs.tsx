import { memo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useUnsavedChangesStore } from "@/shared/store/useUnsavedChangesStore";
import { useSourceStore } from "@/shared/store";
import { UnsavedChangesDialog } from "../../UnsavedChangesDialog";
import { TabHeader } from "./TabHeader";
import { TabContent } from "./TabContent";
import { Capybara } from "@/components/Capybara";

function QueryTabsComponent() {
  // Use selective subscriptions to prevent unnecessary re-renders
  const { openTabs, activeTabId } = useTabManagerStore();
  const { allSources: sources } = useSourceStore();

  // Dialog state
  const { unsavedChangesDialog, hideUnsavedChangesDialog, handleDialogSave, handleDialogDiscard } =
    useUnsavedChangesStore();

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
            className="h-8 px-3 rounded-none border-r hover:bg-accent"
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
        {activeTab && <TabContent key={activeTab.id} tabId={activeTab.id} />}
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
