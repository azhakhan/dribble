// Compatibility layer for gradual migration from useAppStore to new stores
// This provides the same interface as useAppStore but uses the new stores underneath

import { useSourceStore } from "./useSourceStore";
import { useQueryStore } from "./useQueryStore";
import { useTabStore } from "./useTabStore";
import { useTreeStore } from "./useTreeStore";
import { useChatStore } from "./useChatStore";
import { useUIStore } from "./useUIStore";
import type { Query } from "@/shared/lib/api";

// Create a compatibility hook that combines all stores
export const useAppStoreCompat = () => {
  const sourceStore = useSourceStore();
  const queryStore = useQueryStore();
  const tabStore = useTabStore();
  const treeStore = useTreeStore();
  const chatStore = useChatStore();
  const uiStore = useUIStore();

  // Return combined state and actions
  return {
    // Source state
    sources: sourceStore.sources,
    allSources: sourceStore.allSources,
    connectedSources: sourceStore.connectedSources,
    connectedSourcesData: sourceStore.connectedSourcesData,
    selectedSource: sourceStore.selectedSource,
    sourceSchemaMap: sourceStore.sourceSchemaMap,
    sourceGeneratedChildren: sourceStore.sourceGeneratedChildren,
    loadingSources: sourceStore.loadingSources,
    loadingConnectedSources: sourceStore.loadingConnectedSources,
    loadingSchemas: sourceStore.loadingSchemas,
    sourceSchemaErrors: sourceStore.sourceSchemaErrors,
    sourceStatuses: sourceStore.sourceStatuses,

    // Query state
    queries: queryStore.queries,
    queryVersions: queryStore.queryVersions,
    queryRuns: queryStore.queryRuns,
    queryRunsPagination: queryStore.queryRunsPagination,
    loadingQueries: queryStore.loadingQueries,
    loadingVersions: queryStore.loadingVersions,
    loadingRuns: queryStore.loadingRuns,
    queriesBySource: queryStore.queriesBySource,
    versionsByQuery: queryStore.versionsByQuery,
    runsByVersion: queryStore.runsByVersion,

    // Tab state
    openTabs: tabStore.openTabs,
    activeTabId: tabStore.activeTabId,
    tableFilters: tabStore.tableFilters,
    editorContent: tabStore.editorContent,

    // Tree state
    sidebarState: treeStore.sidebarState,
    selectedNodeId: treeStore.selectedNodeId,
    loadingSourceIds: treeStore.loadingSourceIds,

    // Chat state
    selectedLLM: chatStore.selectedLLM,
    messages: chatStore.messages,
    chatLoading: chatStore.chatLoading,
    sessionId: chatStore.sessionId,
    proposedChanges: chatStore.proposedChanges,

    // UI state
    panelSizes: uiStore.panelSizes,
    selectedTableData: uiStore.selectedTableData,
    schemasLoading: uiStore.schemasLoading,
    schemasError: uiStore.schemasError,
    connectedSourceIds: uiStore.connectedSourceIds,
    queryResults: uiStore.queryResults,
    queryRunning: uiStore.queryRunning,

    // Source actions
    loadSources: sourceStore.loadSources,
    loadConnectedSources: sourceStore.loadConnectedSources,
    loadSourceSchema: sourceStore.loadSourceSchema,
    loadConnectedSourcesSchemas: sourceStore.loadConnectedSourcesSchemas,
    setSources: sourceStore.setSources,
    setSelectedSource: sourceStore.setSelectedSource,
    setConnectedSourcesData: sourceStore.setConnectedSourcesData,
    setSourceSchema: sourceStore.setSourceSchema,
    setSourceGeneratedChildren: sourceStore.setSourceGeneratedChildren,
    setSourceSchemaError: sourceStore.setSourceSchemaError,
    setSourceStatus: sourceStore.setSourceStatus,
    removeSourceStatus: sourceStore.removeSourceStatus,
    cleanupDisconnectedSources: sourceStore.cleanupDisconnectedSources,
    setConnectedSources: (sourceIds: string[]) => {
      sourceStore.setConnectedSourcesData(sourceIds.map((id) => ({ id, source_id: id })));
    },

    // Query actions
    loadQuery: queryStore.loadQuery,
    loadQueryVersions: queryStore.loadQueryVersions,
    loadQueryRuns: queryStore.loadQueryRuns,
    loadQueryRunsPaginated: queryStore.loadQueryRunsPaginated,
    loadLatestQueryVersion: queryStore.loadLatestQueryVersion,
    setQuery: queryStore.setQuery,
    setQueryVersions: queryStore.setQueryVersions,
    setQueryRuns: queryStore.setQueryRuns,
    setQueryRunsPaginated: queryStore.setQueryRunsPaginated,
    createNewQuery: queryStore.createNewQuery,
    saveQueryVersion: queryStore.saveQueryVersion,
    updateQueryName: async (queryId: string, newName: string) => {
      await queryStore.updateQueryName(queryId, newName);

      // Update tab title if the query is open
      const tab = tabStore.openTabs.find((tab) => tab.queryId === queryId);
      if (tab) {
        tabStore.updateTabTitle(tab.id, newName);
      }
    },
    getOrCreateEphemeralQuery: queryStore.getOrCreateEphemeralQuery,
    convertEphemeralToRegular: async (queryId: string, name: string) => {
      const updatedQuery = await queryStore.convertEphemeralToRegular(queryId, name);

      // Update tab title if the query is open
      const tab = tabStore.openTabs.find((tab) => tab.queryId === queryId);
      if (tab) {
        tabStore.updateTabTitle(tab.id, name);
      }

      return updatedQuery;
    },
    setQueriesBySource: queryStore.setQueriesBySource,
    setVersionsByQuery: queryStore.setVersionsByQuery,
    setRunsByVersion: queryStore.setRunsByVersion,
    clearQueriesBySource: queryStore.clearQueriesBySource,
    clearVersionsByQuery: queryStore.clearVersionsByQuery,
    clearRunsByVersion: queryStore.clearRunsByVersion,

    // Tab actions
    openQueryTab: tabStore.openQueryTab,
    closeQueryTab: tabStore.closeQueryTab,
    setActiveTab: tabStore.setActiveTab,
    updateTabContent: tabStore.updateTabContent,
    updateTabTitle: tabStore.updateTabTitle,
    loadQueryInTab: tabStore.loadQueryInTab,
    setEditorContent: tabStore.setEditorContent,
    executeQuery: tabStore.executeQuery,
    setTableFilterOffset: tabStore.setTableFilterOffset,
    setTableFilterWhere: tabStore.setTableFilterWhere,
    setTableFilterOrderBy: tabStore.setTableFilterOrderBy,
    setTableFilterPageSize: tabStore.setTableFilterPageSize,
    clearTableFilters: tabStore.clearTableFilters,
    getTableFilters: tabStore.getTableFilters,
    getTabFilterState: tabStore.getTabFilterState,
    shouldAutoExecuteQuery: tabStore.shouldAutoExecuteQuery,
    initializeQueryTabsRuntimeStates: tabStore.initializeQueryTabsRuntimeStates,
    openQueryFromTree: async (query: Query) => {
      await tabStore.openQueryFromTree(query.id);
    },
    openTableFromTree: tabStore.openTableFromTree,

    // Tree actions
    setSidebarActiveTab: treeStore.setSidebarActiveTab,
    setNodeExpanded: treeStore.setNodeExpanded,
    setQuerySourceExpanded: treeStore.setQuerySourceExpanded,
    collapseDisconnectedSources: treeStore.collapseDisconnectedSources,
    isNodeExpanded: treeStore.isNodeExpanded,
    isQuerySourceExpanded: treeStore.isQuerySourceExpanded,
    setSelectedNodeId: treeStore.setSelectedNodeId,
    addLoadingSourceId: treeStore.addLoadingSourceId,
    removeLoadingSourceId: treeStore.removeLoadingSourceId,

    // Chat actions
    setSelectedLLM: chatStore.setSelectedLLM,
    addMessage: chatStore.addMessage,
    setChatLoading: chatStore.setChatLoading,
    clearMessages: chatStore.clearMessages,
    generateNewSession: chatStore.generateNewSession,
    setSessionId: chatStore.setSessionId,
    startNewSession: chatStore.startNewSession,
    loadMessagesFromServer: chatStore.loadMessagesFromServer,
    setProposedChanges: chatStore.setProposedChanges,
    acceptProposedChanges: chatStore.acceptProposedChanges,
    rejectProposedChanges: chatStore.rejectProposedChanges,

    // UI actions
    setPanelSizes: uiStore.setPanelSizes,
    setSelectedTableData: uiStore.setSelectedTableData,
    setQueryResults: uiStore.setQueryResults,
    setQueryRunning: uiStore.setQueryRunning,
    setSchemasLoading: uiStore.setSchemasLoading,
    setSchemasError: uiStore.setSchemasError,
    setConnectedSourceIds: uiStore.setConnectedSourceIds,

    // Debug action
    debugLogLocalStorage: () => {
      console.log("Source Store:", sourceStore);
      console.log("Query Store:", queryStore);
      console.log("Tab Store:", tabStore);
      console.log("Tree Store:", treeStore);
      console.log("Chat Store:", chatStore);
      console.log("UI Store:", uiStore);
    }
  };
};

// Also export a version that can be used with getState()
export const useAppStoreCompatGetState = () => {
  const sourceState = useSourceStore.getState();
  const queryState = useQueryStore.getState();
  const tabState = useTabStore.getState();
  const treeState = useTreeStore.getState();
  const chatState = useChatStore.getState();
  const uiState = useUIStore.getState();

  return {
    ...sourceState,
    ...queryState,
    ...tabState,
    ...treeState,
    ...chatState,
    ...uiState,

    // Additional compatibility methods
    setConnectedSources: (sourceIds: string[]) => {
      sourceState.setConnectedSourcesData(sourceIds.map((id) => ({ id, source_id: id })));
    },
    updateQueryName: async (queryId: string, newName: string) => {
      await queryState.updateQueryName(queryId, newName);
      const tab = tabState.openTabs.find((tab) => tab.queryId === queryId);
      if (tab) {
        tabState.updateTabTitle(tab.id, newName);
      }
    },
    convertEphemeralToRegular: async (queryId: string, name: string) => {
      const updatedQuery = await queryState.convertEphemeralToRegular(queryId, name);
      const tab = tabState.openTabs.find((tab) => tab.queryId === queryId);
      if (tab) {
        tabState.updateTabTitle(tab.id, name);
      }
      return updatedQuery;
    },
    openQueryFromTree: async (query: Query) => {
      await tabState.openQueryFromTree(query.id);
    },
    debugLogLocalStorage: () => {
      console.log("All stores state:", {
        source: sourceState,
        query: queryState,
        tab: tabState,
        tree: treeState,
        chat: chatState,
        ui: uiState
      });
    }
  };
};
