import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueryTab } from "./types";
import { useQueryStore } from "./useQueryStore";
import { useSourceStore } from "./useSourceStore";

interface TabManagerState {
  // Tab state
  openTabs: QueryTab[];
  activeTabId: string | null;

  // Tab lifecycle actions
  openQueryTab: (tab: Omit<QueryTab, "id">) => Promise<void>;
  closeQueryTab: (tabId: string) => void;
  closeQueryTabWithConfirmation: (tabId: string) => Promise<boolean>;
  closeTabsByQueryId: (queryId: string) => void;
  setActiveTab: (tabId: string | null) => Promise<void>;
  updateTabTitle: (tabId: string, title: string) => void;
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

      // Open a new query tab
      openQueryTab: async (tab) => {
        const newTabId = crypto.randomUUID();
        const newTab: QueryTab = {
          ...tab,
          id: newTabId,
          isLoadingQuery: tab.isLoadingQuery ?? false,
          isLoadingVersions: tab.isLoadingVersions ?? false,
          lastSavedContent: tab.lastSavedContent || "",
          originalContent: tab.originalContent || ""
        };

        set((state) => ({
          openTabs: [...state.openTabs, newTab],
          activeTabId: newTabId
        }));

        // Auto-execute if conditions are met for the new tab
        const currentState = get();
        if (currentState.shouldAutoExecuteQuery(newTab)) {
          try {
            // Import the execution store dynamically to avoid circular dependency
            // @ts-expect-error - Dynamic import to avoid circular dependency
            const { useTabExecutionStore } = await import("./useTabExecutionStore");
            await useTabExecutionStore.getState().executeQuery(newTabId);
          } catch (error) {
            console.error("Failed to auto-execute query on new tab:", error);
          }
        }
      },

      // Close a query tab
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

      // Close a query tab with confirmation if there are unsaved changes
      closeQueryTabWithConfirmation: async (tabId) => {
        const state = get();
        const tab = state.openTabs.find((t) => t.id === tabId);

        // Check if tab has unsaved changes
        if (tab && tab.isDirty) {
          // For now, return false to prevent closing - this will be handled by the UI
          return false;
        }

        get().closeQueryTab(tabId);
        return true;
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
        // Set the active tab immediately for UI responsiveness
        set(() => ({ activeTabId: tabId }));

        if (!tabId) return;

        const currentState = get();
        const activeTab = currentState.openTabs.find((tab) => tab.id === tabId);

        if (!activeTab) return;

        // Import content store dynamically to avoid circular dependency
        const { useTabContentStore } = await import("@/shared/store/useTabContentStore");
        const contentStore = useTabContentStore.getState();

        // If the tab has a query, only load from server if tab doesn't have unsaved changes
        if (activeTab.queryId) {
          try {
            const queryStore = useQueryStore.getState();
            const sourceStore = useSourceStore.getState();

            // Get the query and its source
            await queryStore.loadQuery(activeTab.queryId);
            const query = queryStore.queries[activeTab.queryId];
            const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;

            // Only load latest version from server if tab is not dirty (has no unsaved changes)
            if (!activeTab.isDirty) {
              // Load the latest version of the query
              const latestVersion = await queryStore.loadLatestQueryVersion(activeTab.queryId);

              // Update the tab with the latest content only if not dirty
              set((state) => ({
                openTabs: state.openTabs.map((tab) =>
                  tab.id === tabId
                    ? {
                        ...tab,
                        queryVersionId: latestVersion?.id || tab.queryVersionId,
                        editorContent: latestVersion?.sql || tab.editorContent,
                        lastSavedContent: latestVersion?.sql || tab.lastSavedContent,
                        originalContent: latestVersion?.sql || tab.originalContent
                      }
                    : tab
                )
              }));

              // Update global editorContent for backward compatibility
              contentStore.setEditorContent(latestVersion?.sql || activeTab.editorContent);
            } else {
              // Tab has unsaved changes, just update global editorContent without overwriting tab content
              contentStore.setEditorContent(activeTab.editorContent);
            }

            // Set the selected source
            if (querySource) {
              sourceStore.setSelectedSource(querySource);
            }

            // Auto-execute if conditions are met (only if not dirty to avoid losing unsaved changes)
            if (!activeTab.isDirty) {
              const updatedState = get();
              const updatedTab = updatedState.openTabs.find((tab) => tab.id === tabId);
              if (updatedTab && currentState.shouldAutoExecuteQuery(updatedTab)) {
                // @ts-expect-error - Dynamic import to avoid circular dependency
                const { useTabExecutionStore } = await import("./useTabExecutionStore");
                await useTabExecutionStore.getState().executeQuery(tabId);
              }
            }
          } catch (error) {
            console.error("Failed to load latest query version when switching tabs:", error);
            // Still set the source even if loading fails
            const queryStore = useQueryStore.getState();
            const sourceStore = useSourceStore.getState();
            const query = queryStore.queries[activeTab.queryId];
            const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;
            if (querySource) {
              sourceStore.setSelectedSource(querySource);
            }
            // Update global editorContent with tab content
            contentStore.setEditorContent(activeTab.editorContent);
          }
        } else {
          // For tabs without a queryId, just update the global editorContent
          const sourceStore = useSourceStore.getState();
          contentStore.setEditorContent(activeTab.editorContent);

          // Set the source for the tab
          const tabSource = sourceStore.sources[activeTab.sourceId];
          if (tabSource) {
            sourceStore.setSelectedSource(tabSource);
          }

          // Auto-execute if conditions are met for tabs without queryId
          if (currentState.shouldAutoExecuteQuery(activeTab)) {
            // @ts-expect-error - Dynamic import to avoid circular dependency
            const { useTabExecutionStore } = await import("./useTabExecutionStore");
            await useTabExecutionStore.getState().executeQuery(tabId);
          }
        }
      },

      // Update tab title
      updateTabTitle: (tabId, title) =>
        set((state) => ({
          openTabs: state.openTabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
        })),

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

          // Auto-execute if conditions are met
          const updatedState = get();
          const updatedTab = updatedState.openTabs.find((t) => t.id === tabId);
          if (updatedTab && updatedState.shouldAutoExecuteQuery(updatedTab)) {
            // @ts-expect-error - Dynamic import to avoid circular dependency
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
              try {
                // @ts-expect-error - Dynamic import to avoid circular dependency
                const { useTabExecutionStore } = await import("./useTabExecutionStore");
                await useTabExecutionStore.getState().executeQuery(currentState.activeTabId!);
              } catch (error) {
                console.error("Failed to auto-execute query on page reload:", error);
              }
            }
          }
        }, 500); // Wait 500ms for connected sources to load
      },

      // Unified helper to open query from tree (query double-click)
      openQueryFromTree: async (queryId: string) => {
        const currentState = get();
        const queryStore = useQueryStore.getState();

        // Load the query to get its details
        await queryStore.loadQuery(queryId);
        const query = queryStore.queries[queryId];

        if (!query) {
          console.error("Query not found:", queryId);
          return;
        }

        // Check if query is already open in a tab
        const existingTab = currentState.openTabs.find((tab) => tab.queryId === query.id);

        if (existingTab) {
          // Switch to existing tab - auto-execution will handle running if needed
          await currentState.setActiveTab(existingTab.id);
        } else {
          // Open new tab for this query - auto-execution will handle running automatically
          await currentState.openQueryTab({
            queryId: query.id,
            queryVersionId: null,
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
        nodeType: "table" | "view",
        schemaName?: string
      ) => {
        const currentState = get();
        const queryStore = useQueryStore.getState();

        try {
          // Parse table name to get schema and table
          const parts = tableName.split(".");

          // If schema is provided explicitly, use it
          let schema: string;
          let table: string;

          if (schemaName) {
            // Use the provided schema name
            schema = schemaName;
            table = parts.length > 1 ? parts[1] : parts[0];
          } else if (parts.length > 1) {
            // Schema was included in table name
            schema = parts[0];
            table = parts[1];
          } else {
            // No schema provided, need to determine default based on database type
            table = parts[0];

            // Get source information to determine database type
            const sourceStore = useSourceStore.getState();
            const source = sourceStore.sources[sourceId];

            if (source?.dbtype === "mysql") {
              // MySQL doesn't use schemas in the same way, use the database name as schema
              // For now, we'll use just the table name without schema prefix
              schema = "";
            } else if (source?.dbtype === "sqlite") {
              // SQLite doesn't use schemas, use just table name
              schema = "";
            } else {
              // PostgreSQL and unknown types default to "public"
              schema = "public";
            }
          }

          // Get or create ephemeral query for this table/view
          const ephemeralQuery = await queryStore.getOrCreateEphemeralQuery(
            sourceId,
            schema,
            table,
            nodeType
          );

          // Load the latest version to get the SQL - wait for it to complete
          const latestVersion = await queryStore.loadLatestQueryVersion(ephemeralQuery.id);

          // Generate SQL based on whether schema should be included
          const sqlTableRef = schema ? `${schema}.${table}` : table;
          const sql = latestVersion?.sql || `SELECT * FROM ${sqlTableRef} LIMIT 101`;

          // Check if this ephemeral query is already open in a tab
          const existingTab = currentState.openTabs.find(
            (tab) => tab.queryId === ephemeralQuery.id
          );

          if (existingTab) {
            // Switch to existing tab and ensure it has the latest SQL
            await currentState.setActiveTab(existingTab.id);

            // Update tab content directly since updateTabContent is now in this store
            set((state) => ({
              openTabs: state.openTabs.map((tab) =>
                tab.id === existingTab.id
                  ? {
                      ...tab,
                      editorContent: sql,
                      lastSavedContent: sql,
                      originalContent: sql,
                      isDirty: false
                    }
                  : tab
              )
            }));

            // Wait a bit for state to settle before auto-execution
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Auto-execute if conditions are met
            const updatedTab = get().openTabs.find((tab) => tab.id === existingTab.id);
            if (updatedTab && currentState.shouldAutoExecuteQuery(updatedTab)) {
              // @ts-expect-error - Dynamic import to avoid circular dependency
              const { useTabExecutionStore } = await import("./useTabExecutionStore");
              await useTabExecutionStore.getState().executeQuery(existingTab.id);
            }
          } else {
            // Create a new tab for this ephemeral query
            await currentState.openQueryTab({
              queryId: ephemeralQuery.id,
              queryVersionId: latestVersion?.id || null,
              sourceId,
              title: schema ? `${schema}.${table}` : table,
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

            // Wait a bit for the tab to be fully created
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Auto-execution will be handled by openQueryTab
          }
        } catch (error) {
          console.error("Failed to handle table double-click:", error);
          // Fallback to simple query - auto-execution will handle running
          const query = `SELECT * FROM ${tableName} LIMIT 101`;
          await currentState.openQueryTab({
            queryId: null,
            queryVersionId: null,
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
