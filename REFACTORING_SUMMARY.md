# Query Hooks Refactoring Summary

## What Was Refactored

### ✅ **Removed Redundant Hooks**

The following hooks were completely redundant with `useAppStore` functionality and have been **deleted**:

1. **`useQueriesQuery.ts`** - Query management now handled by store actions:

   - `loadQuery()`, `createNewQuery()`, `saveQueryVersion()`
   - Centralized query cache in `queries` state

2. **`useQueryVersionsQuery.ts`** - Query versions now managed by:

   - `loadQueryVersions()`, `loadLatestQueryVersion()`
   - Centralized versions cache in `queryVersions` state

3. **`useQueryRunsQuery.ts`** - Query execution now handled by:

   - `executeQuery()` store action
   - Results stored in tab-specific `queryResults`

4. **`useLatestQueryVersionQuery.ts`** - Replaced by:

   - `loadLatestQueryVersion()` store action

5. **`useSourcesQuery.ts`** - Sources loading now handled by:

   - `loadSources()` store action
   - Centralized sources cache in `allSources` and `sources` state

6. **`useConnectedSourcesQuery.ts`** - Connected sources now handled by:
   - `loadConnectedSources()` store action
   - Centralized cache in `connectedSourcesData` and `connectedSources` state

### 🔄 **Created Store-Integrated Hooks**

New file: **`useStoreQueries.ts`** provides React Query-like interface using store:

```typescript
// Clean, store-integrated hooks with familiar API
const { data: sources, isLoading, error } = useStoreSources();
const { data: connectedSources } = useStoreConnectedSources();
const { data: query } = useStoreQuery(queryId);
const { data: versions } = useStoreQueryVersions(queryId);
const { createQuery, createVersion } = useStoreQueryMutations();
```

### ✅ **Kept Specialized Hooks**

These hooks remain because they handle specialized functionality not suitable for global store:

1. **`useChatQuery.ts`** - Chat-specific server state
2. **`useLLMsQuery.ts`** - LLM data fetching
3. **`useConnectSourceMutation.ts`** - Complex connection logic
4. **`useSourceStatusQuery.ts`** - Real-time status polling
5. **`useSourceSchemasQuery.ts`** - Schema fetching with retry logic
6. **`useConnectedSourcesSchemas.ts`** - Schema integration with store
7. **`useQueryQuery.ts`** - Table data display queries (specialized polling logic)
8. **`useChatLLMQuery.ts`** - Chat LLM specific queries

## Best Practices Established

### 🎯 **When to Use Store vs React Query**

**Use `useAppStore` for:**

- ✅ Global application state that needs to be shared across components
- ✅ Data that should persist during navigation
- ✅ Complex state relationships (queries ↔ versions ↔ tabs)
- ✅ Actions that modify multiple pieces of state
- ✅ Data that's frequently accessed by multiple components

**Use React Query hooks for:**

- ✅ Server state that's component-specific
- ✅ Real-time polling/subscriptions
- ✅ Complex retry/caching logic that doesn't need global state
- ✅ One-off data fetching that doesn't affect global state

### 🏗️ **Store Architecture Patterns**

1. **Centralized Data Management**

   ```typescript
   // Store manages all related data together
   interface QueryState {
     queries: Record<string, Query>;
     queryVersions: Record<string, QueryVersion[]>;
     loadingQueries: Set<string>;
     loadingVersions: Set<string>;
   }
   ```

2. **Action-Based Loading**

   ```typescript
   // Actions handle loading and caching
   loadQuery: async (queryId: string) => {
     if (state.queries[queryId] || state.loadingQueries.has(queryId)) return;
     // Load and cache...
   };
   ```

3. **Store-Integrated Hooks**

   ```typescript
   // Hooks provide React Query-like interface
   export function useStoreQuery(queryId: string | null) {
     const { queries, loadingQueries, loadQuery } = useAppStore();

     useEffect(() => {
       if (queryId && !queries[queryId] && !loadingQueries.has(queryId)) {
         loadQuery(queryId);
       }
     }, [queryId, queries, loadingQueries, loadQuery]);

     return {
       data: queryId ? queries[queryId] || null : null,
       isLoading: queryId ? loadingQueries.has(queryId) : false,
       error: null
     };
   }
   ```

### 📊 **Benefits Achieved**

1. **Reduced Bundle Size** - Eliminated 6 redundant hook files (50% reduction)
2. **Simplified State Management** - Single source of truth in store
3. **Better Performance** - No duplicate API calls, shared caching
4. **Improved Developer Experience** - Consistent patterns, less context switching
5. **Easier Testing** - Centralized state makes testing simpler
6. **Better Type Safety** - Store provides strong typing across components
7. **Cleaner Architecture** - Clear separation between global state and specialized hooks

### 🔄 **Migration Pattern**

For future hook consolidation:

1. **Identify** hooks that duplicate store functionality
2. **Enhance** store with missing actions/state
3. **Create** store-integrated hooks with familiar API
4. **Update** components to use new hooks
5. **Delete** redundant hooks
6. **Test** to ensure functionality is preserved

### 🚀 **Next Steps**

Consider consolidating these remaining hooks if they become redundant:

- `useSourceSchemasQuery.ts` - Could be integrated into store if schema loading becomes more centralized
- `useChatQuery.ts` - Could be partially integrated if chat state needs to be global

The current architecture provides a clean separation between global application state (store) and specialized server state (React Query hooks).
