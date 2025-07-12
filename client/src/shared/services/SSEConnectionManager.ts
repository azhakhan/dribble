import { useSSEStore } from "@/shared/store/useSSEStore";
import type { TaskResult } from "@/shared/store/useSSEStore";
import { getWorkerTaskResult } from "@/shared/lib/api";
import type { TableRow } from "@/shared/types/api";

export interface SSEMessageHandler {
  onTaskResult?: (queryId: string, result: TaskResult) => void;
  onConnection?: (clientId: string) => void;
  onHeartbeat?: () => void;
  onError?: (error: string) => void;
}

class SSEConnectionManager {
  private eventSource: EventSource | null = null;
  private messageHandlers = new Set<SSEMessageHandler>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 1000;

  // Track query to task mapping
  private queryTaskMap = new Map<string, string>();

  /**
   * Connect to the SSE endpoint
   */
  public async connect(): Promise<void> {
    // Already connected
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      return;
    }

    // Clean up any existing connection
    this.disconnect();

    const store = useSSEStore.getState();
    store.updateConnectionStatus("connecting");

    try {
      // Create SSE connection
      this.eventSource = new EventSource("/api/stream/events/", {
        withCredentials: true
      });

      this.eventSource.onopen = () => {
        store.updateConnectionStatus("connected");
        store.setConnection({
          status: "connected",
          reconnectAttempts: 0
        });
      };

      this.eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        store.updateConnectionStatus("error");
        this.handleReconnect();
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };
    } catch (error) {
      console.error("Failed to create SSE connection:", error);
      store.updateConnectionStatus("error");
      throw error;
    }
  }

  /**
   * Disconnect from SSE
   */
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const store = useSSEStore.getState();
    store.updateConnectionStatus("disconnected");
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Add a message handler
   */
  public addMessageHandler(handler: SSEMessageHandler): void {
    this.messageHandlers.add(handler);
  }

  /**
   * Remove a message handler
   */
  public removeMessageHandler(handler: SSEMessageHandler): void {
    this.messageHandlers.delete(handler);
  }

  /**
   * Track a query task mapping
   */
  public trackQueryTask(queryId: string, taskId: string): void {
    this.queryTaskMap.set(queryId, taskId);
  }

  /**
   * Get task ID for a query
   */
  public getTaskForQuery(queryId: string): string | undefined {
    return this.queryTaskMap.get(queryId);
  }

  /**
   * Handle incoming SSE messages
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const data = JSON.parse(event.data);
      const store = useSSEStore.getState();

      switch (data.type) {
        case "connection":
          // Update connection with client ID
          store.setConnection({
            status: "connected",
            reconnectAttempts: 0,
            clientId: data.client_id
          });

          // Notify handlers
          this.messageHandlers.forEach((handler) => {
            handler.onConnection?.(data.client_id);
          });
          break;

        case "task_status": {
          const taskId = data.task_id;
          const status = data.status;

          if (taskId && status) {
            // Find query ID for this task
            let queryId: string | null = null;
            for (const [qId, tId] of this.queryTaskMap.entries()) {
              if (tId === taskId) {
                queryId = qId;
                break;
              }
            }

            if (queryId) {
              if (status === "success") {
                // Fetch results when task completes
                try {
                  const taskResult = await getWorkerTaskResult(taskId);
                  const result: TaskResult = {
                    taskId,
                    queryId,
                    status,
                    timestamp: Date.now(),
                    data: taskResult.data as TableRow[],
                    error: taskResult.error
                  };
                  store.updateTaskResult(queryId, result);

                  // Notify handlers
                  this.messageHandlers.forEach((handler) => {
                    handler.onTaskResult?.(queryId!, result);
                  });

                  // Clean up task mapping
                  this.queryTaskMap.delete(queryId);
                } catch (error) {
                  // Failed to fetch results
                  const errorResult: TaskResult = {
                    taskId,
                    queryId,
                    status: "error",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "Failed to fetch results"
                  };
                  store.updateTaskResult(queryId, errorResult);
                }
              } else if (status === "error" || status === "cancelled") {
                // Fetch full task result for error cases to get error message
                try {
                  const taskResult = await getWorkerTaskResult(taskId);
                  const result: TaskResult = {
                    taskId,
                    queryId,
                    status,
                    timestamp: Date.now(),
                    error: taskResult.error
                  };
                  store.updateTaskResult(queryId, result);

                  // Notify handlers
                  this.messageHandlers.forEach((handler) => {
                    handler.onTaskResult?.(queryId!, result);
                  });
                } catch (error) {
                  // Failed to fetch error details
                  const errorResult: TaskResult = {
                    taskId,
                    queryId,
                    status: "error",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "Failed to fetch error details"
                  };
                  store.updateTaskResult(queryId, errorResult);
                }

                // Clean up task mapping
                this.queryTaskMap.delete(queryId);
              } else {
                // Update status for running/other non-terminal states
                const result: TaskResult = {
                  taskId,
                  queryId,
                  status,
                  timestamp: Date.now()
                };
                store.updateTaskResult(queryId, result);

                // Notify handlers
                this.messageHandlers.forEach((handler) => {
                  handler.onTaskResult?.(queryId!, result);
                });
              }
            }
          }
          break;
        }

        case "heartbeat":
          this.messageHandlers.forEach((handler) => {
            handler.onHeartbeat?.();
          });
          break;

        case "error":
          this.messageHandlers.forEach((handler) => {
            handler.onError?.(data.error);
          });
          break;
      }
    } catch {
      // Silently ignore malformed messages
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    const store = useSSEStore.getState();
    const currentAttempts = store.connection?.reconnectAttempts || 0;

    if (currentAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached");
      store.updateConnectionStatus("error");
      return;
    }

    // Schedule reconnect
    this.reconnectTimeout = setTimeout(
      () => {
        store.setConnection({
          status: "connecting",
          reconnectAttempts: currentAttempts + 1
        });
        this.connect();
      },
      this.RECONNECT_DELAY * Math.pow(2, currentAttempts)
    );
  }
}

// Export singleton instance
export const sseConnectionManager = new SSEConnectionManager();

// Handle page unload/reload - cleanup connection
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    sseConnectionManager.disconnect();
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Page became visible - reconnect if needed
      if (!sseConnectionManager.isConnected()) {
        sseConnectionManager.connect().catch(() => {
          // Failed to reconnect on visibility change
        });
      }
    }
  });
}
