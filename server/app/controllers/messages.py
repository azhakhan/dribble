from typing import Dict, Any, List, Optional
import json
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.models import (
    ChatSession,
    ChatMessage as ChatMessageModel,
    ChatRoleEnum,
    MessageTypeEnum,
)


@dataclass
class ChatMessage:
    """Structured chat message for LLM processing"""

    role: str
    content: str
    metadata: Optional[Dict[str, Any]] = None


class ChatMessageService:
    """Service for managing chat message persistence and retrieval"""

    def __init__(self, db_session: Session, chat_session: ChatSession):
        self.db = db_session
        self.chat_session = chat_session

    def load_messages(self) -> List[ChatMessage]:
        """Load all messages for the chat session as ChatMessage dataclasses"""
        db_messages = (
            self.db.query(ChatMessageModel)
            .filter(ChatMessageModel.chat_session_id == self.chat_session.id)
            .order_by(ChatMessageModel.position)
            .all()
        )

        # Convert database models to dataclasses for LLM processing
        messages = []
        for db_msg in db_messages:
            # Skip tool calls and tool responses for LLM context (they're stored for audit trail)
            if db_msg.message_type in [MessageTypeEnum.tool_call, MessageTypeEnum.tool_response]:
                continue

            messages.append(
                ChatMessage(
                    role=db_msg.role.value, content=db_msg.content, metadata=db_msg.message_metadata
                )
            )

        return messages

    def save_message(
        self,
        role: str,
        content: str,
        message_type: MessageTypeEnum = MessageTypeEnum.message,
        metadata: Optional[Dict[str, Any]] = None,
        parent_message_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ChatMessageModel:
        """Save a message to the database"""

        # Get the next position
        last_position = (
            self.db.query(ChatMessageModel.position)
            .filter(ChatMessageModel.chat_session_id == self.chat_session.id)
            .order_by(ChatMessageModel.position.desc())
            .first()
        )
        next_position = (last_position[0] + 1) if last_position else 0

        # Convert string role to enum
        role_enum = ChatRoleEnum(role)

        db_message = ChatMessageModel(
            role=role_enum,
            content=content,
            position=next_position,
            message_type=message_type,
            message_metadata=metadata,
            parent_message_id=parent_message_id,
            chat_session_id=self.chat_session.id,
            user_id=user_id,
        )

        self.db.add(db_message)
        self.db.commit()
        self.db.refresh(db_message)

        return db_message

    def save_tool_call(
        self,
        tool_call_id: str,
        function_name: str,
        arguments: Dict[str, Any],
        parent_message_id: str,
    ) -> ChatMessageModel:
        """Save a tool call to the database"""
        metadata = {
            "tool_call_id": tool_call_id,
            "function_name": function_name,
            "arguments": arguments,
        }

        content = f"Tool call: {function_name}"

        return self.save_message(
            role="assistant",
            content=content,
            message_type=MessageTypeEnum.tool_call,
            metadata=metadata,
            parent_message_id=parent_message_id,
        )

    def save_tool_response(
        self, tool_call_id: str, response: Dict[str, Any], parent_message_id: str
    ) -> ChatMessageModel:
        """Save a tool response to the database"""
        metadata = {"tool_call_id": tool_call_id, "response": response}

        content = f"Tool response: {json.dumps(response, indent=2)}"

        return self.save_message(
            role="tool",
            content=content,
            message_type=MessageTypeEnum.tool_response,
            metadata=metadata,
            parent_message_id=parent_message_id,
        )
