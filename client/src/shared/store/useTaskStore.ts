import { create } from "zustand";

export interface Task {
  task_id: string;
  task_type: string;
  status: "pending" | "running" | "success" | "error";
  timestamp: number;
  result?: unknown;
  error?: string;
}

export interface SSEConnection {
  clientId: string;
  eventSource: EventSource;
  status: "connecting" | "connected" | "closed" | "error";
  lastMessageTime: number;
  reconnectAttempts: number;
}

interface TaskState {
  // Tasks tracked by task_id
  tasks: Record<string, Task>;

  // Single global SSE connection
  connection: SSEConnection | null;

  // Actions
  addTask: (task: Task) => void;
  updateTask: (task_id: string, updates: Partial<Task>) => void;
  removeTask: (task_id: string) => void;
  getTask: (task_id: string) => Task | undefined;

  // Connection management
  setConnection: (connection: SSEConnection) => void;
  updateConnectionStatus: (status: SSEConnection["status"]) => void;
  closeConnection: () => void;

  // Utility
  clearAllTasks: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: {},
  connection: null,

  addTask: (task) => {
    set((state) => ({
      tasks: {
        ...state.tasks,
        [task.task_id]: task
      }
    }));
  },

  updateTask: (task_id, updates) => {
    set((state) => {
      const existingTask = state.tasks[task_id];
      if (!existingTask) return state;

      return {
        tasks: {
          ...state.tasks,
          [task_id]: {
            ...existingTask,
            ...updates,
            timestamp: Date.now()
          }
        }
      };
    });
  },

  removeTask: (task_id) => {
    set((state) => {
      const newTasks = { ...state.tasks };
      delete newTasks[task_id];
      return { tasks: newTasks };
    });
  },

  getTask: (task_id) => {
    return get().tasks[task_id];
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

  closeConnection: () => {
    const state = get();
    if (state.connection?.eventSource) {
      state.connection.eventSource.close();
    }
    set({ connection: null });
  },

  clearAllTasks: () => {
    set({ tasks: {} });
  }
}));
