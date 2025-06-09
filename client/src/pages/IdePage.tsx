import { useMemo, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppStore } from "@/shared/store/useAppStore";
import { SidebarTabs } from "@/features/sources/SidebarTabs";
import { QueryTabs } from "@/features/query/QueryTabs";
import { ChatSidebar } from "@/features/chat/ChatSidebar";
import {
  useStoreSources,
  useStoreConnectedSources,
  useStoreSourceSchema
} from "@/shared/hooks/useStoreQueries";
import { useSourceStatusQuery } from "@/shared/hooks/useSourceStatusQuery";
import { sourcesToFileTreeNodes } from "@/shared/lib/fileTreeUtils";
import type { Source, ConnectedSource, Query } from "@/shared/lib/api";

export function IdePage() {
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
    setActiveTab,
    setSources,
    setConnectedSources,
    loadQueryInTab
  } = useAppStore();

  // Query for all sources
  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useStoreSources();

  // Get connected sources
  const { data: connectedSourcesData } = useStoreConnectedSources();

  // Create a set of connected source IDs for easy lookup
  const connectedSourceIds = useMemo(() => {
    if (!connectedSourcesData) return new Set<string>();
    return new Set(connectedSourcesData.map((source: ConnectedSource) => source.id));
  }, [connectedSourcesData]);

  // Update store with sources and connected sources when they change
  useEffect(() => {
    if (sources) {
      setSources(sources);
    }
  }, [sources, setSources]);

  useEffect(() => {
    if (connectedSourcesData) {
      setConnectedSources(connectedSourcesData.map((s: ConnectedSource) => s.id));
    }
  }, [connectedSourcesData, setConnectedSources]);

  // Query for selected source schemas - only if the source is connected
  const { data: sourceSchemas } = useStoreSourceSchema(
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

  // Update source status when new status data is loaded
  useEffect(() => {
    if (selectedSource?.id && selectedSourceStatus) {
      setSourceStatus(selectedSource.id, selectedSourceStatus);
    }
  }, [selectedSource, selectedSourceStatus, setSourceStatus]);

  // Transform sources to file tree structure - memoized
  const fileTreeData = useMemo(() => {
    if (!sources) return [];
    return sourcesToFileTreeNodes(sources);
  }, [sources]);

  // Handle source selection
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
        selectedTableData: { sourceId, tableName, query },
        isLoadingQuery: false,
        isLoadingVersions: false,
        lastSavedContent: "",
        originalContent: ""
      });
    },
    [activeTabId, openTabs, updateTabContent, openQueryTab]
  );

  // Handle query selection from QueryTree
  const handleQuerySelect = useCallback(
    async (query: Query) => {
      // Check if query is already open in a tab
      const existingTab = openTabs.find((tab) => tab.queryId === query.id);

      if (existingTab) {
        // Switch to existing tab
        setActiveTab(existingTab.id);
      } else {
        // Open new tab for this query
        openQueryTab({
          queryId: query.id,
          sourceId: query.source_id,
          title: query.name || `Query ${query.id.slice(0, 8)}`,
          isDirty: false,
          editorContent: "", // Will be loaded by loadQueryInTab
          queryResults: null,
          queryRunning: false,
          selectedTableData: null,
          isLoadingQuery: true,
          isLoadingVersions: true,
          lastSavedContent: "",
          originalContent: ""
        });

        // Get the newly created tab ID from the store
        const state = useAppStore.getState();
        const newTab = state.openTabs[state.openTabs.length - 1]; // Latest tab

        if (newTab) {
          // Load query data in the background
          await loadQueryInTab(newTab.id, query.id);
        }
      }
    },
    [openTabs, setActiveTab, openQueryTab, loadQueryInTab]
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
