import { create } from "zustand";
import type { TableRow } from "@/shared/types/api";

export interface QueryResult {
  queryId: string;
  status: "running" | "success" | "error";
  timestamp: number;
  data?: TableRow[];
  error?: string;
}

export interface SSEConnection {
  queryId: string;
  eventSource: EventSource;
  status: "connecting" | "connected" | "closed" | "error";
  lastMessageTime: number;
}

interface SSEState {
  // Real-time query results keyed by queryId
  queryResults: Record<string, QueryResult>;

  // Active SSE connections
  connections: Record<string, SSEConnection>;

  // Actions
  setQueryResult: (queryId: string, result: QueryResult) => void;
  updateQueryStatus: (
    queryId: string,
    status: QueryResult["status"],
    data?: TableRow[],
    error?: string
  ) => void;
  addConnection: (queryId: string, eventSource: EventSource) => void;
  updateConnectionStatus: (queryId: string, status: SSEConnection["status"]) => void;
  removeConnection: (queryId: string) => void;
  clearQueryResult: (queryId: string) => void;

  // Utility functions
  getQueryResult: (queryId: string) => QueryResult | undefined;
  getConnectionStatus: (queryId: string) => SSEConnection["status"] | "disconnected";
  isQueryRunning: (queryId: string) => boolean;
  hasActiveConnection: (queryId: string) => boolean;

  // Cleanup functions
  closeConnection: (queryId: string) => void;
  closeAllConnections: () => void;
}

export const useSSEStore = create<SSEState>((set, get) => ({
  queryResults: {},
  connections: {},

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
      return {
        queryResults: {
          ...state.queryResults,
          [queryId]: {
            queryId,
            status,
            timestamp: Date.now(),
            data: data || existingResult?.data,
            error: error || existingResult?.error
          }
        }
      };
    });
  },

  addConnection: (queryId, eventSource) => {
    set((state) => ({
      connections: {
        ...state.connections,
        [queryId]: {
          queryId,
          eventSource,
          status: "connecting",
          lastMessageTime: Date.now()
        }
      }
    }));
  },

  updateConnectionStatus: (queryId, status) => {
    set((state) => {
      const connection = state.connections[queryId];
      if (!connection) return state;

      return {
        connections: {
          ...state.connections,
          [queryId]: {
            ...connection,
            status,
            lastMessageTime: Date.now()
          }
        }
      };
    });
  },

  removeConnection: (queryId) => {
    set((state) => {
      const newConnections = { ...state.connections };
      delete newConnections[queryId];
      return { connections: newConnections };
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

  getConnectionStatus: (queryId) => {
    const connection = get().connections[queryId];
    return connection?.status || "disconnected";
  },

  isQueryRunning: (queryId) => {
    const result = get().queryResults[queryId];
    return result?.status === "running";
  },

  hasActiveConnection: (queryId) => {
    const connection = get().connections[queryId];
    return connection?.status === "connected";
  },

  closeConnection: (queryId) => {
    const state = get();
    const connection = state.connections[queryId];

    if (connection?.eventSource) {
      connection.eventSource.close();
    }

    get().removeConnection(queryId);
  },

  closeAllConnections: () => {
    const state = get();

    Object.values(state.connections).forEach((connection) => {
      if (connection.eventSource) {
        connection.eventSource.close();
      }
    });

    set({ connections: {} });
  }
}));
