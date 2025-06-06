import { memo, useCallback, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppStore } from "@/shared/store/useAppStore";
import { TableDataDisplay } from "@/features/tables/TableDataDisplay";
import { Editor } from "@/features/editor/Editor";
import { useSourcesQuery } from "@/shared/hooks/useSourcesQuery";
import type { Source } from "@/shared/lib/api";

interface QueryProps {
  tabId: string;
  selectedSource: Source | null;
  schemasLoading: boolean;
  schemasError?: unknown;
  connectedSourceIds: Set<string>;
}

function QueryComponent({
  tabId,
  selectedSource,
  schemasLoading,
  schemasError,
  connectedSourceIds
}: QueryProps) {
  console.log("🔄 Query render:", { tabId, selectedSource: selectedSource?.name });

  const { openTabs, updateTabContent } = useAppStore();
  const { data: sources } = useSourcesQuery();

  // Handle SQL query execution from Editor
  const handleQueryExecution = useCallback(
    (results: object[]) => {
      updateTabContent(tabId, {
        queryResults: results,
        selectedTableData: null // Clear table selection since we're viewing custom query results
      });
    },
    [tabId, updateTabContent]
  );

  // Handle query running status change
  const handleQueryStatusChange = useCallback(
    (isRunning: boolean) => {
      updateTabContent(tabId, {
        queryRunning: isRunning
      });
    },
    [tabId, updateTabContent]
  );

  // Find current tab
  const currentTab = openTabs.find((tab) => tab.id === tabId);

  // Find the source for this tab's query
  const tabSource = useMemo(() => {
    if (!currentTab || !sources) return null;
    return sources.find((source) => source.id === currentTab.sourceId) || null;
  }, [currentTab, sources]);

  console.log("📝 Current tab:", {
    currentTab: currentTab?.title,
    tabId,
    tabSourceId: currentTab?.sourceId,
    tabSourceName: tabSource?.name
  });

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
          <TableDataDisplay
            tableData={currentTab.selectedTableData}
            queryResults={currentTab.queryResults}
            isQueryRunning={currentTab.queryRunning}
          />
        </Panel>

        <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={40} minSize={10}>
          <Editor
            key={tabId}
            selectedSource={tabSource}
            schemasLoading={schemasLoading}
            schemasError={schemasError}
            onQueryExecution={handleQueryExecution}
            onQueryStatusChange={handleQueryStatusChange}
            connectedSourceIds={connectedSourceIds}
            initialQueryId={currentTab.queryId}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const Query = memo(QueryComponent);
