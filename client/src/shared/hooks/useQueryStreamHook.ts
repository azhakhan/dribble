import { useEffect, useCallback, useRef } from "react";
import { useSSEStore } from "@/shared/store/useSSEStore";
import type { QueryResult } from "@/shared/store/useSSEStore";
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
  connectionStatus: "connecting" | "connected" | "closed" | "error" | "disconnected";
  isRunning: boolean;
  hasActiveConnection: boolean;
  startStream: () => void;
  stopStream: () => void;
}

/**
 * Hook for streaming query execution results via SSE
 * Automatically manages EventSource connections and stores results in Zustand
 */
export function useQueryStream(
  queryId: string,
  options: UseQueryStreamOptions = {}
): UseQueryStreamReturn {
  const { enabled = true, onStatusChange, onSuccess, onError, onComplete } = options;

  const {
    addConnection,
    updateConnectionStatus,
    updateQueryStatus,
    closeConnection,
    getQueryResult,
    getConnectionStatus,
    isQueryRunning,
    hasActiveConnection
  } = useSSEStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const result = getQueryResult(queryId);
  const connectionStatus = getConnectionStatus(queryId);

  const startStream = useCallback(() => {
    if (!queryId || hasActiveConnection(queryId)) {
      return;
    }

    console.log(`🔗 Starting SSE stream for query: ${queryId}`);

    try {
      const eventSource = new EventSource(`/api/stream/query-results/${queryId}`);
      eventSourceRef.current = eventSource;

      // Add connection to store
      addConnection(queryId, eventSource);

      eventSource.onopen = () => {
        console.log(`✅ SSE connection opened for query: ${queryId}`);
        updateConnectionStatus(queryId, "connected");
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 SSE message for query ${queryId}:`, data);

          const { status, data: queryData, error, timestamp } = data;

          // Update query status in store
          updateQueryStatus(queryId, status, queryData, error);

          // Call optional callbacks
          if (onStatusChange) {
            onStatusChange(queryId, status);
          }

          if (status === "success" && queryData && onSuccess) {
            onSuccess(queryId, queryData);
          }

          if (status === "error" && error && onError) {
            onError(queryId, error);
          }

          // If query is complete (success or error), close the connection
          if (status === "success" || status === "error") {
            console.log(`🏁 Query ${queryId} completed with status: ${status}`);
            if (onComplete) {
              onComplete(queryId, { queryId, status, timestamp, data: queryData, error });
            }
            stopStream();
          }
        } catch (parseError) {
          console.error(`❌ Error parsing SSE message for query ${queryId}:`, parseError);
        }
      };

      eventSource.addEventListener("close", () => {
        console.log(`🔒 SSE stream closed for query: ${queryId}`);
        stopStream();
      });

      eventSource.addEventListener("heartbeat", () => {
        // Just acknowledge heartbeat - keeps connection alive
        console.debug(`💓 Heartbeat received for query: ${queryId}`);
      });

      eventSource.onerror = (error) => {
        console.error(`❌ SSE error for query ${queryId}:`, error);
        updateConnectionStatus(queryId, "error");

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s
          reconnectAttempts.current++;

          console.log(
            `🔄 Reconnecting SSE for query ${queryId} in ${delay}ms (attempt ${reconnectAttempts.current})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            stopStream();
            startStream();
          }, delay);
        } else {
          console.error(`💥 Max reconnection attempts reached for query ${queryId}`);
          stopStream();
        }
      };
    } catch (error) {
      console.error(`❌ Failed to create SSE connection for query ${queryId}:`, error);
      updateConnectionStatus(queryId, "error");
    }
  }, [
    queryId,
    hasActiveConnection,
    addConnection,
    updateConnectionStatus,
    updateQueryStatus,
    onStatusChange,
    onSuccess,
    onError,
    onComplete
  ]);

  const stopStream = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    closeConnection(queryId);
    console.log(`🛑 Stopped SSE stream for query: ${queryId}`);
  }, [queryId, closeConnection]);

  // Auto-start stream when enabled
  useEffect(() => {
    if (enabled && queryId) {
      startStream();
    }

    return () => {
      if (!enabled) {
        stopStream();
      }
    };
  }, [enabled, queryId, startStream, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    result,
    connectionStatus,
    isRunning: isQueryRunning(queryId),
    hasActiveConnection: hasActiveConnection(queryId),
    startStream,
    stopStream
  };
}

/**
 * Hook for managing multiple query streams efficiently
 * Useful for query tabs or when multiple queries need to be monitored
 */
export function useMultipleQueryStreams(
  queryIds: string[],
  options: UseQueryStreamOptions = {}
): Record<string, UseQueryStreamReturn> {
  const results: Record<string, UseQueryStreamReturn> = {};

  queryIds.forEach((queryId) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[queryId] = useQueryStream(queryId, options);
  });

  return results;
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
 * Hook for managing query stream lifecycle based on tab visibility
 * Automatically starts/stops streams when tabs become active/inactive
 */
export function useTabAwareQueryStream(
  queryId: string,
  isTabActive: boolean,
  options: UseQueryStreamOptions = {}
): UseQueryStreamReturn {
  return useQueryStream(queryId, {
    ...options,
    enabled: options.enabled !== false && isTabActive
  });
}
