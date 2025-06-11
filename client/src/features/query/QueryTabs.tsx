import { X, Plus } from "lucide-react";
import { useCallback, memo } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/components/ui/button";
import { Query } from "./Query";
import { useTabStore, useSourceStore } from "@/shared/store";

// Memoized tab button component to prevent unnecessary re-renders
const TabButton = memo(
  ({
    tab,
    isActive,
    onTabClick,
    onCloseTab
  }: {
    tab: { id: string; title: string; isDirty: boolean };
    isActive: boolean;
    onTabClick: (tabId: string) => Promise<void>;
    onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  }) => (
    <div
      className={cn(
        "flex items-center px-2 py-1.5 border-r cursor-pointer hover:bg-accent group min-w-0",
        isActive ? "bg-background border-b-2 border-b-primary" : ""
      )}
      onClick={() => onTabClick(tab.id)}
    >
      <span className="text-sm truncate mr-2 min-w-0" title={tab.title}>
        {tab.title}
        {tab.isDirty && <span className="ml-1">•</span>}
      </span>
      <button
        className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
        onClick={(e) => onCloseTab(tab.id, e)}
        aria-label="Close tab"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
);

function QueryTabsComponent() {
  // Use selective subscriptions to prevent unnecessary re-renders
  const openTabs = useTabStore((state) => state.openTabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const selectedSource = useSourceStore((state) => state.selectedSource);

  // Get actions from store
  const { openQueryTab, closeQueryTab, setActiveTab } = useTabStore();

  // Handle creating a new query tab
  const handleNewTab = useCallback(async () => {
    if (!selectedSource) return;

    try {
      await openQueryTab({
        queryId: null,
        sourceId: selectedSource.id,
        title: "Untitled Query",
        isDirty: false,
        editorContent: "",
        queryResults: null,
        queryRunning: false,
        selectedTableData: null,
        isLoadingQuery: false,
        isLoadingVersions: false,
        lastSavedContent: "",
        originalContent: ""
      });
    } catch (error) {
      console.error("Failed to open new query tab:", error);
    }
  }, [selectedSource, openQueryTab]);

  // Handle closing a tab
  const handleCloseTab = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeQueryTab(tabId);
    },
    [closeQueryTab]
  );

  // Handle tab click to make it active
  const handleTabClick = useCallback(
    async (tabId: string) => {
      await setActiveTab(tabId);
    },
    [setActiveTab]
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
            onClick={handleNewTab}
            disabled={!selectedSource}
            className="h-8 px-3 rounded-none border-r hover:bg-accent"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Query
          </Button>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg mb-2">No queries open</p>
            <p className="text-sm">
              {!selectedSource
                ? "Select a source to create queries"
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
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-stretch border-b border-border/50 bg-muted/10 h-10 overflow-x-auto">
        {openTabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onTabClick={handleTabClick}
            onCloseTab={handleCloseTab}
          />
        ))}

        {/* New tab button */}
        <Button
          variant="ghost"
          size="xs"
          onClick={handleNewTab}
          disabled={!selectedSource}
          className="h-full px-3 rounded-none hover:bg-accent flex-shrink-0"
        >
          <Plus className="h-2 w-2" />
        </Button>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0">{activeTab && <Query tabId={activeTab.id} />}</div>
    </div>
  );
}

// Memoize the main component but be careful about when it should re-render
export const QueryTabs = memo(QueryTabsComponent);
