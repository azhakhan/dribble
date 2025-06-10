# Query State Persistence

This document describes how query state persistence works for maintaining open query tabs and the active query across page reloads and browser sessions.

## Overview

The query state persistence system maintains the state of query tabs across page reloads and tab switches. This includes:

- **Open Query Tabs**: All currently open query tabs with their content
- **Active Tab**: Which query tab was last active
- **Editor Content**: SQL content in each tab
- **Query Metadata**: Query ID, source ID, title, and dirty state

## How It Works

### State Structure

Query state is managed through the same Zustand store with localStorage persistence as tree state:

```typescript
interface QueryTab {
  id: string;
  queryId: string | null;
  sourceId: string;
  title: string;
  isDirty: boolean;
  editorContent: string;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;
  lastSavedContent: string;
  originalContent: string;
  // Runtime states (not persisted)
  queryResults: object[] | null;
  queryRunning: boolean;
  isLoadingQuery: boolean;
  isLoadingVersions: boolean;
}

interface AppState {
  openTabs: QueryTab[];
  activeTabId: string | null;
  // ... other state
}
```

### Persistence Flow

1. **User opens/closes tabs** → Tab actions update `openTabs` and `activeTabId`
2. **Zustand automatically persists** → Essential tab data saved to localStorage
3. **Page reload** → Zustand restores tab state from localStorage
4. **Runtime reset** → `initializeQueryTabsRuntimeStates()` resets loading/result states
5. **Auto-execution check** → If active tab contains a SELECT query with no results, auto-execute
6. **Tabs render** → Previous query tabs are restored with their content and data

## Key Features

### Automatic Persistence

- All essential tab data is automatically saved to localStorage
- No manual save/restore needed
- Works across browser sessions
- Follows the same philosophy as tree state persistence

### Smart Runtime State Management

- **Persisted**: Tab content, metadata, editor content
- **Not Persisted**: Query results, loading states, runtime flags
- Runtime states are reset to defaults on app initialization

### Seamless User Experience

- Preserves work-in-progress queries
- Maintains tab order and active tab selection
- Restores editor content exactly as left
- Handles both saved and unsaved queries

## Store Actions

### Managing Query Tabs

```typescript
// Tab management
openQueryTab(tab: Omit<QueryTab, "id">): void
closeQueryTab(tabId: string): void
setActiveTab(tabId: string | null): void

// Tab content
updateTabContent(tabId: string, content: Partial<QueryTab>): void
updateTabTitle(tabId: string, title: string): void

// Runtime state initialization
initializeQueryTabsRuntimeStates(): void
```

### Component Usage

```typescript
// In a query component
const { openTabs, activeTabId, openQueryTab } = useAppStore();

// Open a new tab
const handleNewQuery = () => {
  openQueryTab({
    queryId: null,
    sourceId: selectedSource.id,
    title: "Untitled Query",
    isDirty: false,
    editorContent: "",
    queryResults: null,
    queryRunning: false,
    selectedTableData: null,
    isLoadingQuery: false,
    isLoadingVersions: false,
    lastSavedContent: "",
    originalContent: ""
  });
};
```

## What Gets Persisted

- **Tab Structure**: All open tabs with their IDs and order
- **Active Tab**: Which tab was last selected
- **Editor Content**: SQL content in each tab
- **Query Metadata**: Query ID, source, title, dirty state
- **Selected Tables**: Table context for each tab

## What Doesn't Get Persisted

- **Query Results**: Large result sets that should be re-fetched
- **Loading States**: Runtime flags for loading queries/versions
- **Execution State**: Whether queries are currently running

## Runtime State Initialization

On app startup, call `initializeQueryTabsRuntimeStates()` to ensure all runtime states are properly reset and check for auto-execution:

```typescript
// In your app initialization
useEffect(() => {
  const initialize = async () => {
    try {
      const { initializeQueryTabsRuntimeStates } = useAppStore.getState();
      await initializeQueryTabsRuntimeStates();
    } catch (error) {
      console.error("Failed to initialize query tabs runtime states:", error);
    }
  };
  initialize();
}, []);
```

### Auto-execution on Page Reload

The initialization process includes smart auto-execution logic:

- **Checks active tab**: If there's an active tab on page reload
- **Validates content**: Ensures the tab contains a SELECT query
- **Verifies connection**: Confirms the source is connected
- **Checks results**: Only auto-executes if no results are present
- **Delayed execution**: Waits for connected sources to load before execution

## Benefits

- **Better UX**: No lost work when refreshing or closing browser
- **Productivity**: Faster workflow without re-opening queries
- **Consistency**: Same persistence philosophy as tree state
- **Performance**: Lightweight persistence with minimal overhead
- **Reliability**: Simple approach that works with Zustand's persistence

## Conceptual Similarity to Tree State

Both persistence systems follow the same philosophy:

1. **Zustand Store**: Single store with automatic localStorage persistence
2. **Selective Persistence**: Only essential state is persisted
3. **Runtime Reset**: Transient states are reset on app load
4. **Simple Actions**: Clean actions for state management
5. **No Manual Work**: Persistence happens automatically

## Testing

To verify persistence is working:

1. Open several query tabs with different content
2. Make some tabs dirty by editing content
3. Switch between tabs to set an active tab
4. Reload the page
5. Confirm all tabs, content, and active tab are preserved
6. Verify runtime states (loading, results) are reset to defaults
