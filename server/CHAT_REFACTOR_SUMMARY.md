# Chat Feature Refactoring Summary

## Overview

The chat feature has been refactored to move away from relying on a single SQL query from the editor and a selected source. Instead, it now uses a **context-based approach** where users can attach multiple queries as context, each with its own version and source. **NEW**: Context can now be updated with each message, similar to how Cursor works.

## Key Changes

### 1. Context-Based Architecture

- **Before**: Chat relied on a single source and query from the editor
- **After**: Users can attach multiple queries as context, each with its own source and version
- **NEW**: Context can be updated with each new message, allowing dynamic context switching

### 2. Dynamic Context Updates

- **Context per Message**: Each message can have its own context, not just the first message
- **System Prompt Updates**: System prompt is automatically updated when context changes
- **Context Comparison**: Smart detection of context changes to avoid unnecessary updates
- **Cursor-like Behavior**: Users can switch context queries between messages seamlessly

### 3. No Context Required

- **General SQL Help**: Users can chat without any context for general SQL learning
- **Educational Mode**: Ask about SQL syntax, concepts, and best practices
- **Flexible Usage**: Both educational and context-specific workflows supported

### 4. New Data Models

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

### 5. Enhanced Services

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

### 6. Smart Query Update Logic

- **Default**: LLM updates the active query (marked with `active=True`)
- **UUID-based Updates**: User can reference queries by name, but LLM uses UUIDs internally
- **Validation**: If no active query and no query specified, LLM asks for clarification
- **Tracking**: Response includes `updated_query_id` (UUID) to indicate which query was modified

### 7. Enhanced Tool Execution

The `execute_sql_query` tool now:

- Accepts optional `query_id` parameter (UUID for uniqueness)
- Determines source from query context using UUID lookup
- Falls back to active query if no ID specified
- Provides better error handling for missing context
- **Eliminates query name ambiguity issues**

### 8. Improved System Prompts

System prompts now include:

- All context queries with their SQL and UUIDs
- Source information for each query
- Active query indication with UUID
- Clear instructions for query update logic using UUIDs
- Available query UUIDs for tool execution
- **NEW**: Complete database schema information for all sources in context

### Database Schema Integration (NEW)

The system now automatically includes database schema information in the system prompt when context queries are present:

- **Automatic Schema Loading**: Fetches schema for all unique sources in context queries
- **Complete Table Information**: Includes tables, columns, data types, primary keys, and foreign keys
- **Schema-Aware Queries**: LLM can suggest better joins and constraints using actual schema
- **No Hallucination**: LLM instructed to only use tables/columns shown in the schema
- **Schema Caching**: Schemas are cached to improve performance (handled by `get_source_schema`)

#### Schema Information Included:

- Source name and ID for each database
- Database schemas (e.g., `public`, `analytics`)
- Tables with complete column definitions
- Data types and nullable information
- Primary key constraints
- Foreign key relationships
- Schema.table format guidance for multi-schema databases

### 9. Simplified Chat Endpoint

The chat route is now much cleaner:

- All session/message creation logic moved to ChatService
- Simple initialization: `ChatService(db)`
- Single method call: `await service.chat(request)`

## Usage Examples

### Dynamic Context Updates (NEW)

#### Scenario 1: Starting without context, then adding context

```javascript
// Message 1: General SQL help
{
  "session_id": "session-123",
  "llm_id": "llm-456",
  "message": "How do I write a JOIN query?",
  "context": []  // No context
}
// Response: General SQL education about JOINs

// Message 2: Adding specific queries to context
{
  "session_id": "session-123",
  "llm_id": "llm-456",
  "message": "Now help me optimize this specific query",
  "context": [
    {
      "query_id": "action-actors-uuid",
      "active": true
    }
  ]
}
// System prompt automatically updated with new context
// Response: Context-specific query optimization
```

#### Scenario 2: Switching context between messages

```javascript
// Message 1: Working with first query
{
  "session_id": "session-123",
  "llm_id": "llm-456",
  "message": "Optimize this query for performance",
  "context": [
    {
      "query_id": "query-1-uuid",
      "active": true
    }
  ]
}

// Message 2: Switching to different query
{
  "session_id": "session-123",
  "llm_id": "llm-456",
  "message": "Now look at this other query instead",
  "context": [
    {
      "query_id": "query-2-uuid",  // Different query
      "active": true
    }
  ]
}
// System prompt updated with new context
// LLM now has access to query-2 instead of query-1
```

#### Scenario 3: Adding multiple queries to context

```javascript
// Message: Compare and relate multiple queries
{
  "session_id": "session-123",
  "llm_id": "llm-456",
  "message": "Compare these queries and suggest improvements",
  "context": [
    {
      "query_id": "sales-query-uuid",
      "active": true
    },
    {
      "query_id": "revenue-query-uuid",
      "active": false
    },
    {
      "query_id": "customers-query-uuid",
      "active": false
    }
  ]
}
// All three queries available in context
// LLM can compare and analyze relationships
```

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

#### Schema-Aware Query Suggestions (NEW)

```json
{
  "content": "Based on the database schema, I can see that the `users` table has a foreign key relationship with `orders`. Here's an optimized query that properly joins these tables using the available columns:",
  "sql_query": "SELECT u.id, u.name, u.email, COUNT(o.id) as order_count FROM public.users u LEFT JOIN public.orders o ON u.id = o.user_id GROUP BY u.id, u.name, u.email",
  "updated_query_id": "550e8400-e29b-41d4-a716-446655440000"
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
9. **Schema Awareness**: LLM has complete knowledge of database structure
10. **No Hallucination**: Only references actual tables and columns that exist
11. **Better Suggestions**: Can recommend proper joins, constraints, and optimizations
12. **Multi-Database Support**: Handles different schemas and sources simultaneously

## File Changes

- **Updated**: `server/app/controllers/chat.py` - Complete refactor with UUID-based approach + database schema integration
- **Updated**: `server/app/models.py` - Fixed relationships, added sql_query field
- **Updated**: `server/app/routes/chat.py` - Simplified route with logic moved to service
- **Updated**: `server/app/schemas/chat.py` - Removed source_id dependencies
- **Updated**: `server/CHAT_REFACTOR_SUMMARY.md` - This document

### Latest Changes (Database Schema Integration):

- **Modified**: `ChatContextService.load_database_schemas()` - New method to fetch schemas for all unique sources
- **Modified**: `ChatService.chat()` - Now loads database schemas and passes to system prompt
- **Modified**: `ChatService._compose_system_prompt()` - Enhanced to include complete database schema information
- **Enhanced**: System prompt with detailed schema information including tables, columns, keys, and relationships

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

## How It Works:

### Dynamic Context Flow:

<svg aria-roledescription="flowchart-v2" role="graphics-document document" viewBox="-8 -8 635.3515625 865.046875" style="max-width: 635.3515625px;" xmlns="http://www.w3.org/2000/svg" width="100%" id="mermaid-svg-1749857068961-e0vdambii"><style>#mermaid-svg-1749857068961-e0vdambii{font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:16px;fill:rgba(204, 204, 204, 0.87);}#mermaid-svg-1749857068961-e0vdambii .error-icon{fill:#bf616a;}#mermaid-svg-1749857068961-e0vdambii .error-text{fill:#bf616a;stroke:#bf616a;}#mermaid-svg-1749857068961-e0vdambii .edge-thickness-normal{stroke-width:2px;}#mermaid-svg-1749857068961-e0vdambii .edge-thickness-thick{stroke-width:3.5px;}#mermaid-svg-1749857068961-e0vdambii .edge-pattern-solid{stroke-dasharray:0;}#mermaid-svg-1749857068961-e0vdambii .edge-pattern-dashed{stroke-dasharray:3;}#mermaid-svg-1749857068961-e0vdambii .edge-pattern-dotted{stroke-dasharray:2;}#mermaid-svg-1749857068961-e0vdambii .marker{fill:rgba(204, 204, 204, 0.87);stroke:rgba(204, 204, 204, 0.87);}#mermaid-svg-1749857068961-e0vdambii .marker.cross{stroke:rgba(204, 204, 204, 0.87);}#mermaid-svg-1749857068961-e0vdambii svg{font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:16px;}#mermaid-svg-1749857068961-e0vdambii .label{font-family:"trebuchet ms",verdana,arial,sans-serif;color:rgba(204, 204, 204, 0.87);}#mermaid-svg-1749857068961-e0vdambii .cluster-label text{fill:#ffffff;}#mermaid-svg-1749857068961-e0vdambii .cluster-label span,#mermaid-svg-1749857068961-e0vdambii p{color:#ffffff;}#mermaid-svg-1749857068961-e0vdambii .label text,#mermaid-svg-1749857068961-e0vdambii span,#mermaid-svg-1749857068961-e0vdambii p{fill:rgba(204, 204, 204, 0.87);color:rgba(204, 204, 204, 0.87);}#mermaid-svg-1749857068961-e0vdambii .node rect,#mermaid-svg-1749857068961-e0vdambii .node circle,#mermaid-svg-1749857068961-e0vdambii .node ellipse,#mermaid-svg-1749857068961-e0vdambii .node polygon,#mermaid-svg-1749857068961-e0vdambii .node path{fill:#1a1a1a;stroke:#2a2a2a;stroke-width:1px;}#mermaid-svg-1749857068961-e0vdambii .flowchart-label text{text-anchor:middle;}#mermaid-svg-1749857068961-e0vdambii .node .label{text-align:center;}#mermaid-svg-1749857068961-e0vdambii .node.clickable{cursor:pointer;}#mermaid-svg-1749857068961-e0vdambii .arrowheadPath{fill:#e5e5e5;}#mermaid-svg-1749857068961-e0vdambii .edgePath .path{stroke:rgba(204, 204, 204, 0.87);stroke-width:2.0px;}#mermaid-svg-1749857068961-e0vdambii .flowchart-link{stroke:rgba(204, 204, 204, 0.87);fill:none;}#mermaid-svg-1749857068961-e0vdambii .edgeLabel{background-color:#1a1a1a99;text-align:center;}#mermaid-svg-1749857068961-e0vdambii .edgeLabel rect{opacity:0.5;background-color:#1a1a1a99;fill:#1a1a1a99;}#mermaid-svg-1749857068961-e0vdambii .labelBkg{background-color:rgba(26, 26, 26, 0.5);}#mermaid-svg-1749857068961-e0vdambii .cluster rect{fill:rgba(64, 64, 64, 0.47);stroke:#30373a;stroke-width:1px;}#mermaid-svg-1749857068961-e0vdambii .cluster text{fill:#ffffff;}#mermaid-svg-1749857068961-e0vdambii .cluster span,#mermaid-svg-1749857068961-e0vdambii p{color:#ffffff;}#mermaid-svg-1749857068961-e0vdambii div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:"trebuchet ms",verdana,arial,sans-serif;font-size:12px;background:#88c0d0;border:1px solid #30373a;border-radius:2px;pointer-events:none;z-index:100;}#mermaid-svg-1749857068961-e0vdambii .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgba(204, 204, 204, 0.87);}#mermaid-svg-1749857068961-e0vdambii :root{--mermaid-font-family:"trebuchet ms",verdana,arial,sans-serif;}</style><g><marker orient="auto" markerHeight="12" markerWidth="12" markerUnits="userSpaceOnUse" refY="5" refX="6" viewBox="0 0 10 10" class="marker flowchart" id="mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd"><path style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 0 0 L 10 5 L 0 10 z"/></marker><marker orient="auto" markerHeight="12" markerWidth="12" markerUnits="userSpaceOnUse" refY="5" refX="4.5" viewBox="0 0 10 10" class="marker flowchart" id="mermaid-svg-1749857068961-e0vdambii_flowchart-pointStart"><path style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 0 5 L 10 10 L 10 0 z"/></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5" refX="11" viewBox="0 0 10 10" class="marker flowchart" id="mermaid-svg-1749857068961-e0vdambii_flowchart-circleEnd"><circle style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" r="5" cy="5" cx="5"/></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5" refX="-1" viewBox="0 0 10 10" class="marker flowchart" id="mermaid-svg-1749857068961-e0vdambii_flowchart-circleStart"><circle style="stroke-width: 1; stroke-dasharray: 1, 0;" class="arrowMarkerPath" r="5" cy="5" cx="5"/></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5.2" refX="12" viewBox="0 0 11 11" class="marker cross flowchart" id="mermaid-svg-1749857068961-e0vdambii_flowchart-crossEnd"><path style="stroke-width: 2; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 1,1 l 9,9 M 10,1 l -9,9"/></marker><marker orient="auto" markerHeight="11" markerWidth="11" markerUnits="userSpaceOnUse" refY="5.2" refX="-1" viewBox="0 0 11 11" class="marker cross flowchart" id="mermaid-svg-1749857068961-e0vdambii_flowchart-crossStart"><path style="stroke-width: 2; stroke-dasharray: 1, 0;" class="arrowMarkerPath" d="M 1,1 l 9,9 M 10,1 l -9,9"/></marker><g class="root"><g class="clusters"/><g class="edgePaths"><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-A LE-B" id="L-A-B-0" d="M311.682,33.5L311.682,37.667C311.682,41.833,311.682,50.167,311.682,57.617C311.682,65.067,311.682,71.633,311.682,74.917L311.682,78.2"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-B LE-C" id="L-B-C-0" d="M311.682,117L311.682,121.167C311.682,125.333,311.682,133.667,311.748,141.2C311.814,148.734,311.946,155.467,312.012,158.834L312.078,162.201"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-C LE-D" id="L-C-D-0" d="M261.899,266.608L232.796,280.613C203.693,294.619,145.487,322.63,116.384,345.135C87.281,367.641,87.281,384.641,87.281,401.641C87.281,418.641,87.281,435.641,87.281,464.57C87.281,493.5,87.281,534.359,87.281,575.219C87.281,616.078,87.281,656.938,87.281,682.192C87.281,707.447,87.281,717.097,87.281,721.922L87.281,726.747"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-C LE-E" id="L-C-E-0" d="M350.245,278.827L362.685,290.796C375.125,302.765,400.005,326.703,412.445,343.497C424.885,360.291,424.885,369.941,424.885,374.766L424.885,379.591"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-E LE-F" id="L-E-F-0" d="M424.885,418.391L424.885,424.099C424.885,429.807,424.885,441.224,424.955,451.841C425.026,462.457,425.167,472.274,425.238,477.183L425.309,482.091"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-F LE-G" id="L-F-G-0" d="M383.371,622.033L371.757,634.66C360.143,647.288,336.915,672.542,325.301,689.995C313.688,707.447,313.688,717.097,313.688,721.922L313.688,726.747"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-F LE-H" id="L-F-H-0" d="M467.399,622.033L478.846,634.66C490.293,647.288,513.188,672.542,524.635,689.995C536.082,707.447,536.082,717.097,536.082,721.922L536.082,726.747"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-D LE-I" id="L-D-I-0" d="M87.281,765.547L87.281,769.714C87.281,773.88,87.281,782.214,109.008,790.387C130.735,798.56,174.188,806.573,195.915,810.579L217.642,814.586"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-G LE-I" id="L-G-I-0" d="M313.688,765.547L313.688,769.714C313.688,773.88,313.688,782.214,313.688,789.664C313.688,797.114,313.688,803.68,313.688,806.964L313.688,810.247"/><path marker-end="url(#mermaid-svg-1749857068961-e0vdambii_flowchart-pointEnd)" style="fill:none;" class="edge-thickness-normal edge-pattern-solid flowchart-link LS-H LE-I" id="L-H-I-0" d="M536.082,765.547L536.082,769.714C536.082,773.88,536.082,782.214,514.755,790.384C493.428,798.554,450.774,806.562,429.448,810.565L408.121,814.569"/></g><g class="edgeLabels"><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"></span></div></foreignObject></g></g><g transform="translate(87.28125, 452.640625)" class="edgeLabel"><g transform="translate(-11.32421875, -9.25)" class="label"><foreignObject height="18.5" width="22.6484375"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel">Yes</span></div></foreignObject></g></g><g transform="translate(424.884765625, 350.640625)" class="edgeLabel"><g transform="translate(-9.3984375, -9.25)" class="label"><foreignObject height="18.5" width="18.796875"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel">No</span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"></span></div></foreignObject></g></g><g transform="translate(313.6875, 697.796875)" class="edgeLabel"><g transform="translate(-11.32421875, -9.25)" class="label"><foreignObject height="18.5" width="22.6484375"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel">Yes</span></div></foreignObject></g></g><g transform="translate(536.08203125, 697.796875)" class="edgeLabel"><g transform="translate(-9.3984375, -9.25)" class="label"><foreignObject height="18.5" width="18.796875"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel">No</span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"></span></div></foreignObject></g></g><g class="edgeLabel"><g transform="translate(0, 0)" class="label"><foreignObject height="0" width="0"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="edgeLabel"></span></div></foreignObject></g></g></g><g class="nodes"><g transform="translate(311.681640625, 16.75)" id="flowchart-A-20" class="node default default flowchart-label"><rect height="33.5" width="108.859375" y="-16.75" x="-54.4296875" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-46.9296875, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="93.859375"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">New Message</span></div></foreignObject></g></g><g transform="translate(311.681640625, 100.25)" id="flowchart-B-21" class="node default default flowchart-label"><rect height="33.5" width="169.5390625" y="-16.75" x="-84.76953125" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-77.26953125, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="154.5390625"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Load Current Context</span></div></foreignObject></g></g><g transform="translate(311.681640625, 241.6953125)" id="flowchart-C-23" class="node default default flowchart-label"><polygon style="" transform="translate(-74.6953125,74.6953125)" class="label-container" points="74.6953125,0 149.390625,-74.6953125 74.6953125,-149.390625 0,-74.6953125"/><g transform="translate(-50.4453125, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="100.890625"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">First Message?</span></div></foreignObject></g></g><g transform="translate(87.28125, 748.796875)" id="flowchart-D-25" class="node default default flowchart-label"><rect height="33.5" width="174.5625" y="-16.75" x="-87.28125" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-79.78125, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="159.5625"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Create System Prompt</span></div></foreignObject></g></g><g transform="translate(424.884765625, 401.640625)" id="flowchart-E-27" class="node default default flowchart-label"><rect height="33.5" width="199.203125" y="-16.75" x="-99.6015625" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-92.1015625, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="184.203125"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Get Last Message Context</span></div></foreignObject></g></g><g transform="translate(424.884765625, 575.21875)" id="flowchart-F-29" class="node default default flowchart-label"><polygon style="" transform="translate(-88.328125,88.328125)" class="label-container" points="88.328125,0 176.65625,-88.328125 88.328125,-176.65625 0,-88.328125"/><g transform="translate(-64.078125, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="128.15625"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Context Changed?</span></div></foreignObject></g></g><g transform="translate(313.6875, 748.796875)" id="flowchart-G-31" class="node default default flowchart-label"><rect height="33.5" width="178.25" y="-16.75" x="-89.125" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-81.625, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="163.25"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Update System Prompt</span></div></foreignObject></g></g><g transform="translate(536.08203125, 748.796875)" id="flowchart-H-33" class="node default default flowchart-label"><rect height="33.5" width="166.5390625" y="-16.75" x="-83.26953125" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-75.76953125, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="151.5390625"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Keep Existing Prompt</span></div></foreignObject></g></g><g transform="translate(313.6875, 832.296875)" id="flowchart-I-35" class="node default default flowchart-label"><rect height="33.5" width="184.1953125" y="-16.75" x="-92.09765625" ry="0" rx="0" style="" class="basic label-container"/><g transform="translate(-84.59765625, -9.25)" style="" class="label"><rect/><foreignObject height="18.5" width="169.1953125"><div style="display: inline-block; white-space: nowrap;" xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Save Message &amp; Process</span></div></foreignObject></g></g></g></g></g></svg>
