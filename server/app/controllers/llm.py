from abc import ABC, abstractmethod
from typing import Dict, Any, List, AsyncGenerator, Optional, Union
from enum import Enum
import json
import re
import asyncio
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.schemas.llm import LLMName, ChatLLMRequest
from app.models import LLM, Source, ChatSession, MessageTypeEnum
from openai import OpenAI
from app.core.encryption import decrypt_password
from app.controllers.sources import get_source_schema
from app.controllers.query import execute_in_worker, get_query_results
from app.controllers.messages import ChatMessageService, ChatMessage


class ActionType(str, Enum):
    """Actions to take based on response"""

    UPDATE_EDITOR = "update_editor"
    SHOW_MESSAGE = "show_message"


@dataclass
class ChatResponse:
    """Structured response from LLM chat"""

    content: str
    action: ActionType
    sql_query: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class StreamChunk:
    """Single chunk of streaming data"""

    content: str
    is_complete: bool = False
    action: Optional[ActionType] = None
    metadata: Optional[Dict[str, Any]] = None


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""

    def __init__(
        self,
        llm: LLM,
        query_executor: Optional["SQLQueryExecutor"] = None,
        message_service: Optional[ChatMessageService] = None,
    ):
        self.llm = llm
        self.query_executor = query_executor
        self.message_service = message_service
        self.client = None
        self._initialize_client()

    @abstractmethod
    def _initialize_client(self):
        """Initialize the provider-specific client"""
        pass

    @abstractmethod
    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None, stream: bool = False
    ) -> Union[ChatResponse, AsyncGenerator[StreamChunk, None]]:
        """Generate chat completion"""
        pass

    @abstractmethod
    async def stream_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream chat completion"""
        pass


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider implementation"""

    def _initialize_client(self):
        self.client = OpenAI(api_key=decrypt_password(self.llm.api_key))

    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None, stream: bool = False
    ) -> Union[ChatResponse, AsyncGenerator[StreamChunk, None]]:
        if stream:
            return self.stream_completion(messages, tools)

        openai_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

        # Track tool usage for safety
        tool_call_count = 0
        max_tool_calls = 5

        # Initial call
        response = self.client.chat.completions.create(
            model=self.llm.model,
            messages=openai_messages,
            tools=tools or [],
            tool_choice="auto" if tools else "none",
            temperature=1,
            max_tokens=2048,
            top_p=1,
            response_format={"type": "json_object"},
        )

        # Handle tool calls (existing logic)
        assistant_message_id = None
        while response.choices[0].message.tool_calls and tool_call_count < max_tool_calls:
            tool_call_count += 1

            # Save the assistant message with tool calls if we have message service
            if self.message_service and assistant_message_id is None:
                assistant_db_msg = self.message_service.save_message(
                    role="assistant",
                    content="Executing tool calls...",
                    message_type=MessageTypeEnum.message,
                    metadata={"has_tool_calls": True},
                )
                assistant_message_id = str(assistant_db_msg.id)

            openai_messages.append(response.choices[0].message)

            for tool_call in response.choices[0].message.tool_calls:
                if tool_call.function.name == "execute_sql_query":
                    try:
                        function_args = json.loads(tool_call.function.arguments)
                        sql_query = function_args["query"]
                        reasoning = function_args["reasoning"]

                        # Save tool call to database
                        if self.message_service and assistant_message_id:
                            self.message_service.save_tool_call(
                                tool_call_id=tool_call.id,
                                function_name=tool_call.function.name,
                                arguments=function_args,
                                parent_message_id=assistant_message_id,
                            )

                        if not is_safe_query(sql_query):
                            error_result = {
                                "error": "Query rejected for safety reasons. Only SELECT queries are allowed.",
                                "query": sql_query,
                            }

                            # Save tool response to database
                            if self.message_service and assistant_message_id:
                                self.message_service.save_tool_response(
                                    tool_call_id=tool_call.id,
                                    response=error_result,
                                    parent_message_id=assistant_message_id,
                                )

                            error_response = {
                                "role": "tool",
                                "content": json.dumps(error_result),
                                "tool_call_id": tool_call.id,
                            }
                            openai_messages.append(error_response)
                            continue

                        # Execute query using the query executor
                        if self.query_executor:
                            result = await self.query_executor.execute_query(sql_query, reasoning)
                        else:
                            result = await self._execute_query_tool(sql_query, reasoning)

                        # Save tool response to database
                        if self.message_service and assistant_message_id:
                            self.message_service.save_tool_response(
                                tool_call_id=tool_call.id,
                                response=result,
                                parent_message_id=assistant_message_id,
                            )

                        tool_response = {
                            "role": "tool",
                            "content": json.dumps(result),
                            "tool_call_id": tool_call.id,
                        }
                        openai_messages.append(tool_response)

                    except Exception as e:
                        error_result = {
                            "error": f"Query execution failed: {str(e)}",
                            "query": function_args.get("query", "Unknown query"),
                            "status": "error",
                        }

                        # Save tool response to database
                        if self.message_service and assistant_message_id:
                            self.message_service.save_tool_response(
                                tool_call_id=tool_call.id,
                                response=error_result,
                                parent_message_id=assistant_message_id,
                            )

                        error_response = {
                            "role": "tool",
                            "content": json.dumps(error_result),
                            "tool_call_id": tool_call.id,
                        }
                        openai_messages.append(error_response)

            response = self.client.chat.completions.create(
                model=self.llm.model,
                messages=openai_messages,
                tools=tools or [],
                tool_choice="auto" if tools else "none",
                temperature=1,
                max_tokens=2048,
                top_p=1,
                response_format={"type": "json_object"},
            )

        content = response.choices[0].message.content

        # Parse JSON response
        try:
            json_response = json.loads(content)
            action_str = json_response.get("action", "show_message")
            action = (
                ActionType.UPDATE_EDITOR
                if action_str == "update_editor"
                else ActionType.SHOW_MESSAGE
            )
            sql_query = json_response.get("sql_query")
            response_content = json_response.get("content", content)
        except json.JSONDecodeError:
            # Fallback to original content if JSON parsing fails
            action = ActionType.SHOW_MESSAGE
            sql_query = None
            response_content = content

        return ChatResponse(content=response_content, action=action, sql_query=sql_query)

    async def stream_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> AsyncGenerator[StreamChunk, None]:
        openai_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

        stream = self.client.chat.completions.create(
            model=self.llm.model,
            messages=openai_messages,
            tools=tools or [],
            tool_choice="auto" if tools else "none",
            temperature=1,
            max_tokens=2048,
            top_p=1,
            stream=True,
            response_format={"type": "json_object"},
        )

        accumulated_content = ""
        accumulated_metadata = {}

        for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                accumulated_content += content

                if chunk.metadata:
                    accumulated_metadata.update(chunk.metadata)

                yield StreamChunk(content=content, is_complete=False)

        # Parse final JSON response
        try:
            json_response = json.loads(accumulated_content)
            action_str = json_response.get("action", "show_message")
            action = (
                ActionType.UPDATE_EDITOR
                if action_str == "update_editor"
                else ActionType.SHOW_MESSAGE
            )
            sql_query = json_response.get("sql_query")
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            action = ActionType.SHOW_MESSAGE
            sql_query = None

        yield StreamChunk(
            content="",
            is_complete=True,
            action=action,
            metadata={"sql_query": sql_query} if sql_query else None,
        )

    async def _execute_query_tool(self, sql_query: str, reasoning: str) -> Dict[str, Any]:
        """Fallback execute SQL query tool - used when no query executor is provided"""
        print(f"LLM is executing query: {sql_query}")
        print(f"Reasoning: {reasoning}")

        return {
            "query": sql_query,
            "result": "Tool execution not implemented in this context",
            "reasoning": reasoning,
            "status": "success",
        }


class AnthropicProvider(BaseLLMProvider):
    """Anthropic (Claude) provider implementation"""

    def _initialize_client(self):
        raise NotImplementedError("Anthropic provider not yet implemented")

    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None, stream: bool = False
    ) -> Union[ChatResponse, AsyncGenerator[StreamChunk, None]]:
        raise NotImplementedError("Anthropic provider not yet implemented")

    async def stream_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> AsyncGenerator[StreamChunk, None]:
        raise NotImplementedError("Anthropic provider not yet implemented")


class OllamaProvider(BaseLLMProvider):
    """Ollama provider implementation"""

    def _initialize_client(self):
        raise NotImplementedError("Ollama provider not yet implemented")

    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None, stream: bool = False
    ) -> Union[ChatResponse, AsyncGenerator[StreamChunk, None]]:
        raise NotImplementedError("Ollama provider not yet implemented")

    async def stream_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> AsyncGenerator[StreamChunk, None]:
        raise NotImplementedError("Ollama provider not yet implemented")


class LLMProviderFactory:
    """Factory for creating LLM providers"""

    @staticmethod
    def create_provider(
        llm: LLM,
        query_executor: Optional["SQLQueryExecutor"] = None,
        message_service: Optional[ChatMessageService] = None,
    ) -> BaseLLMProvider:
        if llm.name == LLMName.openai:
            return OpenAIProvider(llm, query_executor, message_service)
        elif llm.name == LLMName.anthropic:
            return AnthropicProvider(llm, query_executor, message_service)
        elif llm.name == LLMName.ollama:
            return OllamaProvider(llm, query_executor, message_service)
        else:
            raise ValueError(f"Unsupported LLM provider: {llm.name}")


class SQLQueryExecutor:
    """Handles SQL query execution for tool calls"""

    def __init__(self, source: Source):
        self.source = source

    def _ensure_query_limit(self, query: str, default_limit: int = 10) -> str:
        """
        Add LIMIT clause to SELECT queries that don't already have one.
        Returns the modified query with LIMIT added if necessary.
        """
        # Clean and normalize the query
        cleaned_query = query.strip()
        normalized_query = " ".join(cleaned_query.split()).upper()

        # Only process SELECT queries (including CTEs that start with WITH)
        if not (normalized_query.startswith("SELECT") or normalized_query.startswith("WITH")):
            return query

        # Check if LIMIT already exists
        if "LIMIT" in normalized_query:
            return query

        # Add LIMIT to the query
        # Handle potential semicolon at the end
        if cleaned_query.endswith(";"):
            return f"{cleaned_query[:-1]} LIMIT {default_limit};"
        else:
            return f"{cleaned_query} LIMIT {default_limit}"

    async def execute_query(self, sql_query: str, reasoning: str) -> Dict[str, Any]:
        """Execute SQL query and return results"""
        try:
            print(f"LLM is executing query: {sql_query}")
            print(f"Reasoning: {reasoning}")

            # Ensure query has LIMIT 10 if it's a SELECT query without LIMIT
            processed_query = self._ensure_query_limit(sql_query)
            if processed_query != sql_query:
                print(f"Added LIMIT to query: {processed_query}")

            result = execute_in_worker(self.source.id, processed_query)
            query_id = result.get("query_id")

            if query_id:
                # Wait for query results
                for _ in range(5):
                    result = await get_query_results(query_id)
                    if result.get("status") == "success":
                        break
                    await asyncio.sleep(1)

                if result.get("status") == "error":
                    result_data = result.get("error")
                else:
                    result_data = result.get("data")
            else:
                result_data = result

            return {
                "query": processed_query,
                "result": result_data,
                "reasoning": reasoning,
                "status": "success",
            }

        except Exception as e:
            return {
                "error": f"Query execution failed: {str(e)}",
                "query": sql_query,
                "status": "error",
            }


class ChatService:
    """Main service for handling LLM chat functionality"""

    def __init__(
        self,
        llm: LLM,
        source: Source,
        chat_session: ChatSession,
        db_session: Session,
        user_id: Optional[str] = None,
    ):
        self.llm = llm
        self.source = source
        self.chat_session = chat_session
        self.db = db_session
        self.user_id = user_id
        self.query_executor = SQLQueryExecutor(source)
        self.message_service = ChatMessageService(db_session, chat_session)
        self.provider = LLMProviderFactory.create_provider(
            llm, self.query_executor, self.message_service
        )
        self.tools = self._get_tools()

    async def chat(
        self, request: ChatLLMRequest, stream: bool = False
    ) -> Union[ChatResponse, AsyncGenerator[StreamChunk, None]]:
        """Main chat method"""
        schema = await get_source_schema(str(self.source.id))

        # Load existing messages from database
        messages = self.message_service.load_messages()

        # Add system prompt if no messages exist yet
        if not messages:
            system_prompt = self._compose_system_prompt(schema, request.query)
            self.message_service.save_message(
                role="system",
                content=system_prompt,
                metadata={"schema_version": "1.0"},  # Track schema versions for debugging
            )
            messages.append(ChatMessage(role="system", content=system_prompt))

        # Save user message to database
        self.message_service.save_message(
            role="user", content=request.message, user_id=self.user_id
        )

        # Add user message to the conversation
        messages.append(ChatMessage(role="user", content=request.message))

        # Generate response
        if stream:
            return self._handle_streaming_response(messages)
        else:
            return await self._handle_regular_response(messages)

    async def _handle_regular_response(self, messages: List[ChatMessage]) -> ChatResponse:
        """Handle non-streaming response with database persistence"""
        response = await self.provider.chat_completion(messages, self.tools, stream=False)

        if isinstance(response, ChatResponse):
            # Save assistant response to database
            self.message_service.save_message(
                role="assistant",
                content=response.content,
                metadata=(
                    {"action": response.action.value, "sql_query": response.sql_query}
                    if response.sql_query
                    else {"action": response.action.value}
                ),
            )

            return response
        else:
            raise ValueError("Unexpected response type in non-streaming mode")

    async def _handle_streaming_response(
        self, messages: List[ChatMessage]
    ) -> AsyncGenerator[StreamChunk, None]:
        """Handle streaming response with database persistence"""
        accumulated_content = ""
        accumulated_metadata = {}

        async for chunk in self.provider.stream_completion(messages, self.tools):
            accumulated_content += chunk.content

            if chunk.metadata:
                accumulated_metadata.update(chunk.metadata)

            yield chunk

            # Save complete response when streaming is done
            if chunk.is_complete:
                self.message_service.save_message(
                    role="assistant",
                    content=accumulated_content,
                    metadata={
                        "action": chunk.action.value if chunk.action else "show_message",
                        **accumulated_metadata,
                    },
                )

    def _get_tools(self) -> List[Dict]:
        """Get available tools for the LLM"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "execute_sql_query",
                    "description": "Execute a SQL query against the database and return the results. Use this to run queries and analyze data before providing your final response. Only use SELECT queries for data exploration. Avoid destructive operations. Alwats add LIMIT 10 to the query to avoid returning too many results.",
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
                        },
                        "required": ["query", "reasoning"],
                    },
                },
            }
        ]

    def _compose_system_prompt(self, schema: dict, query: str | None = None):
        """Compose system prompt for the LLM"""
        system_prompt = f"""
You are a senior SQL expert assisting a user in writing and editing SQL queries.

Your job is to help users:
- Generate correct and optimized SQL based on natural language requests
- Modify or improve existing SQL
- Explain what a query does in plain English
- Ensure that queries are syntactically correct and valid for the selected database

You have access to tools that allow you to execute SQL queries against the database. Use these tools to:
- Test queries before providing final results
- Analyze data to provide better insights
- Verify that queries work correctly
- Gather sample data to better understand the user's needs

IMPORTANT: You must respond with a JSON object in the following format:
{{
  "action": "update_editor" | "show_message",
  "content": "Your response content here",
  "sql_query": "SQL query here (only if action is update_editor)"
}}

Use "update_editor" action when:
- User asks you to generate, create, write, or modify SQL
- User wants a query for a specific task
- User asks for optimization or improvement of SQL

Use "show_message" action when:
- User asks you to explain existing SQL
- User asks general questions about databases
- User wants clarification or help understanding something
- You're providing general guidance or conversation

Use the following rules:
- Follow the syntax for the target database: {self.source.dbtype}
- Refer only to available tables, columns, and relationships provided in the schema
- Never hallucinate table or column names
- Avoid destructive commands (DROP, DELETE, TRUNCATE) unless explicitly asked
- Avoid using LIMIT without an ORDER BY clause
- Prefer CTEs for readability when queries are complex

If the user provides a partial query, improve or complete it while preserving intent.
If the user provides both a query and a request (e.g. "optimize this"), rewrite accordingly.

Your output must be ready to run.

Here is the current database schema:

{json.dumps(schema)}

The user is working in this context.
"""
        if query:
            system_prompt += f"""
Here is the user's current query:

{query}
"""
        return system_prompt


def is_safe_query(query: str) -> bool:
    """
    Basic safety check to ensure only SELECT queries are executed.
    This prevents destructive operations like DELETE, DROP, etc.
    """
    # Remove comments and normalize whitespace
    cleaned_query = re.sub(r"--.*$", "", query, flags=re.MULTILINE)
    cleaned_query = re.sub(r"/\*.*?\*/", "", cleaned_query, flags=re.DOTALL)
    cleaned_query = " ".join(cleaned_query.split()).strip().upper()

    # Check if query starts with SELECT or WITH (for CTEs)
    if not (cleaned_query.startswith("SELECT") or cleaned_query.startswith("WITH")):
        return False

    # Check for dangerous keywords
    dangerous_keywords = [
        "DELETE",
        "DROP",
        "TRUNCATE",
        "INSERT",
        "UPDATE",
        "ALTER",
        "CREATE",
        "GRANT",
        "REVOKE",
        "EXEC",
        "EXECUTE",
    ]

    for keyword in dangerous_keywords:
        if keyword in cleaned_query:
            return False

    return True


# Export classes for external use
__all__ = [
    "ChatService",
    "ChatMessageService",
    "ChatMessage",
    "LLMProviderFactory",
    "ActionType",
    "ChatResponse",
    "StreamChunk",
    "MessageTypeEnum",
]
