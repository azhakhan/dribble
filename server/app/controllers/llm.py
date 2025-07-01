import re
from abc import ABC, abstractmethod

from typing import Dict, Any, List, AsyncGenerator, Optional, Union
import json
from uuid import UUID
from app.schemas.llm import LLMName
from app.models import (
    LLM,
    MessageTypeEnum,
)
from openai import OpenAI
from app.core.encryption import decrypt_password
from app.controllers.messages import ChatMessageService, ChatMessage
from app.controllers.chat_types import ContextQuery, ChatResponse
from datetime import datetime
from sqlalchemy.orm import Session


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""

    def __init__(
        self,
        llm: LLM,
        context_queries: List[ContextQuery],
        db_session: Session,
        message_service: Optional[ChatMessageService] = None,
    ):
        self.llm = llm
        self.context_queries = context_queries
        self.db_session = db_session
        self.message_service = message_service
        self.client = None
        self._initialize_client()

    @abstractmethod
    def _initialize_client(self):
        """Initialize the provider-specific client"""
        pass

    @abstractmethod
    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> Union[ChatResponse, AsyncGenerator[None]]:
        """Generate chat completion"""
        pass


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider implementation"""

    def _initialize_client(self):
        self.client = OpenAI(api_key=decrypt_password(self.llm.api_key))

    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> Union[ChatResponse, AsyncGenerator[None]]:
        openai_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

        # todo: remove this
        # write the messages to a file
        with open(f"messages_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(openai_messages, f, indent=4)

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
                    message_type=MessageTypeEnum.internal_message,
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
                        query_id_str = function_args.get("query_id")

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

                        # Execute query using the appropriate source
                        result = await self._execute_query_tool(sql_query, reasoning, query_id_str)

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
            sql_query = json_response.get("sql_query")
            response_content = json_response.get("content", content)
            updated_query_id_str = json_response.get("updated_query_id")
            updated_query_id = UUID(updated_query_id_str) if updated_query_id_str else None
        except (json.JSONDecodeError, ValueError):
            # Fallback to original content if JSON parsing fails
            sql_query = None
            response_content = content
            updated_query_id = None

        return ChatResponse(
            content=response_content, sql_query=sql_query, updated_query_id=updated_query_id
        )

    async def _execute_query_tool(
        self, sql_query: str, reasoning: str, query_id_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute SQL query tool - determines source from query context using query ID"""

        # Determine source from query ID or use active query
        source_id = None
        query_name = None

        if query_id_str:
            try:
                query_id = UUID(query_id_str)
                # Find source from query ID
                context_query = next(
                    (q for q in self.context_queries if q.query_id == query_id), None
                )
                if context_query:
                    source_id = context_query.source_id
                    query_name = context_query.name
                else:
                    return {
                        "error": f"Query with ID '{query_id_str}' not found in context",
                        "query": sql_query,
                        "status": "error",
                    }
            except ValueError:
                return {
                    "error": f"Invalid query ID format: '{query_id_str}'",
                    "query": sql_query,
                    "status": "error",
                }
        else:
            # Use active query's source
            active_query = next((q for q in self.context_queries if q.active), None)
            if active_query:
                source_id = active_query.source_id
                query_name = active_query.name
            else:
                return {
                    "error": "No active query found and no query ID specified",
                    "query": sql_query,
                    "status": "error",
                }

        try:
            # TODO: AZ implement using new worker

            return {
                "query": sql_query,
                "result": {},
                "reasoning": reasoning,
                "source_id": str(source_id),
                "query_name": query_name,
                "query_id": query_id_str,
                "status": "success",
            }

        except Exception as e:
            return {
                "error": f"Query execution failed: {str(e)}",
                "query": sql_query,
                "status": "error",
            }


class AnthropicProvider(BaseLLMProvider):
    """Anthropic (Claude) provider implementation"""

    def _initialize_client(self):
        raise NotImplementedError("Anthropic provider not yet implemented")

    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> Union[ChatResponse, AsyncGenerator[None]]:
        raise NotImplementedError("Anthropic provider not yet implemented")


class OllamaProvider(BaseLLMProvider):
    """Ollama provider implementation"""

    def _initialize_client(self):
        raise NotImplementedError("Ollama provider not yet implemented")

    async def chat_completion(
        self, messages: List[ChatMessage], tools: Optional[List[Dict]] = None
    ) -> Union[ChatResponse, AsyncGenerator[None]]:
        raise NotImplementedError("Ollama provider not yet implemented")


class LLMProviderFactory:
    """Factory for creating LLM providers"""

    @staticmethod
    def create_provider(
        llm: LLM,
        context_queries: List[ContextQuery],
        db_session: Session,
        message_service: Optional[ChatMessageService] = None,
    ) -> BaseLLMProvider:
        if llm.name == LLMName.openai:
            return OpenAIProvider(llm, context_queries, db_session, message_service)
        elif llm.name == LLMName.anthropic:
            return AnthropicProvider(llm, context_queries, db_session, message_service)
        elif llm.name == LLMName.ollama:
            return OllamaProvider(llm, context_queries, db_session, message_service)
        else:
            raise ValueError(f"Unsupported LLM provider: {llm.name}")


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

    # For WITH queries, ensure they end with SELECT and don't contain dangerous operations
    if cleaned_query.startswith("WITH"):
        # Check for dangerous keywords that would indicate non-read operations
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

        # Split the query to separate the WITH clause from the main query
        # Find the final SELECT statement
        parts = cleaned_query.split()
        select_found = False
        for i, part in enumerate(parts):
            if part == "SELECT" and i > 0:  # Not the first word (which would be WITH)
                select_found = True
            elif part in dangerous_keywords:
                return False

        # WITH queries must contain at least one SELECT
        if not select_found:
            return False
    else:
        # For regular SELECT queries, check for dangerous keywords
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
    "BaseLLMProvider",
    "OpenAIProvider",
    "LLMProviderFactory",
    "is_safe_query",
]
