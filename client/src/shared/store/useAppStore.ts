import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Source, SourceStatus, Query, QueryVersion, QueryRun } from "@/shared/lib/api";
import {
  getQueryById,
  getQueryVersions,
  createQuery,
  createQueryVersion,
  executeQuery as apiExecuteQuery,
  getQueryResults
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

// Centralized query state management
interface QueryState {
  // Cached data
  queries: Record<string, Query>; // queryId -> Query
  queryVersions: Record<string, QueryVersion[]>; // queryId -> versions
  sources: Record<string, Source>; // sourceId -> Source
  connectedSources: Set<string>; // Set of connected source IDs

  // Loading states
  loadingQueries: Set<string>; // Set of query IDs being loaded
  loadingVersions: Set<string>; // Set of query IDs whose versions are being loaded

  // Actions for centralized query management
  loadQuery: (queryId: string) => Promise<void>;
  loadQueryVersions: (queryId: string) => Promise<void>;
  setQuery: (queryId: string, query: Query) => void;
  setQueryVersions: (queryId: string, versions: QueryVersion[]) => void;
  setSources: (sources: Source[]) => void;
  setConnectedSources: (connectedSourceIds: string[]) => void;

  // Query execution
  executeQuery: (tabId: string, sql?: string) => Promise<void>;

  // Query creation and management
  createNewQuery: (sourceId: string) => Promise<string>;
  saveQueryVersion: (queryId: string, sql: string, saveTrigger: "run" | "ai") => Promise<void>;
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
interface AppState extends FileTreeState, SourceChildrenState, QueryState {
  // Panel sizes
  panelSizes: number[];

  // Source and schema state
  selectedSource: Source | null;
  sourceSchemaMap: Record<string, Record<string, SchemaObject>>;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;

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
  openQueryTab: (tab: Omit<QueryTab, "id">) => void;
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

      // Source and schema state
      selectedSource: null,
      sourceSchemaMap: {},
      selectedTableData: null,

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
      sources: {},
      connectedSources: new Set(),
      loadingQueries: new Set(),
      loadingVersions: new Set(),

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

          return {
            sourceSchemaMap: newSourceSchemaMap,
            sourceGeneratedChildren: newSourceGeneratedChildren,
            sourceSchemaErrors: newSourceSchemaErrors,
            sourceStatuses: newSourceStatuses
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
      openQueryTab: (tab) =>
        set((state) => {
          const newTabId = crypto.randomUUID();
          const newTab: QueryTab = {
            ...tab,
            id: newTabId,
            isLoadingQuery: false,
            isLoadingVersions: false,
            lastSavedContent: "",
            originalContent: ""
          };
          return {
            openTabs: [...state.openTabs, newTab],
            activeTabId: newTabId
          };
        }),
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
      setActiveTab: (tabId) =>
        set((state) => {
          // Find the tab being activated
          const activeTab = tabId ? state.openTabs.find((tab) => tab.id === tabId) : null;

          // If the tab has a query, get the query's source and set it as selected source for chat
          let selectedSource = state.selectedSource;
          if (activeTab?.queryId && state.queries[activeTab.queryId]) {
            const query = state.queries[activeTab.queryId];
            const querySource = query.source_id ? state.sources[query.source_id] : null;
            if (querySource) {
              selectedSource = querySource;
            }
          }

          return {
            activeTabId: tabId,
            selectedSource
          };
        }),
      updateTabContent: (tabId, content) =>
        set((state) => ({
          openTabs: state.openTabs.map((tab) => (tab.id === tabId ? { ...tab, ...content } : tab))
        })),
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
          // Load query and versions concurrently
          await Promise.all([state.loadQuery(queryId), state.loadQueryVersions(queryId)]);

          const updatedState = get();
          const query = updatedState.queries[queryId];
          const versions = updatedState.queryVersions[queryId] || [];
          const latestVersion = versions[0];

          // Get the source for this query to set as selected source for chat
          const querySource = query?.source_id ? updatedState.sources[query.source_id] : null;

          // Update tab with loaded data and set query's source as selected source for chat
          set((state) => ({
            openTabs: state.openTabs.map((t) =>
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
            selectedSource: querySource || state.selectedSource
          }));
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

      setQuery: (queryId, query) =>
        set((state) => ({
          queries: { ...state.queries, [queryId]: query }
        })),

      setQueryVersions: (queryId, versions) =>
        set((state) => ({
          queryVersions: { ...state.queryVersions, [queryId]: versions }
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

        // Set running state
        set(() => ({
          openTabs: currentState.openTabs.map((t) =>
            t.id === tabId ? { ...t, queryRunning: true } : t
          )
        }));

        try {
          // Step 1: Execute query and get a query ID
          const queryId = await apiExecuteQuery(tab.sourceId, queryToRun);

          // Step 2: Poll for results until we get a final response
          const pollForResults = async (maxAttempts = 50): Promise<object[]> => {
            // Limit the number of attempts to prevent infinite loops
            if (maxAttempts <= 0) {
              throw new Error("Max polling attempts reached - query may still be running");
            }

            try {
              const results = await getQueryResults(queryId);

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

      // Editor-related actions
      setSchemasLoading: (loading) => set({ schemasLoading: loading }),
      setSchemasError: (error) => set({ schemasError: error }),
      setConnectedSourceIds: (sourceIds) => set({ connectedSourceIds: sourceIds })
    }),
    {
      name: "dribble-app-storage",
      // Only persist certain values
      partialize: (state) => ({
        panelSizes: state.panelSizes,
        editorContent: state.editorContent
      })
    }
  )
);
