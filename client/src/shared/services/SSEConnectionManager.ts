import { useSSEStore } from "@/shared/store/useSSEStore";
import type { TaskResult, GlobalSSEConnection } from "@/shared/store/useSSEStore";
import { getWorkerTaskResult } from "@/shared/lib/api";
import type { TableRow } from "@/shared/types/api";

export interface SSEMessageHandler {
  onTaskResult?: (queryId: string, taskId: string, result: TaskResult) => void;
  onConnection?: (clientId: string) => void;
  onHeartbeat?: () => void;
  onError?: (error: string) => void;
}

class SSEConnectionManager {
  private static instance: SSEConnectionManager | null = null;
  private eventSource: EventSource | null = null;
  private clientId: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1 second
  private messageHandlers: Set<SSEMessageHandler> = new Set();

  private constructor() {}

  static getInstance(): SSEConnectionManager {
    if (!SSEConnectionManager.instance) {
      SSEConnectionManager.instance = new SSEConnectionManager();
    }
    return SSEConnectionManager.instance;
  }

  /**
   * Start the SSE connection if not already connected
   */
  public connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      const store = useSSEStore.getState();

      // If already connected, return existing client ID
      if (store.hasActiveConnection() && this.clientId) {
        resolve(this.clientId);
        return;
      }

      // Close existing connection if any
      this.disconnect();

      try {
        // Connect to the multiplexed events endpoint
        this.eventSource = new EventSource("/api/stream/events");

        // Set up connection in store
        const connection: GlobalSSEConnection = {
          clientId: "", // Will be set after connection message
          eventSource: this.eventSource,
          status: "connecting",
          lastMessageTime: Date.now(),
          reconnectAttempts: 0
        };

        store.setConnection(connection);

        this.eventSource.onopen = () => {
          store.updateConnectionStatus("connected");
          store.resetReconnectAttempts();
          this.clearReconnectTimeout();
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.eventSource.onerror = () => {
          store.updateConnectionStatus("error");

          const currentConnection = store.connection;
          const attempts = currentConnection?.reconnectAttempts || 0;

          if (attempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            this.disconnect();
            reject(new Error("Failed to establish SSE connection after multiple attempts"));
          }
        };

        // Set up a timeout for initial connection
        const connectionTimeout = setTimeout(() => {
          if (!this.clientId) {
            reject(new Error("SSE connection timeout"));
          }
        }, 10000); // 10 second timeout

        // Wait for connection message to get client ID
        const connectionHandler: SSEMessageHandler = {
          onConnection: (clientId: string) => {
            this.clientId = clientId;
            clearTimeout(connectionTimeout);
            this.removeMessageHandler(connectionHandler);
            resolve(clientId);
          }
        };

        this.addMessageHandler(connectionHandler);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect the SSE connection
   */
  public disconnect(): void {
    this.clearReconnectTimeout();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.clientId = null;
    this.messageHandlers.clear();

    const store = useSSEStore.getState();
    store.closeConnection();
  }

  /**
   * Register a query as awaiting a specific task
   */
  public trackQueryTask(queryId: string, taskId: string): void {
    const store = useSSEStore.getState();
    store.registerQueryAwaitingTask(queryId, taskId);
    store.addActiveTask(taskId);
  }

  /**
   * Remove a task from tracking
   */
  public untrackTask(taskId: string): void {
    const store = useSSEStore.getState();
    store.removeActiveTask(taskId);
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
   * Get current connection status
   */
  public getConnectionStatus(): GlobalSSEConnection["status"] | "disconnected" {
    const store = useSSEStore.getState();
    return store.getConnectionStatus();
  }

  /**
   * Check if connection is active
   */
  public isConnected(): boolean {
    const store = useSSEStore.getState();
    return store.hasActiveConnection();
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
          this.clientId = data.client_id;

          // Update connection with client ID
          if (store.connection) {
            store.setConnection({
              ...store.connection,
              clientId: data.client_id
            });
          }

          // Notify handlers
          this.messageHandlers.forEach((handler) => {
            handler.onConnection?.(data.client_id);
          });
          break;

        case "task_status": {
          const taskId = data.task_id;
          const status = data.status;

          if (taskId && status) {
            // Find query ID for this task from our tracked queries
            const queries = store.queries;
            let queryId: string | null = null;

            for (const [qId, queryData] of Object.entries(queries)) {
              if (queryData.awaitingTaskId === taskId) {
                queryId = qId;
                break;
              }
            }

            if (queryId) {
              if (status === "success") {
                // Task completed successfully, fetch the actual data
                try {
                  const taskResult = await getWorkerTaskResult(taskId);
                  store.updateTaskResult(
                    taskId,
                    queryId,
                    status,
                    taskResult.data as TableRow[],
                    taskResult.error
                  );
                } catch (error) {
                  // Failed to fetch results, mark as error
                  const errorMessage =
                    error instanceof Error ? error.message : "Failed to fetch task results";
                  store.updateTaskResult(taskId, queryId, "error", undefined, errorMessage);
                }
              } else {
                // For running, error, or cancelled states, update without fetching data
                store.updateTaskResult(taskId, queryId, status, undefined, data.error);
              }

              // Create result object for handlers
              const result: TaskResult = {
                taskId,
                queryId,
                status,
                timestamp: data.timestamp || Date.now(),
                data: undefined, // Data will be fetched separately for success cases
                error: data.error
              };

              // Notify handlers
              this.messageHandlers.forEach((handler) => {
                handler.onTaskResult?.(queryId, taskId, result);
              });

              // Remove from active tasks if completed
              if (status === "success" || status === "error" || status === "cancelled") {
                store.removeActiveTask(taskId);
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
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    this.clearReconnectTimeout();

    const store = useSSEStore.getState();
    const attempts = store.connection?.reconnectAttempts || 0;
    const delay = this.baseReconnectDelay * Math.pow(2, attempts); // Exponential backoff

    store.incrementReconnectAttempts();

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, will be handled by the error handler
      });
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

// Export singleton instance
export const sseConnectionManager = SSEConnectionManager.getInstance();

// Handle page unload/reload - cleanup connection
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    sseConnectionManager.disconnect();
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Page became visible - reconnect if needed
      const store = useSSEStore.getState();
      if (!store.hasActiveConnection() && store.activeTasks.size > 0) {
        sseConnectionManager.connect().catch(() => {
          // Failed to reconnect on visibility change
        });
      }
    }
  });
}
