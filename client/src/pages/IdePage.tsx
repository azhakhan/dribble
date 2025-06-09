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
    setActiveTab,
    setSources,
    setConnectedSources,
    loadQueryInTab,
    executeQuery,
    getOrCreateEphemeralQuery,
    loadLatestQueryVersion
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

  // Get the currently selected query ID based on the active tab
  const selectedQueryId = useMemo(() => {
    if (!activeTabId) return undefined;
    const activeTab = openTabs.find((tab) => tab.id === activeTabId);
    return activeTab?.queryId || undefined;
  }, [activeTabId, openTabs]);

  // Handle source selection
  const handleSourceSelect = useCallback(
    (source: Source) => {
      setSelectedSource(source);
    },
    [setSelectedSource]
  );

  // Handle table double-click - create or switch to existing ephemeral query tab
  const handleTableDoubleClick = useCallback(
    async (sourceId: string, tableName: string) => {
      try {
        // Extract schema and table from tableName (format: "schema.table")
        const parts = tableName.split(".");
        const schema = parts.length > 1 ? parts[0] : "public";
        const table = parts.length > 1 ? parts[1] : parts[0];

        // Get or create ephemeral query
        const ephemeralQuery = await getOrCreateEphemeralQuery(sourceId, schema, table);
        console.log("Ephemeral query for table double-click:", ephemeralQuery);

        // Check if this ephemeral query is already open in a tab
        const existingTab = openTabs.find((tab) => tab.queryId === ephemeralQuery.id);

        if (existingTab) {
          // Switch to existing tab and execute query
          setActiveTab(existingTab.id);
          await executeQuery(existingTab.id);
          return;
        }

        // Get the latest version to get the SQL
        const latestVersion = await loadLatestQueryVersion(ephemeralQuery.id);
        const sql = latestVersion?.sql || `SELECT * FROM ${schema}.${table} LIMIT 101`;

        // Create a new tab for this ephemeral query
        openQueryTab({
          queryId: ephemeralQuery.id,
          sourceId,
          title: `${schema}.${table}`,
          isDirty: false,
          editorContent: sql,
          queryResults: null,
          queryRunning: true,
          selectedTableData: { sourceId, tableName, query: sql },
          isLoadingQuery: false,
          isLoadingVersions: false,
          lastSavedContent: sql,
          originalContent: sql
        });

        // Execute the query immediately
        setTimeout(async () => {
          const state = useAppStore.getState();
          const newTab = state.openTabs[state.openTabs.length - 1];
          if (newTab) {
            await executeQuery(newTab.id);
          }
        }, 100);
      } catch (error) {
        console.error("Failed to handle table double-click:", error);
        // Fallback to old behavior
        const query = `SELECT * FROM ${tableName} LIMIT 101`;
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
      }
    },
    [
      getOrCreateEphemeralQuery,
      loadLatestQueryVersion,
      openTabs,
      setActiveTab,
      executeQuery,
      openQueryTab
    ]
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

  // Handle query double-click from QueryTree - open in tab and execute
  const handleQueryDoubleClick = useCallback(
    async (query: Query) => {
      // First, handle the selection (open in tab)
      await handleQuerySelect(query);

      // Then execute the query after a brief delay to ensure tab is set up
      setTimeout(async () => {
        const state = useAppStore.getState();
        const activeTab = state.openTabs.find((tab) => tab.queryId === query.id);

        if (activeTab) {
          await executeQuery(activeTab.id);
        }
      }, 100);
    },
    [handleQuerySelect, executeQuery]
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
              onQueryDoubleClick={handleQueryDoubleClick}
              selectedQueryId={selectedQueryId}
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
