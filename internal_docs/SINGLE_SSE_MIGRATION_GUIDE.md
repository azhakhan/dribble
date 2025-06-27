# Single SSE Connection Migration Guide

## 🎯 Overview

This guide explains the migration from individual SSE connections per query to a single multiplexed SSE connection per client session. This change dramatically improves performance and solves browser connection limit issues.

## 🚨 Key Changes

### Before: One Connection Per Query ❌

- Each query created its own `EventSource(/stream/query-results/{queryId})`
- Browser connection limits (6-8 per domain) quickly exhausted
- High server resource usage
- Complex connection management

### After: Single Multiplexed Connection ✅

- One `EventSource(/stream/events)` per client
- All query results multiplexed through single connection
- No browser connection limits
- Simplified connection management

## 📋 Migration Checklist

### ✅ Server-Side Changes (Completed)

- [x] **New endpoint**: `/stream/events` replaces `/stream/query-results/{queryId}`
- [x] **Message format**: Added `query_id` field for multiplexing
- [x] **Client sessions**: Track active client connections
- [x] **Heartbeat system**: Keep connections alive
- [x] **Backward compatibility**: Old endpoints still exist (for now)

### ✅ Client-Side Changes (Completed)

- [x] **New connection manager**: `SSEConnectionManager` singleton
- [x] **Updated Zustand store**: Single connection state model
- [x] **Refactored hooks**: Same API, different implementation
- [x] **Enhanced query service**: Auto-connects to SSE
- [x] **Demo component**: Shows new functionality

## 🔧 Technical Implementation

### 1. Server Endpoint Change

**Old Endpoint:**

```
GET /stream/query-results/{query_id}
```

**New Endpoint:**

```
GET /stream/events?client_id=optional
```

### 2. Message Format

**Old Format:**

```json
{
  "status": "success",
  "data": [...],
  "timestamp": 1234567890
}
```

**New Format:**

```json
{
  "type": "query_result",
  "query_run_id": "query-run-uuid",
  "status": "success",
  "data": [...],
  "timestamp": 1234567890
}
```

### 3. Connection Management

**Old Way:**

```typescript
// Each query creates its own connection
const eventSource = new EventSource(`/api/stream/query-results/${queryId}`);
```

**New Way:**

```typescript
// Single connection manager handles all queries
await sseConnectionManager.connect();
sseConnectionManager.trackQuery(queryId);
```

## 🔄 How to Use the New System

### 1. Basic Query Streaming (No Changes)

Your existing code continues to work:

```typescript
const { result, isRunning } = useQueryStream(queryRunId, {
  onSuccess: (queryId, data) => {
    console.log(`Query ${queryId} completed with ${data.length} rows`);
  },
  onError: (queryId, error) => {
    console.error(`Query ${queryId} failed:`, error);
  }
});
```

### 2. Query Execution (Enhanced)

Query execution now automatically establishes SSE connection:

```typescript
// This automatically connects to SSE and tracks the query
const result = await QueryExecutionServiceSSE.executeQuery(tab);

if (result.success && result.queryRunId) {
  // The query is now being tracked by the global SSE connection
  console.log(`Query started: ${result.queryRunId}`);
}
```

### 3. Connection Status Monitoring (New)

You can now monitor the global connection:

```typescript
const { status, isConnected, connect, disconnect } = useSSEConnectionStatus();

// Connection status: "connecting" | "connected" | "disconnected" | "error"
console.log(`SSE Status: ${status}`);

// Manually control connection if needed
if (!isConnected) {
  await connect();
}
```

### 4. Multiple Queries (Improved)

Execute multiple queries through single connection:

```typescript
// All queries will use the same SSE connection
const streams = useMultipleQueryStreams(["query-1", "query-2", "query-3"], {
  onComplete: (queryId, result) => {
    console.log(`Query ${queryId} completed`);
  }
});
```

## 🚀 Performance Benefits

### Connection Efficiency

- **Before**: 10 queries = 10 connections
- **After**: 10 queries = 1 connection
- **Improvement**: 90% reduction in browser connections

### Server Resources

- **Before**: High memory and CPU per connection
- **After**: Shared resources for all queries
- **Improvement**: Significant server resource savings

### Browser Limits

- **Before**: Hit 6-8 connection limit quickly
- **After**: Never hit browser limits
- **Improvement**: Unlimited concurrent queries

## 🛠️ Debugging & Monitoring

### 1. Browser DevTools

**Network Tab:**

- Look for single `/stream/events` connection instead of multiple `/stream/query-results/*`
- Connection should stay open indefinitely

**Console:**

```
🔗 Starting global SSE connection...
✅ Global SSE connection opened
🎉 Connected with client ID: client-abc123
🔍 Now tracking query: query-run-uuid
📨 SSE message received: {type: "query_result", query_run_id: "...", status: "success"}
🏁 Query query-run-uuid completed with status: success
```

### 2. React DevTools

**Zustand Store State:**

```javascript
{
  connection: {
    clientId: "client-abc123",
    eventSource: EventSource,
    status: "connected",
    lastMessageTime: 1234567890,
    reconnectAttempts: 0
  },
  activeQueries: Set(["query-1", "query-2"]),
  queryResults: {
    "query-1": { status: "success", data: [...] },
    "query-2": { status: "running" }
  }
}
```

### 3. Debug Endpoints

**Check active queries:**

```
GET /api/stream/active-queries
```

**Check active clients:**

```
GET /api/stream/active-clients
```

## 🚨 Troubleshooting

### Connection Issues

**Problem**: SSE connection not establishing

```typescript
// Check connection status
const { status, connect } = useSSEConnectionStatus();
if (status === "disconnected") {
  await connect();
}
```

**Problem**: Queries not receiving updates

```typescript
// Verify query is being tracked
const { activeQueries } = useSSEStore();
console.log("Active queries:", Array.from(activeQueries));
```

**Problem**: Page reload breaks connection

```typescript
// This is handled automatically, but you can monitor:
window.addEventListener("beforeunload", () => {
  console.log("Page unloading, SSE will cleanup automatically");
});
```

### Performance Issues

**Problem**: Memory leaks from query results

```typescript
// Clear old results when no longer needed
const { clearQueryResult } = useSSEStore();
clearQueryResult(oldQueryId);
```

**Problem**: Too many reconnection attempts

```typescript
// Connection manager has built-in exponential backoff
// Max 5 attempts with increasing delays: 1s, 2s, 4s, 8s, 16s
```

## 📈 Monitoring & Analytics

### Key Metrics to Track

1. **Connection Success Rate**

   - Monitor successful SSE connections vs failures
   - Track reconnection frequency

2. **Query Response Times**

   - Compare before/after migration
   - Should see improved consistency

3. **Browser Performance**

   - Monitor connection count in browser
   - Track memory usage

4. **Server Resources**
   - Monitor connection pool usage
   - Track CPU and memory consumption

### Logging

**Client-side:**

```typescript
// Enable debug logging
localStorage.setItem("debug", "sse:*");

// Or monitor specific events
sseConnectionManager.addMessageHandler({
  onQueryResult: (queryId, result) => {
    analytics.track("sse_query_result", {
      queryId,
      status: result.status,
      duration: Date.now() - result.timestamp
    });
  }
});
```

**Server-side:**

```python
# Monitor active connections
logger.info(f"Active SSE clients: {len(active_client_sessions)}")

# Track message volume
logger.debug(f"Sent multiplexed message for query {query_id}: {message['status']}")
```

## 🎯 Best Practices

### 1. Connection Lifecycle

- Let the system manage connections automatically
- Don't manually disconnect unless necessary
- Monitor connection status for debugging

### 2. Query Management

- Use `useTabAwareQueryStream` for tab-specific queries
- Clean up query results when components unmount
- Leverage connection status for error handling

### 3. Error Handling

```typescript
const stream = useQueryStream(queryId, {
  onError: (queryId, error) => {
    // Handle query-specific errors
    showErrorNotification(error);
  }
});

const { status } = useSSEConnectionStatus();
if (status === "error") {
  // Handle connection-level errors
  showConnectionError();
}
```

### 4. Performance Optimization

- Use `useQueryResult` for read-only access
- Implement proper cleanup in useEffect
- Monitor active query count

## 🎉 Success Metrics

After migration, you should see:

- ✅ **Reduced connection count**: 1 connection instead of N queries
- ✅ **Better performance**: Faster query result delivery
- ✅ **No connection limits**: Ability to run many concurrent queries
- ✅ **Improved stability**: More reliable connection management
- ✅ **Better debugging**: Centralized connection monitoring

## 🚀 Next Steps

1. **Monitor the migration**: Watch for any issues in production
2. **Optimize further**: Fine-tune heartbeat intervals and reconnection logic
3. **Clean up old code**: Remove deprecated per-query connection code
4. **Enhance features**: Add query prioritization, connection pooling, etc.

The single SSE connection system is a major architectural improvement that provides better performance, reliability, and developer experience! 🎉
