import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueryTab, TableFilterState } from "./types";
import { useQueryStore } from "./useQueryStore";
import { useSourceStore } from "./useSourceStore";
import {
  executeQueryVersionRun,
  getQueryRunResults,
  type CreateQueryRunRequest
} from "@/shared/lib/api";

interface TabState {
  // Tab state
  openTabs: QueryTab[];
  activeTabId: string | null;

  // Table filter state - grouped by tab ID
  tableFilters: Record<string, TableFilterState>;

  // Global editor state (legacy, for backward compatibility)
  editorContent: string;

  // Actions for tabs
  openQueryTab: (tab: Omit<QueryTab, "id">) => Promise<void>;
  closeQueryTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => Promise<void>;
  updateTabContent: (tabId: string, content: Partial<QueryTab>) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  loadQueryInTab: (tabId: string, queryId: string) => Promise<void>;

  // Editor actions
  setEditorContent: (content: string) => void;

  // Query execution
  executeQuery: (tabId: string, sql?: string) => Promise<void>;

  // Table filter actions
  setTableFilterOffset: (offset: number) => void;
  setTableFilterWhere: (where: string) => void;
  setTableFilterOrderBy: (orderBy: string) => void;
  setTableFilterPageSize: (displaySize: number) => void;
  clearTableFilters: () => void;
  getTableFilters: () => { limit: number; offset: number; where?: string; order_by?: string };
  getTabFilterState: (tabId: string) => TableFilterState;

  // Helper functions
  shouldAutoExecuteQuery: (tab: QueryTab) => boolean;
  initializeQueryTabsRuntimeStates: () => Promise<void>;

  // Unified query/table opening helpers
  openQueryFromTree: (queryId: string) => Promise<void>;
  openTableFromTree: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view"
  ) => Promise<void>;
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      // Initial state
      openTabs: [],
      activeTabId: null,
      tableFilters: {},
      editorContent: "",

      // Open a new query tab
      openQueryTab: async (tab) => {
        const newTabId = crypto.randomUUID();
        const newTab: QueryTab = {
          ...tab,
          id: newTabId,
          isLoadingQuery: false,
          isLoadingVersions: false,
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
            await currentState.executeQuery(newTabId);
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

      // Set active tab
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
            const queryStore = useQueryStore.getState();
            const sourceStore = useSourceStore.getState();

            // Load the latest version of the query
            const latestVersion = await queryStore.loadLatestQueryVersion(activeTab.queryId);

            // Get the query and its source
            await queryStore.loadQuery(activeTab.queryId);
            const query = queryStore.queries[activeTab.queryId];
            const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;

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
              // Update global editorContent for backward compatibility
              editorContent: latestVersion?.sql || activeTab.editorContent
            }));

            // Set the selected source
            if (querySource) {
              sourceStore.setSelectedSource(querySource);
            }

            // Auto-execute if conditions are met
            const updatedState = get();
            const updatedTab = updatedState.openTabs.find((tab) => tab.id === tabId);
            if (updatedTab && currentState.shouldAutoExecuteQuery(updatedTab)) {
              await currentState.executeQuery(tabId);
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
          }
        } else {
          // For tabs without a queryId, just update the global editorContent
          const sourceStore = useSourceStore.getState();
          set(() => ({
            editorContent: activeTab.editorContent
          }));

          // Set the source for the tab
          const tabSource = sourceStore.sources[activeTab.sourceId];
          if (tabSource) {
            sourceStore.setSelectedSource(tabSource);
          }

          // Auto-execute if conditions are met for tabs without queryId
          if (currentState.shouldAutoExecuteQuery(activeTab)) {
            await currentState.executeQuery(tabId);
          }
        }
      },

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

          // Also update global editorContent if this is the active tab and editorContent is being updated
          const isActiveTab = state.activeTabId === tabId;
          const updatingEditorContent = content.editorContent !== undefined;

          return {
            openTabs: updatedTabs,
            ...(isActiveTab && updatingEditorContent && { editorContent: content.editorContent })
          };
        }),

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
                    title: query?.name || `Query ${queryId.slice(0, 8)}`,
                    editorContent: latestVersion?.sql || "",
                    originalContent: latestVersion?.sql || "",
                    lastSavedContent: latestVersion?.sql || "",
                    isLoadingQuery: false,
                    isLoadingVersions: false
                  }
                : t
            ),
            // Update global editorContent if this is the active tab
            editorContent:
              prevState.activeTabId === tabId ? latestVersion?.sql || "" : prevState.editorContent
          }));

          // Set the query's source as the selected source
          if (querySource) {
            sourceStore.setSelectedSource(querySource);
          }

          // Auto-execute if conditions are met
          const updatedState = get();
          const updatedTab = updatedState.openTabs.find((t) => t.id === tabId);
          if (updatedTab && updatedState.shouldAutoExecuteQuery(updatedTab)) {
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

      // Set editor content
      setEditorContent: (content) => set({ editorContent: content }),

      // Execute query
      executeQuery: async (tabId, sql) => {
        // Helper function to get the most current tab state
        const getCurrentTab = () => {
          const state = get();
          return state.openTabs.find((t) => t.id === tabId);
        };

        const tab = getCurrentTab();
        if (!tab) {
          console.error("Tab not found:", tabId);
          return;
        }

        const queryStore = useQueryStore.getState();
        const sourceStore = useSourceStore.getState();

        // Determine what SQL to run - prioritize the passed sql parameter over tab content
        const queryToRun = sql || tab.editorContent;
        if (!queryToRun.trim()) {
          console.error("No SQL to execute");
          return;
        }

        // Set running state
        set((state) => ({
          openTabs: state.openTabs.map((t) => (t.id === tabId ? { ...t, queryRunning: true } : t))
        }));

        try {
          // Step 1: Ensure we have a query and get the version ID for what user wants to execute
          let versionId: string;

          if (tab.queryId) {
            // Check if it's an ephemeral query that should be converted
            const query = queryStore.queries[tab.queryId];
            if (query?.is_ephemeral && tab.isDirty) {
              // Generate name for the converted query
              const date = new Date();
              const sourceName = sourceStore.sources[tab.sourceId]?.name || "Unknown";
              const queryName = `${sourceName} query ${date.toISOString().split("T")[0]}`;

              // Convert to regular query
              const updatedQuery = await queryStore.convertEphemeralToRegular(
                tab.queryId,
                queryName
              );

              // Update the tab title
              set((state) => ({
                openTabs: state.openTabs.map((t) =>
                  t.id === tabId ? { ...t, title: updatedQuery.name || queryName } : t
                )
              }));
            }

            // We have an existing query
            const currentLatestVersion = await queryStore.loadLatestQueryVersion(tab.queryId);

            // Check if what user wants to execute is different from the latest saved version
            const shouldSaveNewVersion =
              !currentLatestVersion || queryToRun.trim() !== currentLatestVersion.sql.trim();

            if (shouldSaveNewVersion) {
              // Save the current editor content as a new version
              await queryStore.saveQueryVersion(tab.queryId, queryToRun, "run");

              // Get the version we just created
              const newVersion = await queryStore.loadLatestQueryVersion(tab.queryId);
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
            const newQuery = await queryStore.createNewQuery(tab.sourceId);

            // Update the tab to reference the new query
            set((prevState) => ({
              openTabs: prevState.openTabs.map((t) =>
                t.id === tabId ? { ...t, queryId: newQuery.id } : t
              )
            }));

            // Save the current editor content as the first version
            await queryStore.saveQueryVersion(newQuery.id, queryToRun, "run");

            // Get the version we just created
            const newVersion = await queryStore.loadLatestQueryVersion(newQuery.id);
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
          const tabFilters = get().getTableFilters();
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

          set((state) => ({
            openTabs: state.openTabs.map((t) =>
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
          // Increase delay to ensure the run is fully persisted
          await new Promise((resolve) => setTimeout(resolve, 500));

          const finalState = get();
          const finalTab = finalState.openTabs.find((t) => t.id === tabId);
          if (finalTab?.queryId) {
            // Force refresh to get the latest runs including the one just created
            await queryStore.loadQueryRuns(finalTab.queryId, true);

            // Also trigger a reload of query versions to ensure version count is accurate
            await queryStore.loadQueryVersions(finalTab.queryId);
          }
        } catch (error) {
          console.error("Query execution failed:", error);
          set((state) => ({
            openTabs: state.openTabs.map((t) =>
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
                await currentState.executeQuery(currentState.activeTabId!);
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
        const queryStore = useQueryStore.getState();

        try {
          // Parse table name to get schema and table
          const parts = tableName.split(".");
          const schema = parts.length > 1 ? parts[0] : "public";
          const table = parts.length > 1 ? parts[1] : parts[0];

          // Get or create ephemeral query for this table/view
          const ephemeralQuery = await queryStore.getOrCreateEphemeralQuery(
            sourceId,
            schema,
            table,
            nodeType
          );

          // Load the latest version to get the SQL - wait for it to complete
          const latestVersion = await queryStore.loadLatestQueryVersion(ephemeralQuery.id);

          const sql = latestVersion?.sql || `SELECT * FROM ${schema}.${table} LIMIT 101`;

          // Check if this ephemeral query is already open in a tab
          const existingTab = currentState.openTabs.find(
            (tab) => tab.queryId === ephemeralQuery.id
          );

          if (existingTab) {
            // Switch to existing tab and ensure it has the latest SQL
            await currentState.setActiveTab(existingTab.id);

            // Update the tab content with the latest SQL and ensure it's not dirty
            currentState.updateTabContent(existingTab.id, {
              editorContent: sql,
              lastSavedContent: sql,
              originalContent: sql,
              isDirty: false
            });

            // Wait a bit for state to settle before auto-execution
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Auto-execute if conditions are met
            const updatedTab = get().openTabs.find((tab) => tab.id === existingTab.id);
            if (updatedTab && currentState.shouldAutoExecuteQuery(updatedTab)) {
              await currentState.executeQuery(existingTab.id);
            }
          } else {
            // Create a new tab for this ephemeral query
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
      name: "dribble-tabs-storage",
      // Only persist certain values
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        editorContent: state.editorContent
      })
    }
  )
);
