# Fix for Duplicate API Calls and Timing Issues on Page Load

## Issue Description

When the web page was first loaded with an open query, it would make duplicate API calls:

1. `GET /api/versions/query/{query_id}/latest` - called twice
2. `POST /api/execution/version` - called twice

Additionally, the first execution request would take a long time to start and sometimes timeout, even with running worker containers.

## Root Cause Analysis

### 1. Duplicate Auto-Execution Logic

The duplicate API calls were caused by multiple places in the code that triggered auto-execution on page load:

- **`useTabManagerStore.initializeQueryTabsRuntimeStates()`**: Used `setTimeout(..., 500)` to wait for connected sources, then called `executeQuery(tabId)`
- **`TabNavigationService.initializeQueryTabsRuntimeStates()`**: Also used `setTimeout(..., 500)` with the same logic
- **`useTabManagerStore.loadQueryInTab()`**: Called `loadLatestQueryVersion()` (GET request) and then immediately triggered `executeQuery()` (POST request)

This created a race condition where multiple initialization paths would trigger simultaneously.

### 2. SSE Connection Not Established Before Query Execution

The main timing issue was that queries were being executed before the SSE (Server-Sent Events) connection was established. This caused:

- Slow first execution requests as SSE connection was established mid-request
- Potential race conditions between query execution and result streaming
- Timeout errors due to timing mismatches

### 3. No Duplicate Call Prevention

There were no guards to prevent multiple concurrent calls to the same endpoints for the same resources.

## Solution Implemented

### 1. Establish SSE Connection First

- **Modified `IdePage`** to establish SSE connection before any query initialization
- **Updated initialization sequence** to ensure SSE is ready before auto-execution
- **Added console logging** to track SSE connection establishment

### 2. Consolidate Auto-Execution Logic

- **Removed duplicate initialization logic** from `useTabManagerStore`
- **Delegated all initialization** to `TabNavigationService` to have a single source of truth
- **Added `isInitializing` flag** to prevent auto-execution during load
- **Modified `loadQueryInTab()`** to check the flag before auto-executing

### 3. Prevent Duplicate API Calls

- **Added loading state tracking** for `loadLatestQueryVersion` calls
- **Added execution state checking** to prevent duplicate query executions
- **Added console logging** to track and debug duplicate call prevention

## Code Changes

### 1. Early SSE Connection in IdePage

**File**: `client/src/pages/IdePage.tsx`

```typescript
// Initialize SSE connection and runtime states for query tabs on app load
useEffect(() => {
  const initialize = async () => {
    try {
      // Import SSE connection manager
      const { sseConnectionManager } = await import("@/shared/services/SSEConnectionManager");

      // Establish SSE connection first
      console.log("Establishing SSE connection...");
      await sseConnectionManager.connect();
      console.log("SSE connection established successfully");

      // Then initialize query tabs
      await initializeQueryTabsRuntimeStates();
    } catch (error) {
      console.error("Failed to initialize query tabs runtime states:", error);
    }
  };
  initialize();
}, [initializeQueryTabsRuntimeStates]);
```

### 2. Wait for SSE in TabNavigationService

**File**: `client/src/shared/services/TabNavigationService.ts`

```typescript
static async initializeQueryTabsRuntimeStates(): Promise<void> {
  // ... reset runtime states ...

  // After resetting runtime states, wait for SSE connection and connected sources
  // before checking if active tab should auto-execute
  setTimeout(async () => {
    try {
      // First, establish SSE connection before executing any queries
      await sseConnectionManager.connect();
      console.log("SSE connection established, checking for auto-execution");

      // ... check for auto-execution ...
    } catch (error) {
      console.error("Failed to establish SSE connection:", error);
      // Continue without auto-execution if SSE connection fails
    }
  }, 1000); // Increased to 1000ms to give more time for SSE connection
}
```

### 3. Prevent Duplicate loadLatestQueryVersion Calls

**File**: `client/src/shared/store/useQueryStore.ts`

```typescript
interface QueryState {
  // ... existing properties
  loadingLatestVersions: Set<string>;
}

loadLatestQueryVersion: async (queryId) => {
  const state = get();

  // Prevent duplicate calls
  if (state.loadingLatestVersions.has(queryId)) {
    console.log(`Already loading latest version for query ${queryId}, skipping duplicate call`);
    return null;
  }

  set((state) => ({
    loadingLatestVersions: new Set(state.loadingLatestVersions).add(queryId)
  }));

  try {
    // ... load version logic ...
  } finally {
    // Always clear loading state
    set((state) => ({
      loadingLatestVersions: new Set(
        [...state.loadingLatestVersions].filter((id) => id !== queryId)
      )
    }));
  }
};
```

### 4. Prevent Duplicate Query Executions

**File**: `client/src/shared/store/useTabExecutionStore.ts`

```typescript
executeQuery: async (tabId, sql, overrideFilters) => {
  // ... get tab logic ...

  // Prevent duplicate executions
  if (tab.queryRunning) {
    console.log(`Query already running for tab ${tabId}, skipping duplicate execution`);
    return;
  }

  // ... execution logic ...
};
```

### 5. Consolidated Initialization

**File**: `client/src/shared/store/useTabManagerStore.ts`

```typescript
interface TabManagerState {
  // ... existing properties
  isInitializing: boolean;
}

initializeQueryTabsRuntimeStates: async () => {
  // Set initialization flag to prevent auto-execution during load
  set((state) => ({ ...state, isInitializing: true }));

  // Delegate to the TabNavigationService to avoid duplicate logic
  await TabNavigationService.initializeQueryTabsRuntimeStates();

  // Clear initialization flag after completion
  set((state) => ({ ...state, isInitializing: false }));
};
```

## Expected Behavior After Fix

1. **SSE connection established first** before any query operations
2. **No duplicate API calls** on page load
3. **Single, coordinated auto-execution** handled by TabNavigationService
4. **Faster query execution** due to pre-established SSE connection
5. **Better debugging** with console logs tracking the flow
6. **Improved reliability** with duplicate call prevention

## Testing

To verify the fix works:

1. **Open a query tab** and refresh the page
2. **Check browser DevTools Network tab** - should see only single API calls
3. **Check browser console** - should see SSE connection establishment logs
4. **Monitor timing** - first query execution should be fast with SSE ready
5. **Test multiple refreshes** - should be consistent without race conditions

The changes ensure that:

- SSE connection is established before any query operations
- Duplicate calls are prevented at multiple levels
- Initialization follows a predictable sequence
- Better error handling and debugging information is available
