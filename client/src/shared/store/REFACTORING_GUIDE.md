# Store Refactoring Guide

## Overview

The monolithic `useAppStore` has been refactored into multiple domain-specific stores for better organization, maintainability, and performance. Each store now handles a specific concern, making the codebase more modular and easier to understand.

## New Store Structure

### 1. **useSourceStore** (`useSourceStore.ts`)

Manages database sources, connections, and schemas.

- Source data and metadata
- Connection states
- Schema information
- Source error tracking

### 2. **useQueryStore** (`useQueryStore.ts`)

Handles query management, versions, and runs.

- Query CRUD operations
- Query versions
- Query runs and results
- Ephemeral queries

### 3. **useTabStore** (`useTabStore.ts`)

Manages query tabs and query execution.

- Tab lifecycle
- Query execution
- Table filters
- Auto-execution logic

### 4. **useTreeStore** (`useTreeStore.ts`)

Handles navigation tree state.

- Sidebar state
- Node expansion states
- Selected nodes
- Loading states

### 5. **useChatStore** (`useChatStore.ts`)

Manages chat and LLM functionality.

- Chat messages
- LLM selection
- Session management
- Proposed changes

### 6. **useUIStore** (`useUIStore.ts`)

Handles general UI state.

- Panel sizes
- Loading states
- Legacy state (being phased out)

## Migration Strategy

### Phase 1: Compatibility Layer (Current)

Use `useAppStoreCompat` which provides the same interface as `useAppStore` but uses the new stores underneath.

```typescript
// Old way (still works via compatibility layer)
import { useAppStore } from "@/shared/store/useAppStore";

// New way (recommended)
import { useSourceStore, useQueryStore, useTabStore } from "@/shared/store";
```

### Phase 2: Gradual Component Migration

Migrate components one by one to use specific stores directly.

```typescript
// Before
const { sources, loadSources, queries, executeQuery } = useAppStore();

// After
const { sources, loadSources } = useSourceStore();
const { queries } = useQueryStore();
const { executeQuery } = useTabStore();
```

### Phase 3: Remove Compatibility Layer

Once all components are migrated, remove `useAppStore` and the compatibility layer.

## Usage Examples

### Working with Sources

```typescript
import { useSourceStore } from "@/shared/store";

function SourceComponent() {
  const { sources, selectedSource, loadSources, setSelectedSource } = useSourceStore();

  // Use source data...
}
```

### Managing Queries

```typescript
import { useQueryStore } from "@/shared/store";

function QueryComponent() {
  const { queries, loadQuery, updateQueryName } = useQueryStore();

  // Work with queries...
}
```

### Tab Management

```typescript
import { useTabStore } from "@/shared/store";

function TabComponent() {
  const { openTabs, activeTabId, openQueryTab, executeQuery } = useTabStore();

  // Manage tabs...
}
```

## Benefits

1. **Better Organization**: Each store has a clear, single responsibility
2. **Improved Performance**: Components only subscribe to the specific state they need
3. **Easier Testing**: Smaller stores are easier to test in isolation
4. **Type Safety**: Each store has its own well-defined interface
5. **Maintainability**: Easier to find and modify specific functionality

## Common Patterns

### Cross-Store Communication

When stores need to communicate, they can access each other's state:

```typescript
// In useTabStore
import { useSourceStore } from "./useSourceStore";

const sourceStore = useSourceStore.getState();
const source = sourceStore.sources[sourceId];
```

### Persisted State

Only essential state is persisted to localStorage:

- Tab state (openTabs, activeTabId)
- Tree state (sidebarState)
- UI state (panelSizes)

## Debugging

Use the debug function to inspect all stores:

```typescript
const { debugLogLocalStorage } = useAppStoreCompat();
debugLogLocalStorage(); // Logs all store states
```

## Notes

- The old `useAppStore` is still available but deprecated
- Use `migrateFromAppStore()` to migrate existing localStorage data
- The compatibility layer ensures backward compatibility during migration
