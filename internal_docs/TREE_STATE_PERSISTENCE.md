# Tree State Persistence

This document describes how tree state persistence works for the source and query trees in the application.

## Overview

The tree state persistence system maintains the expanded/collapsed state of tree nodes across page reloads and tab switches. This includes:

- **Source Tree**: Sources, schemas, organizational folders (Tables/Views), tables, views, and columns
- **Query Tree**: Source expansion states in the query view
- **Sidebar Tab**: Which tab (Sources/Queries) was last active

## How It Works

### State Structure

Tree state is managed through Zustand store with localStorage persistence:

```typescript
interface SidebarState {
  activeTab: "sources" | "queries";
  expandedNodes: Record<string, boolean>; // nodeId -> isExpanded for file tree
  expandedQuerySources: Record<string, boolean>; // sourceId -> isExpanded in query tree
}
```

### Node ID System

Each tree node gets a unique identifier for state tracking:

```typescript
// Source nodes
source - { sourceId };

// Schema nodes
schema - { sourceId } - { schemaName };

// Table/View nodes
table - { tableId };

// Organizational folders
tables - folder - { sourceId } - { schemaName };
views - folder - { sourceId } - { schemaName };

// Column nodes
column - { sourceId } - { schemaName } - { columnName };
```

### Persistence Flow

1. **User expands/collapses a node** → `setNodeExpanded()` updates state
2. **Zustand automatically persists** → State saved to localStorage
3. **Page reload** → Zustand restores state from localStorage
4. **Tree renders** → Nodes use restored expansion states

## Key Features

### Automatic Persistence

- All expansion states are automatically saved to localStorage
- No manual save/restore needed
- Works across browser sessions

### Smart Cleanup

- Query tree sources are cleaned up when sources disconnect
- File tree expansion states are preserved unless manually changed
- No interference with persistence during app initialization

### Organizational Folders

- Handles UI-only "Tables" and "Views" grouping folders
- These are not database entities but UI constructs for organization
- Proper state tracking with unique IDs

## Store Actions

### Managing Tree State

```typescript
// Active tab
setSidebarActiveTab(tab: "sources" | "queries"): void

// File tree nodes
setNodeExpanded(nodeId: string, isExpanded: boolean): void
isNodeExpanded(nodeId: string): boolean

// Query tree sources
setQuerySourceExpanded(sourceId: string, isExpanded: boolean): void
isQuerySourceExpanded(sourceId: string): boolean
```

### Component Usage

```typescript
// In a tree component
const { isNodeExpanded, setNodeExpanded } = useAppStore();

// Check expansion state
const isExpanded = isNodeExpanded("schema-abc123-public");

// Toggle expansion
const handleClick = () => {
  setNodeExpanded("schema-abc123-public", !isExpanded);
};
```

## What Gets Persisted

- **Panel Sizes**: Sidebar and editor panel dimensions
- **Editor Content**: Current SQL content
- **Tree States**: All node expansion states
- **Active Tab**: Sources or Queries tab selection
- **Query Tab State**: Open query tabs and active query (see [Query State Persistence](./QUERY_STATE_PERSISTENCE.md))

## Benefits

- **Better UX**: Navigation state preserved across sessions
- **Productivity**: Faster workflow without re-expanding trees
- **Performance**: Lightweight persistence with minimal overhead
- **Reliability**: Simple approach that works with Zustand's persistence

## Testing

To verify persistence is working:

1. Expand some sources and schemas in the file tree
2. Switch to Queries tab and expand some sources
3. Reload the page
4. Confirm all expansion states and active tab are preserved
