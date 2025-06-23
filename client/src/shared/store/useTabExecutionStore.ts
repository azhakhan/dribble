import { create } from "zustand";
import type { CreateQueryRunRequest } from "@/shared/lib/api";
import { executeQueryVersionRun, getQueryRunResults } from "@/shared/lib/api";

interface TabExecutionState {
  // Query execution
  executeQuery: (
    tabId: string,
    sql?: string,
    overrideFilters?: { where?: string; order_by?: string }
  ) => Promise<void>;
}

export const useTabExecutionStore = create<TabExecutionState>()(() => ({
  // Execute query
  executeQuery: async (tabId, sql, overrideFilters) => {
    // Import required stores dynamically to avoid circular dependencies
    const { useTabManagerStore } = await import("./useTabManagerStore");
    const { useQueryStore } = await import("./useQueryStore");
    const { useSourceStore } = await import("./useSourceStore");

    // Helper function to get the most current tab state
    const getCurrentTab = () => {
      const tabManager = useTabManagerStore.getState();
      return tabManager.openTabs.find((t) => t.id === tabId);
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
    const tabManager = useTabManagerStore.getState();
    const updatedTabs = tabManager.openTabs.map((t) =>
      t.id === tabId ? { ...t, queryRunning: true } : t
    );
    useTabManagerStore.setState({ openTabs: updatedTabs });

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
          const updatedQuery = await queryStore.convertEphemeralToRegular(tab.queryId, queryName);

          // Update the tab title
          const currentTabs = useTabManagerStore.getState().openTabs;
          const updatedTabsWithTitle = currentTabs.map((t) =>
            t.id === tabId ? { ...t, title: updatedQuery.name || queryName } : t
          );
          useTabManagerStore.setState({ openTabs: updatedTabsWithTitle });
        }

        // We have an existing query
        if (tab.isDirty) {
          // Create a new version with the current content
          await queryStore.saveQueryVersion(tab.queryId, queryToRun, "run");
          const newVersion = await queryStore.loadLatestQueryVersion(tab.queryId);
          if (!newVersion) {
            throw new Error("Failed to create query version");
          }
          versionId = newVersion.id;

          // Update the tab's saved content tracking
          const currentTabs = useTabManagerStore.getState().openTabs;
          const updatedTabsWithSave = currentTabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  lastSavedContent: queryToRun,
                  isDirty: false // Mark as clean since we just saved
                }
              : t
          );
          useTabManagerStore.setState({ openTabs: updatedTabsWithSave });
        } else {
          // Use existing version
          versionId = tab.queryVersionId!;
        }
      } else {
        // Create a new ephemeral query and save the version
        const newQuery = await queryStore.createNewQuery({
          sourceId: tab.sourceId
        });
        await queryStore.saveQueryVersion(newQuery.id, queryToRun, "run");
        const newVersion = await queryStore.loadLatestQueryVersion(newQuery.id);
        if (!newVersion) {
          throw new Error("Failed to create query version");
        }
        versionId = newVersion.id;

        // Update the tab's saved content tracking
        const currentTabs = useTabManagerStore.getState().openTabs;
        const updatedTabsWithNew = currentTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                lastSavedContent: queryToRun,
                isDirty: false // Mark as clean since we just saved
              }
            : t
        );
        useTabManagerStore.setState({ openTabs: updatedTabsWithNew });
      }

      // Step 2: Create a query run and execute
      // Get the tab-specific filters (now that we're using tab-aware filters)
      const currentTab = getCurrentTab();
      // Import filter store dynamically
      const { useTableFilterStore } = await import("./useTableFilterStore");
      const filterStore = useTableFilterStore.getState();
      const tabFilters = currentTab
        ? filterStore.getTabFilterState(currentTab.id)
        : {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          };

      const finalFilters = {
        limit: tabFilters.pageSize,
        offset: tabFilters.currentOffset,
        where: overrideFilters?.where ?? (tabFilters.whereInput.trim() || undefined),
        order_by: overrideFilters?.order_by ?? (tabFilters.orderByInput.trim() || undefined)
      };

      const runRequest: CreateQueryRunRequest = {
        query_version_id: versionId,
        modifiers: finalFilters
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
        processedResults = results.length > 0 ? results : [{ message: "Query returned no data" }];
      } else if (typeof results === "object" && results !== null) {
        processedResults = [results];
      } else {
        // Handle primitive types (string, number, etc.) by wrapping them in objects
        processedResults = [{ result: results }];
      }

      const finalTabs = useTabManagerStore.getState().openTabs;
      const updatedFinalTabs = finalTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              queryRunning: false,
              queryResults: processedResults
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: updatedFinalTabs });

      // Reload runs to get the latest run data after successful execution
      // Increase delay to ensure the run is fully persisted
      await new Promise((resolve) => setTimeout(resolve, 500));

      const finalState = useTabManagerStore.getState();
      const finalTab = finalState.openTabs.find((t) => t.id === tabId);
      if (finalTab?.queryId) {
        // Force refresh to get the latest runs including the one just created
        await queryStore.loadQueryRuns(finalTab.queryId, true);

        // Also trigger a reload of query versions to ensure version count is accurate
        await queryStore.loadQueryVersions(finalTab.queryId);
      }
    } catch (error) {
      console.error("Query execution failed:", error);
      const errorTabs = useTabManagerStore.getState().openTabs;
      const updatedErrorTabs = errorTabs.map((t) =>
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
      );
      useTabManagerStore.setState({ openTabs: updatedErrorTabs });
      throw error;
    }
  }
}));
