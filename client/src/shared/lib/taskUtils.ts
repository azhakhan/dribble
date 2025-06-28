import axios from "axios";
import { useTaskStore } from "../store/useTaskStore";

// Create axios instance
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json"
  }
});

export interface TaskSubmissionResponse {
  task_id: string;
  task_type: string;
  status: string;
}

export interface TaskResult<T = unknown> {
  status: "success" | "error";
  result?: T;
  error?: string;
}

/**
 * Submit a task and wait for completion via SSE
 * @param endpoint - The API endpoint to submit the task to
 * @param data - The data to submit
 * @param timeoutMs - Timeout in milliseconds (default: 30 seconds)
 * @returns Promise that resolves when task completes
 */
export async function submitTaskAndWait<T = unknown>(
  endpoint: string,
  data: unknown,
  timeoutMs: number = 30000
): Promise<TaskResult<T>> {
  const taskStore = useTaskStore.getState();

  // Ensure SSE connection is active
  if (!taskStore.connection || taskStore.connection.status !== "connected") {
    initializeTaskSSE();
    // Wait a bit for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Submit the task
  const response = await api.post<TaskSubmissionResponse>(endpoint, data);
  const { task_id, task_type } = response.data;

  // Add task to store for tracking
  taskStore.addTask({
    task_id,
    task_type,
    status: "pending",
    timestamp: Date.now()
  });

  // Wait for SSE notification - purely event-driven, no polling
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      taskStore.removeTask(task_id);
      cleanup();
      reject(new Error("Task timeout"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      taskStore.removeTask(task_id);
      // Remove event listener
      if (taskStore.connection?.eventSource) {
        taskStore.connection.eventSource.removeEventListener("message", handleSSEMessage);
      }
    };

    // Listen directly to SSE events for this specific task
    const handleSSEMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "task_status" && data.task_id === task_id) {
          if (data.status === "success") {
            cleanup();

            // Fetch the task result from the server
            api
              .get(`/worker/tasks/${task_id}/result`)
              .then((response) => {
                resolve({
                  status: "success",
                  result: response.data as T
                });
              })
              .catch((error) => {
                resolve({
                  status: "error",
                  error: `Failed to fetch task result: ${error.message}`
                });
              });
          } else if (data.status === "error") {
            cleanup();
            resolve({
              status: "error",
              error: "Task failed"
            });
          }
          // For "running" status, just continue waiting
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    // Add event listener to the SSE connection
    if (taskStore.connection?.eventSource) {
      taskStore.connection.eventSource.addEventListener("message", handleSSEMessage);
    } else {
      cleanup();
      reject(new Error("No SSE connection available"));
    }
  });
}

/**
 * Initialize SSE connection for task updates
 */
export function initializeTaskSSE(): void {
  const taskStore = useTaskStore.getState();

  // Don't create multiple connections
  if (
    taskStore.connection?.status === "connected" ||
    taskStore.connection?.status === "connecting"
  ) {
    return;
  }

  const clientId = `client-${Math.random().toString(36).substr(2, 8)}`;
  const eventSource = new EventSource(`/api/stream/events?client_id=${clientId}`);

  taskStore.setConnection({
    clientId,
    eventSource,
    status: "connecting",
    lastMessageTime: Date.now(),
    reconnectAttempts: 0
  });

  eventSource.onopen = () => {
    taskStore.updateConnectionStatus("connected");
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "task_status") {
        const { task_id, status } = data;

        // Update existing task in store (for potential other uses)
        const existingTask = taskStore.getTask(task_id);
        if (existingTask) {
          taskStore.updateTask(task_id, { status });
        }

        // Note: Individual tasks listen to SSE events directly
        // This store update is just for potential other consumers
      }
    } catch (error) {
      console.error("Failed to parse SSE message:", error);
    }
  };

  eventSource.onerror = () => {
    taskStore.updateConnectionStatus("error");
    // Could implement reconnection logic here if needed
  };
}

/**
 * Hook to initialize SSE connection on app start
 */
export function useTaskSSE() {
  const { connection } = useTaskStore();

  // Initialize connection if not exists
  if (!connection) {
    initializeTaskSSE();
  }

  return {
    connectionStatus: connection?.status || "disconnected",
    lastMessageTime: connection?.lastMessageTime
  };
}
