from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from uuid import UUID
from app.schemas.chat import ChatLLMRequest, ChatContext as ChatContextSchema
from app.models import (
    LLM,
    Source,
    ChatSession,
    MessageTypeEnum,
    Query,
    QueryVersion,
    ChatContext as ChatContextModel,
    ChatMessage as ChatMessageModel,
    ChatRoleEnum,
)
from app.controllers.messages import ChatMessageService, ChatMessage
from app.core.db_utils import safe_create, get_or_404
from app.controllers.llm import LLMProviderFactory, BaseLLMProvider
from app.controllers.chat_types import ChatResponse, ContextQuery
from app.controllers.sources import get_source_schema


class ChatContextService:
    """Service for managing chat context with queries"""

    def __init__(self, db_session: Session):
        self.db = db_session

    def load_context_queries(self, context: List[ChatContextSchema]) -> List[ContextQuery]:
        """Load context queries with their SQL from query versions"""
        context_queries = []

        for ctx in context:
            # Load query and version
            query = self.db.query(Query).filter(Query.id == ctx.query_id).first()
            if not query:
                continue

            # Get SQL from specific version or latest version
            if ctx.query_version_id:
                version = (
                    self.db.query(QueryVersion)
                    .filter(QueryVersion.id == ctx.query_version_id)
                    .first()
                )
            else:
                version = (
                    self.db.query(QueryVersion)
                    .filter(QueryVersion.query_id == ctx.query_id)
                    .order_by(QueryVersion.created_at.desc())
                    .first()
                )

            if not version:
                continue

            # Load source information
            source = self.db.query(Source).filter(Source.id == query.source_id).first()
            if not source:
                continue

            context_queries.append(
                ContextQuery(
                    query_id=query.id,
                    query_version_id=version.id,
                    name=query.name or f"query_{query.id}",
                    sql=version.sql,
                    source_id=source.id,
                    source_name=source.name,
                    active=ctx.active,
                )
            )

        return context_queries

    def get_active_query(self, context_queries: List[ContextQuery]) -> Optional[ContextQuery]:
        """Get the active query from context"""
        return next((q for q in context_queries if q.active), None)

    def find_query_by_id(
        self, context_queries: List[ContextQuery], query_id: UUID
    ) -> Optional[ContextQuery]:
        """Find query by ID in context"""
        return next((q for q in context_queries if q.query_id == query_id), None)

    def get_last_message_context(self, chat_session_id: UUID) -> List[ContextQuery]:
        """Get context from the last user message in the session"""
        # Get the last user message
        last_message = (
            self.db.query(ChatMessageModel)
            .filter(
                ChatMessageModel.chat_session_id == chat_session_id,
                ChatMessageModel.role == ChatRoleEnum.user,
            )
            .order_by(ChatMessageModel.created_at.desc())
            .first()
        )

        if not last_message:
            return []

        # Get context for that message
        context_models = (
            self.db.query(ChatContextModel)
            .filter(ChatContextModel.message_id == last_message.id)
            .all()
        )

        # Convert to ChatContextSchema and load
        context_schemas = []
        for ctx_model in context_models:
            context_schemas.append(
                ChatContextSchema(
                    query_id=ctx_model.query_id,
                    query_version_id=ctx_model.query_version_id,
                    active=ctx_model.active,
                )
            )

        return self.load_context_queries(context_schemas)

    def contexts_are_different(
        self, context1: List[ContextQuery], context2: List[ContextQuery]
    ) -> bool:
        """Compare two context lists to see if they're different

        This method compares both the structure (query_id, version_id, active) and the actual
        SQL content to detect changes. This ensures system prompt is updated when:
        1. Context structure changes (different queries, versions, or active status)
        2. SQL content changes (even if version_id appears the same due to caching)
        """
        if len(context1) != len(context2):
            return True

        # Create comparable sets with both version_id and SQL content hash
        # This catches both structural changes and content changes
        set1 = {(q.query_id, q.query_version_id, q.active, hash(q.sql)) for q in context1}
        set2 = {(q.query_id, q.query_version_id, q.active, hash(q.sql)) for q in context2}

        return set1 != set2

    async def load_database_schemas(self, context_queries: List[ContextQuery]) -> Dict[str, Dict]:
        """Load database schemas for all unique sources in context queries"""
        schemas = {}

        # Get unique source IDs from context queries
        unique_source_ids = set()
        for query in context_queries:
            unique_source_ids.add(str(query.source_id))

        # Load schema for each unique source
        for source_id in unique_source_ids:
            try:
                schema_data = await get_source_schema(source_id, self.db)
                schemas[source_id] = schema_data
            except Exception as e:
                # If schema loading fails, log it but don't break the chat
                print(f"Warning: Could not load schema for source {source_id}: {e}")
                schemas[source_id] = None

        return schemas


class ChatService:
    """Main service for handling LLM chat functionality with context support"""

    def __init__(self, db_session: Session):
        self.db = db_session
        self.context_service = ChatContextService(db_session)

    async def chat(self, request: ChatLLMRequest) -> ChatResponse:
        """Main chat method with context support"""

        # Load current context queries
        current_context_queries = []
        if request.context:
            current_context_queries = self.context_service.load_context_queries(request.context)

        # Load database schemas for context queries
        database_schemas = {}
        if current_context_queries:
            database_schemas = await self.context_service.load_database_schemas(
                current_context_queries
            )

        # Create or get chat session
        chat_session = await self._get_or_create_session(request)

        # Initialize message service
        message_service = ChatMessageService(self.db, chat_session)

        # Load existing messages from database
        messages = message_service.load_messages()

        # Check if this is the first message or if context has changed
        should_update_system_prompt = False

        if not messages:
            # First message - always create system prompt
            should_update_system_prompt = True
        else:
            # Check if context has changed from last message
            last_context_queries = self.context_service.get_last_message_context(chat_session.id)
            if self.context_service.contexts_are_different(
                current_context_queries, last_context_queries
            ):
                should_update_system_prompt = True

        # Update system prompt if needed
        if should_update_system_prompt:
            new_system_prompt = self._compose_system_prompt(
                current_context_queries, database_schemas
            )

            if messages and messages[0].role == "system":
                # Update existing system message
                messages[0] = ChatMessage(role="system", content=new_system_prompt)
                # Save the updated system prompt to database
                # TODO: make system messages immutable
                message_service.update_system_message(
                    new_system_prompt,
                    {
                        "schema_version": "1.0",
                        "context_queries": len(current_context_queries),
                        "context_updated": True,
                    },
                )
            else:
                # Create new system message
                message_service.save_message(
                    role="system",
                    content=new_system_prompt,
                    metadata={
                        "schema_version": "1.0",
                        "context_queries": len(current_context_queries),
                    },
                )
                messages.insert(0, ChatMessage(role="system", content=new_system_prompt))

        # Save user message and context
        await self._save_user_message_with_context(request, chat_session)

        # Add user message to the conversation
        messages.append(ChatMessage(role="user", content=request.message))

        # Create LLM provider with current context
        llm = self.db.query(LLM).filter(LLM.id == request.llm_id).first()
        if not llm:
            return ChatResponse(content="LLM not found", metadata={"error": "invalid_llm_id"})

        provider = LLMProviderFactory.create_provider(
            llm, current_context_queries, self.db, message_service
        )

        tools = self._get_tools(current_context_queries)

        # Generate response
        return await self._handle_regular_response(messages, provider, tools, message_service)

    async def _get_or_create_session(self, request: ChatLLMRequest) -> ChatSession:
        """Get existing chat session or create a new one"""
        if request.session_id:
            chat_session = self.db.query(ChatSession).filter_by(id=request.session_id).first()
            if chat_session:
                return chat_session

        # Create new session
        chat_session = safe_create(
            self.db,
            ChatSession(
                id=request.session_id,
                llm_id=request.llm_id,
            ),
        )
        return chat_session

    async def _save_user_message_with_context(
        self, request: ChatLLMRequest, chat_session: ChatSession
    ):
        """Save user message and associated context to database"""
        # Create message service for this session
        message_service = ChatMessageService(self.db, chat_session)

        # Create user message using message service (which handles position)
        chat_message = message_service.save_message(
            role="user",
            content=request.message,
            message_type=MessageTypeEnum.message,
        )

        # Save context for this message
        if request.context:
            for ctx in request.context:
                # Validate query and version exist
                query = get_or_404(self.db, Query, ctx.query_id, "Query not found")
                if ctx.query_version_id:
                    get_or_404(
                        self.db, QueryVersion, ctx.query_version_id, "Query version not found"
                    )

                safe_create(
                    self.db,
                    ChatContextModel(
                        message_id=chat_message.id,
                        query_id=query.id,
                        query_version_id=ctx.query_version_id,
                        active=ctx.active,
                    ),
                )

    async def _handle_regular_response(
        self,
        messages: List[ChatMessage],
        provider: BaseLLMProvider,
        tools: List[Dict],
        message_service: ChatMessageService,
    ) -> ChatResponse:
        """Handle non-streaming response with database persistence"""
        response = await provider.chat_completion(messages, tools)

        # Save response with potential query update
        message_service.save_message(
            role="assistant",
            content=response.content,
            sql_query=response.sql_query,
            metadata={
                "updated_query_id": str(response.updated_query_id)
                if response.updated_query_id
                else None
            },
        )
        return response

    def _get_tools(self, context_queries: List[ContextQuery]) -> List[Dict]:
        """Get available tools for the LLM with context information"""

        # If no context queries, don't provide SQL execution tools
        if not context_queries:
            return []

        # Create query reference list for the LLM
        query_refs = []
        for query in context_queries:
            status = " (ACTIVE)" if query.active else ""
            query_refs.append(f"- ID: {query.query_id}, Name: '{query.name}'{status}")

        query_list = "\n".join(query_refs)

        return [
            {
                "type": "function",
                "function": {
                    "name": "execute_sql_query",
                    "description": f"""Execute a SQL query against one of the databases in the context and return the results. 
                    Use this to run queries and analyze data before providing your final response. 
                    Only use SELECT queries for data exploration. Avoid destructive operations. 
                    Always add LIMIT 10 to the query to avoid returning too many results.
                    
                    Available queries in context:
                    {query_list}""",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The SQL query to execute (SELECT statements only)",
                            },
                            "reasoning": {
                                "type": "string",
                                "description": "Brief explanation of why you're running this query",
                            },
                            "query_id": {
                                "type": "string",
                                "description": f"UUID of the query context to use for execution. If not specified, will use the active query. Available IDs: {', '.join(str(q.query_id) for q in context_queries)}",
                            },
                        },
                        "required": ["query", "reasoning"],
                    },
                },
            }
        ]

    def _compose_system_prompt(
        self, context_queries: List[ContextQuery], database_schemas: Dict[str, Dict]
    ) -> str:
        """Compose system prompt for the LLM with context information"""

        # If no context queries, provide general SQL assistance
        if not context_queries:
            return """
You are a senior SQL expert assistant helping users learn and write SQL queries.

Your job is to help users:
- Generate correct and optimized SQL based on natural language requests
- Explain SQL concepts and syntax in plain English
- Review and improve SQL queries
- Teach best practices for database querying
- Answer questions about SQL syntax, functions, and operations

You must respond with a JSON object in the following format:
{
  "content": "Your response content here",
  "sql_query": "SQL query here (only when generating/modifying SQL)"
}

IMPORTANT RULES:
1. Include the "sql_query" field when:
   - User asks you to generate, create, write, or modify SQL
   - User wants a query for a specific task
   - User asks for optimization or improvement of SQL

2. Provide educational explanations when teaching SQL concepts
3. Always write syntactically correct SQL
4. Explain what queries do in plain English
5. Suggest best practices and optimizations
6. Never hallucinate table or column names - ask for clarification if needed
7. Avoid destructive commands (DROP, DELETE, TRUNCATE) unless explicitly requested and explained

Since you don't have access to specific databases, focus on teaching SQL concepts and syntax.
"""

        # Check if user is asking to update a specific query
        active_query = self.context_service.get_active_query(context_queries)

        # Build context section
        context_section = "CONTEXT QUERIES:\n"
        for query in context_queries:
            status = " (ACTIVE)" if query.active else ""
            context_section += f"""
Query ID: {query.query_id}{status}
Query Name: {query.name}
Source: {query.source_name} (ID: {query.source_id})
Current SQL:
```sql
{query.sql}
```
---"""

        # Build database schemas section
        schemas_section = ""
        if database_schemas:
            schemas_section = "\nDATABASE SCHEMAS:\n"
            for source_id, schema_data in database_schemas.items():
                if schema_data is None:
                    continue

                # Find source name from context queries
                source_name = "Unknown"
                for query in context_queries:
                    if str(query.source_id) == source_id:
                        source_name = query.source_name
                        break

                schemas_section += f"\nSource: {source_name} (ID: {source_id})\n"

                # Process each schema in the database
                for schema_name, schema_info in schema_data.items():
                    if not isinstance(schema_info, dict) or "tables" not in schema_info:
                        continue

                    schemas_section += f"\nSchema: {schema_name}\n"

                    # List tables and their columns
                    for table_name, table_info in schema_info["tables"].items():
                        schemas_section += f"  Table: {table_name}\n"

                        # Add columns
                        if "columns" in table_info:
                            for column in table_info["columns"]:
                                nullable = " (nullable)" if column.get("nullable", False) else ""
                                schemas_section += (
                                    f"    - {column['name']}: {column['type']}{nullable}\n"
                                )

                        # Add primary keys
                        if "primary_keys" in table_info and table_info["primary_keys"]:
                            pk_list = ", ".join(table_info["primary_keys"])
                            schemas_section += f"    Primary Keys: {pk_list}\n"

                        # Add foreign keys
                        if "foreign_keys" in table_info and table_info["foreign_keys"]:
                            for fk in table_info["foreign_keys"]:
                                if isinstance(fk, dict):
                                    schemas_section += f"    Foreign Key: {fk.get('column')} -> {fk.get('referenced_table')}.{fk.get('referenced_column')}\n"

                        schemas_section += "\n"

                schemas_section += "---\n"

        system_prompt = f"""
You are a senior SQL expert assisting a user in writing and editing SQL queries with access to multiple query contexts.

Your job is to help users:
- Generate correct and optimized SQL based on natural language requests
- Modify or improve existing SQL queries in the context
- Explain what queries do in plain English
- Compare and relate different queries in the context
- Ensure that queries are syntactically correct and valid for their respective databases

{context_section}

{schemas_section}

IMPORTANT RULES:
1. You have access to tools that allow you to execute SQL queries against the databases. Use these tools to:
   - Test queries before providing final results
   - Analyze data to provide better insights
   - Verify that queries work correctly
   - Gather sample data to better understand the user's needs

2. You must respond with a JSON object in the following format:
{{
  "content": "Your response content here",
  "sql_query": "SQL query here (only when generating/modifying SQL)",
  "updated_query_id": "UUID of query being updated (only when updating a specific query)"
}}

3. Include the "sql_query" field when:
   - User asks you to generate, create, write, or modify SQL
   - User wants a query for a specific task
   - User asks for optimization or improvement of SQL

4. Include the "updated_query_id" field when:
   - You're providing an updated version of a specific query in the context
   - User explicitly asks to update a query by name or reference
   - You're modifying the active query

5. Query Update Logic:
   - By default, update the ACTIVE query (marked with "ACTIVE" above)
   - If user mentions a specific query name or references a query, update that query
   - If no active query exists and user doesn't specify a query, ask which query to update
   - Always specify the updated_query_id (UUID) when providing SQL updates
   - Use query IDs (UUIDs) for precise identification, not names (names may not be unique)

6. For each query context, follow the syntax for its target database type
7. Database schemas are provided above - refer ONLY to the available tables and columns shown in the schema
8. Never hallucinate table or column names - use only what's shown in the database schemas
9. When suggesting queries, ensure they reference the correct schema.table format when needed
10. Avoid destructive commands (DROP, DELETE, TRUNCATE) unless explicitly asked
11. When comparing queries, explain similarities and differences clearly
12. Use the execute_sql_query tool to run queries before suggesting updates
13. When using tools, specify query_id (UUID) to ensure you're working with the correct database
14. Use the database schema information to suggest better joins, constraints, and optimizations

CURRENT ACTIVE QUERY: {active_query.name + " (" + str(active_query.query_id) + ")" if active_query else "None"}

The user is working with the above query contexts and wants assistance.
"""

        return system_prompt


# Export classes for external use
__all__ = [
    "ChatService",
    "ChatMessageService",
    "ChatMessage",
    "ChatResponse",
    "ContextQuery",
]
