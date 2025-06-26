import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useQueryStream,
  useTabAwareQueryStream,
  useQueryResult
} from "@/shared/hooks/useQueryStreamHook";
import { QueryExecutionServiceSSE } from "@/shared/services/QueryExecutionServiceSSE";
import type { QueryTab } from "@/shared/store/types";

interface QueryExecutionDemoProps {
  tab: QueryTab;
  isTabActive: boolean;
}

/**
 * Demo component showing how to use SSE streaming for query execution
 * This replaces the old polling approach with real-time streaming
 */
export function QueryExecutionDemo({ tab, isTabActive }: QueryExecutionDemoProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentQueryRunId, setCurrentQueryRunId] = useState<string | null>(null);

  // Example 1: Basic SSE streaming hook with callbacks
  const queryStream = useQueryStream(currentQueryRunId || "", {
    enabled: !!currentQueryRunId,
    onStatusChange: (queryId, status) => {
      console.log(`🔄 Query ${queryId} status changed to: ${status}`);
    },
    onSuccess: (queryId, data) => {
      console.log(`✅ Query ${queryId} completed successfully with ${data.length} rows`);
      setIsExecuting(false);
    },
    onError: (queryId, error) => {
      console.error(`❌ Query ${queryId} failed:`, error);
      setIsExecuting(false);
    },
    onComplete: (queryId, result) => {
      console.log(`🏁 Query ${queryId} completed:`, result);
    }
  });

  // Example 2: Tab-aware streaming (starts/stops based on tab visibility)
  const tabAwareStream = useTabAwareQueryStream(currentQueryRunId || "", isTabActive, {
    onStatusChange: (queryId, status) => {
      console.log(`📱 Tab-aware: Query ${queryId} status: ${status}`);
    }
  });

  // Example 3: Simple result reader (no stream management)
  const currentResult = useQueryResult(currentQueryRunId || "");

  const executeQuery = async () => {
    if (!tab) return;

    setIsExecuting(true);

    try {
      // Start query execution - this returns immediately with a run ID
      const result = await QueryExecutionServiceSSE.executeQuery(tab);

      if (result.success && result.queryRunId) {
        setCurrentQueryRunId(result.queryRunId);
        console.log(`🚀 Started query execution with run ID: ${result.queryRunId}`);

        // The SSE hook will automatically start streaming results
        // No need to poll - results will come via the stream!
      } else {
        console.error("❌ Failed to start query:", result.error);
        setIsExecuting(false);
      }
    } catch (error) {
      console.error("❌ Query execution error:", error);
      setIsExecuting(false);
    }
  };

  const stopQuery = () => {
    if (currentQueryRunId) {
      queryStream.stopStream();
      setCurrentQueryRunId(null);
      setIsExecuting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-yellow-500";
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "connecting":
        return "bg-blue-500";
      case "connected":
        return "bg-green-400";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🔄 SSE Query Execution Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Execution Controls */}
          <div className="flex gap-2">
            <Button
              onClick={executeQuery}
              disabled={isExecuting}
              className="flex items-center gap-2"
            >
              {isExecuting ? "⏳ Executing..." : "▶️ Execute Query"}
            </Button>

            {isExecuting && (
              <Button onClick={stopQuery} variant="outline" className="flex items-center gap-2">
                ⏹️ Stop
              </Button>
            )}
          </div>

          {/* Query Run Info */}
          {currentQueryRunId && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                Query Run ID: <code className="bg-gray-100 px-1 rounded">{currentQueryRunId}</code>
              </div>

              <div className="text-sm text-gray-600">
                Tab Active:{" "}
                <Badge variant={isTabActive ? "default" : "secondary"}>
                  {isTabActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="text-sm font-medium">Main Stream</div>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-2 h-2 rounded-full ${getStatusColor(queryStream.connectionStatus)}`}
                />
                <span className="text-sm">{queryStream.connectionStatus}</span>
              </div>
              {queryStream.result && (
                <div className="text-xs text-gray-500 mt-1">
                  Status: {queryStream.result.status}
                </div>
              )}
            </Card>

            <Card className="p-3">
              <div className="text-sm font-medium">Tab-Aware Stream</div>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-2 h-2 rounded-full ${getStatusColor(
                    tabAwareStream.connectionStatus
                  )}`}
                />
                <span className="text-sm">{tabAwareStream.connectionStatus}</span>
              </div>
              {tabAwareStream.result && (
                <div className="text-xs text-gray-500 mt-1">
                  Status: {tabAwareStream.result.status}
                </div>
              )}
            </Card>
          </div>

          {/* Query Results */}
          {currentResult && (
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">Query Result</div>
              <div className="space-y-1 text-xs">
                <div>
                  Status:{" "}
                  <Badge className={getStatusColor(currentResult.status)}>
                    {currentResult.status}
                  </Badge>
                </div>
                <div>Timestamp: {new Date(currentResult.timestamp).toLocaleTimeString()}</div>
                {currentResult.data && <div>Rows: {currentResult.data.length}</div>}
                {currentResult.error && (
                  <div className="text-red-600">Error: {currentResult.error}</div>
                )}
              </div>
            </Card>
          )}

          {/* Benefits Display */}
          <Card className="p-3 bg-green-50">
            <div className="text-sm font-medium text-green-800 mb-2">✨ SSE Benefits</div>
            <ul className="text-xs text-green-700 space-y-1">
              <li>🚀 Instant updates (no 500ms polling delay)</li>
              <li>📡 Real-time status changes</li>
              <li>🔋 Reduced server load</li>
              <li>📱 Tab-aware streaming</li>
              <li>🔄 Automatic reconnection</li>
              <li>💾 State stored in Zustand</li>
            </ul>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Hook for integrating SSE streaming with existing query execution flow
 * This can be used to migrate existing components gradually
 */
export function useSSEQueryExecution(tab: QueryTab, isTabActive: boolean = true) {
  const [queryRunId, setQueryRunId] = useState<string | null>(null);

  const queryStream = useTabAwareQueryStream(queryRunId || "", isTabActive, {
    onComplete: (queryId, result) => {
      // Automatically refresh query store data when execution completes
      if (result.status === "success" && tab.queryId) {
        QueryExecutionServiceSSE.refreshQueryData(tab.queryId);
      }
    }
  });

  const executeQuery = async (options = {}) => {
    const result = await QueryExecutionServiceSSE.executeQuery(tab, options);

    if (result.success && result.queryRunId) {
      setQueryRunId(result.queryRunId);
      return { success: true, queryRunId: result.queryRunId };
    }

    return { success: false, error: result.error };
  };

  const stopExecution = () => {
    if (queryRunId) {
      queryStream.stopStream();
      setQueryRunId(null);
    }
  };

  return {
    executeQuery,
    stopExecution,
    queryRunId,
    result: queryStream.result,
    connectionStatus: queryStream.connectionStatus,
    isRunning: queryStream.isRunning,
    hasActiveConnection: queryStream.hasActiveConnection
  };
}
