# Redis Pub/Sub + SSE Streaming Guide

This guide explains how to use the new real-time query execution streaming system that replaces polling with Server-Sent Events (SSE).

## Overview

The system consists of:

1. **Workers** publish query results to Redis pub/sub channels
2. **Server** subscribes to these channels and stores messages in memory
3. **SSE endpoints** stream results to clients in real-time
4. **Client** receives instant updates instead of polling

## Architecture

```
Worker (PostgreSQL/MySQL)
    ↓ (publishes to Redis)
Redis Pub/Sub Channel: query_results:{query_id}
    ↓ (background subscriber)
Server In-Memory Storage
    ↓ (SSE streaming)
Client (JavaScript EventSource)
```

## Redis Pub/Sub Channels

### Channel Format

- `query_results:{query_run_id}` - for both `/execute/` and `/execute/version` endpoints

All query results are now published using query_run_id for consistency.

### Message Format

```json
{
  "query_run_id": "uuid-here",
  "status": "running" | "success" | "error",
  "timestamp": 1234567890.123,
  "data": [...],      // Only present on success
  "error": "message"  // Only present on error
}
```

## SSE Endpoints

### 1. Stream Query Results

```
GET /stream/query-results/{query_id}?last_timestamp=optional
```

**Response**: Server-Sent Events stream

- `data:` events contain query status updates
- `event: close` when query completes (success/error)
- `event: heartbeat` to keep connection alive
- `event: error` on streaming errors

**Example Usage**:

```javascript
const eventSource = new EventSource(`/stream/query-results/${queryId}`);

eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log("Query status:", data.status);

  if (data.status === "success") {
    console.log("Results:", data.data);
  } else if (data.status === "error") {
    console.error("Query failed:", data.error);
  }
};

eventSource.addEventListener("close", function (event) {
  console.log("Query completed, closing stream");
  eventSource.close();
});
```

### 2. Get Query Status (Non-streaming)

```
GET /stream/query-status/{query_id}
```

**Response**:

```json
{
  "query_id": "uuid",
  "status": "running" | "success" | "error" | "not_found",
  "timestamp": 1234567890.123,
  "has_data": true,
  "has_error": false
}
```

### 3. List Active Queries

```
GET /stream/active-queries
```

**Response**:

```json
{
  "active_queries": [
    {
      "query_id": "uuid1",
      "status": "running",
      "timestamp": 1234567890.123
    }
  ],
  "total_count": 1
}
```

## Replacing Polling with SSE

### Before (Polling)

```javascript
// ❌ Old polling approach
async function pollForResults(runId) {
  while (true) {
    const response = await fetch(`/execution/run-results/${runId}`);
    if (response.status === 200) {
      return await response.json();
    } else if (response.status === 500) {
      throw new Error("Query failed");
    }
    // Status 202 = still running, continue polling
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
```

### After (SSE)

```javascript
// ✅ New SSE approach
function streamQueryResults(queryId) {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`/stream/query-results/${queryId}`);

    eventSource.onmessage = function (event) {
      const data = JSON.parse(event.data);

      if (data.status === "success") {
        eventSource.close();
        resolve(data.data);
      } else if (data.status === "error") {
        eventSource.close();
        reject(new Error(data.error));
      }
      // 'running' status: just wait for next message
    };

    eventSource.onerror = function (event) {
      eventSource.close();
      reject(new Error("Stream connection failed"));
    };
  });
}
```

## Benefits

1. **Instant Updates**: No 500ms polling delay
2. **Reduced Server Load**: No repeated HTTP requests
3. **Better UX**: Real-time progress updates
4. **Efficient**: Single connection per query
5. **Reliable**: Automatic reconnection on failures

## Configuration

### Memory Management

The system stores up to 100 messages per query in memory (configurable):

```python
# In redis_subscriber.py
subscriber = QueryResultsSubscriber(max_messages_per_query=100)
```

### Connection Timeouts

SSE connections include heartbeats to prevent browser timeouts:

```python
# Heartbeat sent every 1 second during streaming
yield f"event: heartbeat\ndata: ping\n\n"
```

## Testing

Run the test script to verify everything works:

```bash
cd server
python test_redis_pubsub.py
```

## Troubleshooting

### Common Issues

1. **No messages received**

   - Check Redis connection
   - Verify worker is publishing to correct channels
   - Check server logs for subscriber errors

2. **SSE connection drops**

   - Browser may timeout long connections
   - Check for firewall/proxy issues
   - Verify heartbeat messages are sent

3. **Memory usage**
   - Monitor in-memory message storage
   - Adjust `max_messages_per_query` if needed
   - Messages auto-expire when queries complete

### Debug Endpoints

- `GET /stream/active-queries` - See what queries have messages
- `GET /stream/query-status/{id}` - Check individual query status
- Check server logs for Redis subscriber activity

## Migration Guide

1. Replace polling loops with SSE EventSource
2. Handle three status types: running, success, error
3. Close EventSource when query completes
4. Add error handling for connection failures
5. Test with real query executions

This system provides instant, efficient real-time updates for query execution results! 🚀
