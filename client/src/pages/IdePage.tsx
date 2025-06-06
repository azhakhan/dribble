import { useEffect, useMemo, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { SidebarTabs } from "@/features/sources/SidebarTabs";
import { sourcesToFileTreeNodes } from "@/shared/lib/fileTreeUtils";
import { QueryTabs } from "@/features/query/QueryTabs";
import { ChatSidebar } from "@/features/chat/ChatSidebar";
import { useSourcesQuery } from "@/shared/hooks/useSourcesQuery";
import { useSourceSchemasQuery } from "@/shared/hooks/useSourceSchemasQuery";
import { useSourceStatusQuery } from "@/shared/hooks/useSourceStatusQuery";
import { useConnectedSourcesQuery } from "@/shared/hooks/useConnectedSourcesQuery";
import type { Source, ConnectedSource, Query } from "@/shared/lib/api";
import { useAppStore } from "@/shared/store/useAppStore";

const sampleFileTree = [
  {
    name: "Loading...",
    type: "folder" as const,
    children: []
  }
];

export function IdePage() {
  console.log("🔄 IdePage render");

  // Get state and actions from Zustand store
  const {
    panelSizes,
    setPanelSizes,
    selectedSource,
    setSelectedSource,
    setSourceSchema,
    sourceSchemaErrors,
    setSourceSchemaError,
    setSourceStatus,
    openQueryTab,
    activeTabId,
    openTabs,
    updateTabContent,
    setActiveTab
  } = useAppStore();

  // Query for all sources
  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useSourcesQuery();

  // Get connected sources
  const { data: connectedSourcesData } = useConnectedSourcesQuery();

  // Create a set of connected source IDs for easy lookup
  const connectedSourceIds = useMemo(() => {
    if (!connectedSourcesData) return new Set<string>();
    return new Set(connectedSourcesData.map((source: ConnectedSource) => source.id));
  }, [connectedSourcesData]);

  // Query for selected source schemas - only if the source is connected
  const { data: sourceSchemas } = useSourceSchemasQuery(
    selectedSource?.id && connectedSourceIds.has(selectedSource.id) ? selectedSource.id : undefined
  );

  // Query for selected source status - only if the source is connected
  const { data: selectedSourceStatus } = useSourceStatusQuery(
    selectedSource?.id && connectedSourceIds.has(selectedSource.id) ? selectedSource.id : undefined
  );

  // Update schema map when new schema data is loaded
  useEffect(() => {
    if (selectedSource?.id && sourceSchemas) {
      setSourceSchema(selectedSource.id, sourceSchemas);
      // Clear any error for this source
      if (sourceSchemaErrors[selectedSource.id]) {
        setSourceSchemaError(selectedSource.id, null);
      }
    }
  }, [selectedSource, sourceSchemas, sourceSchemaErrors, setSourceSchema, setSourceSchemaError]);

  // Track source statuses
  useEffect(() => {
    if (selectedSourceStatus && selectedSource?.id) {
      setSourceStatus(selectedSource.id, selectedSourceStatus);
    }
  }, [selectedSourceStatus, selectedSource, setSourceStatus]);

  // Update selectedSource when active tab changes
  useEffect(() => {
    if (activeTabId && openTabs.length > 0) {
      const activeTab = openTabs.find((tab) => tab.id === activeTabId);
      if (activeTab && sources) {
        const tabSource = sources.find((source) => source.id === activeTab.sourceId);
        if (tabSource && (!selectedSource || selectedSource.id !== tabSource.id)) {
          setSelectedSource(tabSource);
        }
      }
    }
  }, [activeTabId, openTabs, sources, selectedSource, setSelectedSource]);

  // Build file tree data with sources only - schema children are handled by FileTree component via AppState
  const fileTreeData = sources ? sourcesToFileTreeNodes(sources) : sampleFileTree;

  const handleSourceSelect = useCallback(
    (source: Source) => {
      setSelectedSource(source);
    },
    [setSelectedSource]
  );

  // Handle table double-click - create or switch to existing tab
  const handleTableDoubleClick = useCallback(
    async (sourceId: string, tableName: string) => {
      // Build the query to select all data from the table with a limit
      const query = `SELECT * FROM ${tableName} LIMIT 101`;

      // Check if there's already an active tab for this source that we can reuse
      if (activeTabId && openTabs.length > 0) {
        const activeTab = openTabs.find((tab) => tab.id === activeTabId);
        if (
          activeTab &&
          activeTab.sourceId === sourceId &&
          !activeTab.selectedTableData &&
          !activeTab.queryResults
        ) {
          // Use the active empty tab
          updateTabContent(activeTabId, {
            selectedTableData: { sourceId, tableName, query },
            queryResults: null,
            queryRunning: true,
            title: tableName,
            editorContent: query
          });
          return;
        }
      }

      // Create a new tab for this table
      openQueryTab({
        queryId: null,
        sourceId,
        title: tableName,
        isDirty: false,
        editorContent: query,
        queryResults: null,
        queryRunning: true,
        selectedTableData: { sourceId, tableName, query }
      });
    },
    [activeTabId, openTabs, updateTabContent, openQueryTab]
  );

  // Handle query selection from QueryTree
  const handleQuerySelect = useCallback(
    (query: Query) => {
      // Check if query is already open in a tab
      const existingTab = openTabs.find((tab) => tab.queryId === query.id);

      if (existingTab) {
        // Switch to existing tab - use the action from store instead of direct call
        setActiveTab(existingTab.id);
      } else {
        // Open new tab for this query
        openQueryTab({
          queryId: query.id,
          sourceId: query.source_id,
          title: query.name || `Query ${query.id.slice(0, 8)}`,
          isDirty: false,
          editorContent: "", // Will be loaded by the Editor component
          queryResults: null,
          queryRunning: false,
          selectedTableData: null
        });
      }
    },
    [openTabs, setActiveTab, openQueryTab]
  );

  return (
    <div className="flex-1 min-h-0">
      <PanelGroup direction="horizontal" onLayout={(newSizes) => setPanelSizes(newSizes)}>
        <Panel defaultSize={panelSizes[0]} minSize={15}>
          <div className="h-full border-r select-none">
            <SidebarTabs
              sources={fileTreeData}
              sourcesLoading={sourcesLoading}
              sourcesError={sourcesError}
              onSourceSelect={handleSourceSelect}
              onTableDoubleClick={handleTableDoubleClick}
              onQuerySelect={handleQuerySelect}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={panelSizes[1]} minSize={30}>
          <QueryTabs />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={panelSizes[2]} minSize={15}>
          <div className="h-full">
            <ChatSidebar />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
