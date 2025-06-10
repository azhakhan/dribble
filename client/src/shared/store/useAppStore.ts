import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Source, SourceStatus, Query, QueryVersion, QueryRun } from "@/shared/lib/api";
import {
  getQueryById,
  getQueryVersions,
  getLatestQueryVersion,
  createQuery,
  createQueryVersion,
  updateQuery,
  executeQueryVersionRun,
  getQueryRunResults,
  getQueryRunsByQueryId,
  getQueryRunsByQueryIdPaginated,
  getSources,
  getConnectedSources,
  getSourceSchemas,
  getOrCreateEphemeralQuery,
  convertEphemeralToRegular,
  type ConnectedSource,
  type CreateQueryRunRequest
} from "@/shared/lib/api";
import type { FileNode } from "@/shared/lib/fileTreeUtils";

// Interface for schema objects
interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

interface SchemaForeignKey {
  column: string;
  constraint_name: string;
  references_table: string;
  references_column: string;
}

interface SchemaRelationshipReference {
  foreign_column: string;
  local_column: string;
  table: string;
  type: string;
}

interface SchemaRelationship {
  referenced_by: SchemaRelationshipReference[];
  references: SchemaRelationshipReference[];
}

export interface SchemaTable {
  columns: SchemaColumn[];
  primary_keys: string[];
  foreign_keys: SchemaForeignKey[];
  relationships?: SchemaRelationship;
}

interface SchemaView {
  columns: SchemaColumn[];
}

export interface SchemaObject {
  tables: Record<string, SchemaTable>;
  views: Record<string, SchemaView>;
}

// Type for the schema map
export type SourceSchemaMap = Record<string, Record<string, SchemaObject>>;

// Tree state persistence interfaces (for future use)
// interface TreeNodeState {
//   id: string;
//   isExpanded: boolean;
//   nodeType: "source" | "schema" | "table" | "column" | "folder";
//   sourceId?: string; // For nested nodes to know which source they belong to
// }

interface SidebarState {
  activeTab: "sources" | "queries";
  expandedNodes: Record<string, boolean>; // nodeId -> isExpanded
  expandedQuerySources: Record<string, boolean>; // sourceId -> isExpanded in query tree
}

interface TreeState {
  sidebarState: SidebarState;

  // Actions for tree state management
  setSidebarActiveTab: (tab: "sources" | "queries") => void;
  setNodeExpanded: (nodeId: string, isExpanded: boolean) => void;
  setQuerySourceExpanded: (sourceId: string, isExpanded: boolean) => void;
  collapseDisconnectedSources: (connectedSourceIds: string[]) => void;
  isNodeExpanded: (nodeId: string) => boolean;
  isQuerySourceExpanded: (sourceId: string) => boolean;

  // Debug action
  debugLogLocalStorage: () => void;

  // Initialize runtime states for query tabs
  initializeQueryTabsRuntimeStates: () => Promise<void>;
}

// Enhanced query tab interface with better state management
export interface QueryTab {
  id: string;
  queryId: string | null;
  sourceId: string;
  title: string;
  isDirty: boolean;
  editorContent: string;
  queryResults: object[] | null;
  queryRunning: boolean;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;
  // Add loading states
  isLoadingQuery: boolean;
  isLoadingVersions: boolean;
  lastSavedContent: string;
  originalContent: string;
}

// Pagination interface
interface PaginationInfo {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Table filter interface
interface TableFilterState {
  currentOffset: number;
  whereInput: string;
  orderByInput: string;
  pageSize: number;
  displaySize: number;
}

// Centralized query state management
interface QueryState {
  // Cached data
  queries: Record<string, Query>; // queryId -> Query
  queryVersions: Record<string, QueryVersion[]>; // queryId -> versions
  queryRuns: Record<string, QueryRun[]>; // queryId -> runs
  queryRunsPagination: Record<string, PaginationInfo>; // queryId -> pagination info
  sources: Record<string, Source>; // sourceId -> Source
  connectedSources: Set<string>; // Set of connected source IDs
  allSources: Source[]; // All available sources
  connectedSourcesData: ConnectedSource[]; // Connected sources with status

  // Loading states
  loadingQueries: Set<string>; // Set of query IDs being loaded
  loadingVersions: Set<string>; // Set of query IDs whose versions are being loaded
  loadingRuns: Set<string>; // Set of query IDs whose runs are being loaded
  loadingSources: boolean; // Loading all sources
  loadingConnectedSources: boolean; // Loading connected sources
  loadingSchemas: Set<string>; // Set of source IDs whose schemas are being loaded

  // Actions for centralized query management
  loadQuery: (queryId: string) => Promise<void>;
  loadQueryVersions: (queryId: string) => Promise<void>;
  loadQueryRuns: (queryId: string, forceRefresh?: boolean) => Promise<void>;
  loadQueryRunsPaginated: (
    queryId: string,
    page: number,
    pageSize: number,
    forceRefresh?: boolean
  ) => Promise<void>;
  loadLatestQueryVersion: (queryId: string) => Promise<QueryVersion | null>;
  setQuery: (queryId: string, query: Query) => void;
  setQueryVersions: (queryId: string, versions: QueryVersion[]) => void;
  setQueryRuns: (queryId: string, runs: QueryRun[]) => void;
  setQueryRunsPaginated: (queryId: string, runs: QueryRun[], pagination: PaginationInfo) => void;

  // Enhanced source management
  loadSources: () => Promise<void>;
  loadConnectedSources: () => Promise<void>;
  loadSourceSchema: (sourceId: string) => Promise<void>;
  loadConnectedSourcesSchemas: (connectedSources: ConnectedSource[]) => Promise<void>;
  setSources: (sources: Source[]) => void;
  setConnectedSources: (connectedSourceIds: string[]) => void;
  setConnectedSourcesData: (connectedSources: ConnectedSource[]) => void;

  // Query execution
  executeQuery: (tabId: string, sql?: string) => Promise<void>;

  // Query creation and management
  createNewQuery: (sourceId: string) => Promise<string>;
  saveQueryVersion: (queryId: string, sql: string, saveTrigger: "run" | "ai") => Promise<void>;
  updateQueryName: (queryId: string, newName: string) => Promise<void>;

  // Ephemeral query management
  getOrCreateEphemeralQuery: (
    sourceId: string,
    schema: string,
    table: string,
    nodeType: "table" | "view"
  ) => Promise<Query>;
  convertEphemeralToRegular: (queryId: string, name: string) => Promise<Query>;

  // Auto-execution helper
  shouldAutoExecuteQuery: (tab: QueryTab) => boolean;

  // Unified query/table opening helpers
  openQueryFromTree: (query: Query) => Promise<void>;
  openTableFromTree: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view"
  ) => Promise<void>;
}

// FileTree state
interface FileTreeState {
  // From FileTree.tsx
  selectedNodeId: string | undefined;
  loadingSourceIds: Set<string>;

  // Actions
  setSelectedNodeId: (id: string | undefined) => void;
  addLoadingSourceId: (id: string) => void;
  removeLoadingSourceId: (id: string) => void;
}

// Source children state
interface SourceChildrenState {
  // Map of sourceId to generated children
  sourceGeneratedChildren: Record<string, FileNode[]>;

  // Actions
  setSourceGeneratedChildren: (sourceId: string, children: FileNode[]) => void;
}

// App state
interface AppState extends FileTreeState, SourceChildrenState, QueryState, TreeState {
  // Panel sizes
  panelSizes: number[];

  // Source and schema state
  selectedSource: Source | null;
  sourceSchemaMap: Record<string, Record<string, SchemaObject>>;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;

  // Table filter state - grouped by tab ID
  tableFilters: Record<string, TableFilterState>;

  // Editor-related state
  schemasLoading: boolean;
  schemasError: unknown;
  connectedSourceIds: Set<string>;

  // Query state (legacy - will be moved to QueryState)
  queryResults: object[] | null;
  queryRunning: boolean;

  // Query tabs state
  openTabs: QueryTab[];
  activeTabId: string | null;

  // Error and status tracking
  sourceSchemaErrors: Record<string, string>;
  sourceStatuses: Record<string, SourceStatus>;

  // Editor state
  editorContent: string;

  // Proposed changes for diff view
  proposedChanges: {
    originalContent: string;
    proposedContent: string;
    message: string;
  } | null;

  // Chat state
  selectedLLM: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string; sql_query?: string }>;
  chatLoading: boolean;
  sessionId: string | null;

  // Query, Version, Run state (legacy - will be consolidated)
  queriesBySource: Record<string, Query[]>;
  versionsByQuery: Record<string, QueryVersion[]>;
  runsByVersion: Record<string, QueryRun[]>;

  // Actions for App state
  setPanelSizes: (sizes: number[]) => void;
  setSelectedSource: (source: Source | null) => void;
  setSourceSchema: (sourceId: string, schema: Record<string, SchemaObject>) => void;
  setSelectedTableData: (
    data: { sourceId: string; tableName: string; query: string } | null
  ) => void;
  setQueryResults: (results: object[] | null) => void;
  setQueryRunning: (isRunning: boolean) => void;
  setSourceSchemaError: (sourceId: string, error: string | null) => void;
  setSourceStatus: (sourceId: string, status: SourceStatus) => void;
  removeSourceStatus: (sourceId: string) => void;

  // Enhanced query tabs actions
  openQueryTab: (tab: Omit<QueryTab, "id">) => Promise<void>;
  closeQueryTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTabContent: (tabId: string, content: Partial<QueryTab>) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  loadQueryInTab: (tabId: string, queryId: string) => Promise<void>;

  // Editor actions
  setEditorContent: (content: string) => void;

  // Proposed changes actions
  setProposedChanges: (
    changes: {
      originalContent: string;
      proposedContent: string;
      message: string;
    } | null
  ) => void;
  acceptProposedChanges: () => void;
  rejectProposedChanges: () => void;

  // Chat actions
  setSelectedLLM: (llmId: string | null) => void;
  addMessage: (message: {
    role: "user" | "assistant";
    content: string;
    sql_query?: string;
  }) => void;
  setChatLoading: (loading: boolean) => void;
  clearMessages: () => void;
  generateNewSession: () => void;
  setSessionId: (sessionId: string | null) => void;
  startNewSession: () => void;
  loadMessagesFromServer: (
    messages: Array<{ role: "user" | "assistant"; content: string; sql_query?: string }>
  ) => void;

  // New action to clean up disconnected sources
  cleanupDisconnectedSources: (connectedSourceIds: string[]) => void;

  // Legacy query, Version, Run actions (to be deprecated)
  setQueriesBySource: (sourceId: string, queries: Query[]) => void;
  setVersionsByQuery: (queryId: string, versions: QueryVersion[]) => void;
  setRunsByVersion: (versionId: string, runs: QueryRun[]) => void;
  clearQueriesBySource: (sourceId: string) => void;
  clearVersionsByQuery: (queryId: string) => void;
  clearRunsByVersion: (versionId: string) => void;

  // Editor-related actions
  setSchemasLoading: (loading: boolean) => void;
  setSchemasError: (error: unknown) => void;
  setConnectedSourceIds: (sourceIds: Set<string>) => void;

  // Table filter actions
  setTableFilterOffset: (offset: number) => void;
  setTableFilterWhere: (where: string) => void;
  setTableFilterOrderBy: (orderBy: string) => void;
  setTableFilterPageSize: (displaySize: number) => void;
  clearTableFilters: () => void;
  getTableFilters: () => { limit: number; offset: number; where?: string; order_by?: string };
  getTabFilterState: (tabId: string) => TableFilterState;
}

// Create the store with persistence for certain values
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Panel sizes with default values
      panelSizes: [20, 60, 20],

      // FileTree state
      selectedNodeId: undefined,
      loadingSourceIds: new Set(),

      // Tree state with default values
      sidebarState: {
        activeTab: "sources",
        expandedNodes: {},
        expandedQuerySources: {}
      },

      // Source and schema state
      selectedSource: null,
      sourceSchemaMap: {},
      selectedTableData: null,

      // Table filter state - grouped by tab ID
      tableFilters: {},

      // Editor-related state
      schemasLoading: false,
      schemasError: null,
      connectedSourceIds: new Set(),

      // Query state
      queryResults: null,
      queryRunning: false,

      // Query tabs state
      openTabs: [],
      activeTabId: null,

      // Error and status tracking
      sourceSchemaErrors: {},
      sourceStatuses: {},

      // Source children state
      sourceGeneratedChildren: {},

      // Editor state
      editorContent: "",

      // Proposed changes state
      proposedChanges: null,

      // Chat state
      selectedLLM: null,
      messages: [],
      chatLoading: false,
      sessionId: null,

      // Query, Version, Run state
      queriesBySource: {},
      versionsByQuery: {},
      runsByVersion: {},

      // Centralized query state
      queries: {},
      queryVersions: {},
      queryRuns: {},
      queryRunsPagination: {},
      sources: {},
      connectedSources: new Set(),
      loadingQueries: new Set(),
      loadingVersions: new Set(),
      loadingRuns: new Set(),
      allSources: [],
      connectedSourcesData: [],
      loadingSources: false,
      loadingConnectedSources: false,
      loadingSchemas: new Set(),

      // Tree state actions
      setSidebarActiveTab: (tab) =>
        set((state) => ({
          sidebarState: { ...state.sidebarState, activeTab: tab }
        })),

      setNodeExpanded: (nodeId, isExpanded) =>
        set((state) => ({
          sidebarState: {
            ...state.sidebarState,
            expandedNodes: {
              ...state.sidebarState.expandedNodes,
              [nodeId]: isExpanded
            }
          }
        })),

      setQuerySourceExpanded: (sourceId, isExpanded) =>
        set((state) => ({
          sidebarState: {
            ...state.sidebarState,
            expandedQuerySources: {
              ...state.sidebarState.expandedQuerySources,
              [sourceId]: isExpanded
            }
          }
        })),

      collapseDisconnectedSources: (connectedSourceIds) =>
        set((state) => {
          // Only clean up query source expansion states (simpler and safer)
          const connectedSet = new Set(connectedSourceIds);

          const newExpandedQuerySources = Object.entries(state.sidebarState.expandedQuerySources)
            .filter(([sourceId]) => connectedSet.has(sourceId))
            .reduce((acc, [sourceId, isExpanded]) => ({ ...acc, [sourceId]: isExpanded }), {});

          return {
            sidebarState: {
              ...state.sidebarState,
              expandedQuerySources: newExpandedQuerySources
              // Keep expandedNodes unchanged - let manual disconnects handle cleanup
            }
          };
        }),

      isNodeExpanded: (nodeId) => {
        const state = get();
        return state.sidebarState.expandedNodes[nodeId] || false;
      },

      isQuerySourceExpanded: (sourceId) => {
        const state = get();
        return state.sidebarState.expandedQuerySources[sourceId] || false;
      },

      // Panel actions
      setPanelSizes: (sizes) => set({ panelSizes: sizes }),

      // FileTree actions
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      addLoadingSourceId: (id) =>
        set((state) => ({
          loadingSourceIds: new Set(state.loadingSourceIds).add(id)
        })),
      removeLoadingSourceId: (id) =>
        set((state) => {
          const newSet = new Set(state.loadingSourceIds);
          newSet.delete(id);
          return { loadingSourceIds: newSet };
        }),

      // Source and schema actions
      setSelectedSource: (source) => set({ selectedSource: source }),
      setSourceSchema: (sourceId, schema) =>
        set((state) => ({
          sourceSchemaMap: {
            ...state.sourceSchemaMap,
            [sourceId]: schema
          }
        })),
      setSelectedTableData: (data) => set({ selectedTableData: data }),

      // Query actions
      setQueryResults: (results) => set({ queryResults: results }),
      setQueryRunning: (isRunning) => set({ queryRunning: isRunning }),

      // Error and status actions
      setSourceSchemaError: (sourceId, error) =>
        set((state) => {
          const newErrors = { ...state.sourceSchemaErrors };
          if (error === null) {
            delete newErrors[sourceId];
          } else {
            newErrors[sourceId] = error;
          }
          return { sourceSchemaErrors: newErrors };
        }),
      setSourceStatus: (sourceId, status) =>
        set((state) => ({
          sourceStatuses: {
            ...state.sourceStatuses,
            [sourceId]: status
          }
        })),
      removeSourceStatus: (sourceId) =>
        set((state) => {
          const newStatuses = { ...state.sourceStatuses };
          delete newStatuses[sourceId];
          return { sourceStatuses: newStatuses };
        }),

      // Source children actions
      setSourceGeneratedChildren: (sourceId, children) =>
        set((state) => ({
          sourceGeneratedChildren: {
            ...state.sourceGeneratedChildren,
            [sourceId]: children
          }
        })),

      // Editor actions
      setEditorContent: (content) => set({ editorContent: content }),

      // Proposed changes actions
      setProposedChanges: (changes) => set({ proposedChanges: changes }),
      acceptProposedChanges: () =>
        set((state) => {
          if (state.proposedChanges && state.activeTabId) {
            // Update the active tab's content instead of global editorContent
            const updatedTabs = state.openTabs.map((tab) =>
              tab.id === state.activeTabId
                ? {
                    ...tab,
                    editorContent: state.proposedChanges!.proposedContent,
                    isDirty: true
                  }
                : tab
            );

            return {
              openTabs: updatedTabs,
              // Keep global editorContent for backward compatibility but also update it
              editorContent: state.proposedChanges.proposedContent,
              proposedChanges: null
            };
          }
          return { proposedChanges: null };
        }),
      rejectProposedChanges: () => set({ proposedChanges: null }),

      // Chat actions
      setSelectedLLM: (llmId) => set({ selectedLLM: llmId }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message]
        })),
      setChatLoading: (loading) => set({ chatLoading: loading }),
      clearMessages: () => set({ messages: [] }),
      generateNewSession: () => set({ sessionId: crypto.randomUUID() }),
      setSessionId: (sessionId) => set({ sessionId }),
      startNewSession: () => set({ messages: [], sessionId: crypto.randomUUID() }),
      loadMessagesFromServer: (messages) => set({ messages }),

      // New action to clean up disconnected sources
      cleanupDisconnectedSources: (connectedSourceIds) =>
        set((state) => {
          const connectedSet = new Set(connectedSourceIds);

          // Clean up schema map
          const newSourceSchemaMap = { ...state.sourceSchemaMap };
          Object.keys(newSourceSchemaMap).forEach((sourceId) => {
            if (!connectedSet.has(sourceId)) {
              delete newSourceSchemaMap[sourceId];
            }
          });

          // Clean up generated children
          const newSourceGeneratedChildren = { ...state.sourceGeneratedChildren };
          Object.keys(newSourceGeneratedChildren).forEach((sourceId) => {
            if (!connectedSet.has(sourceId)) {
              delete newSourceGeneratedChildren[sourceId];
            }
          });

          // Clean up schema errors
          const newSourceSchemaErrors = { ...state.sourceSchemaErrors };
          Object.keys(newSourceSchemaErrors).forEach((sourceId) => {
            if (!connectedSet.has(sourceId)) {
              delete newSourceSchemaErrors[sourceId];
            }
          });

          // Clean up source statuses
          const newSourceStatuses = { ...state.sourceStatuses };
          Object.keys(newSourceStatuses).forEach((sourceId) => {
            if (!connectedSet.has(sourceId)) {
              delete newSourceStatuses[sourceId];
            }
          });

          // Clean up tree expansion states for disconnected sources
          const newExpandedNodes = { ...state.sidebarState.expandedNodes };
          Object.keys(newExpandedNodes).forEach((nodeId) => {
            // Remove expansion state for source nodes that are no longer connected
            if (nodeId.startsWith("source-")) {
              const sourceId = nodeId.replace("source-", "");
              if (!connectedSet.has(sourceId)) {
                delete newExpandedNodes[nodeId];
              }
            }
            // Remove schema nodes for disconnected sources
            else if (nodeId.startsWith("schema-")) {
              const parts = nodeId.split("-");
              if (parts.length >= 2) {
                const sourceId = parts[1];
                if (!connectedSet.has(sourceId)) {
                  delete newExpandedNodes[nodeId];
                }
              }
            }
            // Remove organizational folder nodes (tables-folder-, views-folder-)
            else if (nodeId.includes("-folder-")) {
              const parts = nodeId.split("-folder-");
              if (parts.length >= 2) {
                const sourceIdPart = parts[1].split("-")[0];
                if (!connectedSet.has(sourceIdPart)) {
                  delete newExpandedNodes[nodeId];
                }
              }
            }
            // Remove table/view nodes for disconnected sources
            else if (nodeId.startsWith("table-")) {
              // Table node IDs are like: table-${sourceId}_${schemaName}_${tableName}
              const tableIdPart = nodeId.replace("table-", "");
              const sourceId = tableIdPart.split("_")[0];
              if (!connectedSet.has(sourceId)) {
                delete newExpandedNodes[nodeId];
              }
            }
            // Remove column nodes for disconnected sources
            else if (nodeId.startsWith("column-")) {
              const parts = nodeId.split("-");
              if (parts.length >= 2) {
                const sourceId = parts[1];
                if (!connectedSet.has(sourceId)) {
                  delete newExpandedNodes[nodeId];
                }
              }
            }
          });

          // Clean up query source expansion states
          const newExpandedQuerySources = { ...state.sidebarState.expandedQuerySources };
          Object.keys(newExpandedQuerySources).forEach((sourceId) => {
            if (!connectedSet.has(sourceId)) {
              delete newExpandedQuerySources[sourceId];
            }
          });

          return {
            sourceSchemaMap: newSourceSchemaMap,
            sourceGeneratedChildren: newSourceGeneratedChildren,
            sourceSchemaErrors: newSourceSchemaErrors,
            sourceStatuses: newSourceStatuses,
            sidebarState: {
              ...state.sidebarState,
              expandedNodes: newExpandedNodes,
              expandedQuerySources: newExpandedQuerySources
            }
          };
        }),

      // Legacy query, Version, Run actions
      setQueriesBySource: (sourceId, queries) =>
        set((state) => ({
          queriesBySource: { ...state.queriesBySource, [sourceId]: queries }
        })),
      setVersionsByQuery: (queryId, versions) =>
        set((state) => ({
          versionsByQuery: { ...state.versionsByQuery, [queryId]: versions }
        })),
      setRunsByVersion: (versionId, runs) =>
        set((state) => ({
          runsByVersion: { ...state.runsByVersion, [versionId]: runs }
        })),
      clearQueriesBySource: (sourceId) =>
        set((state) => {
          const newQueries = { ...state.queriesBySource };
          delete newQueries[sourceId];
          return { queriesBySource: newQueries };
        }),
      clearVersionsByQuery: (queryId) =>
        set((state) => {
          const newVersions = { ...state.versionsByQuery };
          delete newVersions[queryId];
          return { versionsByQuery: newVersions };
        }),
      clearRunsByVersion: (versionId) =>
        set((state) => {
          const newRuns = { ...state.runsByVersion };
          delete newRuns[versionId];
          return { runsByVersion: newRuns };
        }),

      // Query tabs actions
      openQueryTab: async (tab) => {
        const newTabId = crypto.randomUUID();
        const newTab: QueryTab = {
          ...tab,
          id: newTabId,
          isLoadingQuery: false,
          isLoadingVersions: false,
          lastSavedContent: "",
          originalContent: ""
        };

        set((state) => ({
          openTabs: [...state.openTabs, newTab],
          activeTabId: newTabId
        }));

        // Auto-execute if conditions are met for the new tab
        const currentState = get();
        if (currentState.shouldAutoExecuteQuery(newTab)) {
          console.log("Auto-executing query on new tab:", newTabId);
          try {
            await currentState.executeQuery(newTabId);
          } catch (error) {
            console.error("Failed to auto-execute query on new tab:", error);
          }
        }
      },
      closeQueryTab: (tabId) =>
        set((state) => {
          const newOpenTabs = state.openTabs.filter((tab) => tab.id !== tabId);
          const newActiveTabId =
            state.activeTabId === tabId
              ? newOpenTabs.length > 0
                ? newOpenTabs[newOpenTabs.length - 1].id
                : null
              : state.activeTabId;
          return {
            openTabs: newOpenTabs,
            activeTabId: newActiveTabId
          };
        }),
      setActiveTab: async (tabId) => {
        // Set the active tab immediately for UI responsiveness
        set(() => ({ activeTabId: tabId }));

        if (!tabId) return;

        const currentState = get();
        const activeTab = currentState.openTabs.find((tab) => tab.id === tabId);

        if (!activeTab) return;

        // If the tab has a query, load its latest content and set source
        if (activeTab.queryId) {
          try {
            // Load the latest version of the query
            const latestVersion = await currentState.loadLatestQueryVersion(activeTab.queryId);

            // Get the query and its source
            const query = currentState.queries[activeTab.queryId];
            const querySource = query?.source_id ? currentState.sources[query.source_id] : null;

            // Update the tab with the latest content and set the query's source as selected
            set((state) => ({
              openTabs: state.openTabs.map((tab) =>
                tab.id === tabId
                  ? {
                      ...tab,
                      editorContent: latestVersion?.sql || tab.editorContent,
                      lastSavedContent: latestVersion?.sql || tab.lastSavedContent,
                      originalContent: latestVersion?.sql || tab.originalContent
                    }
                  : tab
              ),
              selectedSource: querySource || state.selectedSource,
              // Update global editorContent for backward compatibility
              editorContent: latestVersion?.sql || activeTab.editorContent
            }));

            // Auto-execute if conditions are met
            const updatedState = get();
            const updatedTab = updatedState.openTabs.find((tab) => tab.id === tabId);
            if (updatedTab && currentState.shouldAutoExecuteQuery(updatedTab)) {
              console.log("Auto-executing query on tab switch:", tabId);
              await currentState.executeQuery(tabId);
            }
          } catch (error) {
            console.error("Failed to load latest query version when switching tabs:", error);
            // Still set the source even if loading fails
            const query = currentState.queries[activeTab.queryId];
            const querySource = query?.source_id ? currentState.sources[query.source_id] : null;
            if (querySource) {
              set(() => ({ selectedSource: querySource }));
            }
          }
        } else {
          // For tabs without a queryId, just update the global editorContent
          set((prevState) => ({
            editorContent: activeTab.editorContent,
            selectedSource: currentState.sources[activeTab.sourceId] || prevState.selectedSource
          }));

          // Auto-execute if conditions are met for tabs without queryId
          if (currentState.shouldAutoExecuteQuery(activeTab)) {
            console.log("Auto-executing query on tab switch (no queryId):", tabId);
            await currentState.executeQuery(tabId);
          }
        }
      },
      updateTabContent: (tabId, content) =>
        set((state) => {
          const updatedTabs = state.openTabs.map((tab) => {
            if (tab.id === tabId) {
              const updatedTab = { ...tab, ...content };

              // If editor content is being updated, check if it makes the tab dirty
              if (content.editorContent !== undefined) {
                updatedTab.isDirty = content.editorContent.trim() !== tab.lastSavedContent.trim();
              }

              return updatedTab;
            }
            return tab;
          });

          // Also update global editorContent if this is the active tab and editorContent is being updated
          const isActiveTab = state.activeTabId === tabId;
          const updatingEditorContent = content.editorContent !== undefined;

          return {
            openTabs: updatedTabs,
            ...(isActiveTab && updatingEditorContent && { editorContent: content.editorContent })
          };
        }),
      updateTabTitle: (tabId, title) =>
        set((state) => ({
          openTabs: state.openTabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
        })),

      // Enhanced query management
      loadQueryInTab: async (tabId, queryId) => {
        const state = get();
        const tab = state.openTabs.find((t) => t.id === tabId);
        if (!tab) return;

        // Set loading state
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.id === tabId ? { ...t, isLoadingQuery: true, isLoadingVersions: true } : t
          )
        }));

        try {
          // Load query and latest version concurrently
          const [query, latestVersion] = await Promise.all([
            state.loadQuery(queryId).then(() => get().queries[queryId]),
            state.loadLatestQueryVersion(queryId)
          ]);

          // Get the source for this query to set as selected source for chat
          const querySource = query?.source_id ? get().sources[query.source_id] : null;

          // Update tab with loaded data and set query's source as selected source for chat
          set((prevState) => ({
            openTabs: prevState.openTabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    queryId,
                    title: query?.name || `Query ${queryId.slice(0, 8)}`,
                    editorContent: latestVersion?.sql || "",
                    originalContent: latestVersion?.sql || "",
                    lastSavedContent: latestVersion?.sql || "",
                    isLoadingQuery: false,
                    isLoadingVersions: false
                  }
                : t
            ),
            // Set the query's source as the selected source for chat
            selectedSource: querySource || prevState.selectedSource,
            // Update global editorContent if this is the active tab
            editorContent:
              prevState.activeTabId === tabId ? latestVersion?.sql || "" : prevState.editorContent
          }));

          // Auto-execute if conditions are met
          const updatedState = get();
          const updatedTab = updatedState.openTabs.find((t) => t.id === tabId);
          if (updatedTab && updatedState.shouldAutoExecuteQuery(updatedTab)) {
            console.log("Auto-executing query after loading in tab:", tabId);
            await updatedState.executeQuery(tabId);
          }
        } catch (error) {
          console.error("Failed to load query:", error);
          // Reset loading state on error
          set((state) => ({
            openTabs: state.openTabs.map((t) =>
              t.id === tabId ? { ...t, isLoadingQuery: false, isLoadingVersions: false } : t
            )
          }));
        }
      },

      // Centralized query state management
      loadQuery: async (queryId) => {
        const state = get();
        if (state.queries[queryId] || state.loadingQueries.has(queryId)) return;

        set((state) => ({
          loadingQueries: new Set(state.loadingQueries).add(queryId)
        }));

        try {
          const query = await getQueryById(queryId);
          set((state) => ({
            queries: { ...state.queries, [queryId]: query },
            loadingQueries: new Set([...state.loadingQueries].filter((id) => id !== queryId))
          }));
        } catch (error) {
          console.error(`Failed to load query ${queryId}:`, error);
          set((state) => ({
            loadingQueries: new Set([...state.loadingQueries].filter((id) => id !== queryId))
          }));
        }
      },

      loadQueryVersions: async (queryId) => {
        const state = get();
        if (state.queryVersions[queryId] || state.loadingVersions.has(queryId)) return;

        set((state) => ({
          loadingVersions: new Set(state.loadingVersions).add(queryId)
        }));

        try {
          const versions = await getQueryVersions(queryId);
          set((state) => ({
            queryVersions: { ...state.queryVersions, [queryId]: versions },
            loadingVersions: new Set([...state.loadingVersions].filter((id) => id !== queryId))
          }));
        } catch (error) {
          console.error(`Failed to load versions for query ${queryId}:`, error);
          set((state) => ({
            loadingVersions: new Set([...state.loadingVersions].filter((id) => id !== queryId))
          }));
        }
      },

      loadLatestQueryVersion: async (queryId) => {
        try {
          const latestVersion = await getLatestQueryVersion(queryId);

          // Update the queryVersions cache if we have it
          const currentState = get();
          if (currentState.queryVersions[queryId] && latestVersion) {
            // Insert the latest version at the beginning if it's not already there
            const existingVersions = currentState.queryVersions[queryId];
            const latestExists = existingVersions.some((v) => v.id === latestVersion.id);

            if (!latestExists) {
              set((state) => ({
                queryVersions: {
                  ...state.queryVersions,
                  [queryId]: [latestVersion, ...existingVersions]
                }
              }));
            }
          }

          return latestVersion;
        } catch (error) {
          console.error(`Failed to load latest version for query ${queryId}:`, error);
          return null;
        }
      },

      setQuery: (queryId, query) =>
        set((state) => ({
          queries: { ...state.queries, [queryId]: query }
        })),

      setQueryVersions: (queryId, versions) =>
        set((state) => ({
          queryVersions: { ...state.queryVersions, [queryId]: versions }
        })),

      loadQueryRuns: async (queryId, forceRefresh = false) => {
        const state = get();
        if (!forceRefresh && (state.queryRuns[queryId] || state.loadingRuns.has(queryId))) return;

        set((state) => ({
          loadingRuns: new Set(state.loadingRuns).add(queryId)
        }));

        try {
          const runs = await getQueryRunsByQueryId(queryId);
          set((state) => ({
            queryRuns: { ...state.queryRuns, [queryId]: runs },
            loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== queryId))
          }));
        } catch (error) {
          console.error(`Failed to load runs for query ${queryId}:`, error);
          set((state) => ({
            loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== queryId))
          }));
        }
      },

      setQueryRuns: (queryId, runs) =>
        set((state) => ({
          queryRuns: { ...state.queryRuns, [queryId]: runs }
        })),

      loadQueryRunsPaginated: async (queryId, page, pageSize, forceRefresh = false) => {
        const state = get();

        if (!forceRefresh && state.loadingRuns.has(queryId)) return;

        set((state) => ({
          loadingRuns: new Set(state.loadingRuns).add(queryId)
        }));

        try {
          const response = await getQueryRunsByQueryIdPaginated(queryId, page, pageSize);
          set((state) => ({
            queryRuns: { ...state.queryRuns, [queryId]: response.items },
            queryRunsPagination: {
              ...state.queryRunsPagination,
              [queryId]: {
                total: response.total,
                page: response.page,
                page_size: response.page_size,
                total_pages: response.total_pages,
                has_next: response.has_next,
                has_prev: response.has_prev
              }
            },
            loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== queryId))
          }));
        } catch (error) {
          console.error(`Failed to load paginated runs for query ${queryId}:`, error);
          set((state) => ({
            loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== queryId))
          }));
        }
      },

      setQueryRunsPaginated: (queryId, runs, pagination) =>
        set((state) => ({
          queryRuns: { ...state.queryRuns, [queryId]: runs },
          queryRunsPagination: { ...state.queryRunsPagination, [queryId]: pagination }
        })),

      setSources: (sources) =>
        set(() => ({
          sources: sources.reduce((acc, source) => ({ ...acc, [source.id]: source }), {})
        })),

      setConnectedSources: (connectedSourceIds) =>
        set({ connectedSources: new Set(connectedSourceIds) }),

      executeQuery: async (tabId, sql) => {
        const currentState = get();
        const tab = currentState.openTabs.find((t) => t.id === tabId);
        if (!tab) return;

        const source = currentState.sources[tab.sourceId];
        if (!source || !currentState.connectedSources.has(tab.sourceId)) {
          throw new Error("Source not connected");
        }

        const queryToRun = sql || tab.editorContent;
        if (!queryToRun.trim()) return;

        // Check if this is an ephemeral query that has been modified
        if (tab.queryId && currentState.queries[tab.queryId]?.is_ephemeral) {
          const query = currentState.queries[tab.queryId];

          // Only convert if the tab is marked as dirty (user has made changes)
          // This prevents automatic conversion on the initial table double-click execution
          if (tab.isDirty && queryToRun.trim() !== tab.originalContent.trim()) {
            try {
              console.log("Converting ephemeral query to regular before execution");

              // Generate a name based on source, schema, table, and date
              const now = new Date();
              const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD format
              const sourceName = source.name || "unknown";
              const previewParts = query.preview_key?.split(".") || [];
              const schema = previewParts[previewParts.length - 2] || "unknown";
              const table = previewParts[previewParts.length - 1] || "unknown";
              const defaultName = `${sourceName} ${schema} ${table} ${dateStr}`;

              await currentState.convertEphemeralToRegular(tab.queryId, defaultName);
            } catch (error) {
              console.error("Failed to convert ephemeral query:", error);
              // Continue with execution even if conversion fails
            }
          }
        }

        // Set running state
        set(() => ({
          openTabs: currentState.openTabs.map((t) =>
            t.id === tabId ? { ...t, queryRunning: true } : t
          )
        }));

        try {
          // Step 1: Ensure we have a query and get the version ID for what user wants to execute
          let versionId: string;

          if (tab.queryId) {
            // We have an existing query
            const currentLatestVersion = await currentState.loadLatestQueryVersion(tab.queryId);

            // Check if what user wants to execute is different from the latest saved version
            const shouldSaveNewVersion =
              !currentLatestVersion || queryToRun.trim() !== currentLatestVersion.sql.trim();

            if (shouldSaveNewVersion) {
              // Save the current editor content as a new version
              await currentState.saveQueryVersion(tab.queryId, queryToRun, "run");

              // Get the version we just created
              const newVersion = await currentState.loadLatestQueryVersion(tab.queryId);
              if (!newVersion) {
                throw new Error("Failed to create query version");
              }
              versionId = newVersion.id;

              // Update the tab's saved content tracking
              set((prevState) => ({
                openTabs: prevState.openTabs.map((t) =>
                  t.id === tabId
                    ? {
                        ...t,
                        lastSavedContent: queryToRun,
                        isDirty: false // Mark as clean since we just saved
                      }
                    : t
                )
              }));
            } else {
              // Content is the same as latest version, use existing version
              versionId = currentLatestVersion.id;
            }
          } else {
            // No query exists, create a new one
            const newQueryId = await currentState.createNewQuery(tab.sourceId);

            // Update the tab to reference the new query
            set((prevState) => ({
              openTabs: prevState.openTabs.map((t) =>
                t.id === tabId ? { ...t, queryId: newQueryId } : t
              )
            }));

            // Save the current editor content as the first version
            await currentState.saveQueryVersion(newQueryId, queryToRun, "run");

            // Get the version we just created
            const newVersion = await currentState.loadLatestQueryVersion(newQueryId);
            if (!newVersion) {
              throw new Error("Failed to create query version");
            }
            versionId = newVersion.id;

            // Update the tab's saved content tracking
            set((prevState) => ({
              openTabs: prevState.openTabs.map((t) =>
                t.id === tabId
                  ? {
                      ...t,
                      lastSavedContent: queryToRun,
                      isDirty: false // Mark as clean since we just saved
                    }
                  : t
              )
            }));
          }

          // Step 2: Create a query run and execute
          const tabFilters = currentState.getTableFilters();
          const runRequest: CreateQueryRunRequest = {
            query_version_id: versionId,
            modifiers: {
              limit: tabFilters.limit,
              offset: tabFilters.offset,
              where: tabFilters.where,
              order_by: tabFilters.order_by
            }
          };

          const runId = await executeQueryVersionRun(runRequest);

          // Step 3: Poll for results until we get a final response
          const pollForResults = async (maxAttempts = 50): Promise<object[]> => {
            // Limit the number of attempts to prevent infinite loops
            if (maxAttempts <= 0) {
              throw new Error("Max polling attempts reached - query may still be running");
            }

            try {
              const results = await getQueryRunResults(runId);

              // Check if results is an array (query completed successfully)
              if (Array.isArray(results)) {
                return results;
              } else {
                // If not an array, we need to keep polling (matches old logic)
                await new Promise((resolve) => setTimeout(resolve, 500));
                return pollForResults(maxAttempts - 1);
              }
            } catch (error) {
              console.error("Error during polling:", error);
              throw error;
            }
          };

          // Start polling for results
          const results = await pollForResults();

          // Ensure results are always an array of objects
          let processedResults: object[];
          if (Array.isArray(results)) {
            processedResults =
              results.length > 0 ? results : [{ message: "Query returned no data" }];
          } else if (typeof results === "object" && results !== null) {
            processedResults = [results];
          } else {
            // Handle primitive types (string, number, etc.) by wrapping them in objects
            processedResults = [{ result: results }];
          }

          set(() => ({
            openTabs: currentState.openTabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    queryRunning: false,
                    queryResults: processedResults
                  }
                : t
            )
          }));

          // Reload runs to get the latest run data after successful execution
          // Add a small delay to ensure the run is fully persisted
          await new Promise((resolve) => setTimeout(resolve, 200));

          const finalState = get();
          const finalTab = finalState.openTabs.find((t) => t.id === tabId);
          if (finalTab?.queryId) {
            // Force refresh to get the latest runs including the one just created
            await finalState.loadQueryRuns(finalTab.queryId, true);
          }
        } catch (error) {
          console.error("Query execution failed:", error);
          set(() => ({
            openTabs: currentState.openTabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    queryRunning: false,
                    queryResults: [
                      {
                        error: `Query execution failed: ${
                          error instanceof Error ? error.message : "Unknown error"
                        }`
                      }
                    ]
                  }
                : t
            )
          }));
          throw error;
        }
      },

      createNewQuery: async (sourceId) => {
        try {
          const newQuery = await createQuery({ source_id: sourceId });
          set((state) => ({
            queries: { ...state.queries, [newQuery.id]: newQuery }
          }));
          return newQuery.id;
        } catch (error) {
          console.error("Failed to create query:", error);
          throw error;
        }
      },

      saveQueryVersion: async (queryId, sql, saveTrigger) => {
        try {
          await createQueryVersion({
            query_id: queryId,
            sql,
            save_trigger: saveTrigger,
            created_by: "00000000-0000-0000-0000-000000000000" // TODO: Replace with actual user ID
          });

          // Reload versions to get the latest
          const currentState = get();
          await currentState.loadQueryVersions(queryId);
        } catch (error) {
          console.error("Failed to save query version:", error);
          throw error;
        }
      },

      updateQueryName: async (queryId, newName) => {
        try {
          // Update the query name on the server
          const updatedQuery = await updateQuery(queryId, { name: newName });

          // Update the query in the store
          set((state) => ({
            queries: { ...state.queries, [queryId]: updatedQuery }
          }));

          // Update the tab title if the query is open in a tab
          const currentState = get();
          const tab = currentState.openTabs.find((tab) => tab.queryId === queryId);
          if (tab) {
            set((state) => ({
              openTabs: state.openTabs.map((t) => (t.id === tab.id ? { ...t, title: newName } : t))
            }));
          }
        } catch (error) {
          console.error("Failed to update query name:", error);
          throw error;
        }
      },

      getOrCreateEphemeralQuery: async (sourceId, schema, table, nodeType) => {
        try {
          const query = await getOrCreateEphemeralQuery(sourceId, schema, table, nodeType);

          console.log("Created/retrieved ephemeral query:", query);

          // Update the query in the store
          set((state) => ({
            queries: { ...state.queries, [query.id]: query }
          }));

          return query;
        } catch (error) {
          console.error("Failed to get or create ephemeral query:", error);
          throw error;
        }
      },

      convertEphemeralToRegular: async (queryId, name) => {
        try {
          console.log("Converting ephemeral query to regular:", { queryId, name });
          console.log("Query before conversion:", get().queries[queryId]);

          const updatedQuery = await convertEphemeralToRegular(queryId, name);

          console.log("Query after conversion:", updatedQuery);

          // Update the query in the store
          set((state) => ({
            queries: { ...state.queries, [queryId]: updatedQuery }
          }));

          // Update the tab title if the query is open in a tab
          const currentState = get();
          const tab = currentState.openTabs.find((tab) => tab.queryId === queryId);
          if (tab) {
            set((state) => ({
              openTabs: state.openTabs.map((t) => (t.id === tab.id ? { ...t, title: name } : t))
            }));
          }

          return updatedQuery;
        } catch (error) {
          console.error("Failed to convert ephemeral query to regular:", error);
          throw error;
        }
      },

      // Editor-related actions
      setSchemasLoading: (loading) => set({ schemasLoading: loading }),
      setSchemasError: (error) => set({ schemasError: error }),
      setConnectedSourceIds: (sourceIds) => set({ connectedSourceIds: sourceIds }),

      // Enhanced source management
      loadSources: async () => {
        const currentState = get();
        if (currentState.loadingSources) return;

        set({ loadingSources: true });
        try {
          const sources = await getSources();
          set(() => ({
            allSources: sources,
            sources: sources.reduce((acc, source) => ({ ...acc, [source.id]: source }), {}),
            loadingSources: false
          }));
        } catch (error) {
          console.error("Failed to load sources:", error);
          set({ loadingSources: false });
        }
      },

      loadConnectedSources: async () => {
        const currentState = get();
        if (currentState.loadingConnectedSources) return;

        set({ loadingConnectedSources: true });
        try {
          const connectedSources = await getConnectedSources();
          set(() => ({
            connectedSourcesData: connectedSources,
            connectedSources: new Set(connectedSources.map((s) => s.id)),
            loadingConnectedSources: false
          }));
        } catch (error) {
          console.error("Failed to load connected sources:", error);
          set({ loadingConnectedSources: false });
        }
      },

      setConnectedSourcesData: (connectedSources) =>
        set({
          connectedSourcesData: connectedSources,
          connectedSources: new Set(connectedSources.map((s) => s.id))
        }),

      // Schema loading actions
      loadSourceSchema: async (sourceId: string) => {
        const currentState = get();

        if (currentState.sourceSchemaMap[sourceId]) {
          return;
        }

        if (currentState.loadingSchemas.has(sourceId)) {
          return;
        }

        set((state) => ({
          loadingSchemas: new Set(state.loadingSchemas).add(sourceId)
        }));

        try {
          const schemas = await getSourceSchemas(sourceId);

          set((state) => ({
            sourceSchemaMap: {
              ...state.sourceSchemaMap,
              [sourceId]: schemas
            },
            loadingSchemas: new Set([...state.loadingSchemas].filter((id) => id !== sourceId))
          }));

          // Clear any existing error for this source
          get().setSourceSchemaError(sourceId, null);

          // Generate and set children nodes from schema data
          const { schemaToFileTreeNodes } = await import("@/shared/lib/fileTreeUtils");
          const generatedChildren = schemaToFileTreeNodes(schemas, sourceId);

          get().setSourceGeneratedChildren(sourceId, generatedChildren);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          set((state) => ({
            loadingSchemas: new Set([...state.loadingSchemas].filter((id) => id !== sourceId))
          }));

          // Set error and clear children
          get().setSourceSchemaError(sourceId, errorMessage);
          get().setSourceGeneratedChildren(sourceId, []);
        }
      },

      loadConnectedSourcesSchemas: async (connectedSources: ConnectedSource[]) => {
        if (!connectedSources || connectedSources.length === 0) {
          return;
        }

        // Load schemas for all connected sources in parallel
        await Promise.allSettled(
          connectedSources.map(async (source) => {
            return await get().loadSourceSchema(source.id);
          })
        );
      },

      // Debug action
      debugLogLocalStorage: () => {
        const state = get();
        console.log("Current localStorage state:", state);
      },

      // Initialize runtime states - called on app start to reset runtime states
      initializeQueryTabsRuntimeStates: async () => {
        set((state) => ({
          openTabs: state.openTabs.map((tab) => ({
            ...tab,
            // Reset runtime states to defaults on app load
            queryResults: null,
            queryRunning: false,
            isLoadingQuery: false,
            isLoadingVersions: false
          }))
        }));

        // After resetting runtime states, check if active tab should auto-execute
        // We need to wait a bit for connected sources to be loaded
        setTimeout(async () => {
          const currentState = get();
          if (currentState.activeTabId) {
            const activeTab = currentState.openTabs.find(
              (tab) => tab.id === currentState.activeTabId
            );
            if (activeTab && currentState.shouldAutoExecuteQuery(activeTab)) {
              console.log("Auto-executing active tab on page reload:", currentState.activeTabId);
              try {
                await currentState.executeQuery(currentState.activeTabId!);
              } catch (error) {
                console.error("Failed to auto-execute query on page reload:", error);
              }
            }
          }
        }, 500); // Wait 500ms for connected sources to load
      },

      // Helper function to determine if a query should auto-execute
      shouldAutoExecuteQuery: (tab: QueryTab) => {
        // Don't auto-execute if query is already running
        if (tab.queryRunning) return false;

        // Don't auto-execute if there are already results
        if (tab.queryResults && tab.queryResults.length > 0) return false;

        // Don't auto-execute if no SQL content
        const sql = tab.editorContent?.trim();
        if (!sql) return false;

        // Check if the source is connected
        const currentState = get();
        if (!currentState.connectedSources.has(tab.sourceId)) {
          // During page load, connected sources might not be loaded yet
          // If we have connected sources data, check that instead
          if (currentState.connectedSourcesData.length > 0) {
            const isConnected = currentState.connectedSourcesData.some(
              (source) => source.id === tab.sourceId
            );
            if (!isConnected) return false;
          } else {
            // No connected sources data yet, don't auto-execute
            return false;
          }
        }

        // Check if it's a SELECT query (case-insensitive, allowing for comments and whitespace)
        const cleanSql = sql.replace(/^\/\*[\s\S]*?\*\/|^--.*$/gm, "").trim();
        const isSelectQuery = /^\s*select\s+/i.test(cleanSql);

        return isSelectQuery;
      },

      // Unified helper to open query from tree (query double-click)
      openQueryFromTree: async (query: Query) => {
        const currentState = get();

        // Check if query is already open in a tab
        const existingTab = currentState.openTabs.find((tab) => tab.queryId === query.id);

        if (existingTab) {
          // Switch to existing tab - auto-execution will handle running if needed
          await currentState.setActiveTab(existingTab.id);
        } else {
          // Open new tab for this query - auto-execution will handle running automatically
          await currentState.openQueryTab({
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
          const updatedState = get();
          const newTab = updatedState.openTabs[updatedState.openTabs.length - 1]; // Latest tab

          if (newTab) {
            // Load query data into the tab - auto-execution will handle running
            await currentState.loadQueryInTab(newTab.id, query.id);
          }
        }
      },

      // Unified helper to open table from tree (table double-click)
      openTableFromTree: async (
        sourceId: string,
        tableName: string,
        nodeType: "table" | "view"
      ) => {
        const currentState = get();

        try {
          // Parse table name to get schema and table
          const parts = tableName.split(".");
          const schema = parts.length > 1 ? parts[0] : "public";
          const table = parts.length > 1 ? parts[1] : parts[0];

          // Get or create ephemeral query for this table/view
          const ephemeralQuery = await currentState.getOrCreateEphemeralQuery(
            sourceId,
            schema,
            table,
            nodeType
          );

          // Load the latest version to get the SQL
          const latestVersion = await currentState.loadLatestQueryVersion(ephemeralQuery.id);

          const sql = latestVersion?.sql || `SELECT * FROM ${schema}.${table}`;

          // Create a new tab for this ephemeral query
          // Auto-execution will handle running the query automatically
          await currentState.openQueryTab({
            queryId: ephemeralQuery.id,
            sourceId,
            title: `${schema}.${table}`,
            isDirty: false,
            editorContent: sql,
            queryResults: null,
            queryRunning: false,
            selectedTableData: { sourceId, tableName, query: sql },
            isLoadingQuery: false,
            isLoadingVersions: false,
            lastSavedContent: sql,
            originalContent: sql
          });
        } catch (error) {
          console.error("Failed to handle table double-click:", error);
          // Fallback to simple query - auto-execution will handle running
          const query = `SELECT * FROM ${tableName}`;
          await currentState.openQueryTab({
            queryId: null,
            sourceId,
            title: tableName,
            isDirty: false,
            editorContent: query,
            queryResults: null,
            queryRunning: false,
            selectedTableData: { sourceId, tableName, query },
            isLoadingQuery: false,
            isLoadingVersions: false,
            lastSavedContent: "",
            originalContent: ""
          });
        }
      },

      // Table filter actions
      setTableFilterOffset: (offset: number) =>
        set((state) => {
          const tabId = state.activeTabId || "default";
          const currentFilter = state.tableFilters[tabId] || {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          };
          return {
            tableFilters: {
              ...state.tableFilters,
              [tabId]: { ...currentFilter, currentOffset: offset }
            }
          };
        }),

      setTableFilterWhere: (where: string) =>
        set((state) => {
          const tabId = state.activeTabId || "default";
          const currentFilter = state.tableFilters[tabId] || {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          };
          return {
            tableFilters: {
              ...state.tableFilters,
              [tabId]: { ...currentFilter, whereInput: where, currentOffset: 0 }
            }
          };
        }),

      setTableFilterOrderBy: (orderBy: string) =>
        set((state) => {
          const tabId = state.activeTabId || "default";
          const currentFilter = state.tableFilters[tabId] || {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          };
          return {
            tableFilters: {
              ...state.tableFilters,
              [tabId]: { ...currentFilter, orderByInput: orderBy, currentOffset: 0 }
            }
          };
        }),

      clearTableFilters: () =>
        set((state) => {
          const tabId = state.activeTabId || "default";
          return {
            tableFilters: {
              ...state.tableFilters,
              [tabId]: {
                currentOffset: 0,
                whereInput: "",
                orderByInput: "",
                pageSize: 501,
                displaySize: 500
              }
            }
          };
        }),

      setTableFilterPageSize: (displaySize: number) =>
        set((state) => {
          const tabId = state.activeTabId || "default";
          const currentFilter = state.tableFilters[tabId] || {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          };
          return {
            tableFilters: {
              ...state.tableFilters,
              [tabId]: {
                ...currentFilter,
                displaySize,
                pageSize: displaySize + 1, // DataGrip style: fetch one extra to check for next page
                currentOffset: 0 // Reset to first page when changing page size
              }
            }
          };
        }),

      getTableFilters: () => {
        const state = get();
        const tabId = state.activeTabId || "default";
        const filter = state.tableFilters[tabId] || {
          currentOffset: 0,
          whereInput: "",
          orderByInput: "",
          pageSize: 501,
          displaySize: 500
        };
        return {
          limit: filter.pageSize,
          offset: filter.currentOffset,
          where: filter.whereInput.trim() || undefined,
          order_by: filter.orderByInput.trim() || undefined
        };
      },

      getTabFilterState: (tabId: string) => {
        const state = get();
        return (
          state.tableFilters[tabId] || {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          }
        );
      }
    }),
    {
      name: "dribble-app-storage",
      // Only persist certain values
      partialize: (state) => ({
        panelSizes: state.panelSizes,
        editorContent: state.editorContent,
        sidebarState: state.sidebarState,
        // Query state persistence - persist tabs and active tab ID
        openTabs: state.openTabs,
        activeTabId: state.activeTabId
      })
    }
  )
);
