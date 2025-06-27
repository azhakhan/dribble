import { create } from "zustand";
import type { TableRow } from "@/shared/types/api";

export interface RunResult {
  runId: string;
  queryId: string;
  status: "running" | "success" | "error" | "cancelled";
  timestamp: number;
  data?: TableRow[];
  error?: string;
}

export interface QueryWithLatestRun {
  queryId: string;
  latestRun: RunResult | null;
  awaitingRunId: string | null; // Track which run we're waiting for
}

export interface GlobalSSEConnection {
  clientId: string;
  eventSource: EventSource;
  status: "connecting" | "connected" | "closed" | "error";
  lastMessageTime: number;
  reconnectAttempts: number;
}

interface SSEState {
  // Queries with their latest run data, keyed by queryId
  queries: Record<string, QueryWithLatestRun>;

  // Single global SSE connection
  connection: GlobalSSEConnection | null;

  // Active runs being tracked (for cleanup), keyed by runId
  activeRuns: Set<string>;

  // Actions for query/run management
  registerQueryAwaitingRun: (queryId: string, runId: string) => void;
  updateRunResult: (
    runId: string,
    queryId: string,
    status: RunResult["status"],
    data?: TableRow[],
    error?: string
  ) => void;

  // Single connection management
  setConnection: (connection: GlobalSSEConnection) => void;
  updateConnectionStatus: (status: GlobalSSEConnection["status"]) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  closeConnection: () => void;

  // Run tracking management
  addActiveRun: (runId: string) => void;
  removeActiveRun: (runId: string) => void;
  clearQueryData: (queryId: string) => void;

  // Utility functions
  getQueryData: (queryId: string) => QueryWithLatestRun | undefined;
  getQueryLatestRun: (queryId: string) => RunResult | null;
  isQueryRunning: (queryId: string) => boolean;
  hasActiveConnection: () => boolean;
  isRunActive: (runId: string) => boolean;
  getConnectionStatus: () => GlobalSSEConnection["status"] | "disconnected";

  // Cleanup functions
  clearAllData: () => void;

  // Debug helper method
  getDebugInfo: () => {
    queryCount: number;
    activeRunCount: number;
    queries: {
      queryId: string;
      latestRunId: string | undefined;
      latestRunStatus: RunResult["status"] | undefined;
      awaitingRunId: string | null;
    }[];
  };
}

export const useSSEStore = create<SSEState>((set, get) => ({
  queries: {},
  connection: null,
  activeRuns: new Set(),

  registerQueryAwaitingRun: (queryId, runId) => {
    set((state) => ({
      queries: {
        ...state.queries,
        [queryId]: {
          queryId,
          latestRun: state.queries[queryId]?.latestRun || null,
          awaitingRunId: runId
        }
      }
    }));
  },

  updateRunResult: (runId, queryId, status, data, error) => {
    set((state) => {
      const existingQuery = state.queries[queryId];

      // Only update if this run is what we're waiting for, or if we don't have a latest run yet
      const shouldUpdate =
        !existingQuery || existingQuery.awaitingRunId === runId || !existingQuery.latestRun;

      if (!shouldUpdate) {
        // This might be an old run result, ignore it
        return state;
      }

      const newRunResult: RunResult = {
        runId,
        queryId,
        status,
        timestamp: Date.now(),
        data: data || existingQuery?.latestRun?.data,
        error: error || existingQuery?.latestRun?.error
      };

      const updatedQuery: QueryWithLatestRun = {
        queryId,
        latestRun: newRunResult,
        awaitingRunId: status === "running" ? runId : null // Clear awaiting if completed
      };

      return {
        queries: {
          ...state.queries,
          [queryId]: updatedQuery
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
      activeRuns: new Set() // Clear active runs when connection closes
    });
  },

  addActiveRun: (runId) => {
    set((state) => ({
      activeRuns: new Set([...state.activeRuns, runId])
    }));
  },

  removeActiveRun: (runId) => {
    set((state) => {
      const newActiveRuns = new Set(state.activeRuns);
      newActiveRuns.delete(runId);
      return { activeRuns: newActiveRuns };
    });
  },

  clearQueryData: (queryId) => {
    set((state) => {
      const newQueries = { ...state.queries };
      delete newQueries[queryId];
      return { queries: newQueries };
    });
  },

  getQueryData: (queryId) => {
    return get().queries[queryId];
  },

  getQueryLatestRun: (queryId) => {
    return get().queries[queryId]?.latestRun;
  },

  isQueryRunning: (queryId) => {
    const queryData = get().queries[queryId];
    return queryData?.latestRun?.status === "running" || !!queryData?.awaitingRunId;
  },

  hasActiveConnection: () => {
    const connection = get().connection;
    return connection?.status === "connected";
  },

  isRunActive: (runId) => {
    return get().activeRuns.has(runId);
  },

  getConnectionStatus: () => {
    return get().connection?.status || "disconnected";
  },

  clearAllData: () => {
    set({
      queries: {},
      activeRuns: new Set()
    });
  },

  // Debug helper method
  getDebugInfo: () => {
    const state = get();
    return {
      queryCount: Object.keys(state.queries).length,
      activeRunCount: state.activeRuns.size,
      queries: Object.values(state.queries).map((q) => ({
        queryId: q.queryId,
        latestRunId: q.latestRun?.runId,
        latestRunStatus: q.latestRun?.status,
        awaitingRunId: q.awaitingRunId
      }))
    };
  }
}));
