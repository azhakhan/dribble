import { useMemo, useCallback, useEffect, useState, Suspense, lazy } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useUIStore, useSourceStore } from "@/shared/store";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { SidebarTabs } from "@/features/sources/SidebarTabs";
import { QueryTabs } from "@/features/query/QueryTabs";

// Lazy load ChatSidebar
const ChatSidebar = lazy(() =>
  import("@/features/chat/ChatSidebar").then((m) => ({ default: m.ChatSidebar }))
);
import {
  useStoreSources,
  useStoreConnectedSources,
  useStoreSourceSchema
} from "@/shared/hooks/useStoreQueries";
import { useSourceStatus } from "@/shared/hooks/useSourceStatus";
import { sourcesToFileTreeNodes } from "@/shared/lib/fileTreeUtils";
import type { Source, ConnectedSource, Query } from "@/shared/lib/api";

function IdePage() {
  // Get state and actions from Zustand store
  const { panelSizes, setPanelSizes } = useUIStore();
  const {
    selectedSource,
    setSelectedSource,
    setSourceSchema,
    sourceSchemaErrors,
    setSourceSchemaError,
    setSourceStatus,
    setSources,
    setConnectedSourcesData,
    startStatusPolling,
    stopStatusPolling
  } = useSourceStore();
  const {
    activeTabId,
    openTabs,
    initializeQueryTabsRuntimeStates,
    openQueryFromTree,
    openTableFromTree
  } = useTabManagerStore();

  // Initialize SSE connection and runtime states for query tabs on app load
  useEffect(() => {
    const initialize = async () => {
      try {
        // Import SSE connection manager
        const { sseConnectionManager } = await import("@/shared/services/SSEConnectionManager");

        // Establish SSE connection first
        console.log("Establishing SSE connection...");
        await sseConnectionManager.connect();
        console.log("SSE connection established successfully");

        // Then initialize query tabs
        await initializeQueryTabsRuntimeStates();
      } catch (error) {
        console.error("Failed to initialize query tabs runtime states:", error);
      }
    };
    initialize();
  }, [initializeQueryTabsRuntimeStates]);

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
      setConnectedSourcesData(connectedSourcesData);

      // Start background status polling when connected sources are loaded
      // if (connectedSourcesData.length > 0) {
      //   startStatusPolling();
      // }
    }
  }, [connectedSourcesData, setConnectedSourcesData, startStatusPolling]);

  // Cleanup status polling on unmount
  useEffect(() => {
    return () => {
      stopStatusPolling();
    };
  }, [stopStatusPolling]);

  // Query for selected source schemas - only if the source is connected
  const { data: sourceSchemas } = useStoreSourceSchema(
    selectedSource?.id && connectedSourceIds.has(selectedSource.id) ? selectedSource.id : undefined
  );

  // Get selected source status from store (cached value)
  const { status: selectedSourceStatus } = useSourceStatus(
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

  // Handle table double-click - create ephemeral query and execute
  const handleTableDoubleClick = useCallback(
    async (
      sourceId: string,
      tableName: string,
      nodeType: "table" | "view",
      schemaName?: string
    ) => {
      await openTableFromTree(sourceId, tableName, nodeType, schemaName);
    },
    [openTableFromTree]
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

      // Use unified helper
      await openQueryFromTree(query.id);
    },
    [setSelectedQueryId, openQueryFromTree]
  );

  return (
    <div className="flex-1 min-h-0">
      <PanelGroup direction="horizontal" onLayout={(newSizes) => setPanelSizes(newSizes)}>
        <Panel defaultSize={panelSizes[0]} minSize={15}>
          <div className="h-full border-r select-none">
            <SidebarTabs
              sources={fileTreeData}
              connectedSources={connectedSourcesData || []}
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
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
                </div>
              }
            >
              <ChatSidebar />
            </Suspense>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default IdePage;
