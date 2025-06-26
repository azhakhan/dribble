import { create } from "zustand";
import type { TableData } from "../types/api";
import { persist } from "zustand/middleware";

interface UIState {
  // Panel sizes
  panelSizes: number[];

  // Query-related UI state
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;

  // Editor-related state
  schemasLoading: boolean;
  schemasError: unknown;
  connectedSourceIds: Set<string>;

  // Legacy query state (will be moved to QueryState)
  queryResults: TableData | null;
  queryRunning: boolean;

  // Actions
  setPanelSizes: (sizes: number[]) => void;
  setSelectedTableData: (
    data: { sourceId: string; tableName: string; query: string } | null
  ) => void;
  setQueryResults: (results: TableData | null) => void;
  setQueryRunning: (isRunning: boolean) => void;
  setSchemasLoading: (loading: boolean) => void;
  setSchemasError: (error: unknown) => void;
  setConnectedSourceIds: (sourceIds: Set<string>) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      panelSizes: [20, 60, 20],
      selectedTableData: null,
      schemasLoading: false,
      schemasError: null,
      connectedSourceIds: new Set(),
      queryResults: null,
      queryRunning: false,

      // Actions
      setPanelSizes: (sizes) => set({ panelSizes: sizes }),

      setSelectedTableData: (data) => set({ selectedTableData: data }),

      setQueryResults: (results) => set({ queryResults: results }),

      setQueryRunning: (isRunning) => set({ queryRunning: isRunning }),

      setSchemasLoading: (loading) => set({ schemasLoading: loading }),

      setSchemasError: (error) => set({ schemasError: error }),

      setConnectedSourceIds: (sourceIds) => set({ connectedSourceIds: sourceIds })
    }),
    {
      name: "dribble-ui-storage",
      // Only persist panel sizes
      partialize: (state) => ({
        panelSizes: state.panelSizes
      })
    }
  )
);
