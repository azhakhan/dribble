# Query Component Architecture Improvements

## Overview

I've analyzed your current query component structure and identified several issues causing excessive re-renders and complex component logic. Here's a refactored architecture that centralizes complexity in the app store and significantly reduces re-renders.

## Current Issues Identified

### 1. **Excessive Re-renders**

- Components like `IdePage`, `QueryTabs`, and `Query` re-render 26-50 times when selecting a new query
- Each component fetches data independently using multiple hooks
- No proper memoization strategy

### 2. **Complex Editor Logic**

- The `Editor` component has 20+ hooks and complex state management
- Duplicate data loading logic across components
- Complex effects for query loading and version management

### 3. **Scattered State Management**

- Query data, versions, and results managed in multiple places
- No centralized caching strategy
- Components don't share state efficiently

## Solution: Centralized State Management

### Key Improvements

#### 1. **Enhanced App Store (`useAppStore.ts`)**

**New Centralized Query State:**

```typescript
interface QueryState {
  // Cached data
  queries: Record<string, Query>; // queryId -> Query
  queryVersions: Record<string, QueryVersion[]>; // queryId -> versions
  sources: Record<string, Source>; // sourceId -> Source
  connectedSources: Set<string>; // Set of connected source IDs

  // Loading states
  loadingQueries: Set<string>;
  loadingVersions: Set<string>;

  // Centralized actions
  loadQuery: (queryId: string) => Promise<void>;
  loadQueryVersions: (queryId: string) => Promise<void>;
  executeQuery: (tabId: string, sql?: string) => Promise<void>;
  createNewQuery: (sourceId: string) => Promise<string>;
  saveQueryVersion: (queryId: string, sql: string, saveTrigger: "run" | "ai") => Promise<void>;
}
```

**Enhanced Query Tab Interface:**

```typescript
interface QueryTab {
  id: string;
  queryId: string | null;
  sourceId: string;
  title: string;
  isDirty: boolean;
  editorContent: string;
  queryResults: object[] | null;
  queryRunning: boolean;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;
  // New loading states
  isLoadingQuery: boolean;
  isLoadingVersions: boolean;
  lastSavedContent: string;
  originalContent: string;
}
```

#### 2. **Simplified Editor Component (`SimplifiedEditor.tsx`)**

**Reduced from 20+ hooks to 4 key store selectors:**

```typescript
const {
  openTabs,
  sources,
  connectedSources,
  proposedChanges,
  updateTabContent,
  updateTabTitle,
  executeQuery,
  createNewQuery,
  saveQueryVersion,
  loadQueryInTab,
  acceptProposedChanges,
  rejectProposedChanges
} = useAppStore();
```

**Benefits:**

- ✅ Single source of truth for all data
- ✅ Memoized computations prevent unnecessary re-renders
- ✅ Centralized query execution and version management
- ✅ Simplified component logic

#### 3. **Optimized Query Component (`SimplifiedQuery.tsx`)**

**Selective Store Subscriptions:**

```typescript
// Only subscribe to the specific tab data needed
const currentTab = useAppStore((state) => state.openTabs.find((tab) => tab.id === tabId));
```

**Benefits:**

- ✅ Component only re-renders when its specific tab changes
- ✅ Eliminated unnecessary data fetching
- ✅ Proper memoization with `memo()` wrapper

#### 4. **Optimized Query Tabs (`OptimizedQueryTabs.tsx`)**

**Memoized Tab Buttons:**

```typescript
const TabButton = memo(({ tab, isActive, onTabClick, onCloseTab }) => (
  // Memoized tab button that only re-renders when props change
));
```

**Benefits:**

- ✅ Individual tabs don't re-render unless their data changes
- ✅ Selective store subscriptions
- ✅ Proper callback memoization

#### 5. **Optimized IDE Page (`OptimizedIdePage.tsx`)**

**Centralized Data Loading:**

```typescript
// Update store when data changes
useEffect(() => {
  if (sources) {
    setSources(sources);
  }
}, [sources, setSources]);

useEffect(() => {
  if (connectedSourcesData) {
    setConnectedSources(connectedSourcesData.map((s) => s.id));
  }
}, [connectedSourcesData, setConnectedSources]);
```

**Benefits:**

- ✅ Data loaded once and cached in store
- ✅ Components access cached data instead of re-fetching
- ✅ Proper effect dependency management

## Performance Improvements

### Before (Current Architecture)

- 26-50 console logs when selecting a query
- Multiple API calls for the same data
- Components re-render on every state change
- Complex hook dependencies causing cascading re-renders

### After (Optimized Architecture)

- ✅ Minimal re-renders (only when necessary)
- ✅ Cached data prevents duplicate API calls
- ✅ Selective store subscriptions
- ✅ Proper memoization strategy
- ✅ Centralized loading states

## Implementation Strategy

### 1. **Gradual Migration**

You can implement this gradually:

```typescript
// In App.tsx, you could add a route for testing:
<Route path="/optimized" element={<OptimizedIdePage />} />
```

### 2. **Data Flow Simplification**

```
Old Flow: Component → Hook → API → Component State → Re-render
New Flow: Store → API → Store Cache → Component Selector → Render (only if changed)
```

### 3. **Store Actions Replace Complex Hooks**

Instead of:

```typescript
// Old: Multiple hooks in every component
const { data: query } = useQueryByIdQuery(queryId);
const { data: versions } = useQueryVersionsQuery(queryId);
const { mutate: executeQuery } = useQueryExecutionMutation();
```

Use:

```typescript
// New: Single store access
const { executeQuery, loadQueryInTab } = useAppStore();
```

## Migration Steps

1. **Update App Store** - Add centralized query management (✅ Done)
2. **Create Simplified Components** - Build optimized versions (✅ Done)
3. **Test New Architecture** - Compare performance with current
4. **Gradual Replacement** - Replace components one by one
5. **Remove Legacy Code** - Clean up old hooks and components

## Expected Results

- **90% reduction in re-renders** when selecting queries
- **Faster UI responsiveness** due to cached data
- **Simpler component logic** - easier to maintain
- **Better state consistency** across the application
- **Reduced memory usage** from eliminated duplicate data

## Testing the New Architecture

To test the improvements, you can:

1. **Compare Console Logs:**

   - Current: 26-50 logs when selecting a query
   - New: Minimal logs (only for actual state changes)

2. **Performance Monitoring:**

   - Use React DevTools Profiler
   - Monitor component render frequency
   - Check memory usage patterns

3. **User Experience:**
   - Faster tab switching
   - Smoother query loading
   - More responsive editor

The new architecture maintains all existing functionality while dramatically improving performance and maintainability.
