# Query Feature Refactoring

This document outlines the refactoring of the query feature components to improve maintainability and separation of concerns.

## Structure Overview

The query feature is now organized with the following structure:

```
features/query/
├── components/
│   ├── QueryEditor/
│   │   ├── QueryEditor.tsx         # Main editor component
│   │   ├── EditorToolbar.tsx       # Editor toolbar (placeholder)
│   │   ├── EditorStatusBar.tsx     # Version & runs status bar
│   │   └── index.ts               # Component exports
│   ├── QueryResults/
│   │   ├── QueryResults.tsx        # Main results component
│   │   ├── ResultsTable.tsx        # Table display wrapper
│   │   ├── ResultsPagination.tsx   # Pagination (placeholder)
│   │   └── index.ts               # Component exports
│   ├── QueryTabs/
│   │   ├── QueryTabs.tsx          # Main tabs container
│   │   ├── TabHeader.tsx          # Tab bar and controls
│   │   ├── TabContent.tsx         # Individual tab content
│   │   ├── TabButton.tsx          # Individual tab button
│   │   ├── NewQueryModal.tsx      # New query creation modal
│   │   ├── ContextMenu.tsx        # Tab context menu
│   │   └── index.ts              # Component exports
│   └── index.ts                  # All component exports
├── hooks/
│   ├── useQueryExecution.ts      # Query execution logic
│   ├── useQueryVersion.ts        # Version management logic
│   ├── useTabNavigation.ts       # Tab navigation logic
│   └── index.ts                 # Hook exports
├── services/
│   ├── queryService.ts          # Query utility functions
│   └── index.ts                # Service exports
└── README.md                   # This documentation
```

## Key Changes

### 1. Separation of Concerns

- **QueryEditor**: Handles SQL editing, versions, and status
- **QueryResults**: Manages result display and pagination
- **QueryTabs**: Manages tab navigation and layout

### 2. Business Logic Extraction

- **useQueryExecution**: Manages query runs and execution state
- **useQueryVersion**: Handles version selection and management
- **useTabNavigation**: Controls tab behavior and navigation

### 3. Service Layer

- **queryService**: Utility functions for query operations

## Component Responsibilities

### QueryEditor

- Combines Monaco editor with toolbar and status bar
- Handles version selection and display
- Shows query execution status
- Provides access to query runs

### QueryResults

- Wraps TableDataDisplay for consistent styling
- Provides pagination structure (placeholder)
- Manages result display state

### QueryTabs

- **QueryTabs**: Main container with empty state handling
- **TabHeader**: Tab bar, new query button, context menu
- **TabContent**: Individual tab layout with panels
- **TabButton**: Individual tab with close functionality
- **NewQueryModal**: Query creation dialog
- **ContextMenu**: Tab right-click actions

## Hooks

### useQueryExecution

- Manages `showRuns` state
- Provides latest run information
- Handles run loading and refresh

### useQueryVersion

- Manages version selection state
- Handles version loading and display
- Provides version change functionality

### useTabNavigation

- Manages tab scrolling and focus
- Handles tab operations (close, context menu)
- Provides tab state management

## Migration Guide

### From Old Structure

```tsx
// OLD: Direct usage of monolithic components
import { QueryTabs } from "./QueryTabs";
import { Query } from "./Query";

// NEW: Use refactored components
import { QueryTabs } from "./components/QueryTabs";
import { TabContent } from "./components/QueryTabs/TabContent";
```

### For New Development

```tsx
// Use specific components for targeted functionality
import { QueryEditor } from "./components/QueryEditor";
import { QueryResults } from "./components/QueryResults";
import { useQueryExecution, useQueryVersion } from "./hooks";
```

## Benefits

1. **Maintainability**: Smaller, focused components are easier to maintain
2. **Reusability**: Components can be used independently
3. **Testability**: Isolated business logic can be tested separately
4. **Performance**: Better memoization opportunities
5. **Developer Experience**: Clear separation makes code easier to understand

## Future Improvements

1. **EditorToolbar**: Add SQL formatting, templates, shortcuts
2. **ResultsPagination**: Implement actual pagination controls
3. **Enhanced Hooks**: Add more granular state management
4. **Service Expansion**: Add more query-related utilities
5. **Type Safety**: Improve type definitions across components

## Usage Examples

### Basic Query Tab

```tsx
import { TabContent } from "./components/QueryTabs/TabContent";

function MyQueryView({ tabId }) {
  return <TabContent tabId={tabId} />;
}
```

### Standalone Query Editor

```tsx
import { QueryEditor } from "./components/QueryEditor";

function MyEditor({ tabId, onExecute }) {
  return <QueryEditor tabId={tabId} onQueryExecuted={onExecute} showRuns={true} />;
}
```

### Custom Query Results

```tsx
import { QueryResults } from "./components/QueryResults";

function MyResults({ data, isLoading }) {
  return <QueryResults queryResults={data} isQueryRunning={isLoading} />;
}
```
