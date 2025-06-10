# Ephemeral Queries Feature Documentation

## Overview

The **Ephemeral Queries** feature enables one-off, non-persistent queries used for previewing tables. When users double-click a table, the system creates a temporary query that can be converted to a regular saved query when the user modifies and runs it.

## Key Concepts

### Preview Key Format

The `preview_key` format has been updated to distinguish between tables and views:

- **New Format**: `table-source_id.schema.table_name` or `view-source_id.schema.view_name`
- **Legacy Format**: `source_id.schema.table` (still supported for backward compatibility)
- **Purpose**: Prevents conflicts when table and view names are identical
- **Examples**:
  - Table: `table-abc123.public.users`
  - View: `view-abc123.public.users`

## Key Concepts

### Ephemeral Query

- **Purpose**: Temporary queries for table and view previews
- **Lifecycle**: Created on table/view double-click, converted to regular query when user edits and runs
- **Visibility**: Hidden from QueryTree UI but stored in backend for functionality
- **Identification**: Uses `preview_key` in format `table-source_id.schema.table` or `view-source_id.schema.view`
- **Conflict Resolution**: Table and view names can now coexist without conflicts due to type prefix

### Regular Query

- **Purpose**: Persistent, saved queries created by users
- **Lifecycle**: Either created explicitly or converted from ephemeral queries
- **Visibility**: Shown in QueryTree UI
- **Naming**: Auto-generated or user-defined

## Database Schema Changes

### Query Model Updates

```sql
-- Added to queries table
is_ephemeral = Column(Boolean, default=False)
preview_key = Column(String, nullable=True)  -- Format: "table-source_id.schema.table" or "view-source_id.schema.view"
```

### Migration

- **File**: `c29789fd9477_added_is_ephemeral_and_preview_key_to_.py`
- **Changes**: Added `is_ephemeral` and `preview_key` columns to queries table

## Backend API Changes

### New Schemas

#### Query Schemas (`server/app/schemas/query.py`)

```python
# Updated existing schemas
class CreateQueryRequest(BaseModel):
    source_id: UUID
    is_ephemeral: Optional[bool] = False
    preview_key: Optional[str] = None

class UpdateQueryRequest(BaseModel):
    name: Optional[str] = None
    is_ephemeral: Optional[bool] = None

class QueryResponse(BaseModel):
    id: UUID
    name: Optional[str]
    is_ephemeral: Optional[bool]
    preview_key: Optional[str]
    source_id: UUID
    created_by: UUID
    created_at: datetime

# New schemas for ephemeral operations
class CreateEphemeralQueryRequest(BaseModel):
    source_id: UUID
    preview_key: str

class ConvertEphemeralQueryRequest(BaseModel):
    name: str
```

### New Service Methods (`server/app/controllers/query_service.py`)

#### `get_or_create_ephemeral_query()`

- **Purpose**: Finds existing ephemeral query or creates new one
- **Logic**:
  - Searches for existing ephemeral query by `source_id` and `preview_key`
  - If found, returns existing query
  - If not found, creates new ephemeral query with initial `SELECT * FROM schema.table LIMIT 101` version
- **Auto-versioning**: Creates initial QueryVersion with `save_trigger="manual"`

#### `convert_ephemeral_to_regular()`

- **Purpose**: Converts ephemeral query to regular query
- **Logic**:
  - Sets `is_ephemeral = False`
  - Sets provided name
  - Keeps `preview_key` for reference
- **Idempotent**: Safe to call multiple times, won't error if already regular

### New API Endpoints (`server/app/routes/query.py`)

#### `POST /query/ephemeral`

- **Purpose**: Get or create ephemeral query for table preview
- **Request**: `CreateEphemeralQueryRequest`
- **Response**: `QueryResponse`

#### `PUT /query/{query_id}/convert`

- **Purpose**: Convert ephemeral query to regular query
- **Request**: `ConvertEphemeralQueryRequest`
- **Response**: `QueryResponse`

## Frontend Changes

### TypeScript Types (`client/src/shared/lib/api.ts`)

#### Updated Query Interface

```typescript
export interface Query {
  id: UUID;
  name?: string;
  is_ephemeral?: boolean;
  preview_key?: string;
  source_id: UUID;
  created_by: UUID;
  created_at: string;
}
```

#### New API Functions

```typescript
export const getOrCreateEphemeralQuery = async (
  sourceId: string,
  schema: string,
  table: string
): Promise<Query>

export const convertEphemeralToRegular = async (
  queryId: string,
  name: string
): Promise<Query>
```

### Store Updates (`client/src/shared/store/useAppStore.ts`)

#### New Store Methods

```typescript
// Ephemeral query management
getOrCreateEphemeralQuery: (sourceId: string, schema: string, table: string) => Promise<Query>;
convertEphemeralToRegular: (queryId: string, name: string) => Promise<Query>;
```

#### Enhanced executeQuery Logic

- **Conversion Check**: Before execution, checks if ephemeral query has been modified
- **Conversion Trigger**: Only converts when `tab.isDirty && content !== originalContent`
- **Version Saving**: Skips duplicate version creation for unmodified ephemeral queries

### UI Components

#### Table Double-Click Handler (`client/src/pages/IdePage.tsx`)

```typescript
const handleTableDoubleClick = async (sourceId: string, tableName: string) => {
  // 1. Parse schema.table format
  // 2. Get or create ephemeral query
  // 3. Check for existing tab
  // 4. Create new tab with proper content
  // 5. Execute immediately
};
```

#### QueryTree Filtering (`client/src/features/sources/QueryTree.tsx`)

- **UI Filtering**: Ephemeral queries filtered out from display
- **Store Retention**: Ephemeral queries kept in store for functionality
- **Dual Filtering**: Applied to both store data and API fallback data

#### Editor Conversion Logic

- **Removed**: Auto-conversion on content change (was too aggressive)
- **Moved**: Conversion logic to `executeQuery` function
- **Trigger**: Only on explicit user action (running query)

## User Flow

### Table Preview Flow

1. **User double-clicks table** (e.g., `public.products`)
2. **System creates ephemeral query**:
   - `is_ephemeral = true`
   - `preview_key = "source_id.public.products"`
   - Initial version with `SELECT * FROM public.products LIMIT 101`
3. **System opens tab**:
   - Title: `public.products`
   - Content: Generated SQL
   - `isDirty: false`
   - `originalContent` and `lastSavedContent` set to SQL
4. **System executes query immediately**
5. **Query remains ephemeral** (hidden from QueryTree)

### Conversion Flow

1. **User edits SQL** in ephemeral query tab
2. **Tab becomes dirty** (`isDirty: true`)
3. **User clicks Run button**
4. **System converts to regular query**:
   - Generates name: `"source schema table YYYY-MM-DD"`
   - Sets `is_ephemeral = false`
   - Updates store and UI
5. **System saves new version** with `save_trigger="run"`
6. **System executes modified query**
7. **Query now appears in QueryTree**

## Technical Considerations

### Race Condition Prevention

- **Version Saving**: Skips duplicate versions for unmodified ephemeral queries
- **Conversion Logic**: Only triggers on explicit user actions, not automatic executions
- **Idempotent Operations**: Conversion method safe to call multiple times

### Data Consistency

- **Store Synchronization**: Ephemeral queries stored in frontend for conversion logic
- **UI Filtering**: Applied at component level, not data level
- **Preview Key Uniqueness**: Ensures one ephemeral query per table per user

### Performance Optimizations

- **Lazy Loading**: Ephemeral queries created only when needed
- **Efficient Filtering**: Client-side filtering prevents unnecessary API calls
- **Smart Execution**: Prevents duplicate version creation

## Error Handling

### Backend Error Handling

- **Idempotent Conversion**: Returns existing query if already regular
- **Graceful Degradation**: Continues execution even if conversion fails
- **Validation**: Checks for query existence before operations

### Frontend Error Handling

- **Fallback Behavior**: Falls back to old table preview on ephemeral query creation failure
- **User Feedback**: Toast notifications for conversion success/failure
- **Continuation**: Query execution continues even if conversion fails

## Configuration

### Default Limits

- **Preview Query**: `SELECT * FROM schema.table LIMIT 101` (same for tables and views)
- **Name Format**: `"source schema table YYYY-MM-DD"` (same for tables and views)

### Database Constraints

- **preview_key**: Nullable string, no unique constraint (allows multiple users). Format distinguishes tables from views.
- **is_ephemeral**: Boolean, defaults to `false`

## Testing Considerations

### Test Scenarios

1. **Table double-click creates ephemeral query**
2. **Ephemeral query hidden from QueryTree**
3. **Content modification triggers conversion**
4. **Unmodified ephemeral queries don't create duplicate versions**
5. **Converted queries appear in QueryTree**
6. **Multiple users can preview same table**
7. **Error handling works correctly**

### Edge Cases

- **Rapid double-clicks**: Should reuse existing ephemeral query
- **Content unchanged**: Should not convert on execution
- **Tab switching**: Ephemeral state preserved
- **Network failures**: Graceful degradation to fallback behavior
