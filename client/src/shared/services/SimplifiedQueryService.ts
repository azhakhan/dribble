/**
 * Simplified Query Execution Service
 *
 * This service provides a clean interface for query execution that works
 * with the new direct streaming approach, eliminating complex state management.
 */

import { simplifiedSSEManager } from "./SimplifiedSSEManager";

export interface QueryExecutionRequest {
  query_version_id: string;
  modifiers?: Record<string, unknown>;
}

export interface QueryExecutionResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface QueryCancelResponse {
  query_run_id: string;
  status: string;
  message: string;
}

class SimplifiedQueryService {
  private clientId: string = "";

  constructor() {
    // Generate a consistent client ID for this session
    this.clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute a query with automatic task tracking
   */
  async executeQuery(request: QueryExecutionRequest): Promise<string> {
    try {
      // Ensure SSE connection is active
      await this.ensureConnection();

      // Submit query for execution
      const response = await fetch("/api/execution/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": this.clientId
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: QueryExecutionResponse = await response.json();

      // Track the task for streaming updates
      await simplifiedSSEManager.trackTask(result.task_id);

      // Note: Query state will be updated via SSE when task status changes

      console.log(`Query execution started: ${result.task_id}`);
      return result.task_id;
    } catch (error) {
      console.error("Failed to execute query:", error);
      throw error;
    }
  }

  /**
   * Cancel a running query
   */
  async cancelQuery(queryRunId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/execution/cancel/${queryRunId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": this.clientId
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await response.json();
      console.log(`Query cancellation requested: ${queryRunId}`);
      return true;
    } catch (error) {
      console.error("Failed to cancel query:", error);
      return false;
    }
  }

  /**
   * Get current execution status for a task
   */
  getExecutionStatus(taskId: string): unknown {
    // Note: Status tracking is handled by SSE store
    // This is a placeholder until proper store integration
    console.log("Getting execution status for task:", taskId);
    return null;
  }

  /**
   * Stop tracking a completed task
   */
  async stopTracking(taskId: string): Promise<void> {
    try {
      await simplifiedSSEManager.untrackTask(taskId);
      console.log(`Stopped tracking task: ${taskId}`);
    } catch (error) {
      console.error("Failed to stop tracking task:", error);
    }
  }

  /**
   * Ensure SSE connection is established
   */
  private async ensureConnection(): Promise<void> {
    const status = simplifiedSSEManager.getConnectionStatus();

    if (status.status !== "connected") {
      console.log("Establishing SSE connection...");
      await simplifiedSSEManager.connect();

      // Wait a bit for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Get client ID for this session
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Reset the service (for testing or reconnection)
   */
  reset(): void {
    this.clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    simplifiedSSEManager.disconnect();
  }
}

// Export singleton instance
export const simplifiedQueryService = new SimplifiedQueryService();

export default SimplifiedQueryService;
