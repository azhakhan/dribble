import { create } from "zustand";
import type { TableFilterState } from "./types";

interface TableFilterStoreState {
  // Table filter state - grouped by tab ID
  tableFilters: Record<string, TableFilterState>;

  // Table filter actions
  setTableFilterOffset: (offset: number) => void;
  setTableFilterWhere: (where: string, tabId?: string) => void;
  setTableFilterOrderBy: (orderBy: string, tabId?: string) => void;
  setTableFilterPageSize: (displaySize: number) => void;
  clearTableFilters: () => void;
  getTableFilters: () => { limit: number; offset: number; where?: string; order_by?: string };
  getTabFilterState: (tabId: string) => TableFilterState;

  // New method to update filters and execute query atomically
  updateFilterAndExecuteQuery: (
    filterType: "where" | "orderBy",
    value: string,
    tabId?: string
  ) => Promise<void>;
}

export const useTableFilterStore = create<TableFilterStoreState>()((set, get) => ({
  // Initial state
  tableFilters: {},

  // Table filter actions
  setTableFilterOffset: (offset: number) => {
    // Import tab manager to get active tab
    import("./useTabManagerStore").then(({ useTabManagerStore }) => {
      const tabManager = useTabManagerStore.getState();
      const tabId = tabManager.activeTabId || "default";
      const currentFilter = get().tableFilters[tabId] || {
        currentOffset: 0,
        whereInput: "",
        orderByInput: "",
        pageSize: 501,
        displaySize: 500
      };
      set({
        tableFilters: {
          ...get().tableFilters,
          [tabId]: { ...currentFilter, currentOffset: offset }
        }
      });
    });
  },

  setTableFilterWhere: (where: string, tabId?: string) => {
    // Import tab manager to get active tab
    import("./useTabManagerStore").then(({ useTabManagerStore }) => {
      const tabManager = useTabManagerStore.getState();
      const targetTabId = tabId || tabManager.activeTabId || "default";
      const currentFilter = get().tableFilters[targetTabId] || {
        currentOffset: 0,
        whereInput: "",
        orderByInput: "",
        pageSize: 501,
        displaySize: 500
      };
      set({
        tableFilters: {
          ...get().tableFilters,
          [targetTabId]: { ...currentFilter, whereInput: where, currentOffset: 0 }
        }
      });
    });
  },

  setTableFilterOrderBy: (orderBy: string, tabId?: string) => {
    // Import tab manager to get active tab
    import("./useTabManagerStore").then(({ useTabManagerStore }) => {
      const tabManager = useTabManagerStore.getState();
      const targetTabId = tabId || tabManager.activeTabId || "default";
      const currentFilter = get().tableFilters[targetTabId] || {
        currentOffset: 0,
        whereInput: "",
        orderByInput: "",
        pageSize: 501,
        displaySize: 500
      };
      set({
        tableFilters: {
          ...get().tableFilters,
          [targetTabId]: { ...currentFilter, orderByInput: orderBy, currentOffset: 0 }
        }
      });
    });
  },

  // New method to update filters and execute query atomically
  updateFilterAndExecuteQuery: async (
    filterType: "where" | "orderBy",
    value: string,
    tabId?: string
  ) => {
    const { useTabManagerStore } = await import("./useTabManagerStore");
    const tabManager = useTabManagerStore.getState();
    const targetTabId = tabId || tabManager.activeTabId;

    if (!targetTabId) {
      console.error("No active tab to update filter for");
      return;
    }

    // Get current filters before updating
    const currentFilters = get().getTabFilterState(targetTabId);

    // Prepare the override filters with the new value
    const overrideFilters = {
      where:
        filterType === "where"
          ? value.trim() || undefined
          : currentFilters.whereInput.trim() || undefined,
      order_by:
        filterType === "orderBy"
          ? value.trim() || undefined
          : currentFilters.orderByInput.trim() || undefined
    };

    // Update the store with the new value
    if (filterType === "where") {
      get().setTableFilterWhere(value, targetTabId);
    } else {
      get().setTableFilterOrderBy(value, targetTabId);
    }

    // Execute query with explicit filter values
    try {
      const { useTabExecutionStore } = await import("./useTabExecutionStore");
      await useTabExecutionStore.getState().executeQuery(targetTabId, undefined, overrideFilters);
    } catch (error) {
      console.error(`Failed to execute query after updating ${filterType} filter:`, error);
    }
  },

  clearTableFilters: () => {
    // Import tab manager to get active tab
    import("./useTabManagerStore").then(({ useTabManagerStore }) => {
      const tabManager = useTabManagerStore.getState();
      const tabId = tabManager.activeTabId || "default";
      set({
        tableFilters: {
          ...get().tableFilters,
          [tabId]: {
            currentOffset: 0,
            whereInput: "",
            orderByInput: "",
            pageSize: 501,
            displaySize: 500
          }
        }
      });
    });
  },

  setTableFilterPageSize: (displaySize: number) => {
    // Import tab manager to get active tab
    import("./useTabManagerStore").then(({ useTabManagerStore }) => {
      const tabManager = useTabManagerStore.getState();
      const tabId = tabManager.activeTabId || "default";
      const currentFilter = get().tableFilters[tabId] || {
        currentOffset: 0,
        whereInput: "",
        orderByInput: "",
        pageSize: 501,
        displaySize: 500
      };
      set({
        tableFilters: {
          ...get().tableFilters,
          [tabId]: { ...currentFilter, displaySize, pageSize: displaySize + 1 }
        }
      });
    });
  },

  getTableFilters: () => {
    // Note: This is a synchronous getter, so we'll use default tab behavior
    const tabId = "default"; // Will be improved once we resolve circular dependencies
    const filter = get().tableFilters[tabId] || {
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
    return (
      get().tableFilters[tabId] || {
        currentOffset: 0,
        whereInput: "",
        orderByInput: "",
        pageSize: 501,
        displaySize: 500
      }
    );
  }
}));
