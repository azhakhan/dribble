import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueryTab } from "./types";
import { useQueryStore } from "./useQueryStore";
import { useSourceStore } from "./useSourceStore";
import { TabNavigationService } from "@/shared/services";

interface TabManagerState {
  // Tab state
  openTabs: QueryTab[];
  activeTabId: string | null;

  // Internal state for preventing race conditions
  isInitializing: boolean;

  // Tab lifecycle actions
  openQueryTab: (tab: Omit<QueryTab, "id">) => Promise<void>;
  closeQueryTab: (tabId: string) => Promise<void>;
  closeQueryTabWithConfirmation: (tabId: string) => Promise<boolean>;
  closeTabsByQueryId: (queryId: string) => void;
  setActiveTab: (tabId: string | null) => Promise<void>;
  updateTabTitle: (tabId: string, title: string) => void;
  updateTabContent: (tabId: string, content: Partial<QueryTab>) => void;
  loadQueryInTab: (tabId: string, queryId: string) => Promise<void>;

  // Helper functions
  shouldAutoExecuteQuery: (tab: QueryTab) => boolean;
  initializeQueryTabsRuntimeStates: () => Promise<void>;

  // Unified query/table opening helpers
  openQueryFromTree: (queryId: string) => Promise<void>;
  openTableFromTree: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ) => Promise<void>;
}

export const useTabManagerStore = create<TabManagerState>()(
  persist(
    (set, get) => ({
      // Initial state
      openTabs: [],
      activeTabId: null,
      isInitializing: true,

      // Open a new query tab
      openQueryTab: async (tab) => {
        // Delegate to the TabNavigationService
        await TabNavigationService.openQueryTab(tab);
      },

      // Close a query tab
      closeQueryTab: async (tabId) => {
        // Delegate to the TabNavigationService
        await TabNavigationService.closeQueryTab(tabId);
      },

      // Close a query tab with confirmation if there are unsaved changes
      closeQueryTabWithConfirmation: async (tabId) => {
        // Delegate to the TabNavigationService which handles the confirmation logic
        return await TabNavigationService.closeQueryTabWithConfirmation(tabId);
      },

      // Close all tabs with a specific query ID
      closeTabsByQueryId: (queryId) =>
        set((state) => {
          const tabsToClose = state.openTabs.filter((tab) => tab.queryId === queryId);
          const newOpenTabs = state.openTabs.filter((tab) => tab.queryId !== queryId);

          // If the active tab is being closed, set a new active tab
          const isActiveTabClosed = tabsToClose.some((tab) => tab.id === state.activeTabId);
          const newActiveTabId = isActiveTabClosed
            ? newOpenTabs.length > 0
              ? newOpenTabs[newOpenTabs.length - 1].id
              : null
            : state.activeTabId;

          return {
            openTabs: newOpenTabs,
            activeTabId: newActiveTabId
          };
        }),

      // Set active tab
      setActiveTab: async (tabId) => {
        // Delegate to the TabNavigationService
        await TabNavigationService.setActiveTab(tabId);
      },

      // Update tab title
      updateTabTitle: (tabId, title) =>
        set((state) => ({
          openTabs: state.openTabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
        })),

      // Update tab content
      updateTabContent: (tabId, content) =>
        set((state) => {
          const updatedTabs = state.openTabs.map((tab) => {
            if (tab.id === tabId) {
              const updatedTab = { ...tab, ...content };

              // If editor content is being updated and isDirty wasn't explicitly provided, calculate it
              if (content.editorContent !== undefined && content.isDirty === undefined) {
                updatedTab.isDirty =
                  content.editorContent.trim() !== (tab.lastSavedContent || "").trim();
              }

              return updatedTab;
            }
            return tab;
          });

          return { openTabs: updatedTabs };
        }),

      // Load query in tab
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
          const queryStore = useQueryStore.getState();
          const sourceStore = useSourceStore.getState();

          // Load query and latest version concurrently
          await queryStore.loadQuery(queryId);
          const query = queryStore.queries[queryId];
          const latestVersion = await queryStore.loadLatestQueryVersion(queryId);

          // Get the source for this query to set as selected source
          const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;

          // Update tab with loaded data and set query's source as selected source
          set((prevState) => ({
            openTabs: prevState.openTabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    queryId,
                    queryVersionId: latestVersion?.id || null,
                    title: query?.name || `Query ${queryId.slice(0, 8)}`,
                    editorContent: latestVersion?.sql || "",
                    originalContent: latestVersion?.sql || "",
                    lastSavedContent: latestVersion?.sql || "",
                    isLoadingQuery: false,
                    isLoadingVersions: false
                  }
                : t
            )
          }));

          // Update global editorContent if this is the active tab
          if (state.activeTabId === tabId) {
            const { useTabContentStore } = await import("./useTabContentStore");
            useTabContentStore.getState().setEditorContent(latestVersion?.sql || "");
          }

          // Set the query's source as the selected source
          if (querySource) {
            sourceStore.setSelectedSource(querySource);
          }

          // Auto-execute if conditions are met and we're not during initialization
          const updatedState = get();
          const updatedTab = updatedState.openTabs.find((t) => t.id === tabId);
          if (
            updatedTab &&
            updatedState.shouldAutoExecuteQuery(updatedTab) &&
            !updatedState.isInitializing
          ) {
            const { useTabExecutionStore } = await import("./useTabExecutionStore");
            await useTabExecutionStore.getState().executeQuery(tabId);
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
        const sourceStore = useSourceStore.getState();
        if (!sourceStore.connectedSources.has(tab.sourceId)) {
          // During page load, connected sources might not be loaded yet
          // If we have connected sources data, check that instead
          if (sourceStore.connectedSourcesData.length > 0) {
            const isConnected = sourceStore.connectedSourcesData.some(
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

      // Initialize runtime states - called on app start to reset runtime states
      initializeQueryTabsRuntimeStates: async () => {
        // Set initialization flag to prevent auto-execution during load
        set((state) => ({ ...state, isInitializing: true }));

        // Delegate to the TabNavigationService to avoid duplicate logic
        await TabNavigationService.initializeQueryTabsRuntimeStates();

        // Clear initialization flag after completion
        set((state) => ({ ...state, isInitializing: false }));
      },

      // Unified helper to open query from tree (query double-click)
      openQueryFromTree: async (queryId: string) => {
        // Delegate to the TabNavigationService
        await TabNavigationService.openQueryFromTree(queryId);
      },

      // Unified helper to open table from tree (table double-click)
      openTableFromTree: async (
        sourceId: string,
        tableName: string,
        nodeType: "table" | "view",
        schemaName?: string
      ) => {
        // Delegate to the TabNavigationService
        await TabNavigationService.openTableFromTree(sourceId, tableName, nodeType, schemaName);
      }
    }),
    {
      name: "dribble-tabs-manager-storage",
      // Only persist certain values
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId
      })
    }
  )
);
