import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Source, SourceStatus, Query, QueryVersion, QueryRun } from "@/shared/lib/api";
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

// Query tab interface
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
interface AppState extends FileTreeState, SourceChildrenState {
  // Panel sizes
  panelSizes: number[];

  // Source and schema state
  selectedSource: Source | null;
  sourceSchemaMap: Record<string, Record<string, SchemaObject>>;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;

  // Query state
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

  // Query, Version, Run state
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

  // Query tabs actions
  openQueryTab: (tab: Omit<QueryTab, "id">) => string;
  closeQueryTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTabContent: (tabId: string, content: Partial<QueryTab>) => void;
  getActiveTab: () => QueryTab | null;

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

  // Query, Version, Run actions
  setQueriesBySource: (sourceId: string, queries: Query[]) => void;
  setVersionsByQuery: (queryId: string, versions: QueryVersion[]) => void;
  setRunsByVersion: (versionId: string, runs: QueryRun[]) => void;
  clearQueriesBySource: (sourceId: string) => void;
  clearVersionsByQuery: (queryId: string) => void;
  clearRunsByVersion: (versionId: string) => void;
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
          if (state.proposedChanges) {
            return {
              editorContent: state.proposedChanges.proposedContent,
              proposedChanges: null
            };
          }
          return state;
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

      // Query, Version, Run actions
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
      openQueryTab: (tab) => {
        const newTabId = crypto.randomUUID();
        const newTab = { ...tab, id: newTabId };
        set((state) => ({
          openTabs: [...state.openTabs, newTab],
          activeTabId: newTabId
        }));
        return newTabId;
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
      setActiveTab: (tabId) => set({ activeTabId: tabId }),
      updateTabContent: (tabId, content) =>
        set((state) => ({
          openTabs: state.openTabs.map((tab) => (tab.id === tabId ? { ...tab, ...content } : tab))
        })),
      getActiveTab: () => {
        const state = get();
        return state.openTabs.find((tab) => tab.id === state.activeTabId) || null;
      }
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
