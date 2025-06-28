import { create } from "zustand";
import { QueryExecutionServiceSSE, type QueryExecutionOptions } from "@/shared/services";
import { errorToTableData } from "@/shared/utils/errorUtils";
import { useSSEStore } from "@/shared/store/useQuerySSEStore";
import { convertToTableData } from "@/shared/utils/typeUtils";

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

    // Prevent duplicate executions
    if (tab.queryRunning) {
      console.log(`Query already running for tab ${tabId}, skipping duplicate execution`);
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

      if (result.success && result.queryRunId && tab.queryId) {
        // Update tab with the query run ID for cancellation
        const tabsWithRunId = useTabManagerStore
          .getState()
          .openTabs.map((t) =>
            t.id === tabId ? { ...t, queryRunId: result.queryRunId || null } : t
          );
        useTabManagerStore.setState({ openTabs: tabsWithRunId });

        // The SSE connection and tracking is now handled automatically by QueryExecutionServiceSSE
        // We just need to monitor the results using the query ID
        const sseStore = useSSEStore.getState();

        // Set up a polling mechanism to check for results updates
        // In a real implementation, you'd use the useQueryStream hook in the component
        const checkForUpdates = () => {
          const queryLatestRun = sseStore.getQueryLatestRun(tab.queryId!);
          const currentTab = useTabManagerStore.getState().openTabs.find((t) => t.id === tabId);

          // Only update if we have a latest run and it matches the run we're tracking
          if (queryLatestRun && currentTab && queryLatestRun.runId === currentTab.queryRunId) {
            const currentTabs = useTabManagerStore.getState().openTabs;
            const updatedTabs = currentTabs.map((t) => {
              if (t.id !== tabId) return t;

              if (queryLatestRun.status === "success" && queryLatestRun.data) {
                return {
                  ...t,
                  queryRunning: false,
                  queryRunId: null,
                  queryResults: convertToTableData(queryLatestRun.data)
                };
              } else if (queryLatestRun.status === "error") {
                return {
                  ...t,
                  queryRunning: false,
                  queryRunId: null,
                  queryResults: errorToTableData(queryLatestRun.error || "Query execution failed")
                };
              } else if (queryLatestRun.status === "cancelled") {
                return {
                  ...t,
                  queryRunning: false,
                  queryRunId: null,
                  queryResults: errorToTableData(
                    queryLatestRun.error || "Query execution was cancelled"
                  )
                };
              } else if (queryLatestRun.status === "running") {
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

        // Don't check immediately - let the query start running first
        let pollCount = 0;
        const interval = setInterval(() => {
          const queryLatestRun = sseStore.getQueryLatestRun(tab.queryId!);
          const currentTab = useTabManagerStore.getState().openTabs.find((t) => t.id === tabId);
          checkForUpdates();
          pollCount++;

          // Stop polling when query is complete AND it's the run we're tracking
          if (
            queryLatestRun &&
            currentTab &&
            queryLatestRun.runId === currentTab.queryRunId &&
            (queryLatestRun.status === "success" ||
              queryLatestRun.status === "error" ||
              queryLatestRun.status === "cancelled")
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

    try {
      // Import the new immediate cancellation API
      const { cancelQueryRunImmediate } = await import("@/shared/lib/api");
      const { useSSEStore } = await import("./useQuerySSEStore");

      // Immediately mark query as cancelled in the SSE store
      const sseStore = useSSEStore.getState();
      sseStore.markQueryCancelled(
        tab.queryId!,
        tab.queryRunId,
        "Query execution was cancelled by user"
      );

      // Update tab state immediately - keep existing data, just stop running state
      const updatedTabs = tabManager.openTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              queryRunning: false,
              queryRunId: null,
              isLoadingQuery: false // Reset loading state so run button becomes active
              // Keep queryResults as-is (don't replace with error message)
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: updatedTabs });

      // Call the immediate cancellation API (this updates DB and sends fire-and-forget to worker)
      await cancelQueryRunImmediate(tab.queryRunId);

      console.log(`Query ${tab.queryRunId} marked as cancelled`);
    } catch (error) {
      console.error("Failed to cancel query:", error);

      // Even if the API call failed, we've already updated the client state
      // Just log the error and keep the cancelled state
      const updatedTabs = tabManager.openTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              queryRunning: false,
              queryRunId: null,
              isLoadingQuery: false
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: updatedTabs });
    }
  }
}));
