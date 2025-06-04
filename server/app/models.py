from sqlalchemy import Column, DateTime, String, JSON, ForeignKey, Integer, Boolean
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import UUID
import enum
import uuid
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    chat_messages = relationship("ChatMessage", back_populates="user")
    created_at = Column(DateTime, default=datetime.now)


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    sources = relationship("Source", back_populates="workspace")
    workers = relationship("Worker", back_populates="workspace")
    llms = relationship("LLM", back_populates="workspace")
    chat_sessions = relationship("ChatSession", back_populates="workspace")
    created_at = Column(DateTime, default=datetime.now)


class RoleEnum(enum.Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class WorkspaceUser(Base):
    __tablename__ = "workspace_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(SqlEnum(RoleEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    dbtype = Column(String, nullable=False)
    creds = Column(JSON, nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    workspace = relationship("Workspace", back_populates="sources")
    queries = relationship("Query", back_populates="source")
    workers = relationship("Worker", back_populates="source")
    chat_sessions = relationship("ChatSession", back_populates="source")
    created_at = Column(DateTime, default=datetime.now)


class Query(Base):
    __tablename__ = "queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    query = Column(String, nullable=False)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="queries")
    created_at = Column(DateTime, default=datetime.now)


class Worker(Base):
    __tablename__ = "workers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="workers")
    container_id = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    host = Column(String, nullable=False)
    status = Column(String, nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    workspace = relationship("Workspace", back_populates="workers")
    created_at = Column(DateTime, default=datetime.now)


class LLM(Base):
    __tablename__ = "llms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    model = Column(String, nullable=False)
    api_key = Column(String, nullable=True)
    base_url = Column(String, nullable=True)
    api_version = Column(String, nullable=True)
    settings = Column(JSON, nullable=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    workspace = relationship("Workspace", back_populates="llms")
    chat_sessions = relationship("ChatSession", back_populates="llm")
    default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="chat_sessions")
    llm_id = Column(UUID(as_uuid=True), ForeignKey("llms.id"), nullable=False)
    llm = relationship("LLM", back_populates="chat_sessions")
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    workspace = relationship("Workspace", back_populates="chat_sessions")
    created_at = Column(DateTime, default=datetime.now)
    messages = relationship("ChatMessage", back_populates="chat_session")


class ChatRoleEnum(enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"  # For tool call responses


class MessageTypeEnum(enum.Enum):
    message = "message"  # Regular user/assistant message
    tool_call = "tool_call"  # Assistant tool call
    tool_response = "tool_response"  # Tool execution response


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(SqlEnum(ChatRoleEnum), nullable=False)
    content = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    message_type = Column(SqlEnum(MessageTypeEnum), nullable=False, default=MessageTypeEnum.message)
    message_metadata = Column(JSON, nullable=True)  # Store tool calls, reasoning, etc.
    parent_message_id = Column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True
    )  # For threading tool calls
    created_at = Column(DateTime, default=datetime.now)
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    chat_session = relationship("ChatSession", back_populates="messages")
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="chat_messages")

    # Self-referential relationship for message threading
    parent_message = relationship("ChatMessage", remote_side=[id], backref="child_messages")
