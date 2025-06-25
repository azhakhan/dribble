import { memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useSourceStore } from "@/shared/store";
import { QueryResults } from "../QueryResults";
import { QueryEditor } from "../QueryEditor";
import { QueryRuns } from "../../QueryRuns";
import { useQueryExecution } from "../../hooks/useQueryExecution";
import { useQueryVersion } from "../../hooks/useQueryVersion";

interface OptimizedTabContentProps {
  tabId: string;
}

const OptimizedTabContentComponent = ({ tabId }: OptimizedTabContentProps) => {
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

  if (showRuns && currentTab.queryId) {
    return (
      <QueryRuns
        queryId={currentTab.queryId}
        onBack={handleShowRuns}
        sourceName={currentSource?.name || ""}
        queryName={currentTab.title}
      />
    );
  }

  return (
    <PanelGroup direction="vertical" className="h-full">
      <Panel defaultSize={50} minSize={20}>
        <QueryEditor
          tabId={tabId}
          onQueryExecuted={handleQueryExecuted}
          onShowRuns={handleShowRuns}
        />
      </Panel>
      <PanelResizeHandle className="h-1 bg-border hover:bg-accent transition-background" />
      <Panel defaultSize={50} minSize={20}>
        <QueryResults
          tableData={null}
          queryResults={currentTab.queryResults}
          isQueryRunning={currentTab.queryRunning}
        />
      </Panel>
    </PanelGroup>
  );
};

export const OptimizedTabContent = memo(OptimizedTabContentComponent);
