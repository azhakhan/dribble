# Fix: Unnecessary Latest Version API Calls on Tab Switch

## Problem

When users clicked on query tabs that were already open (but not active), the application was making unnecessary API calls to fetch the latest version of the query via:

```
GET /api/versions/query/{queryId}/latest
```

This happened every time a user switched to an existing tab, even when the tab already had the query version loaded and nothing had changed.

## Root Cause

The issue was in `TabNavigationService.setActiveTab()` method. The logic was:

```typescript
// Only load latest version from server if tab is not dirty
if (!activeTab.isDirty) {
  const latestVersion = await queryStore.loadLatestQueryVersion(activeTab.queryId);
  // ... update tab content
}
```

This meant that **every time** a user switched to a tab (that wasn't dirty), it would fetch the latest version from the server, regardless of whether the tab already had a version loaded.

## Solution

Modified the condition to also check if the tab already has a version loaded:

```typescript
// Only load latest version from server if tab is not dirty AND
// the tab doesn't already have a version loaded
if (!activeTab.isDirty && !activeTab.queryVersionId) {
  const latestVersion = await queryStore.loadLatestQueryVersion(activeTab.queryId);
  // ... update tab content
} else {
  // Tab has unsaved changes or already has a version loaded,
  // just update global editorContent without making API calls
  contentStore.setEditorContent(activeTab.editorContent);
}
```

## Impact

- **Performance**: Eliminates unnecessary API calls when switching between already-loaded tabs
- **Network**: Reduces bandwidth usage
- **User Experience**: Faster tab switching since no API calls are made for already-loaded tabs
- **Server Load**: Reduces load on the backend by avoiding redundant latest version requests

## When Latest Version IS Still Fetched

The latest version will still be fetched in these scenarios:

1. When a tab is first opened and doesn't have a version loaded yet (`!activeTab.queryVersionId`)
2. When opening a query from the tree view (handled by `openQueryFromTree` method)
3. When explicitly loading a query into a tab (handled by `loadQueryInTab` method)

This ensures that the application still fetches fresh data when needed, while avoiding unnecessary calls during normal tab navigation.
