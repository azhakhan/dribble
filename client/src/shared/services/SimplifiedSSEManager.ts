/**
 * Simplified SSE Connection Manager for Direct Result Streaming
 *
 * This new implementation removes the complex query-task mapping and
 * result fetching logic, instead relying on direct streaming of results
 * via SSE with proper typing.
 */

import { useSSEStore } from "@/shared/store/useSSEStore";

export interface TaskUpdate {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  task_type: "query_execution" | "query_cancel" | "source_test" | "source_connect";
  progress?: number;
  message?: string;
  error?: string;
  result?: {
    columns?: string[];
    data?: unknown[][];
    row_count?: number;
    execution_time_ms?: number;
    connected?: boolean;
    cancelled?: boolean;
  };
  timestamp?: string;
}

export interface ConnectionStatus {
  status: "disconnected" | "connecting" | "connected" | "error";
  clientId?: string;
  reconnectAttempts: number;
  lastError?: string;
}

class SimplifiedSSEManager {
  private eventSource: EventSource | null = null;
  private clientId: string = "";
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 2000;
  private reconnectAttempts = 0;

  /**
   * Connect to the SSE endpoint with simplified flow
   */
  public async connect(): Promise<void> {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    this.disconnect();
    this.updateConnectionStatus("connecting");

    try {
      // Generate a unique client ID
      this.clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Connect to the new streaming endpoint
      this.eventSource = new EventSource(`/api/stream/events?client_id=${this.clientId}`, {
        withCredentials: true
      });

      this.setupEventListeners();
    } catch (error) {
      console.error("Failed to connect to SSE:", error);
      this.updateConnectionStatus("error", String(error));
      this.scheduleReconnect();
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

    this.updateConnectionStatus("disconnected");
  }

  /**
   * Track a task for this client
   */
  public async trackTask(taskId: string): Promise<void> {
    if (!this.clientId) {
      console.warn("Cannot track task: SSE not connected");
      return;
    }

    try {
      await fetch(`/api/stream/track/${taskId}?client_id=${this.clientId}`, {
        method: "POST"
      });
    } catch (error) {
      console.error(`Failed to track task ${taskId}:`, error);
    }
  }

  /**
   * Stop tracking a task
   */
  public async untrackTask(taskId: string): Promise<void> {
    if (!this.clientId) {
      return;
    }

    try {
      await fetch(`/api/stream/track/${taskId}?client_id=${this.clientId}`, {
        method: "DELETE"
      });
    } catch (error) {
      console.error(`Failed to untrack task ${taskId}:`, error);
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    const store = useSSEStore.getState();
    return {
      status: store.connection?.status || "disconnected",
      clientId: this.clientId,
      reconnectAttempts: this.reconnectAttempts,
      lastError: undefined // Note: lastError field not available in current store
    };
  }

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    this.eventSource.onopen = () => {
      console.log("SSE connection opened");
      this.reconnectAttempts = 0;
      this.updateConnectionStatus("connected");
    };

    this.eventSource.onerror = (event) => {
      console.error("SSE connection error:", event);
      this.updateConnectionStatus("error", "Connection error");
      this.scheduleReconnect();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    // Handle specific event types
    this.eventSource.addEventListener("task_update", (event) => {
      try {
        const update: TaskUpdate = JSON.parse((event as MessageEvent).data);
        this.handleTaskUpdate(update);
      } catch (error) {
        console.error("Failed to parse task update:", error);
      }
    });

    this.eventSource.addEventListener("heartbeat", () => {
      // Heartbeat - connection is alive
      console.debug("Received heartbeat");
    });
  }

  private handleMessage(data: Record<string, unknown>): void {
    switch (data.type) {
      case "connection":
        console.log("SSE connection confirmed:", data);
        this.clientId = (data.client_id as string) || this.clientId;
        break;
      case "task_status":
        // Legacy format - convert to new format
        this.handleTaskUpdate({
          task_id: data.task_id as string,
          status: data.status as TaskUpdate["status"],
          task_type: (data.task_type as TaskUpdate["task_type"]) || "query_execution",
          timestamp: data.timestamp as string
        });
        break;
      case "heartbeat":
        // Keep connection alive
        break;
      case "error":
        console.error("SSE error message:", data);
        this.updateConnectionStatus("error", data.error as string);
        break;
      default:
        console.log("Unknown SSE message type:", data.type);
    }
  }

  private handleTaskUpdate(update: TaskUpdate): void {
    console.log("Task update received:", update);

    // Note: Store task status updates would go here
    // This is a placeholder for actual store integration

    // Handle different task types
    switch (update.task_type) {
      case "query_execution":
        this.handleQueryExecutionUpdate(update);
        break;
      case "query_cancel":
        this.handleQueryCancelUpdate(update);
        break;
      case "source_test":
      case "source_connect":
        this.handleSourceUpdate(update);
        break;
      default:
        console.warn("Unknown task type:", update.task_type);
    }
  }

  private handleQueryExecutionUpdate(update: TaskUpdate): void {
    // Note: This is where query results would be updated in the store
    // For now, we'll just log the update
    console.log("Query execution update:", {
      taskId: update.task_id,
      status: update.status,
      result: update.result,
      error: update.error
    });
  }

  private handleQueryCancelUpdate(update: TaskUpdate): void {
    console.log("Query cancel update:", {
      taskId: update.task_id,
      status: update.status
    });
  }

  private handleSourceUpdate(update: TaskUpdate): void {
    // Handle source testing/connection updates
    // This would integrate with source store when needed
    console.log("Source update:", update);
  }

  private updateConnectionStatus(status: ConnectionStatus["status"], error?: string): void {
    const store = useSSEStore.getState();
    store.setConnection({
      status,
      reconnectAttempts: this.reconnectAttempts
      // Note: lastError not supported in current store interface
    });
    if (error) {
      console.error("SSE Connection error:", error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached");
      this.updateConnectionStatus("error", "Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.RECONNECT_DELAY * this.reconnectAttempts);
  }
}

// Export singleton instance
export const simplifiedSSEManager = new SimplifiedSSEManager();

export default SimplifiedSSEManager;
