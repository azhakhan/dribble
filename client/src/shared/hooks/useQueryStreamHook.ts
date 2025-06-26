import { useEffect, useCallback, useRef } from "react";
import { useSSEStore } from "@/shared/store/useSSEStore";
import { sseConnectionManager } from "@/shared/services/SSEConnectionManager";
import type { QueryResult } from "@/shared/store/useSSEStore";
import type { SSEMessageHandler } from "@/shared/services/SSEConnectionManager";
import type { TableRow } from "@/shared/types/api";

export interface UseQueryStreamOptions {
  enabled?: boolean;
  onStatusChange?: (queryId: string, status: QueryResult["status"]) => void;
  onSuccess?: (queryId: string, data: TableRow[]) => void;
  onError?: (queryId: string, error: string) => void;
  onComplete?: (queryId: string, result: QueryResult) => void;
}

export interface UseQueryStreamReturn {
  result: QueryResult | undefined;
  connectionStatus: string;
  isRunning: boolean;
  hasActiveConnection: boolean;
  startStream: () => void;
  stopStream: () => void;
}

/**
 * Hook for streaming query execution results via SSE using single global connection
 * Automatically manages connection and tracks query results in Zustand store
 */
export function useQueryStream(
  queryId: string,
  options: UseQueryStreamOptions = {}
): UseQueryStreamReturn {
  const { enabled = true, onStatusChange, onSuccess, onError, onComplete } = options;

  const { getQueryResult, getConnectionStatus, isQueryRunning } = useSSEStore();
  const handlerRef = useRef<SSEMessageHandler | null>(null);

  const result = getQueryResult(queryId);
  const connectionStatus = getConnectionStatus();

  const startStream = useCallback(async () => {
    if (!queryId || !enabled) {
      return;
    }

    try {
      // Ensure global connection is established
      await sseConnectionManager.connect();

      // Track this query
      sseConnectionManager.trackQuery(queryId);

      // Set up message handler for callbacks
      const handler: SSEMessageHandler = {
        onQueryResult: (receivedQueryId, queryResult) => {
          if (receivedQueryId === queryId) {
            // Call optional callbacks
            if (onStatusChange) {
              onStatusChange(queryId, queryResult.status);
            }

            if (queryResult.status === "success" && queryResult.data && onSuccess) {
              onSuccess(queryId, queryResult.data);
            }

            if (queryResult.status === "error" && queryResult.error && onError) {
              onError(queryId, queryResult.error);
            }

            if (
              (queryResult.status === "success" || queryResult.status === "error") &&
              onComplete
            ) {
              onComplete(queryId, queryResult);
            }
          }
        },
        onError: (error) => {
          if (onError) {
            onError(queryId, error);
          }
        }
      };

      handlerRef.current = handler;
      sseConnectionManager.addMessageHandler(handler);
    } catch (error) {
      if (onError) {
        onError(queryId, error instanceof Error ? error.message : "Connection failed");
      }
    }
  }, [queryId, enabled, onStatusChange, onSuccess, onError, onComplete]);

  const stopStream = useCallback(() => {
    if (!queryId) return;

    // Remove message handler
    if (handlerRef.current) {
      sseConnectionManager.removeMessageHandler(handlerRef.current);
      handlerRef.current = null;
    }

    // Stop tracking this query
    sseConnectionManager.untrackQuery(queryId);
  }, [queryId]);

  // Auto-start stream if enabled
  useEffect(() => {
    if (enabled && queryId) {
      startStream();
    }

    return () => {
      // Cleanup on unmount
      stopStream();
    };
  }, [enabled, queryId, startStream, stopStream]);

  return {
    result,
    connectionStatus,
    isRunning: isQueryRunning(queryId),
    hasActiveConnection: sseConnectionManager.isConnected(),
    startStream,
    stopStream
  };
}

/**
 * Tab-aware version that only streams when tab is active
 */
export function useTabAwareQueryStream(
  queryId: string,
  isTabActive: boolean,
  options: UseQueryStreamOptions = {}
): UseQueryStreamReturn {
  const stream = useQueryStream(queryId, {
    ...options,
    enabled: isTabActive && options.enabled !== false
  });

  return stream;
}

/**
 * Hook for managing multiple query streams efficiently
 */
export function useMultipleQueryStreams(
  queryIds: string[],
  options: UseQueryStreamOptions = {}
): Record<string, UseQueryStreamReturn> {
  const streams: Record<string, UseQueryStreamReturn> = {};

  queryIds.forEach((queryId) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    streams[queryId] = useQueryStream(queryId, options);
  });

  return streams;
}

/**
 * Simplified hook that just returns the current query result without managing streams
 * Useful for components that only need to read the current state
 */
export function useQueryResult(queryId: string): QueryResult | undefined {
  const { getQueryResult } = useSSEStore();
  return getQueryResult(queryId);
}

/**
 * Hook for checking the global SSE connection status
 */
export function useSSEConnectionStatus() {
  const { getConnectionStatus } = useSSEStore();

  return {
    status: getConnectionStatus(),
    isConnected: sseConnectionManager.isConnected(),
    connect: () => sseConnectionManager.connect(),
    disconnect: () => sseConnectionManager.disconnect()
  };
}
