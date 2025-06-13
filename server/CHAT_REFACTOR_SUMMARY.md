# Chat Feature Refactoring Summary

## Overview

The chat feature has been refactored to move away from relying on a single SQL query from the editor and a selected source. Instead, it now uses a **context-based approach** where users can attach multiple queries as context, each with its own version and source.

## Key Changes

### 1. Context-Based Architecture

- **Before**: Chat relied on a single source and query from the editor
- **After**: Users can attach multiple queries as context, each with its own source and version

### 2. New Data Models

#### ContextQuery (Dataclass)

```python
@dataclass
class ContextQuery:
    query_id: UUID
    query_version_id: Optional[UUID]
    name: str
    sql: str
    source_id: UUID
    source_name: str
    active: bool = False
```

#### Updated ChatResponse

```python
@dataclass
class ChatResponse:
    content: str
    sql_query: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    query_id: Optional[UUID] = None
    updated_query_id: Optional[UUID] = None  # NEW - Uses UUID for uniqueness
```

### 3. Enhanced Services

#### ChatContextService

- Loads context queries with their SQL from query versions
- Manages active query logic
- Provides query lookup by UUID (not name for uniqueness)

#### Updated ChatService

- **Now handles session and message creation internally**
- Supports context-based chat workflow
- Composes system prompts with context information
- Handles LLM provider creation with context
- Simplified constructor: `ChatService(db_session)` only

### 4. Smart Query Update Logic

- **Default**: LLM updates the active query (marked with `active=True`)
- **UUID-based Updates**: User can reference queries by name, but LLM uses UUIDs internally
- **Validation**: If no active query and no query specified, LLM asks for clarification
- **Tracking**: Response includes `updated_query_id` (UUID) to indicate which query was modified

### 5. Enhanced Tool Execution

The `execute_sql_query` tool now:

- Accepts optional `query_id` parameter (UUID for uniqueness)
- Determines source from query context using UUID lookup
- Falls back to active query if no ID specified
- Provides better error handling for missing context
- **Eliminates query name ambiguity issues**

### 6. Improved System Prompts

System prompts now include:

- All context queries with their SQL and UUIDs
- Source information for each query
- Active query indication with UUID
- Clear instructions for query update logic using UUIDs
- Available query UUIDs for tool execution

### 7. Simplified Chat Endpoint

The chat route is now much cleaner:

- All session/message creation logic moved to ChatService
- Simple initialization: `ChatService(db)`
- Single method call: `await service.chat(request)`

## Usage Examples

### Basic Context Setup

```python
context = [
    ChatContext(
        query_id=action_actors_id,  # UUID for uniqueness
        query_version_id=latest_version_id,
        active=True  # This query will be updated by default
    ),
    ChatContext(
        query_id=movie_stars_id,  # UUID for uniqueness
        query_version_id=specific_version_id,
        active=False  # Reference query for comparison
    )
]

request = ChatLLMRequest(
    session_id=session_id,
    context=context,
    llm_id=llm_id,
    message="Update query action_actors to follow the same pattern as movie_stars"
)
```

### LLM Tool Usage (UUID-based)

```json
{
  "tool_calls": [
    {
      "function": {
        "name": "execute_sql_query",
        "arguments": {
          "query": "SELECT * FROM actors LIMIT 5",
          "reasoning": "Testing current structure of action_actors query",
          "query_id": "550e8400-e29b-41d4-a716-446655440000"
        }
      }
    }
  ]
}
```

### LLM Response Examples

#### Updating Active Query

```json
{
  "content": "I've optimized the action_actors query...",
  "sql_query": "SELECT ...",
  "updated_query_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### No Active Query - Ask for Clarification

```json
{
  "content": "I see multiple queries in context. Which would you like me to update: action_actors (550e8400-e29b-41d4-a716-446655440000) or movie_stars (6ba7b810-9dad-11d1-80b4-00c04fd430c8)?"
}
```

## Migration Considerations

### Database Changes

1. **Models Updated**: Fixed relationships between ChatContext, Query, and QueryVersion
2. **ChatMessage**: Added `sql_query` field (migration already exists)
3. **ChatSession**: Removed `source_id` dependency (no longer tied to single source)

### API Changes

1. **ChatLLMRequest**: Now requires `context` parameter, removed `source_id`
2. **Tool Parameters**: `execute_sql_query` tool accepts `query_id` (UUID) instead of `query_name`
3. **Response Format**: Added `updated_query_id` field (UUID)
4. **ChatSessionResponse**: Removed `source_id` field

### Code Changes

1. **Chat Route**: Significantly simplified, all logic moved to ChatService
2. **ChatService**: New constructor signature, handles session/message creation
3. **Query Identification**: Uses UUIDs instead of names for uniqueness

## Benefits

1. **Uniqueness**: Query identification by UUID eliminates name collision issues
2. **Flexibility**: Support multiple queries with different sources
3. **Context Awareness**: LLM can compare and relate different queries
4. **Version Control**: Each query can reference specific versions
5. **Source Independence**: Chat sessions not tied to single database
6. **Clear Tracking**: Know exactly which query was updated (by UUID)
7. **Tool Intelligence**: Automatic source selection for query execution
8. **Simplified Architecture**: Cleaner separation of concerns

## File Changes

- **Updated**: `server/app/controllers/chat.py` - Complete refactor with UUID-based approach
- **Updated**: `server/app/models.py` - Fixed relationships, added sql_query field
- **Updated**: `server/app/routes/chat.py` - Simplified route with logic moved to service
- **Updated**: `server/app/schemas/chat.py` - Removed source_id dependencies
- **Updated**: `server/CHAT_REFACTOR_SUMMARY.md` - This document

## Next Steps

1. **Update Frontend**: Modify UI to support context selection and display query UUIDs
2. **API Endpoints**: All chat API changes are complete
3. **Testing**: Add tests for context-based chat functionality
4. **Migration**: Create migration scripts if needed for production
5. **Documentation**: Update API documentation with new schemas

## Breaking Changes

⚠️ **Important**: This refactor introduces breaking changes:

1. **ChatLLMRequest**: Removed `source_id` field
2. **ChatSessionResponse**: Removed `source_id` field
3. **Tool Parameters**: Changed from `query_name` to `query_id`
4. **Response Field**: Changed from `updated_query_name` to `updated_query_id`
5. **ChatService Constructor**: Now takes only `db_session` parameter
