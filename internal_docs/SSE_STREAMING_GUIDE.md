# SSE Status Streaming Guide

This guide explains the simplified real-time task status streaming system using Server-Sent Events (SSE).

## Overview

The simplified system consists of:

1. **Workers** publish only status updates to Redis pub/sub channels (no data)
2. **Server** subscribes to status channels and stores latest status per task
3. **SSE endpoint** streams only status updates to clients
4. **Clients** fetch actual data separately via REST API when needed

## Architecture

```
Worker (PostgreSQL/MySQL/etc)
    ↓ (publishes status to Redis)
Redis Pub/Sub Channel: task_status:{task_id}
    ↓ (background subscriber)
Server In-Memory Status Storage
    ↓ (SSE streaming - status only)
Client (JavaScript EventSource)
    ↓ (on success, fetch data separately)
REST API: GET /api/tasks/{task_id}/result
```

## Redis Pub/Sub Channels

### Channel Format

- `task_status:{task_id}` - for all task types (execute, test_db, connect, etc.)

### Message Format

**Status messages (via pub/sub):**

```json
{
  "task_id": "uuid-here",
  "status": "running" | "success" | "error" | "cancelled",
  "task_type": "execute" | "test_db" | "connect" | "schema" | "disconnect",
  "timestamp": 1234567890.123,
  "error": "message"  // Only present on error
}
```

**Full results (via REST API):**

```json
{
  "status": "success",
  "data": [...],  // Full query results
  "execution_time_ms": 150
}
```

## SSE Endpoint

### Stream Task Status Updates

```
GET /api/stream/events?client_id=optional
```

**Response**: Server-Sent Events stream

- `data:` events contain task status updates only
- `event: heartbeat` to keep connection alive (every 30 seconds)
- `event: error` on streaming errors

**Event Types:**

- `connection` - Initial connection confirmation
- `task_status` - Task status update
- `heartbeat` - Keep-alive ping
- `error` - Stream error

## Usage Pattern

### JavaScript Example

```javascript
// Start SSE connection for status updates
const eventSource = new EventSource("/api/stream/events");

eventSource.onmessage = function (event) {
  const message = JSON.parse(event.data);

  if (message.type === "task_status") {
    console.log(`Task ${message.task_id}: ${message.status}`);

    if (message.status === "success") {
      // Fetch actual data separately
      fetchTaskResult(message.task_id);
    } else if (message.status === "error") {
      console.error(`Task failed: ${message.error}`);
    }
  }
};

// Separate function to fetch task results
async function fetchTaskResult(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/result`);
    const result = await response.json();
    console.log("Task data:", result.data);
  } catch (error) {
    console.error("Failed to fetch result:", error);
  }
}
```

### React Hook Example

```typescript
import { useEffect, useState } from "react";

interface TaskStatus {
  task_id: string;
  status: string;
  task_type: string;
  error?: string;
}

export function useSSETaskUpdates() {
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});

  useEffect(() => {
    const eventSource = new EventSource("/api/stream/events");

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "task_status") {
        setTaskStatuses((prev) => ({
          ...prev,
          [message.task_id]: message
        }));
      }
    };

    return () => eventSource.close();
  }, []);

  return taskStatuses;
}
```

## Benefits of Simplified System

1. **Lightweight**: No large data sent via SSE, only status updates
2. **Memory Efficient**: Server only stores latest status per task
3. **Separation of Concerns**: Status updates via SSE, data via REST
4. **Scalable**: Minimal memory usage in Redis subscriber
5. **Simple**: Easy to understand and maintain

## Task Result Endpoint

### Get Task Results

```
GET /api/tasks/{task_id}/result
```

**Response**:

- **200**: Task completed successfully with data
- **404**: Task not found
- **500**: Server error

**Success Response**:

```json
{
  "status": "success",
  "data": [...],
  "execution_time_ms": 150
}
```

**Error Response**:

```json
{
  "status": "error",
  "error": "Connection failed"
}
```

## Migration from Old System

### Before (Complex SSE)

- SSE streamed both status and data
- Complex filtering by task types and IDs
- Memory-intensive message storage
- Backward compatibility concerns

### After (Simplified SSE)

- SSE streams only status updates
- Simple status-only messages
- Minimal memory usage
- Clear separation of status vs data

## Configuration

### Memory Usage

```python
# Only stores latest status per task (minimal memory)
class TaskStatusSubscriber:
    def __init__(self):
        self.task_status: Dict[str, dict] = {}  # Only latest status
```

### Heartbeat

```python
# Heartbeat every 30 seconds to keep connections alive
heartbeat_interval = 30  # seconds
```

This simplified approach makes the system much easier to understand, maintain, and scale.
