import { useMemo, useCallback, useEffect, useState } from "react";
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

  // Track the selected query ID for highlighting in QueryTree (separate from open tabs)
  const [selectedQueryId, setSelectedQueryId] = useState<string | undefined>(undefined);

  // Update selected query ID when active tab changes (to keep selection in sync)
  useEffect(() => {
    if (activeTabId) {
      const activeTab = openTabs.find((tab) => tab.id === activeTabId);
      if (activeTab?.queryId) {
        setSelectedQueryId(activeTab.queryId);
      }
    }
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

        // Check if this ephemeral query is already open in a tab
        const existingTab = openTabs.find((tab) => tab.queryId === ephemeralQuery.id);

        if (existingTab) {
          // Switch to existing tab and execute query
          setActiveTab(existingTab.id);

          // Make sure the tab has the correct content loaded
          if (!existingTab.editorContent) {
            const latestVersion = await loadLatestQueryVersion(ephemeralQuery.id);
            const sql = latestVersion?.sql || `SELECT * FROM ${schema}.${table} LIMIT 101`;

            // Update tab content before executing
            const { openTabs: currentTabs, updateTabContent } = useAppStore.getState();
            const currentTab = currentTabs.find((tab) => tab.id === existingTab.id);
            if (currentTab) {
              updateTabContent(existingTab.id, {
                editorContent: sql,
                lastSavedContent: sql,
                originalContent: sql
              });
            }
          }

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
          queryRunning: false, // Don't set to running yet
          selectedTableData: { sourceId, tableName, query: sql },
          isLoadingQuery: false,
          isLoadingVersions: false,
          lastSavedContent: sql,
          originalContent: sql
        });

        // Execute the query immediately after tab creation
        // Use requestAnimationFrame to ensure tab is fully created in the UI
        requestAnimationFrame(async () => {
          try {
            const state = useAppStore.getState();
            const newTab = state.openTabs.find((tab) => tab.queryId === ephemeralQuery.id);

            if (newTab) {
              // Set the tab as active before executing
              setActiveTab(newTab.id);

              // Execute the query
              await executeQuery(newTab.id);
            }
          } catch (error) {
            console.error("Failed to execute ephemeral query:", error);
          }
        });
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

  // Handle query selection from QueryTree - just select, don't open
  const handleQuerySelect = useCallback(
    (query: Query) => {
      // Just set the selected query ID for UI highlighting
      setSelectedQueryId(query.id);
    },
    [setSelectedQueryId]
  );

  // Handle query double-click from QueryTree - open in tab and execute
  const handleQueryDoubleClick = useCallback(
    async (query: Query) => {
      // Set as selected
      setSelectedQueryId(query.id);

      // Check if query is already open in a tab
      const existingTab = openTabs.find((tab) => tab.queryId === query.id);

      if (existingTab) {
        // Switch to existing tab and execute
        setActiveTab(existingTab.id);
        await executeQuery(existingTab.id);
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
          // Load query data into the tab
          await loadQueryInTab(newTab.id, query.id);

          // Execute the query after loading
          await executeQuery(newTab.id);
        }
      }
    },
    [setSelectedQueryId, openTabs, setActiveTab, executeQuery, openQueryTab, loadQueryInTab]
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
