import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TableDataDisplay } from "@/features/tables/TableDataDisplay";
import { Editor } from "@/features/editor/Editor";
import { useAppStore } from "@/shared/store/useAppStore";
import type { Source } from "@/shared/lib/api";

interface QueryProps {
  tabId: string;
  selectedSource: Source | null;
  schemasLoading: boolean;
  schemasError?: unknown;
}

export function Query({ tabId, selectedSource, schemasLoading, schemasError }: QueryProps) {
  const { openTabs, updateTabContent } = useAppStore();

  // Find current tab
  const currentTab = openTabs.find((tab) => tab.id === tabId);

  if (!currentTab) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Tab not found
      </div>
    );
  }

  // Handle query execution from editor
  const handleQueryExecution = (results: object[]) => {
    updateTabContent(tabId, {
      queryResults: results,
      selectedTableData: null // Clear table selection when running custom query
    });
  };

  // Handle query running status
  const handleQueryStatusChange = (isRunning: boolean) => {
    updateTabContent(tabId, { queryRunning: isRunning });
  };

  // Handle table double-click (from the sidebar, not directly here)
  // This will be called from the parent component when a table is selected

  return (
    <div className="h-full">
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
            selectedSource={selectedSource}
            schemasLoading={schemasLoading}
            schemasError={schemasError}
            onQueryExecution={handleQueryExecution}
            onQueryStatusChange={handleQueryStatusChange}
            initialQueryId={currentTab.queryId}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
