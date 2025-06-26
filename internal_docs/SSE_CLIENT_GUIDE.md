# SSE Streaming Client Guide

This guide shows how to use the new Server-Sent Events (SSE) streaming system in the Dribble client to replace polling with real-time query execution updates.

## 🚀 Quick Start

### 1. Basic Query Streaming

Replace the old polling approach with real-time streaming:

```typescript
import { useQueryStream } from "@/shared/hooks/useQueryStreamHook";
import { QueryExecutionServiceSSE } from "@/shared/services/QueryExecutionServiceSSE";

function QueryComponent({ tab }: { tab: QueryTab }) {
  const [queryRunId, setQueryRunId] = useState<string | null>(null);

  // Hook automatically manages SSE connection and stores results in Zustand
  const { result, connectionStatus, isRunning, startStream, stopStream } = useQueryStream(
    queryRunId || "",
    {
      onSuccess: (queryId, data) => {
        console.log(`✅ Query completed with ${data.length} rows`);
      },
      onError: (queryId, error) => {
        console.error(`❌ Query failed: ${error}`);
      }
    }
  );

  const executeQuery = async () => {
    // Start execution - returns immediately with run ID
    const execution = await QueryExecutionServiceSSE.executeQuery(tab);

    if (execution.success && execution.queryRunId) {
      setQueryRunId(execution.queryRunId);
      // SSE hook automatically starts streaming!
    }
  };

  return (
    <div>
      <button onClick={executeQuery} disabled={isRunning}>
        {isRunning ? "⏳ Running..." : "▶️ Execute"}
      </button>

      {result && (
        <div>
          Status: {result.status}
          {result.data && <div>Rows: {result.data.length}</div>}
          {result.error && <div>Error: {result.error}</div>}
        </div>
      )}
    </div>
  );
}
```

### 2. Tab-Aware Streaming

Automatically start/stop streams based on tab visibility:

```typescript
import { useTabAwareQueryStream } from "@/shared/hooks/useQueryStreamHook";

function QueryTab({ tab, isActive }: { tab: QueryTab; isActive: boolean }) {
  const [queryRunId, setQueryRunId] = useState<string | null>(null);

  // Only streams when tab is active - automatically stops when inactive
  const queryStream = useTabAwareQueryStream(queryRunId || "", isActive, {
    onStatusChange: (queryId, status) => {
      // Real-time status updates only when tab is visible
      updateUI(status);
    }
  });

  // ... rest of component
}
```

### 3. Multiple Query Monitoring

Monitor multiple queries efficiently:

```typescript
import { useMultipleQueryStreams } from "@/shared/hooks/useQueryStreamHook";

function QueryDashboard({ queryRunIds }: { queryRunIds: string[] }) {
  const streams = useMultipleQueryStreams(queryRunIds, {
    onComplete: (queryId, result) => {
      showNotification(`Query ${queryId} completed`);
    }
  });

  return (
    <div>
      {queryRunIds.map(queryId => (
        <div key={queryId}>
          Query {queryId}: {streams[queryId]?.result?.status}
        </div>
      ))}
    </div>
  );
}
```

## 🔄 Migration from Polling

### Before: Polling Approach ❌

```typescript
// Old polling approach
const pollForResults = async (runId: string) => {
  while (true) {
    const response = await getQueryRunResults(runId);

    if (Array.isArray(response)) {
      return response; // Success
    }

    // Status 202 = still running, continue polling
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};
```

### After: SSE Streaming ✅

```typescript
// New SSE approach
const { result, isRunning } = useQueryStream(queryRunId, {
  onSuccess: (queryId, data) => {
    // Instant callback when query completes
    handleResults(data);
  }
});

// No polling loop needed! Results stream automatically
```

## 📚 API Reference

### useQueryStream Hook

```typescript
function useQueryStream(queryId: string, options?: UseQueryStreamOptions): UseQueryStreamReturn;
```

**Options:**

- `enabled?: boolean` - Enable/disable the stream
- `onStatusChange?: (queryId, status) => void` - Status change callback
- `onSuccess?: (queryId, data) => void` - Success callback
- `onError?: (queryId, error) => void` - Error callback
- `onComplete?: (queryId, result) => void` - Completion callback

**Returns:**

- `result: QueryResult | undefined` - Current query result
- `connectionStatus: string` - SSE connection status
- `isRunning: boolean` - Whether query is currently running
- `hasActiveConnection: boolean` - Whether SSE is connected
- `startStream: () => void` - Manually start streaming
- `stopStream: () => void` - Manually stop streaming

### useTabAwareQueryStream Hook

```typescript
function useTabAwareQueryStream(
  queryId: string,
  isTabActive: boolean,
  options?: UseQueryStreamOptions
): UseQueryStreamReturn;
```

Only streams when `isTabActive` is true. Automatically manages connection lifecycle.

### useQueryResult Hook

```typescript
function useQueryResult(queryId: string): QueryResult | undefined;
```

Simple hook to read current query result without managing streams.

### QueryExecutionServiceSSE

```typescript
class QueryExecutionServiceSSE {
  // Execute and return immediately with run ID
  static async executeQuery(
    tab: QueryTab,
    options?: QueryExecutionOptions
  ): Promise<QueryExecutionResult>;

  // Execute and wait for completion (for compatibility)
  static async executeQueryAndWait(
    tab: QueryTab,
    options?: QueryExecutionOptions,
    timeoutMs?: number
  ): Promise<QueryExecutionResult>;
}
```

## 🏪 Zustand Store Integration

Results are automatically stored in the SSE store:

```typescript
import { useSSEStore } from "@/shared/store/useSSEStore";

function SomeComponent() {
  const { queryResults, connections, getQueryResult } = useSSEStore();

  // Access any query result by ID
  const result = getQueryResult("some-query-id");

  // Get all active connections
  const activeQueries = Object.keys(connections);
}
```

## 🎯 Best Practices

### 1. Use Tab-Aware Streaming

```typescript
// ✅ Good: Only stream when tab is visible
const stream = useTabAwareQueryStream(queryId, isTabActive);

// ❌ Avoid: Streaming when tab is not visible
const stream = useQueryStream(queryId, { enabled: true });
```

### 2. Handle Connection States

```typescript
const { connectionStatus, result } = useQueryStream(queryId);

// Show appropriate UI based on connection status
if (connectionStatus === "connecting") {
  return <div>🔄 Connecting...</div>;
}

if (connectionStatus === "error") {
  return <div>❌ Connection failed</div>;
}

if (result?.status === "running") {
  return <div>⏳ Query running...</div>;
}
```

### 3. Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    // Hooks automatically cleanup, but you can also manually stop
    stopStream();
  };
}, [stopStream]);
```

### 4. Use Callbacks for Actions

```typescript
const stream = useQueryStream(queryId, {
  onSuccess: (queryId, data) => {
    // ✅ Good: Use callbacks for side effects
    showSuccessNotification();
    refreshRelatedData();
  },
  onError: (queryId, error) => {
    showErrorMessage(error);
  }
});
```

## 🚫 Common Pitfalls

### 1. Multiple Hooks for Same Query

```typescript
// ❌ Don't do this - creates multiple connections
const stream1 = useQueryStream(queryId);
const stream2 = useQueryStream(queryId);

// ✅ Use one hook and pass data down
const stream = useQueryStream(queryId);
// Pass stream.result to child components
```

### 2. Forgetting Tab Awareness

```typescript
// ❌ Streams even when tab is hidden
const stream = useQueryStream(queryId, { enabled: true });

// ✅ Only streams when tab is visible
const stream = useTabAwareQueryStream(queryId, isTabActive);
```

### 3. Not Handling Errors

```typescript
// ❌ No error handling
const { result } = useQueryStream(queryId);

// ✅ Handle all states
const { result, connectionStatus } = useQueryStream(queryId, {
  onError: (queryId, error) => {
    handleError(error);
  }
});
```

## 🔧 Debugging

### Enable Debug Logging

```typescript
// Check browser console for SSE events
// Look for messages like:
// 🔗 Starting SSE stream for query: abc-123
// ✅ SSE connection opened for query: abc-123
// 📨 SSE message for query abc-123: {status: "success"}
```

### Monitor Store State

```typescript
// Check current state in React DevTools
import { useSSEStore } from "@/shared/store/useSSEStore";

function DebugPanel() {
  const { queryResults, connections } = useSSEStore();

  return (
    <div>
      <h3>Active Connections:</h3>
      <pre>{JSON.stringify(connections, null, 2)}</pre>

      <h3>Query Results:</h3>
      <pre>{JSON.stringify(queryResults, null, 2)}</pre>
    </div>
  );
}
```

### Check Network Tab

- Look for `/api/stream/query-results/{queryId}` connections
- Verify EventSource connections stay open
- Check for proper SSE message format

## 🎉 Benefits Summary

✅ **Instant Updates**: No 500ms polling delay  
✅ **Real-time UI**: Status changes immediately  
✅ **Efficient**: Single connection per query  
✅ **Tab-aware**: Automatic cleanup when tabs close  
✅ **Reliable**: Auto-reconnection on failures  
✅ **State Management**: Integrated with Zustand  
✅ **Type Safe**: Full TypeScript support  
✅ **Backward Compatible**: Gradual migration path

The SSE streaming system provides a much better user experience with instant query result updates while reducing server load and providing better resource management! 🚀
