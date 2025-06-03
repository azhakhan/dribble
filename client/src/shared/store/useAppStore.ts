import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Source, SourceStatus } from "@/shared/lib/api";
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
  selectedTableData: object[] | null;

  // Query state
  queryResults: object[] | null;
  queryRunning: boolean;

  // Error and status tracking
  sourceSchemaErrors: Record<string, string>;
  sourceStatuses: Record<string, SourceStatus>;

  // Editor state
  editorContent: string;

  // Chat state
  selectedLLM: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  chatLoading: boolean;

  // Actions for App state
  setPanelSizes: (sizes: number[]) => void;
  setSelectedSource: (source: Source | null) => void;
  setSourceSchema: (sourceId: string, schema: Record<string, SchemaObject>) => void;
  setSelectedTableData: (data: object[] | null) => void;
  setQueryResults: (results: object[] | null) => void;
  setQueryRunning: (isRunning: boolean) => void;
  setSourceSchemaError: (sourceId: string, error: string | null) => void;
  setSourceStatus: (sourceId: string, status: SourceStatus) => void;
  removeSourceStatus: (sourceId: string) => void;

  // Editor actions
  setEditorContent: (content: string) => void;

  // Chat actions
  setSelectedLLM: (llmId: string | null) => void;
  addMessage: (message: { role: "user" | "assistant"; content: string }) => void;
  setChatLoading: (loading: boolean) => void;
  clearMessages: () => void;

  // New action to clean up disconnected sources
  cleanupDisconnectedSources: (connectedSourceIds: string[]) => void;
}

// Create the store with persistence for certain values
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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

      // Error and status tracking
      sourceSchemaErrors: {},
      sourceStatuses: {},

      // Source children state
      sourceGeneratedChildren: {},

      // Editor state
      editorContent: "-- Write your SQL query here\n",

      // Chat state
      selectedLLM: null,
      messages: [],
      chatLoading: false,

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

      // Chat actions
      setSelectedLLM: (llmId) => set({ selectedLLM: llmId }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message]
        })),
      setChatLoading: (loading) => set({ chatLoading: loading }),
      clearMessages: () => set({ messages: [] }),

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
        })
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
