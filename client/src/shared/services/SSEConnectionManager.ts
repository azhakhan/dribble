import { useSSEStore } from "@/shared/store/useQuerySSEStore";
import type { RunResult, GlobalSSEConnection } from "@/shared/store/useQuerySSEStore";

export interface SSEMessageHandler {
  onRunResult?: (queryId: string, runId: string, result: RunResult) => void;
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
   * Register a query as awaiting a specific run
   */
  public trackQueryRun(queryId: string, runId: string): void {
    const store = useSSEStore.getState();
    store.registerQueryAwaitingRun(queryId, runId);
    store.addActiveRun(runId);
  }

  /**
   * Remove a run from tracking
   */
  public untrackRun(runId: string): void {
    const store = useSSEStore.getState();
    store.removeActiveRun(runId);
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
  private handleMessage(event: MessageEvent): void {
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

        case "query_result": {
          const runId = data.query_run_id;
          const queryId = data.query_id;

          if (runId && queryId) {
            // Update run result in store
            store.updateRunResult(runId, queryId, data.status, data.data, data.error);

            // Create result object for handlers
            const result: RunResult = {
              runId,
              queryId,
              status: data.status,
              timestamp: data.timestamp || Date.now(),
              data: data.data,
              error: data.error
            };

            // Notify handlers
            this.messageHandlers.forEach((handler) => {
              handler.onRunResult?.(queryId, runId, result);
            });

            // Remove from active runs if completed
            if (
              data.status === "success" ||
              data.status === "error" ||
              data.status === "cancelled"
            ) {
              store.removeActiveRun(runId);
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
      if (!store.hasActiveConnection() && store.activeRuns.size > 0) {
        sseConnectionManager.connect().catch(() => {
          // Failed to reconnect on visibility change
        });
      }
    }
  });
}
