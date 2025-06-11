import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SidebarState } from "./types";

interface TreeState {
  // Sidebar state
  sidebarState: SidebarState;

  // FileTree state
  selectedNodeId: string | undefined;
  loadingSourceIds: Set<string>;

  // Actions for tree state management
  setSidebarActiveTab: (tab: "sources" | "queries") => void;
  setNodeExpanded: (nodeId: string, isExpanded: boolean) => void;
  setQuerySourceExpanded: (sourceId: string, isExpanded: boolean) => void;
  collapseDisconnectedSources: (connectedSourceIds: string[]) => void;
  isNodeExpanded: (nodeId: string) => boolean;
  isQuerySourceExpanded: (sourceId: string) => boolean;

  // FileTree actions
  setSelectedNodeId: (id: string | undefined) => void;
  addLoadingSourceId: (id: string) => void;
  removeLoadingSourceId: (id: string) => void;
}

export const useTreeStore = create<TreeState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarState: {
        activeTab: "sources",
        expandedNodes: {},
        expandedQuerySources: {}
      },
      selectedNodeId: undefined,
      loadingSourceIds: new Set(),

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
        })
    }),
    {
      name: "dribble-tree-storage",
      // Only persist sidebar state
      partialize: (state) => ({
        sidebarState: state.sidebarState
      })
    }
  )
);
