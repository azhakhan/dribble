import { memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppStore } from "@/shared/store/useAppStore";
import { TableDataDisplay } from "@/features/tables/TableDataDisplay";
import { Editor } from "@/features/editor/Editor";

interface QueryProps {
  tabId: string;
}

function QueryComponent({ tabId }: QueryProps) {
  // Use store selectors to get only the data we need for this specific tab
  const currentTab = useAppStore((state) => state.openTabs.find((tab) => tab.id === tabId));

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
          <Editor tabId={tabId} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render if the tabId changes
export const Query = memo(QueryComponent);
