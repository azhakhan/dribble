import { create } from "zustand";
import { QueryExecutionServiceSSE, type QueryExecutionOptions } from "@/shared/services";
import { errorToTableData } from "@/shared/utils/errorUtils";
import { useSSEStore } from "@/shared/store/useSSEStore";
import { convertToTableData } from "@/shared/utils/typeUtils";

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
      t.id === tabId ? { ...t, queryRunning: true } : t
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
                  queryResults: convertToTableData(queryResult.data)
                };
              } else if (queryResult.status === "error") {
                return {
                  ...t,
                  queryRunning: false,
                  queryResults: errorToTableData(queryResult.error || "Query execution failed")
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
        const interval = setInterval(() => {
          const queryResult = sseStore.getQueryResult(result.queryRunId!);
          checkForUpdates();

          // Stop polling when query is complete
          if (queryResult && (queryResult.status === "success" || queryResult.status === "error")) {
            clearInterval(interval);
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
              queryResults: errorToTableData(error, "Query execution failed")
            }
          : t
      );
      useTabManagerStore.setState({ openTabs: updatedErrorTabs });
      throw error;
    }
  }
}));
