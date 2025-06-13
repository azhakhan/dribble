from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ChatMessageResponse(BaseModel):
    """Standardized chat message response for client consumption"""

    role: str  # "user" | "assistant"
    content: str
    sql_query: Optional[str] = None  # SQL query if message contains one
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessagesResponse(BaseModel):
    """Response containing list of chat messages"""

    messages: List[ChatMessageResponse]
    session_id: UUID
    total_count: int


class ChatSessionResponse(BaseModel):
    """Chat session response"""

    id: UUID
    name: Optional[str] = None
    source_id: UUID
    llm_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionsResponse(BaseModel):
    """Response containing list of chat sessions"""

    sessions: List[ChatSessionResponse]
    total_count: int


class ChatContext(BaseModel):
    """Chat context"""

    query_id: Optional[UUID] = None
    query_version_id: Optional[UUID] = None
    active: bool = False


class ChatLLMRequest(BaseModel):
    session_id: Optional[UUID]
    context: Optional[List[ChatContext]] = None
    llm_id: UUID
    message: str


class ChatLLMResponse(BaseModel):
    """Structured response for non-streaming chat"""

    content: str
    sql_query: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    query_id: Optional[UUID] = None
