import { useEffect, useRef } from "react";
import { useSSEStore } from "@/shared/store/useSSEStore";
import { sseConnectionManager } from "@/shared/services/SSEConnectionManager";
import type { TaskResult } from "@/shared/store/useSSEStore";
import type { SSEMessageHandler } from "@/shared/services/SSEConnectionManager";
import type { TableRow } from "@/shared/types/api";

export interface UseQueryStreamOptions {
  enabled?: boolean;
  onStatusChange?: (status: TaskResult["status"]) => void;
  onSuccess?: (data: TableRow[]) => void;
  onError?: (error: string) => void;
}

export interface UseQueryStreamReturn {
  result: TaskResult | null;
  isRunning: boolean;
  isConnected: boolean;
}

/**
 * Hook for streaming query execution results via SSE
 */
export function useQueryStream(
  queryId: string,
  options: UseQueryStreamOptions = {}
): UseQueryStreamReturn {
  const { enabled = true, onStatusChange, onSuccess, onError } = options;
  const { getTaskResult, isQueryRunning } = useSSEStore();
  const handlerRef = useRef<SSEMessageHandler | null>(null);

  const result = getTaskResult(queryId);
  const isRunning = isQueryRunning(queryId);
  const isConnected = sseConnectionManager.isConnected();

  // Set up SSE handler
  useEffect(() => {
    if (!enabled || !queryId) return;

    const handler: SSEMessageHandler = {
      onTaskResult: (qId, taskResult) => {
        if (qId === queryId) {
          // Call callbacks based on status
          if (onStatusChange) {
            onStatusChange(taskResult.status);
          }

          if (taskResult.status === "success" && taskResult.data && onSuccess) {
            onSuccess(taskResult.data);
          }

          if (taskResult.status === "error" && taskResult.error && onError) {
            onError(taskResult.error);
          }
        }
      },
      onError: (error) => {
        if (onError) {
          onError(error);
        }
      }
    };

    handlerRef.current = handler;
    sseConnectionManager.addMessageHandler(handler);

    // Ensure connection is established
    sseConnectionManager.connect().catch(console.error);

    return () => {
      if (handlerRef.current) {
        sseConnectionManager.removeMessageHandler(handlerRef.current);
        handlerRef.current = null;
      }
    };
  }, [queryId, enabled, onStatusChange, onSuccess, onError]);

  return {
    result,
    isRunning,
    isConnected
  };
}
