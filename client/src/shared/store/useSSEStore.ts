import { create } from "zustand";
import type { TableRow } from "@/shared/types/api";

export interface TaskResult {
  taskId: string;
  queryId: string;
  status: "running" | "success" | "error" | "cancelled";
  timestamp: number;
  data?: TableRow[];
  error?: string;
}

export interface QueryWithLatestTask {
  queryId: string;
  latestTask: TaskResult | null;
  awaitingTaskId: string | null; // Track which task we're waiting for
}

export interface GlobalSSEConnection {
  clientId: string;
  eventSource: EventSource;
  status: "connecting" | "connected" | "closed" | "error";
  lastMessageTime: number;
  reconnectAttempts: number;
}

interface SSEState {
  // Queries with their latest task data, keyed by queryId
  queries: Record<string, QueryWithLatestTask>;

  // Single global SSE connection
  connection: GlobalSSEConnection | null;

  // Active tasks being tracked (for cleanup), keyed by taskId
  activeTasks: Set<string>;

  // Actions for query/task management
  registerQueryAwaitingTask: (queryId: string, taskId: string) => void;
  updateTaskResult: (
    taskId: string,
    queryId: string,
    status: TaskResult["status"],
    data?: TableRow[],
    error?: string
  ) => void;

  // Single connection management
  setConnection: (connection: GlobalSSEConnection) => void;
  updateConnectionStatus: (status: GlobalSSEConnection["status"]) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  closeConnection: () => void;

  // Task tracking management
  addActiveTask: (taskId: string) => void;
  removeActiveTask: (taskId: string) => void;
  clearQueryData: (queryId: string) => void;

  // Utility functions
  getQueryData: (queryId: string) => QueryWithLatestTask | undefined;
  getQueryLatestTask: (queryId: string) => TaskResult | null;
  isQueryRunning: (queryId: string) => boolean;
  hasActiveConnection: () => boolean;
  isTaskActive: (taskId: string) => boolean;
  getConnectionStatus: () => GlobalSSEConnection["status"] | "disconnected";

  // Cleanup functions
  clearAllData: () => void;

  // Mark query as cancelled immediately (client-side cancellation)
  markQueryCancelled: (queryId: string, taskId: string, error?: string) => void;

  // Debug helper method
  getDebugInfo: () => {
    queryCount: number;
    activeTaskCount: number;
    queries: {
      queryId: string;
      latestTaskId: string | undefined;
      latestTaskStatus: TaskResult["status"] | undefined;
      awaitingTaskId: string | null;
    }[];
  };
}

export const useSSEStore = create<SSEState>((set, get) => ({
  queries: {},
  connection: null,
  activeTasks: new Set(),

  registerQueryAwaitingTask: (queryId, taskId) => {
    set((state) => ({
      queries: {
        ...state.queries,
        [queryId]: {
          queryId,
          latestTask: state.queries[queryId]?.latestTask || null,
          awaitingTaskId: taskId
        }
      }
    }));
  },

  updateTaskResult: (taskId, queryId, status, data, error) => {
    set((state) => {
      const existingQuery = state.queries[queryId];

      // Only update if this task is what we're waiting for
      const shouldUpdate = existingQuery && existingQuery.awaitingTaskId === taskId;

      if (!shouldUpdate) {
        // This might be an old task result, ignore it
        return state;
      }

      // If the current latest task for this query is already cancelled,
      // ignore any subsequent results from this task
      if (
        existingQuery?.latestTask?.status === "cancelled" &&
        existingQuery?.latestTask?.taskId === taskId
      ) {
        // Task was cancelled, ignore worker results
        return state;
      }

      const newTaskResult: TaskResult = {
        taskId,
        queryId,
        status,
        timestamp: Date.now(),
        data: data || existingQuery?.latestTask?.data,
        error: error || existingQuery?.latestTask?.error
      };

      const updatedQuery: QueryWithLatestTask = {
        queryId,
        latestTask: newTaskResult,
        awaitingTaskId: status === "running" ? taskId : null // Clear awaiting if completed
      };

      return {
        queries: {
          ...state.queries,
          [queryId]: updatedQuery
        }
      };
    });

    // Trigger refresh of query runs in the main store when query completes
    if (status === "success" || status === "error" || status === "cancelled") {
      // Import dynamically to avoid circular dependency
      import("./useQueryStore").then(({ useQueryStore }) => {
        const queryStore = useQueryStore.getState();
        const pagination = queryStore.queryRunsPagination[queryId];
        if (pagination) {
          // Refresh current page to show the completed run
          queryStore.loadQueryRunsPaginated(queryId, pagination.page, pagination.page_size, true);
        }
      });
    }
  },

  markQueryCancelled: (queryId, taskId, error) => {
    set((state) => {
      const existingQuery = state.queries[queryId];

      // Only update if this task is what we're waiting for
      if (!existingQuery || existingQuery.awaitingTaskId !== taskId) {
        return state;
      }

      const cancelledTaskResult: TaskResult = {
        taskId,
        queryId,
        status: "cancelled",
        timestamp: Date.now(),
        data: existingQuery?.latestTask?.data || undefined, // Keep existing data
        error: error || "Query execution was cancelled"
      };

      const updatedQuery: QueryWithLatestTask = {
        queryId,
        latestTask: cancelledTaskResult,
        awaitingTaskId: null // Clear awaiting since we're marking as cancelled
      };

      return {
        queries: {
          ...state.queries,
          [queryId]: updatedQuery
        }
      };
    });

    // Trigger refresh of query runs in the main store when query is cancelled
    import("./useQueryStore").then(({ useQueryStore }) => {
      const queryStore = useQueryStore.getState();
      const pagination = queryStore.queryRunsPagination[queryId];
      if (pagination) {
        // Refresh current page to show the cancelled run
        queryStore.loadQueryRunsPaginated(queryId, pagination.page, pagination.page_size, true);
      }
    });
  },

  setConnection: (connection) => {
    set(() => ({ connection }));
  },

  updateConnectionStatus: (status) => {
    set((state) => ({
      connection: state.connection ? { ...state.connection, status } : null
    }));
  },

  incrementReconnectAttempts: () => {
    set((state) => ({
      connection: state.connection
        ? { ...state.connection, reconnectAttempts: state.connection.reconnectAttempts + 1 }
        : null
    }));
  },

  resetReconnectAttempts: () => {
    set((state) => ({
      connection: state.connection ? { ...state.connection, reconnectAttempts: 0 } : null
    }));
  },

  closeConnection: () => {
    set(() => ({ connection: null }));
  },

  addActiveTask: (taskId) => {
    set((state) => ({
      activeTasks: new Set(state.activeTasks).add(taskId)
    }));
  },

  removeActiveTask: (taskId) => {
    set((state) => ({
      activeTasks: new Set([...state.activeTasks].filter((id) => id !== taskId))
    }));
  },

  clearQueryData: (queryId) => {
    set((state) => {
      const newQueries = { ...state.queries };
      delete newQueries[queryId];
      return { queries: newQueries };
    });
  },

  getQueryData: (queryId) => {
    const state = get();
    return state.queries[queryId];
  },

  getQueryLatestTask: (queryId) => {
    const state = get();
    return state.queries[queryId]?.latestTask || null;
  },

  isQueryRunning: (queryId) => {
    const state = get();
    const query = state.queries[queryId];
    return query?.latestTask?.status === "running" || query?.awaitingTaskId !== null;
  },

  hasActiveConnection: () => {
    const state = get();
    return state.connection?.status === "connected";
  },

  isTaskActive: (taskId) => {
    const state = get();
    return state.activeTasks.has(taskId);
  },

  getConnectionStatus: () => {
    const state = get();
    return state.connection?.status || "disconnected";
  },

  clearAllData: () => {
    set(() => ({
      queries: {},
      activeTasks: new Set()
    }));
  },

  getDebugInfo: () => {
    const state = get();
    return {
      queryCount: Object.keys(state.queries).length,
      activeTaskCount: state.activeTasks.size,
      queries: Object.values(state.queries).map((q) => ({
        queryId: q.queryId,
        latestTaskId: q.latestTask?.taskId,
        latestTaskStatus: q.latestTask?.status,
        awaitingTaskId: q.awaitingTaskId
      }))
    };
  }
}));
