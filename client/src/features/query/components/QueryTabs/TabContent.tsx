import { memo, Suspense, lazy } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useSourceStore } from "@/shared/store";
import { QueryResultsWithSSE } from "./QueryResultsWithSSE";
import { QueryRuns } from "../../QueryRuns";

// Feature-based code splitting
const QueryEditor = lazy(() => import("../QueryEditor/QueryEditor"));
import { useQueryExecution } from "../../hooks/useQueryExecution";
import { useQueryVersion } from "../../hooks/useQueryVersion";

interface TabContentProps {
  tabId: string;
}

const TabContentComponent = ({ tabId }: TabContentProps) => {
  // Get current tab with memoization to reduce lookups
  const currentTab = useTabManagerStore((state) => state.openTabs.find((tab) => tab.id === tabId));

  // Get current source with memoization
  const currentSource = useSourceStore((state) =>
    currentTab?.sourceId ? state.sources[currentTab.sourceId] : null
  );

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
    <PanelGroup direction="vertical" className="h-full">
      <Panel defaultSize={50} minSize={20}>
        <QueryResultsWithSSE
          tabId={tabId}
          queryId={currentTab.queryId}
          queryResults={currentTab.queryResults}
          isQueryRunning={currentTab.queryRunning}
        />
      </Panel>

      <PanelResizeHandle className="h-1 bg-border hover:bg-accent transition-background" />
      <Panel defaultSize={50} minSize={20}>
        {showRuns ? (
          currentTab.queryId ? (
            <QueryRuns
              queryId={currentTab.queryId}
              onBack={handleShowRuns}
              sourceName={currentSource?.name || ""}
              queryName={currentTab.title}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No query selected
            </div>
          )
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
              </div>
            }
          >
            <QueryEditor
              tabId={tabId}
              onQueryExecuted={handleQueryExecuted}
              onShowRuns={handleShowRuns}
            />
          </Suspense>
        )}
      </Panel>
    </PanelGroup>
  );
};

export const TabContent = memo(TabContentComponent);
