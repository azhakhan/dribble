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

interface SchemaTable {
  columns: SchemaColumn[];
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
  loadingSourceId: string | undefined;

  // Actions
  setSelectedNodeId: (id: string | undefined) => void;
  setLoadingSourceId: (id: string | undefined) => void;
}

// Source children state
interface SourceChildrenState {
  // Map of sourceId to generated children
  sourceGeneratedChildren: Record<string, FileNode[]>;
  // Map of sourceId to hasChildren flag
  sourceHasChildren: Record<string, boolean>;

  // Actions
  setSourceGeneratedChildren: (sourceId: string, children: FileNode[]) => void;
  setSourceHasChildren: (sourceId: string, hasChildren: boolean) => void;
}

// App state
interface AppState extends FileTreeState, SourceChildrenState {
  // Panel sizes
  panelSizes: number[];

  // Source and schema state
  selectedSource: Source | null;
  sourceSchemaMap: SourceSchemaMap;
  selectedTableData: {
    sourceId: string;
    tableName: string;
    query: string;
  } | null;

  // Query state
  queryResults: object[] | null;
  queryRunning: boolean;

  // Error and status tracking
  sourceSchemaErrors: Record<string, string>;
  sourceStatuses: Record<string, SourceStatus>;

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
}

// Create the store with persistence for certain values
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Panel sizes with default values
      panelSizes: [20, 60, 20],

      // FileTree state
      selectedNodeId: undefined,
      loadingSourceId: undefined,

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
      sourceHasChildren: {},

      // Panel actions
      setPanelSizes: (sizes) => set({ panelSizes: sizes }),

      // FileTree actions
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),
      setLoadingSourceId: (id) => set({ loadingSourceId: id }),

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

      setSourceHasChildren: (sourceId, hasChildren) =>
        set((state) => ({
          sourceHasChildren: {
            ...state.sourceHasChildren,
            [sourceId]: hasChildren
          }
        }))
    }),
    {
      name: "dribble-app-storage",
      // Only persist certain values
      partialize: (state) => ({
        panelSizes: state.panelSizes
      })
    }
  )
);
