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
    queries = relationship("Query", back_populates="created_by_user")
    query_versions = relationship("QueryVersion", back_populates="created_by_user")
    query_runs = relationship("QueryRun", back_populates="created_by_user")
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
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by_user = relationship("User", back_populates="queries")
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="queries")
    versions = relationship("QueryVersion", back_populates="query")
    created_at = Column(DateTime, default=datetime.now)


class QueryTriggerEnum(enum.Enum):
    manual = "manual"
    run = "run"
    ai = "ai"
    on_exit = "on_exit"


class QueryVersion(Base):
    __tablename__ = "query_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sql = Column(String, nullable=False)
    save_trigger = Column(SqlEnum(QueryTriggerEnum), nullable=False)
    query_id = Column(UUID(as_uuid=True), ForeignKey("queries.id"), nullable=False)
    query = relationship("Query", back_populates="versions")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by_user = relationship("User", back_populates="query_versions")
    runs = relationship("QueryRun", back_populates="query_version")
    created_at = Column(DateTime, default=datetime.now)


class QueryRun(Base):
    __tablename__ = "query_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_message = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    row_count = Column(Integer, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    query_version_id = Column(UUID(as_uuid=True), ForeignKey("query_versions.id"), nullable=False)
    query_version = relationship("QueryVersion", back_populates="runs")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by_user = relationship("User", back_populates="query_runs")
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
    default = Column(Boolean, default=False)
    workspace = relationship("Workspace", back_populates="llms")
    chat_sessions = relationship("ChatSession", back_populates="llm")
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
    messages = relationship("ChatMessage", back_populates="chat_session")
    created_at = Column(DateTime, default=datetime.now)


class ChatRoleEnum(enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"  # For tool call responses


class MessageTypeEnum(enum.Enum):
    message = "message"  # Regular user/assistant message visible to client
    internal_message = "internal_message"  # Internal operational messages (not shown to client)
    tool_call = "tool_call"  # Assistant tool call
    tool_response = "tool_response"  # Tool execution response


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(SqlEnum(ChatRoleEnum), nullable=False)
    content = Column(String, nullable=False)
    sql_query = Column(String, nullable=True)  # Store SQL queries as first-class field
    position = Column(Integer, nullable=False)
    message_type = Column(SqlEnum(MessageTypeEnum), nullable=False, default=MessageTypeEnum.message)
    message_metadata = Column(JSON, nullable=True)  # Store tool calls, reasoning, etc.
    parent_message_id = Column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True
    )  # For threading tool calls
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    chat_session = relationship("ChatSession", back_populates="messages")
    # TODO: inconsistent naming, maybe rename to created_by
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="chat_messages")
    parent_message = relationship("ChatMessage", remote_side=[id], backref="child_messages")
    created_at = Column(DateTime, default=datetime.now)
