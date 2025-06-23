# Store Refactoring: useTabStore Split

This document outlines the refactoring of the large `useTabStore.ts` file into smaller, focused stores.

## Background

The original `useTabStore.ts` was 1,239 lines long and handled too many responsibilities. It has been split into 5 focused stores:

## New Store Architecture

### 1. `useTabManagerStore.ts` (~400 lines)

**Responsibility**: Tab lifecycle management

- Creating, closing, and switching tabs
- Loading queries into tabs
- Auto-execution logic
- Tree integration (opening queries/tables from sidebar)

**Key Methods**:

- `openQueryTab()` - Create new tab
- `closeQueryTab()` - Close tab
- `setActiveTab()` - Switch active tab
- `openQueryFromTree()` - Open query from tree double-click
- `openTableFromTree()` - Open table from tree double-click

### 2. `useTabContentStore.ts` (~30 lines)

**Responsibility**: Editor content management

- Global editor content state (for backward compatibility)
- Content synchronization

**Key Methods**:

- `setEditorContent()` - Update global editor content

### 3. `useTabExecutionStore.ts` (~220 lines)

**Responsibility**: Query execution logic

- Running SQL queries
- Managing query versions
- Polling for results
- Error handling

**Key Methods**:

- `executeQuery()` - Execute SQL query with filters

### 4. `useTableFilterStore.ts` (~180 lines)

**Responsibility**: Table filtering state

- Per-tab filter state management
- WHERE clauses, ORDER BY, pagination
- Filter + execution coordination

**Key Methods**:

- `setTableFilterWhere()` - Set WHERE filter
- `setTableFilterOrderBy()` - Set ORDER BY filter
- `updateFilterAndExecuteQuery()` - Update filter and run query atomically

### 5. `useUnsavedChangesStore.ts` (~180 lines)

**Responsibility**: Unsaved changes dialog

- Dialog state management
- Save/discard logic
- Change detection

**Key Methods**:

- `showUnsavedChangesDialog()` - Show confirmation dialog
- `saveChanges()` - Save tab changes
- `discardChanges()` - Discard tab changes

## Usage

### Current State (Backward Compatible)

The original `useTabStore` continues to work exactly as before. All existing code should continue working without changes.

```tsx
import { useTabStore } from "@/shared/store/useTabStore";

function MyComponent() {
  const { openTabs, activeTabId, executeQuery } = useTabStore();
  // ... existing code works unchanged
}
```

### New Store Usage (Advanced)

For new code or when you need more granular control, you can use individual stores:

```tsx
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useTabExecutionStore } from "@/shared/store/useTabExecutionStore";

function MyComponent() {
  const { openTabs, openQueryTab } = useTabManagerStore();
  const { executeQuery } = useTabExecutionStore();

  // More focused imports, better tree-shaking
}
```

### Composed Store (Recommended for Migration)

For gradual migration, use the composed store:

```tsx
import { useComposedTabStore } from "@/shared/store/useComposedTabStore";

function MyComponent() {
  const tabStore = useComposedTabStore();
  // Same interface as useTabStore, but using new architecture

  // Access individual stores if needed
  const { tabManager, tabExecution } = tabStore.stores;
}
```

## Implementation Notes

### Circular Dependency Handling

The stores use dynamic imports to avoid circular dependencies:

```typescript
// Instead of direct imports
const { useTabExecutionStore } = await import("./useTabExecutionStore");
```

### State Synchronization

- The `useTabManagerStore` remains the source of truth for tab state
- Other stores update the tab manager's state when needed
- The original `useTabStore` remains unchanged for backward compatibility

### Persistence

- Only `useTabManagerStore` and `useTabContentStore` persist data
- Filter and dialog state are intentionally ephemeral
- Same persistence keys as original store for seamless migration

## Migration Strategy

1. **Phase 1** (Current): All stores created, original store unchanged
2. **Phase 2** (Future): Gradually replace `useTabStore` imports with specific stores
3. **Phase 3** (Future): Remove original `useTabStore` when all code migrated

## Benefits

- **Reduced bundle size**: Components only import what they need
- **Better maintainability**: Each store has a single responsibility
- **Improved testability**: Smaller, focused units to test
- **Better TypeScript support**: More specific type checking
- **Easier debugging**: Clearer state boundaries

## File Organization

```
src/shared/store/
├── useTabStore.ts              # Original (preserved for compatibility)
├── useTabStore.original.ts     # Backup of original implementation
├── useTabManagerStore.ts       # Tab lifecycle
├── useTabContentStore.ts       # Content management
├── useTabExecutionStore.ts     # Query execution
├── useTableFilterStore.ts      # Filter state
├── useUnsavedChangesStore.ts   # Dialog management
└── useComposedTabStore.ts      # Composed interface (optional)
```

## Considerations

- Some circular dependency workarounds are temporary
- Dynamic imports may have slight performance implications
- Consider consolidating stores further if usage patterns indicate better groupings
- Monitor for any state synchronization issues during initial rollout
