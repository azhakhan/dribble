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

export interface GlobalSSEConnection {
  status: "connected" | "connecting" | "disconnected" | "error";
  reconnectAttempts: number;
  clientId?: string;
}

interface SSEState {
  // Single source of truth for task results, keyed by queryId
  taskResults: Record<string, TaskResult>;

  // SSE connection state
  connection: GlobalSSEConnection | null;

  // Actions
  updateTaskResult: (queryId: string, result: TaskResult) => void;
  clearTaskResult: (queryId: string) => void;

  // Connection management
  setConnection: (connection: GlobalSSEConnection) => void;
  updateConnectionStatus: (status: GlobalSSEConnection["status"]) => void;

  // Query helpers
  getTaskResult: (queryId: string) => TaskResult | null;
  isQueryRunning: (queryId: string) => boolean;
}

export const useSSEStore = create<SSEState>((set, get) => ({
  taskResults: {},
  connection: null,

  updateTaskResult: (queryId, result) => {
    set((state) => ({
      taskResults: {
        ...state.taskResults,
        [queryId]: result
      }
    }));
  },

  clearTaskResult: (queryId) => {
    set((state) => {
      const newResults = { ...state.taskResults };
      delete newResults[queryId];
      return { taskResults: newResults };
    });
  },

  setConnection: (connection) => {
    set({ connection });
  },

  updateConnectionStatus: (status) => {
    set((state) => ({
      connection: state.connection ? { ...state.connection, status } : null
    }));
  },

  getTaskResult: (queryId) => {
    const state = get();
    return state.taskResults[queryId] || null;
  },

  isQueryRunning: (queryId) => {
    const state = get();
    const result = state.taskResults[queryId];
    return result?.status === "running";
  }
}));
