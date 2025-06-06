import { X, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/components/ui/button";
import { Query } from "./Query";
import { useAppStore } from "@/shared/store/useAppStore";
import type { Source } from "@/shared/lib/api";

interface QueryTabsProps {
  selectedSource: Source | null;
  schemasLoading: boolean;
  schemasError?: unknown;
}

export function QueryTabs({ selectedSource, schemasLoading, schemasError }: QueryTabsProps) {
  const { openTabs, activeTabId, openQueryTab, closeQueryTab, setActiveTab } = useAppStore();

  // Handle creating a new query tab
  const handleNewTab = () => {
    if (!selectedSource) return;

    openQueryTab({
      queryId: null,
      sourceId: selectedSource.id,
      title: "Untitled Query",
      isDirty: false,
      editorContent: "",
      queryResults: null,
      queryRunning: false,
      selectedTableData: null
    });
  };

  // Handle closing a tab
  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeQueryTab(tabId);
  };

  // Handle tab click to make it active
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

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
      <div className="flex-shrink-0 flex items-stretch border-b bg-muted/30 min-h-[40px] overflow-x-auto">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center px-3 py-2 border-r cursor-pointer hover:bg-accent group min-w-0",
              tab.id === activeTabId ? "bg-background border-b-2 border-b-primary" : ""
            )}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="text-sm truncate mr-2 min-w-0" title={tab.title}>
              {tab.title}
              {tab.isDirty && <span className="ml-1">•</span>}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
              onClick={(e) => handleCloseTab(tab.id, e)}
              aria-label="Close tab"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* New tab button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTab}
          disabled={!selectedSource}
          className="h-full px-3 rounded-none hover:bg-accent flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0">
        {activeTab && (
          <Query
            tabId={activeTab.id}
            selectedSource={selectedSource}
            schemasLoading={schemasLoading}
            schemasError={schemasError}
          />
        )}
      </div>
    </div>
  );
}
