# Source Status Optimization

## Problem

Previously, when switching between query tabs that belong to different sources, each tab switch would trigger an individual API call to `/api/sources/status/{source_id}`. This was wasteful because:

1. Multiple components could request the same source status simultaneously
2. Status was re-fetched every time a user switched tabs
3. No caching was implemented, leading to unnecessary network requests

## Solution

Implemented a centralized background status polling system that:

1. **Background Polling**: Polls all connected source statuses every 3 seconds in the background
2. **Zustand Store Caching**: Stores status values in the Zustand store for instant access
3. **Single Source of Truth**: Components get status from the store instead of making individual API calls

## Changes Made

### 1. Enhanced `useSourceStore`

- Added `statusPollingEnabled`, `statusPollingInterval`, and `loadingStatuses` state
- Added `startStatusPolling()`, `stopStatusPolling()`, and `loadAllSourceStatuses()` actions
- Added `getSourceStatus()` helper for easy access

### 2. New `useSourceStatus` Hook

- Replaces `useSourceStatusQuery` for better performance
- Gets cached status from Zustand store instead of making API calls
- Returns `{ status, isLoading }` interface

### 3. Updated Components

- **IdePage**: Starts background polling when connected sources are loaded
- **FileTreeStatusIndicator**: Uses new `useSourceStatus` hook
- Fixed status mapping (`"running"` → `"healthy"` to match API)

### 4. Background Polling Logic

- Automatically starts when connected sources are loaded
- Polls all connected sources in parallel every 3 seconds
- Handles loading states and error cases
- Automatically stops when component unmounts

## Benefits

1. **Performance**: Eliminates redundant API calls when switching tabs
2. **User Experience**: Instant status display from cached values
3. **Efficiency**: Single polling mechanism serves all components
4. **Consistency**: All components show the same status values
5. **Resource Management**: Proper cleanup prevents memory leaks

## Usage

```typescript
// Old way (makes individual API calls)
const { data: status } = useSourceStatusQuery(sourceId);

// New way (uses cached store value)
const { status, isLoading } = useSourceStatus(sourceId);
```

## Status Values

The API returns these status values:

- `"running"`: Source worker is running (initial state when started)
- `"healthy"`: Source is confirmed connected and working (after health check)
- `"unhealthy"`: Source has connection issues
- `"starting"`: Source is in the process of connecting
- `"error"`: Source has critical errors

**Note**: Both `"running"` and `"healthy"` indicate the source is working and should show as connected (green) in the UI.

## Implementation Details

The background polling:

- Only runs when there are connected sources
- Uses `Promise.allSettled()` to handle individual source failures
- Tracks loading states per source to avoid duplicate requests
- Automatically cleans up when sources are disconnected
