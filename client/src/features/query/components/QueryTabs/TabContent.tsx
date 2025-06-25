/**
 * @deprecated This component is deprecated. Use OptimizedTabContent instead.
 *
 * Migration:
 * import { OptimizedTabContent } from "./OptimizedTabContent";
 *
 * The OptimizedTabContent provides:
 * - Optimized Zustand selectors to prevent unnecessary re-renders
 * - Better performance with React.memo
 * - Reduced re-renders when other tabs change
 *
 * This file will be removed in a future version.
 */

import { memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useSourceStore } from "@/shared/store";
import { QueryResults } from "../QueryResults";
import { QueryEditor } from "../QueryEditor";
import { QueryRuns } from "../../QueryRuns";
import { useQueryExecution } from "../../hooks/useQueryExecution";
import { useQueryVersion } from "../../hooks/useQueryVersion";

interface TabContentProps {
  tabId: string;
}

function TabContentComponent({ tabId }: TabContentProps) {
  const { openTabs } = useTabManagerStore();
  const { sources } = useSourceStore();

  const currentTab = openTabs.find((tab) => tab.id === tabId);
  const currentSource = currentTab?.sourceId ? sources[currentTab.sourceId] : null;

  const { showRuns, setShowRuns, loadRuns } = useQueryExecution(currentTab?.queryId || undefined);
  const { resetUserSelection } = useQueryVersion(currentTab?.queryId || undefined, tabId);

  const handleQueryExecuted = () => {
    // Reset user selection flag so the latest version gets auto-selected
    // when a new version is created during query execution
    resetUserSelection();

    // Reload runs after query execution (success or failure)
    loadRuns(true); // Force refresh
  };

  const handleShowRuns = () => {
    setShowRuns(!showRuns);
  };

  if (!currentTab) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Tab not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PanelGroup direction="vertical" storage={localStorage} autoSaveId={`query-layout-${tabId}`}>
        <Panel defaultSize={60} minSize={30}>
          <QueryResults
            tableData={currentTab.selectedTableData}
            queryResults={currentTab.queryResults}
            isQueryRunning={currentTab.queryRunning}
          />
        </Panel>

        <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={40} minSize={10}>
          <div className="h-full flex flex-col">
            {/* Editor or Runs Component */}
            <div className="flex-1 min-h-0">
              {showRuns ? (
                currentTab.queryId ? (
                  <QueryRuns
                    queryId={currentTab.queryId}
                    onBack={() => setShowRuns(false)}
                    sourceName={currentSource?.name || "No source selected"}
                    queryName={currentTab.title}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No query selected
                  </div>
                )
              ) : (
                <QueryEditor
                  tabId={tabId}
                  onQueryExecuted={handleQueryExecuted}
                  onShowRuns={handleShowRuns}
                />
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export const TabContent = memo(TabContentComponent);
