# Codebase Refactoring Plan

## Overview

This document outlines a comprehensive refactoring plan for the database editor application, focusing on simplifying client-side complexity, improving worker code quality, and establishing better architectural patterns.

## 1. Client-Side Refactoring

### 1.1 Split Large Stores

The `useTabStore.ts` (1,136 lines) needs to be broken down into smaller, focused stores:

```
useTabStore →
├── useTabManagerStore     (~200 lines) - Tab lifecycle (create, close, switch)
├── useTabContentStore     (~150 lines) - Editor content management
├── useTabExecutionStore   (~250 lines) - Query execution logic
├── useTableFilterStore    (~150 lines) - Table filtering state
└── useUnsavedChangesStore (~100 lines) - Unsaved changes dialog
```

**Implementation Example**: See `client/src/shared/store/tabs/useTabManagerStore.ts`

### 1.2 Extract Service Layer

Create service classes to handle complex business logic:

- **QueryExecutionService**: Handles query execution, polling, and result processing
- **TabNavigationService**: Manages tab navigation and state synchronization
- **QueryVersionService**: Handles version management and saving

**Implementation Example**: See `client/src/shared/services/QueryExecutionService.ts`

### 1.3 Simplify Component Structure

Current issues:

- `QueryTabs.tsx` (552 lines) handles too many responsibilities
- `Query.tsx` (251 lines) mixes UI and business logic

Proposed structure:

```
features/query/
├── components/
│   ├── QueryEditor/
│   │   ├── QueryEditor.tsx
│   │   ├── EditorToolbar.tsx
│   │   └── EditorStatusBar.tsx
│   ├── QueryResults/
│   │   ├── QueryResults.tsx
│   │   ├── ResultsTable.tsx
│   │   └── ResultsPagination.tsx
│   └── QueryTabs/
│       ├── QueryTabs.tsx
│       ├── TabHeader.tsx
│       └── TabContent.tsx
├── hooks/
│   ├── useQueryExecution.ts
│   ├── useQueryVersion.ts
│   └── useTabNavigation.ts
└── services/
    └── queryService.ts
```

### 1.4 Create Custom Hooks

Extract complex logic into reusable hooks:

```typescript
// useQueryExecution.ts
export function useQueryExecution(tabId: string) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<QueryResult | null>(null);

  const execute = useCallback(
    async (sql?: string) => {
      setIsExecuting(true);
      try {
        const result = await QueryExecutionService.executeQuery(tab, { sql });
        setResults(result);
      } finally {
        setIsExecuting(false);
      }
    },
    [tab]
  );

  return { execute, isExecuting, results };
}
```

## 2. Worker Refactoring

### 2.1 Modularize Worker Code

Split `worker/postgres/app/main.py` (727 lines) into modules:

```
worker/postgres/app/
├── main.py              (~150 lines) - FastAPI app and routes
├── query_executor.py    (~130 lines) - Query execution logic
├── sql_builder.py       (~90 lines)  - Safe SQL composition
├── connection_manager.py (~80 lines)  - Database connection handling
├── schema_inspector.py  (~100 lines) - Schema introspection
├── models.py           (~50 lines)   - Pydantic models
└── utils.py            (~50 lines)   - Utility functions
```

**Implementation Examples**:

- See `worker/postgres/app/query_executor.py`
- See `worker/postgres/app/sql_builder.py`

### 2.2 Improve Error Handling

Create structured error handling:

```python
class WorkerError(Exception):
    """Base worker exception"""
    pass

class DatabaseConnectionError(WorkerError):
    """Database connection failures"""
    pass

class QueryExecutionError(WorkerError):
    """Query execution failures"""
    pass

class ValidationError(WorkerError):
    """Input validation failures"""
    pass
```

### 2.3 Add Input Validation

Use Pydantic for comprehensive validation:

```python
class QueryModifiers(BaseModel):
    limit: int = Field(501, ge=10, le=10000)
    offset: int = Field(0, ge=0)
    where: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9_\.\s,()=<>!]+$')
    order_by: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9_\.\s,]+$')
```

## 3. Architectural Improvements

### 3.1 Implement Repository Pattern

Create repositories for data access:

```typescript
interface QueryRepository {
  getById(id: string): Promise<Query>;
  create(data: CreateQueryRequest): Promise<Query>;
  update(id: string, data: UpdateQueryRequest): Promise<Query>;
  delete(id: string): Promise<void>;
}

class APIQueryRepository implements QueryRepository {
  // Implementation using API calls
}

class CachedQueryRepository implements QueryRepository {
  // Implementation with caching layer
}
```

### 3.2 Add Event System

Implement an event bus for decoupled communication:

```typescript
class EventBus {
  private events = new Map<string, Set<Function>>();

  on(event: string, handler: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  emit(event: string, data: any) {
    this.events.get(event)?.forEach((handler) => handler(data));
  }
}

// Usage
eventBus.on("query:executed", (result) => {
  // Update UI, logs, etc.
});
```

### 3.3 Improve Type Safety

Create comprehensive type definitions:

```typescript
// types/query.ts
export interface QueryExecutionContext {
  query: Query;
  version: QueryVersion;
  source: Source;
  modifiers?: QueryModifiers;
}

export interface QueryExecutionResult {
  data: Record<string, any>[];
  rowCount: number;
  executionTime: number;
  error?: string;
}
```

## 4. Performance Optimizations

### 4.1 Implement Query Result Caching

```typescript
class QueryResultCache {
  private cache = new Map<string, CachedResult>();

  getCacheKey(queryId: string, versionId: string, modifiers?: QueryModifiers): string {
    return `${queryId}:${versionId}:${JSON.stringify(modifiers || {})}`;
  }

  get(key: string): CachedResult | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
    return null;
  }
}
```

### 4.2 Optimize State Updates

Use selective subscriptions in Zustand:

```typescript
// Instead of
const { openTabs, activeTabId } = useTabStore();

// Use
const openTabs = useTabStore((state) => state.openTabs);
const activeTabId = useTabStore((state) => state.activeTabId);
```

### 4.3 Implement Virtual Scrolling

For large result sets, implement virtual scrolling:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

function ResultsTable({ data }: { data: any[] }) {
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35
  });

  // Render only visible rows
}
```

## 5. Testing Strategy

### 5.1 Unit Tests

- Test stores in isolation
- Test services with mocked dependencies
- Test utility functions

### 5.2 Integration Tests

- Test API endpoints
- Test worker query execution
- Test store interactions

### 5.3 E2E Tests

- Test complete user flows
- Test error scenarios
- Test performance under load

## 6. Migration Plan

### Phase 1: Foundation (Week 1-2)

1. Create service layer architecture
2. Implement new store structure
3. Set up testing framework

### Phase 2: Worker Refactoring (Week 2-3)

1. Modularize worker code
2. Implement SQL builder
3. Add comprehensive error handling

### Phase 3: Client Refactoring (Week 3-4)

1. Split large stores
2. Refactor components
3. Implement custom hooks

### Phase 4: Integration (Week 4-5)

1. Connect new services
2. Migrate existing functionality
3. Performance testing

### Phase 5: Cleanup (Week 5-6)

1. Remove old code
2. Update documentation
3. Final testing

## 7. Monitoring and Maintenance

### 7.1 Add Logging

Implement structured logging:

```python
import structlog

logger = structlog.get_logger()

logger.info("query_executed",
    query_id=query_id,
    execution_time_ms=execution_time,
    row_count=row_count
)
```

### 7.2 Performance Metrics

Track key metrics:

- Query execution time
- API response time
- Frontend rendering performance
- Memory usage

### 7.3 Error Tracking

Implement error tracking with Sentry or similar:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter sensitive data
    return event;
  }
});
```

## Conclusion

This refactoring plan addresses the main issues identified:

1. **Client complexity** - Broken down into manageable modules
2. **Worker code quality** - Properly structured with clear separation of concerns
3. **Architecture** - Improved with service layers and proper patterns

The migration can be done incrementally, allowing continuous delivery while improving the codebase quality.
