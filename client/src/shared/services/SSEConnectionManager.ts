import { useSSEStore } from "@/shared/store/useSSEStore";
import type { QueryResult, GlobalSSEConnection } from "@/shared/store/useSSEStore";

export interface SSEMessageHandler {
  onQueryResult?: (queryId: string, result: QueryResult) => void;
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
   * Add a query to be tracked by this connection
   */
  public trackQuery(queryId: string): void {
    const store = useSSEStore.getState();
    store.addActiveQuery(queryId);
  }

  /**
   * Remove a query from tracking
   */
  public untrackQuery(queryId: string): void {
    const store = useSSEStore.getState();
    store.removeActiveQuery(queryId);
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
          const queryRunId = data.query_run_id;
          if (queryRunId) {
            // Update query status in store
            store.updateQueryStatus(queryRunId, data.status, data.data, data.error);

            // Create result object for handlers
            const result: QueryResult = {
              queryId: queryRunId,
              status: data.status,
              timestamp: data.timestamp || Date.now(),
              data: data.data,
              error: data.error
            };

            // Notify handlers
            this.messageHandlers.forEach((handler) => {
              handler.onQueryResult?.(queryRunId, result);
            });

            // Remove from active queries if completed
            if (
              data.status === "success" ||
              data.status === "error" ||
              data.status === "cancelled"
            ) {
              store.removeActiveQuery(queryRunId);
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
    const store = useSSEStore.getState();
    const attempts = store.connection?.reconnectAttempts || 0;

    store.incrementReconnectAttempts();

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, attempts) + Math.random() * 1000,
      30000 // Max 30 seconds
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, but will retry on next attempt
      });
    }, delay);
  }

  /**
   * Clear reconnect timeout
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
      if (!store.hasActiveConnection() && store.activeQueries.size > 0) {
        sseConnectionManager.connect().catch(() => {
          // Failed to reconnect on visibility change
        });
      }
    }
  });
}
