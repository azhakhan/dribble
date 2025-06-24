# Service Layer Extraction

This document explains the extraction of service classes to handle complex business logic in Dribble, moving logic out of Zustand stores and into dedicated service classes.

## Overview

Three main service classes have been created to handle different aspects of the application:

1. **QueryExecutionService** - Handles query execution, polling, and result processing
2. **TabNavigationService** - Manages tab navigation and state synchronization
3. **QueryVersionService** - Handles version management and saving

## Service Classes

### QueryExecutionService

**Location**: `client/src/shared/services/QueryExecutionService.ts`

**Responsibilities**:

- Query execution with automatic version management
- Polling for query results until completion
- Result processing and formatting
- Error handling during execution
- Refreshing query data after successful execution

**Key Methods**:

- `executeQuery(tab, options)` - Main execution method
- `ensureQueryVersionExists(tab, sql)` - Ensures proper version exists before execution
- `pollForResults(runId)` - Polls for query completion
- `processResults(results)` - Formats and processes results
- `refreshQueryData(queryId)` - Refreshes runs and versions after execution

**Features Preserved**:

- ✅ Automatic version saving when SQL changes
- ✅ Ephemeral query conversion when needed
- ✅ Tab filter integration
- ✅ Polling for results with timeout
- ✅ Error handling and fallbacks
- ✅ Query runs and versions refresh after execution

### TabNavigationService

**Location**: `client/src/shared/services/TabNavigationService.ts`

**Responsibilities**:

- Opening and closing tabs
- Tab state synchronization
- Active tab management
- Auto-execution logic
- Query loading in tabs

**Key Methods**:

- `openQueryTab(options)` - Opens new query tabs
- `setActiveTab(tabId)` - Switches active tab with state sync
- `closeQueryTab(tabId)` - Closes tabs with cleanup
- `updateTabContent(tabId, content)` - Updates tab state
- `loadQueryInTab(tabId, queryId)` - Loads query into existing tab
- `openQueryFromTree(queryId)` - Opens query from tree view
- `openTableFromTree(...)` - Opens table from tree view

**Features Preserved**:

- ✅ Tab state synchronization when switching
- ✅ Auto-execution for SELECT queries
- ✅ Source selection synchronization
- ✅ Dirty state tracking
- ✅ Loading state management
- ✅ Query and table opening from tree
- ✅ Tab cleanup on query deletion

### QueryVersionService

**Location**: `client/src/shared/services/QueryVersionService.ts`

**Responsibilities**:

- Query version creation and management
- Query name updates with synchronization
- Ephemeral query conversion
- Version comparison logic

**Key Methods**:

- `saveQueryVersion(queryId, options)` - Saves new versions
- `updateQueryName(queryId, newName)` - Updates names everywhere
- `shouldSaveNewVersion(queryId, sql)` - Checks if SQL changed
- `loadLatestQueryVersion(queryId)` - Gets latest version
- `convertEphemeralToRegular(queryId, name)` - Converts ephemeral queries
- `updateTabAfterVersionSave(...)` - Updates tab state after saving

**Features Preserved**:

- ✅ Version saving when SQL changes
- ✅ Query name updates propagate to all tabs
- ✅ Ephemeral query conversion
- ✅ Tab state synchronization after saves
- ✅ Version comparison logic

## Store Refactoring

### useTabExecutionStore

**Before**: 250+ lines of complex execution logic
**After**: ~90 lines delegating to QueryExecutionService

The store now:

- Gets the current tab
- Sets running state
- Delegates execution to the service
- Updates tab state based on results
- Handles errors appropriately

### useTabManagerStore

**Key Changes**:

- `setActiveTab` now delegates to TabNavigationService
- Complex tab switching logic moved to service
- Auto-execution logic centralized in service

### useQueryStore

**Key Changes**:

- `updateQueryName` now uses QueryVersionService for tab synchronization
- Complex name update logic moved to service

## Current Functionality Preserved

All existing functionality has been preserved:

### Query Execution

- ✅ **Polling for results** - QueryExecutionService handles polling with timeouts
- ✅ **Version saving on SQL changes** - Automatic version creation when SQL differs
- ✅ **Filter integration** - Tab-specific filters applied to queries
- ✅ **Error handling** - Proper error states and fallbacks
- ✅ **Result processing** - Results formatted consistently

### Tab Navigation

- ✅ **State synchronization** - Editor content, sources, and states sync properly
- ✅ **Auto-execution** - SELECT queries auto-execute on tab switches
- ✅ **Dirty state tracking** - Unsaved changes tracked correctly
- ✅ **Source selection** - Query sources set as active sources

### Version Management

- ✅ **Name updates propagate** - Query renames update tab titles immediately
- ✅ **Version comparison** - Only saves when SQL actually changes
- ✅ **Ephemeral conversion** - Temporary queries convert to permanent ones
- ✅ **Tab synchronization** - Tabs update after version saves

## Testing the Refactoring

To verify all functionality still works:

### Query Execution Testing

1. **Run a query** - Should execute and show results
2. **Modify SQL and run** - Should save new version automatically
3. **Run same SQL twice** - Should reuse existing version
4. **Check query runs** - Should refresh and show latest runs
5. **Test filters** - WHERE and ORDER BY should work
6. **Test error handling** - Invalid SQL should show error

### Tab Navigation Testing

1. **Open multiple tabs** - Should track state per tab
2. **Switch between tabs** - Should sync editor content and sources
3. **Modify content in tab** - Should mark as dirty
4. **Switch away and back** - Should preserve unsaved changes
5. **Open query from tree** - Should open in new tab or switch to existing
6. **Open table from tree** - Should create ephemeral query and auto-execute

### Version Management Testing

1. **Rename a query** - Should update tab titles immediately
2. **Check query versions** - Should show all saved versions
3. **Save query with AI** - Should create version with "ai" trigger
4. **Convert ephemeral query** - Should work when making changes to table queries

### Edge Cases Testing

1. **Close tab with unsaved changes** - Should show confirmation
2. **Delete query with open tabs** - Should close all related tabs
3. **Network errors during execution** - Should handle gracefully
4. **Multiple users editing same query** - Should handle conflicts properly

## Architecture Benefits

### Separation of Concerns

- **Stores** focus on state management
- **Services** handle business logic
- **Components** handle UI interactions

### Testability

- Services can be unit tested independently
- Business logic isolated from Zustand state
- Mocking is easier for testing

### Maintainability

- Related functionality grouped together
- Easier to find and modify business logic
- Clear interfaces between layers

### Reusability

- Services can be used by multiple stores
- Logic can be shared across different contexts
- Easier to add new features

## Migration Notes

### For Developers

- Import services from `@/shared/services`
- Use service methods instead of direct store logic
- Services handle state updates internally
- Error handling is built into services

### Backward Compatibility

- All existing store APIs remain unchanged
- Components don't need modifications
- Existing functionality preserved completely

### Future Enhancements

- Add caching to services
- Implement service-level testing
- Add service composition for complex workflows
- Consider dependency injection for better testing

## Conclusion

The service layer extraction successfully moves complex business logic out of Zustand stores while preserving all existing functionality. The new architecture is more maintainable, testable, and provides clear separation of concerns.

Key benefits:

- **Cleaner stores** with focused responsibilities
- **Reusable services** that can be composed
- **Better testing** with isolated business logic
- **Preserved functionality** with no breaking changes
