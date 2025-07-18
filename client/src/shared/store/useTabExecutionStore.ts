import { create } from "zustand";
import { QueryExecutionServiceSSE, type QueryExecutionOptions } from "@/shared/services";

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
  executeQuery: async (tabId, sql, overrideFilters) => {
    const { openTabs, updateTabContent } = await import("@/shared/store/useTabManagerStore").then(
      (m) => m.useTabManagerStore.getState()
    );

    const tab = openTabs.find((t) => t.id === tabId);
    if (!tab) {
      console.error(`Tab ${tabId} not found`);
      return;
    }

    // Clear any existing results and set loading state
    updateTabContent(tabId, {
      queryRunning: true,
      queryResults: null
    });

    try {
      // Prepare execution options
      const options: QueryExecutionOptions = {
        sql,
        overrideFilters
      };

      // Execute query - SSE will handle the updates
      const result = await QueryExecutionServiceSSE.executeQuery(tab, options);

      if (result.success && result.queryRunId && tab.queryId) {
        // Store the task ID as queryRunId for cancellation
        updateTabContent(tabId, { queryRunId: result.queryRunId });
      } else if (!result.success) {
        // Handle immediate errors
        const { errorToTableData } = await import("@/shared/utils/errorUtils");
        updateTabContent(tabId, {
          queryRunning: false,
          queryRunId: null,
          queryResults: errorToTableData(result.error || "Query execution failed")
        });
      }
    } catch (error) {
      // Handle unexpected errors
      const { errorToTableData } = await import("@/shared/utils/errorUtils");
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      updateTabContent(tabId, {
        queryRunning: false,
        queryRunId: null,
        queryResults: errorToTableData(errorMessage)
      });
    }
  },

  cancelQuery: async (tabId) => {
    const { openTabs, updateTabContent } = await import("@/shared/store/useTabManagerStore").then(
      (m) => m.useTabManagerStore.getState()
    );

    const tab = openTabs.find((t) => t.id === tabId);
    if (!tab || !tab.queryRunId || !tab.queryId) {
      return;
    }

    try {
      // Call the cancellation API
      const { cancelQueryRun } = await import("@/shared/lib/api");
      await cancelQueryRun(tab.queryRunId);

      // Update the store to mark as cancelled
      const { useSSEStore } = await import("@/shared/store/useSSEStore");
      const sseStore = useSSEStore.getState();
      sseStore.updateTaskResult(tab.queryId, {
        taskId: tab.queryRunId,
        queryId: tab.queryId,
        status: "cancelled",
        timestamp: Date.now(),
        error: "Query execution was cancelled"
      });

      // Update tab state
      const { errorToTableData } = await import("@/shared/utils/errorUtils");
      updateTabContent(tabId, {
        queryRunning: false,
        queryRunId: null,
        queryResults: errorToTableData("Query execution was cancelled")
      });
    } catch (error) {
      console.error("Failed to cancel query:", error);
    }
  }
}));
