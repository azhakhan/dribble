import { X, Plus } from "lucide-react";
import { useCallback, memo, useRef, useEffect } from "react";
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
    onCloseTab,
    tabRef
  }: {
    tab: { id: string; title: string; isDirty: boolean };
    isActive: boolean;
    onTabClick: (tabId: string) => Promise<void>;
    onCloseTab: (tabId: string, e: React.MouseEvent) => void;
    tabRef?: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div
      ref={tabRef}
      className={cn(
        "flex items-center px-2 py-1.5 border-r cursor-pointer hover:bg-accent group flex-shrink-0",
        "min-w-[120px] max-w-[200px]", // Set minimum and maximum width
        isActive ? "bg-background" : "border-b bg-muted/20"
      )}
      onClick={() => onTabClick(tab.id)}
    >
      <span className="text-sm truncate mx-2 flex-1 min-w-0" title={tab.title}>
        {tab.title}
        {tab.isDirty && <span className="ml-1">•</span>}
      </span>
      <button
        className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity flex-shrink-0"
        onClick={(e) => onCloseTab(tab.id, e)}
        aria-label="Close tab"
      >
        <X className="h-3 w-3 cursor-pointer hover:bg-primary/40 rounded-xs" />
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

  // Refs for scrolling functionality
  const tabBarScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabRef.current && tabBarScrollRef.current) {
      const tabElement = activeTabRef.current;
      const scrollContainer = tabBarScrollRef.current;

      // Calculate the relative position within the scroll container
      const tabLeft = tabElement.offsetLeft;
      const tabRight = tabLeft + tabElement.offsetWidth;
      const scrollLeft = scrollContainer.scrollLeft;
      const containerWidth = scrollContainer.clientWidth;

      // Check if tab is not fully visible and scroll if needed
      if (tabLeft < scrollLeft) {
        // Tab is cut off on the left, scroll to show it
        scrollContainer.scrollTo({
          left: tabLeft - 10, // Add some padding
          behavior: "smooth"
        });
      } else if (tabRight > scrollLeft + containerWidth) {
        // Tab is cut off on the right, scroll to show it
        scrollContainer.scrollTo({
          left: tabRight - containerWidth + 10, // Add some padding
          behavior: "smooth"
        });
      }
    }
  }, [activeTabId, openTabs.length]);

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
      <div
        ref={tabBarScrollRef}
        className="flex-shrink-0 flex items-stretch border-border/50 bg-muted/10 h-10 overflow-x-auto scrollbar-hide"
      >
        <div className="flex items-stretch min-w-fit">
          {openTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onTabClick={handleTabClick}
              onCloseTab={handleCloseTab}
              tabRef={tab.id === activeTabId ? activeTabRef : undefined}
            />
          ))}

          {/* New tab button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleNewTab}
            disabled={!selectedSource}
            className="h-full px-3 rounded-none hover:bg-accent flex-shrink-0 min-w-[40px]"
          >
            <Plus className="h-2 w-2" />
          </Button>
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0">{activeTab && <Query tabId={activeTab.id} />}</div>
    </div>
  );
}

// Memoize the main component but be careful about when it should re-render
export const QueryTabs = memo(QueryTabsComponent);
