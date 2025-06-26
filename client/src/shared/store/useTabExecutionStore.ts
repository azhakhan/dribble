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
        // Set up SSE connection for real-time updates
        const sseStore = useSSEStore.getState();

        // Create EventSource for SSE connection
        const eventSource = new EventSource(
          `http://localhost:8000/stream/query-results/${result.queryRunId}`
        );

        // Add connection to store
        sseStore.addConnection(result.queryRunId, eventSource);

        // Set up event handlers
        eventSource.onopen = () => {
          sseStore.updateConnectionStatus(result.queryRunId!, "connected");
        };

        eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            // Update SSE store
            sseStore.updateQueryStatus(
              result.queryRunId!,
              message.status,
              message.data,
              message.error
            );

            // Update tab state
            const currentTabs = useTabManagerStore.getState().openTabs;
            const updatedTabs = currentTabs.map((t) => {
              if (t.id !== tabId) return t;

              if (message.status === "success" && message.data) {
                return {
                  ...t,
                  queryRunning: false,
                  queryResults: convertToTableData(message.data)
                };
              } else if (message.status === "error") {
                return {
                  ...t,
                  queryRunning: false,
                  queryResults: errorToTableData(message.error || "Query execution failed")
                };
              } else if (message.status === "running") {
                return {
                  ...t,
                  queryRunning: true
                };
              }
              return t;
            });
            useTabManagerStore.setState({ openTabs: updatedTabs });

            // Close connection if query is complete
            if (message.status === "success" || message.status === "error") {
              eventSource.close();
              sseStore.removeConnection(result.queryRunId!);
            }
          } catch (error) {
            console.error("Error parsing SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          sseStore.updateConnectionStatus(result.queryRunId!, "error");
          const errorTabs = useTabManagerStore.getState().openTabs;
          const updatedErrorTabs = errorTabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  queryRunning: false,
                  queryResults: errorToTableData("Connection error")
                }
              : t
          );
          useTabManagerStore.setState({ openTabs: updatedErrorTabs });
        };

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
