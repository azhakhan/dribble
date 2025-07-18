from sqlalchemy import Column, DateTime, String, JSON, ForeignKey, Integer, Boolean
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum
import uuid
from datetime import datetime

Base = declarative_base()


class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True)

    def soft_delete(self):
        self.deleted_at = datetime.now()

    def restore(self):
        self.deleted_at = None

    def is_deleted(self):
        return self.deleted_at is not None


class Source(Base, SoftDeleteMixin):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    dbtype = Column(String, nullable=False)
    creds = Column(JSON, nullable=False)
    queries = relationship("Query", back_populates="source")
    created_at = Column(DateTime, default=datetime.now)


class Query(Base, SoftDeleteMixin):
    __tablename__ = "queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)
    is_ephemeral = Column(Boolean, default=False)
    preview_key = Column(String, nullable=True)  # e.g. "source.schema.table"
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id"), nullable=False)
    source = relationship("Source", back_populates="queries")
    versions = relationship("QueryVersion", back_populates="query")
    chat_contexts = relationship("ChatContext", back_populates="query")
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
    runs = relationship("QueryRun", back_populates="query_version")
    chat_contexts = relationship("ChatContext", back_populates="query_version")
    created_at = Column(DateTime, default=datetime.now)


class QueryRun(Base):
    __tablename__ = "query_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String, nullable=True)
    modifiers = Column(JSONB, nullable=True)
    result_message = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    row_count = Column(Integer, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    query_version_id = Column(UUID(as_uuid=True), ForeignKey("query_versions.id"), nullable=False)
    query_version = relationship("QueryVersion", back_populates="runs")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class LLM(Base, SoftDeleteMixin):
    __tablename__ = "llms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    model = Column(String, nullable=False)
    api_key = Column(String, nullable=True)
    base_url = Column(String, nullable=True)
    api_version = Column(String, nullable=True)
    settings = Column(JSON, nullable=True)
    default = Column(Boolean, default=False)
    chat_sessions = relationship("ChatSession", back_populates="llm")
    created_at = Column(DateTime, default=datetime.now)


class ChatSession(Base, SoftDeleteMixin):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)
    llm_id = Column(UUID(as_uuid=True), ForeignKey("llms.id"), nullable=False)
    llm = relationship("LLM", back_populates="chat_sessions")
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
    position = Column(Integer, nullable=False)
    sql_query = Column(String, nullable=True)  # SQL query if message contains one
    message_type = Column(SqlEnum(MessageTypeEnum), nullable=False, default=MessageTypeEnum.message)
    message_metadata = Column(JSON, nullable=True)  # Store tool calls, reasoning, etc.
    chat_session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    chat_session = relationship("ChatSession", back_populates="messages")

    parent_message_id = Column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True
    )  # For threading tool calls
    parent_message = relationship("ChatMessage", remote_side=[id], backref="child_messages")

    context = relationship("ChatContext", back_populates="message")
    created_at = Column(DateTime, default=datetime.now)


class ChatContext(Base):
    __tablename__ = "chat_contexts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    active = Column(Boolean, default=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=False)
    message = relationship("ChatMessage", back_populates="context")
    query_id = Column(UUID(as_uuid=True), ForeignKey("queries.id"), nullable=False)
    query = relationship("Query", back_populates="chat_contexts")
    query_version_id = Column(UUID(as_uuid=True), ForeignKey("query_versions.id"), nullable=True)
    query_version = relationship("QueryVersion", back_populates="chat_contexts")
    created_at = Column(DateTime, default=datetime.now)
