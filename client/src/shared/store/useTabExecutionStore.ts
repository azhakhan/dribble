import { create } from "zustand";
import { QueryExecutionServiceSSE, type QueryExecutionOptions } from "@/shared/services";
import { errorToTableData } from "@/shared/utils/errorUtils";
import { useSSEStore } from "@/shared/store/useSSEStore";
import { convertToTableData } from "@/shared/utils/typeUtils";
import { cancelQueryRun } from "@/shared/lib/api";

interface TabExecutionState {
  // Query execution
  executeQuery: (
    tabId: string,
    sql?: string,
    overrideFilters?: { where?: string; order_by?: string }
  ) => Promise<void>;

  // Cancel query execution
  cancelQuery: (tabId: string) => Promise<void>;
}

export const useTabExecutionStore = create<TabExecutionState>()(() => ({
  // Execute query
  executeQuery: async (tabId, sql, overrideFilters) => {
    // Get the current tab
    const { useTabManagerStore } = await import("./useTabManagerStore");
    const tabManager = useTabManagerStore.getState();
    const tab = tabManager.openTabs.find((t) => t.id === tabId);

    if (!tab) {
      console.error("Tab not found:", tabId);
      return;
    }

    // Set running state
    const updatedTabs = tabManager.openTabs.map((t) =>
      t.id === tabId ? { ...t, queryRunning: true, queryRunId: null } : t
    );
    useTabManagerStore.setState({ openTabs: updatedTabs });

    try {
      // Prepare execution options
      const options: QueryExecutionOptions = {
        sql,
        overrideFilters
      };

      // Delegate to the SSE service
      const result = await QueryExecutionServiceSSE.executeQuery(tab, options);

      if (result.success && result.queryRunId) {
        // Update tab with the query run ID for cancellation
        const tabsWithRunId = useTabManagerStore
          .getState()
          .openTabs.map((t) =>
            t.id === tabId ? { ...t, queryRunId: result.queryRunId || null } : t
          );
        useTabManagerStore.setState({ openTabs: tabsWithRunId });

        // The SSE connection and tracking is now handled automatically by QueryExecutionServiceSSE
        // We just need to monitor the results in the SSE store
        const sseStore = useSSEStore.getState();

        // Set up a polling mechanism to check for results updates
        // In a real implementation, you'd use the useQueryStream hook in the component
        const checkForUpdates = () => {
          const queryResult = sseStore.getQueryResult(result.queryRunId!);

          if (queryResult) {
            const currentTabs = useTabManagerStore.getState().openTabs;
            const updatedTabs = currentTabs.map((t) => {
              if (t.id !== tabId) return t;

              if (queryResult.status === "success" && queryResult.data) {
                return {
                  ...t,
                  queryRunning: false,
                  queryRunId: null,
                  queryResults: convertToTableData(queryResult.data)
                };
              } else if (queryResult.status === "error") {
                return {
                  ...t,
                  queryRunning: false,
                  queryRunId: null,
                  queryResults: errorToTableData(queryResult.error || "Query execution failed")
                };
              } else if (queryResult.status === "cancelled") {
                return {
                  ...t,
                  queryRunning: false,
                  queryRunId: null,
                  queryResults: errorToTableData(
                    queryResult.error || "Query execution was cancelled"
                  )
                };
              } else if (queryResult.status === "running") {
                return {
                  ...t,
                  queryRunning: true
                };
              }
              return t;
            });
            useTabManagerStore.setState({ openTabs: updatedTabs });
          }
        };

        // Check immediately and then poll for updates
        checkForUpdates();
        let pollCount = 0;
        const interval = setInterval(() => {
          const queryResult = sseStore.getQueryResult(result.queryRunId!);
          checkForUpdates();
          pollCount++;

          // Stop polling when query is complete
          if (
            queryResult &&
            (queryResult.status === "success" ||
              queryResult.status === "error" ||
              queryResult.status === "cancelled")
          ) {
            clearInterval(interval);
          }

          // Every 30 seconds (300 polls at 100ms), check if the query might have been cancelled
          // This helps recover from missed SSE events
          if (pollCount % 300 === 0) {
            const currentTab = useTabManagerStore.getState().openTabs.find((t) => t.id === tabId);
            if (currentTab?.queryRunning && currentTab?.queryRunId) {
              // Make a quick status check to see if the query is still actually running
              // This is a lightweight way to detect if a cancellation was missed
              import("@/shared/lib/api").then(({ getQueryRunById }) => {
                getQueryRunById(currentTab.queryRunId!).catch(() => {
                  // If we can't find the query run, it might have been cancelled/completed
                  // Reset the UI state
                  const updatedTabs = useTabManagerStore.getState().openTabs.map((t) =>
                    t.id === tabId
                      ? {
                          ...t,
                          queryRunning: false,
                          queryRunId: null,
                          queryResults: errorToTableData("Query status unknown - please refresh")
                        }
                      : t
                  );
                  useTabManagerStore.setState({ openTabs: updatedTabs });
                  clearInterval(interval);
                });
              });
            }
          }
        }, 100);

        // Refresh query data if we have a queryId
        if (tab.queryId) {
          await QueryExecutionServiceSSE.refreshQueryData(tab.queryId);
        }
      } else {
        // Handle execution failure
        const errorTabs = useTabManagerStore.getState().openTabs;
        const updatedErrorTabs = errorTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                queryRunning: false,
                queryRunId: null,
                queryResults: result.results || errorToTableData(result.error || "Unknown error")
              }
            : t
        );
        useTabManagerStore.setState({ openTabs: updatedErrorTabs });
      }
    } catch (error) {
      console.error("Query execution failed:", error);
      const errorTabs = useTabManagerStore.getState().openTabs;
      const updatedErrorTabs = errorTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              queryRunning: false,
              queryRunId: null,
              queryResults: errorToTableData(error, "Query execution failed")
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: updatedErrorTabs });
      throw error;
    }
  },

  // Cancel query execution
  cancelQuery: async (tabId) => {
    // Get the current tab
    const { useTabManagerStore } = await import("./useTabManagerStore");
    const tabManager = useTabManagerStore.getState();
    const tab = tabManager.openTabs.find((t) => t.id === tabId);

    if (!tab || !tab.queryRunId || !tab.queryRunning) {
      console.error("No running query to cancel for tab:", tabId);
      return;
    }

    const queryRunId = tab.queryRunId;

    try {
      // Call the API to cancel the query
      await cancelQueryRun(queryRunId);

      // Update tab state to reflect successful cancellation
      const updatedTabs = useTabManagerStore.getState().openTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              queryRunning: false,
              queryRunId: null,
              queryResults: errorToTableData("Query execution was cancelled")
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: updatedTabs });
    } catch (error) {
      console.error("Failed to cancel query:", error);

      // Even if the API call failed (e.g., timeout), we should still reset the UI state
      // The cancellation might have worked on the server side despite the timeout
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Reset the UI state regardless of the error
      const resetTabs = useTabManagerStore.getState().openTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              queryRunning: false,
              queryRunId: null,
              queryResults: errorToTableData(
                errorMessage.includes("timeout") || errorMessage.includes("Query not found")
                  ? "Query cancellation requested (may still be processing)"
                  : `Query cancellation failed: ${errorMessage}`
              )
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: resetTabs });

      // Don't re-throw the error - we've handled the UI state
      // The error will be shown to the user via the error handling in the component
      throw error;
    }
  }
}));
