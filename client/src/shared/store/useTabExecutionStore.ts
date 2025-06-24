import { create } from "zustand";
import { QueryExecutionService, type QueryExecutionOptions } from "@/shared/services";

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

      // Delegate to the service
      const result = await QueryExecutionService.executeQuery(tab, options);

      if (result.success) {
        // Update tab with successful results
        const finalTabs = useTabManagerStore.getState().openTabs;
        const updatedFinalTabs = finalTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                queryRunning: false,
                queryResults: result.results || []
              }
            : t
        );
        useTabManagerStore.setState({ openTabs: updatedFinalTabs });

        // Refresh query data if we have a queryId
        const finalTab = updatedFinalTabs.find((t) => t.id === tabId);
        if (finalTab?.queryId) {
          await QueryExecutionService.refreshQueryData(finalTab.queryId);
        }
      } else {
        // Handle execution failure
        const errorTabs = useTabManagerStore.getState().openTabs;
        const updatedErrorTabs = errorTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                queryRunning: false,
                queryResults: result.results || [{ error: result.error || "Unknown error" }]
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
