import { create } from "zustand";
import type { TableRow } from "@/shared/types/api";

export interface QueryResult {
  queryId: string;
  status: "running" | "success" | "error" | "cancelled";
  timestamp: number;
  data?: TableRow[];
  error?: string;
}

export interface GlobalSSEConnection {
  clientId: string;
  eventSource: EventSource;
  status: "connecting" | "connected" | "closed" | "error";
  lastMessageTime: number;
  reconnectAttempts: number;
}

interface SSEState {
  // Real-time query results keyed by queryId
  queryResults: Record<string, QueryResult>;

  // Single global SSE connection
  connection: GlobalSSEConnection | null;

  // Active queries being tracked
  activeQueries: Set<string>;

  // Actions
  setQueryResult: (queryId: string, result: QueryResult) => void;
  updateQueryStatus: (
    queryId: string,
    status: QueryResult["status"],
    data?: TableRow[],
    error?: string
  ) => void;

  // Single connection management
  setConnection: (connection: GlobalSSEConnection) => void;
  updateConnectionStatus: (status: GlobalSSEConnection["status"]) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  closeConnection: () => void;

  // Query management
  addActiveQuery: (queryId: string) => void;
  removeActiveQuery: (queryId: string) => void;
  clearQueryResult: (queryId: string) => void;

  // Utility functions
  getQueryResult: (queryId: string) => QueryResult | undefined;
  getConnectionStatus: () => GlobalSSEConnection["status"] | "disconnected";
  isQueryRunning: (queryId: string) => boolean;
  hasActiveConnection: () => boolean;
  isQueryActive: (queryId: string) => boolean;

  // Cleanup functions
  clearAllResults: () => void;
}

export const useSSEStore = create<SSEState>((set, get) => ({
  queryResults: {},
  connection: null,
  activeQueries: new Set(),

  setQueryResult: (queryId, result) => {
    set((state) => ({
      queryResults: {
        ...state.queryResults,
        [queryId]: result
      }
    }));
  },

  updateQueryStatus: (queryId, status, data, error) => {
    set((state) => {
      const existingResult = state.queryResults[queryId];
      const updatedResult: QueryResult = {
        queryId,
        status,
        timestamp: Date.now(),
        data: data || existingResult?.data,
        error: error || existingResult?.error
      };

      return {
        queryResults: {
          ...state.queryResults,
          [queryId]: updatedResult
        }
      };
    });
  },

  setConnection: (connection) => {
    set({ connection });
  },

  updateConnectionStatus: (status) => {
    set((state) => {
      if (!state.connection) return state;

      return {
        connection: {
          ...state.connection,
          status,
          lastMessageTime: Date.now()
        }
      };
    });
  },

  incrementReconnectAttempts: () => {
    set((state) => {
      if (!state.connection) return state;

      return {
        connection: {
          ...state.connection,
          reconnectAttempts: state.connection.reconnectAttempts + 1
        }
      };
    });
  },

  resetReconnectAttempts: () => {
    set((state) => {
      if (!state.connection) return state;

      return {
        connection: {
          ...state.connection,
          reconnectAttempts: 0
        }
      };
    });
  },

  closeConnection: () => {
    const state = get();

    if (state.connection?.eventSource) {
      state.connection.eventSource.close();
    }

    set({
      connection: null,
      activeQueries: new Set() // Clear active queries when connection closes
    });
  },

  addActiveQuery: (queryId) => {
    set((state) => ({
      activeQueries: new Set([...state.activeQueries, queryId])
    }));
  },

  removeActiveQuery: (queryId) => {
    set((state) => {
      const newActiveQueries = new Set(state.activeQueries);
      newActiveQueries.delete(queryId);
      return { activeQueries: newActiveQueries };
    });
  },

  clearQueryResult: (queryId) => {
    set((state) => {
      const newResults = { ...state.queryResults };
      delete newResults[queryId];
      return { queryResults: newResults };
    });
  },

  getQueryResult: (queryId) => {
    return get().queryResults[queryId];
  },

  getConnectionStatus: () => {
    return get().connection?.status || "disconnected";
  },

  isQueryRunning: (queryId) => {
    const result = get().queryResults[queryId];
    return result?.status === "running";
  },

  hasActiveConnection: () => {
    const connection = get().connection;
    return connection?.status === "connected";
  },

  isQueryActive: (queryId) => {
    return get().activeQueries.has(queryId);
  },

  clearAllResults: () => {
    set({
      queryResults: {},
      activeQueries: new Set()
    });
  }
}));
