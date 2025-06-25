# Error Handling Standardization Guide

This guide explains how to use the centralized `ErrorService` for consistent error handling throughout the Dribble application.

## Overview

The `ErrorService` provides a centralized way to handle errors with:

- **Consistent logging** with structured data and correlation IDs
- **User-friendly notifications** via toast messages
- **Context-aware error messages** based on operation type
- **Severity-based handling** for different error levels
- **Future monitoring integration** for production observability

## Quick Start

### Basic Usage

Replace existing error handling patterns:

```typescript
// ❌ Before (scattered pattern)
try {
  await someOperation();
} catch (error) {
  console.error("Operation failed:", error);
  toast.error("Operation failed");
}

// ✅ After (centralized pattern)
try {
  await someOperation();
} catch (error) {
  ErrorService.handle(error, ErrorContext.GENERAL, {
    userMessage: "Operation failed"
  });
}
```

### Context-Specific Methods

Use specialized methods for common error scenarios:

```typescript
// Query operations
ErrorService.handleQueryError(error, "execute query", {
  queryId: "123",
  sql: "SELECT * FROM users"
});

// Connection issues
ErrorService.handleConnectionError(error, sourceId, sourceName);

// Data loading failures
ErrorService.handleDataLoadingError(error, "user data", userId);

// Validation errors
ErrorService.handleValidationError(error, "email", emailValue);

// Unexpected errors
ErrorService.handleUnexpectedError(error, "user registration");
```

## Error Contexts

Use appropriate contexts for different parts of the application:

- `ErrorContext.QUERY_EXECUTION` - SQL query execution, query running
- `ErrorContext.QUERY_SAVING` - Query saving, version management
- `ErrorContext.SOURCE_CONNECTION` - Database connections, source management
- `ErrorContext.DATA_LOADING` - Loading queries, results, schemas
- `ErrorContext.FILE_OPERATIONS` - File upload/download, import/export
- `ErrorContext.NAVIGATION` - Route changes, tab management
- `ErrorContext.AUTHENTICATION` - Login, logout, session management
- `ErrorContext.GENERAL` - Fallback for other operations

## Error Severity Levels

Choose appropriate severity levels:

- `ErrorSeverity.LOW` - Validation errors, minor issues (shows warning toast)
- `ErrorSeverity.MEDIUM` - Failed operations that can be retried (shows error toast)
- `ErrorSeverity.HIGH` - Critical operations that affect functionality (shows error toast)
- `ErrorSeverity.CRITICAL` - System-level errors that require attention (shows error toast)

## Migration Examples

### React Components

```typescript
// Before
const handleSaveQuery = async () => {
  try {
    await saveQuery(queryId, content);
    toast.success("Query saved");
  } catch (error) {
    console.error("Failed to save query:", error);
    toast.error("Failed to save query");
  }
};

// After
const handleSaveQuery = async () => {
  try {
    await saveQuery(queryId, content);
    toast.success("Query saved");
  } catch (error) {
    ErrorService.handle(error, ErrorContext.QUERY_SAVING, {
      userMessage: "Failed to save query",
      technicalDetails: { queryId }
    });
  }
};
```

### Store Actions

```typescript
// Before
const loadData = async (id: string) => {
  try {
    const data = await fetchData(id);
    setState({ data });
  } catch (error) {
    console.error(`Failed to load data ${id}:`, error);
    setState({ error: error.message });
  }
};

// After
const loadData = async (id: string) => {
  try {
    const data = await fetchData(id);
    setState({ data });
  } catch (error) {
    ErrorService.handleDataLoadingError(error, "data", id);
    setState({ error: error.message });
  }
};
```

### Service Classes

```typescript
// Before
class ApiService {
  async request(endpoint: string) {
    try {
      return await fetch(endpoint);
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }
}

// After
class ApiService {
  async request(endpoint: string) {
    try {
      return await fetch(endpoint);
    } catch (error) {
      ErrorService.handle(error, ErrorContext.GENERAL, {
        userMessage: "Network request failed",
        technicalDetails: { endpoint }
      });
      throw error;
    }
  }
}
```

## Utility Methods

### Async Wrapper

Use `wrapAsync` for automatic error handling:

```typescript
const result = await ErrorService.wrapAsync(
  () => dangerousAsyncOperation(),
  ErrorContext.QUERY_EXECUTION,
  {
    userMessage: "Query execution failed",
    onError: (correlationId) => {
      // Optional: custom error handling
      console.log(`Error tracked with ID: ${correlationId}`);
    }
  }
);

// result will be null if operation failed
if (result) {
  // Handle success
}
```

### Sync Wrapper

Use `wrapSync` for synchronous operations:

```typescript
const result = ErrorService.wrapSync(() => dangerousSyncOperation(), ErrorContext.GENERAL, {
  userMessage: "Operation failed"
});
```

## Configuration

Configure the ErrorService behavior:

```typescript
// Disable toast notifications for testing
ErrorService.configure({
  enableToastNotifications: false
});

// Enable remote monitoring in production
ErrorService.configure({
  enableRemoteReporting: true,
  logLevel: "warn"
});

// Get current configuration
const config = ErrorService.getConfig();
```

## Best Practices

### 1. Use Appropriate Contexts

Always use the most specific error context available:

```typescript
// ✅ Good - specific context
ErrorService.handleQueryError(error, "execute query");

// ❌ Avoid - generic context when specific is available
ErrorService.handle(error, ErrorContext.GENERAL);
```

### 2. Provide User Messages

Always provide clear, actionable user messages:

```typescript
// ✅ Good - clear, actionable
ErrorService.handle(error, ErrorContext.SOURCE_CONNECTION, {
  userMessage: "Failed to connect to database. Please check your connection settings."
});

// ❌ Avoid - technical jargon
ErrorService.handle(error, ErrorContext.SOURCE_CONNECTION, {
  userMessage: "ECONNREFUSED 127.0.0.1:5432"
});
```

### 3. Include Technical Details

Add relevant technical information for debugging:

```typescript
ErrorService.handle(error, ErrorContext.QUERY_EXECUTION, {
  userMessage: "Query execution failed",
  technicalDetails: {
    queryId,
    sourceId,
    executionTime: Date.now() - startTime,
    sqlLength: sql.length
  }
});
```

### 4. Handle Correlation IDs

Use correlation IDs for tracking related errors:

```typescript
const correlationId = ErrorService.handle(error, ErrorContext.GENERAL);

// Pass correlation ID to support or logging systems
reportToSupport({ correlationId, userAction: "clicked save button" });
```

## Common Patterns

### Connection Error Handling

```typescript
const connectToSource = async (source: Source) => {
  try {
    await establishConnection(source);
  } catch (error) {
    ErrorService.handleConnectionError(error, source.id, source.name);
    // Don't rethrow - error is already handled
  }
};
```

### Validation Error Handling

```typescript
const validateInput = (field: string, value: unknown) => {
  try {
    validate(value);
  } catch (error) {
    ErrorService.handleValidationError(error, field, value);
    return false;
  }
  return true;
};
```

### Query Error Handling

```typescript
const executeQuery = async (query: Query) => {
  try {
    return await runQuery(query.sql);
  } catch (error) {
    ErrorService.handleQueryError(error, "execute query", {
      queryId: query.id,
      sql: query.sql
    });
    throw error; // Re-throw for component to handle
  }
};
```

## Migration Checklist

When migrating existing error handling:

- [ ] Replace `console.error` + `toast.error` with `ErrorService.handle`
- [ ] Choose appropriate `ErrorContext` for the operation
- [ ] Set appropriate `ErrorSeverity` based on impact
- [ ] Provide user-friendly error messages
- [ ] Include relevant technical details
- [ ] Test error scenarios to ensure proper handling
- [ ] Update tests to expect new error handling behavior

## Testing

When testing components that use ErrorService:

```typescript
// Mock ErrorService in tests
jest.mock("@/shared/services", () => ({
  ErrorService: {
    handle: jest.fn(),
    handleQueryError: jest.fn(),
    handleConnectionError: jest.fn()
  }
}));

// Test error handling
it("should handle query errors properly", async () => {
  const mockError = new Error("Query failed");
  mockQueryExecution.mockRejectedValue(mockError);

  await executeQuery("SELECT * FROM users");

  expect(ErrorService.handleQueryError).toHaveBeenCalledWith(
    mockError,
    "execute query",
    expect.objectContaining({ sql: "SELECT * FROM users" })
  );
});
```

## Future Enhancements

The ErrorService is designed to support future enhancements:

- **Remote monitoring integration** (Sentry, DataDog, etc.)
- **Error analytics and reporting**
- **Automatic error recovery strategies**
- **User feedback collection on errors**
- **Error rate limiting and circuit breakers**

These features can be added without changing the existing API, making the migration investment future-proof.
