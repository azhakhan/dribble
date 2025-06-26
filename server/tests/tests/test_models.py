import uuid
from datetime import datetime

from app.models import (
    Source,
    Worker,
    Query,
    QueryVersion,
    QueryRun,
    LLM,
    ChatSession,
    ChatMessage,
    ChatContext,
    QueryTriggerEnum,
    ChatRoleEnum,
    MessageTypeEnum,
)


def test_source_model():
    """Test Source model creation and attributes."""
    creds = {"host": "localhost", "port": 5432}
    source = Source(name="Test Source", dbtype="postgres", creds=creds)
    assert source.name == "Test Source"
    assert source.dbtype == "postgres"
    assert source.creds == creds
    assert source.created_at is None  # Default only applies when saved to DB
    assert source.deleted_at is None


def test_worker_model():
    """Test Worker model creation and attributes."""
    source_id = uuid.uuid4()
    worker = Worker(
        source_id=source_id,
        container_id="test-container",
        port=8000,
        host="localhost",
        status="healthy",
    )
    assert worker.source_id == source_id
    assert worker.container_id == "test-container"
    assert worker.port == 8000
    assert worker.host == "localhost"
    assert worker.status == "healthy"
    assert worker.created_at is None  # Default only applies when saved to DB
    assert worker.deleted_at is None


def test_query_model():
    """Test Query model creation and attributes."""
    source_id = uuid.uuid4()
    query = Query(name="Test Query", source_id=source_id)
    assert query.name == "Test Query"
    assert query.source_id == source_id
    # SQLAlchemy defaults only apply when saved to DB, so in-memory objects have None
    assert query.is_ephemeral is None  # Will be False when saved to DB
    assert query.preview_key is None
    assert query.created_at is None  # Default only applies when saved to DB
    assert query.deleted_at is None


def test_query_version_model():
    """Test QueryVersion model creation and attributes."""
    query_id = uuid.uuid4()
    query_version = QueryVersion(
        sql="SELECT * FROM users", save_trigger=QueryTriggerEnum.manual, query_id=query_id
    )
    assert query_version.sql == "SELECT * FROM users"
    assert query_version.save_trigger == QueryTriggerEnum.manual
    assert query_version.query_id == query_id
    assert query_version.created_at is None  # Default only applies when saved to DB


def test_query_run_model():
    """Test QueryRun model creation and attributes."""
    query_version_id = uuid.uuid4()
    query_run = QueryRun(
        query_version_id=query_version_id,
        row_count=42,
        execution_time_ms=150,
        result_message="Success",
    )
    assert query_run.query_version_id == query_version_id
    assert query_run.row_count == 42
    assert query_run.execution_time_ms == 150
    assert query_run.result_message == "Success"
    assert query_run.error_message is None
    assert query_run.modifiers is None
    assert query_run.created_at is None  # Default only applies when saved to DB


def test_llm_model():
    """Test LLM model creation and attributes."""
    llm = LLM(
        name="Test LLM",
        model="gpt-4",
        api_key="test-key",
        base_url="https://api.openai.com",
        default=True,  # Explicitly set to True
    )
    assert llm.name == "Test LLM"
    assert llm.model == "gpt-4"
    assert llm.api_key == "test-key"
    assert llm.base_url == "https://api.openai.com"
    assert llm.default is True  # Explicitly set value
    assert llm.api_version is None
    assert llm.settings is None
    assert llm.created_at is None  # Default only applies when saved to DB
    assert llm.deleted_at is None


def test_llm_model_default_value():
    """Test LLM model with database default for 'default' field."""
    llm = LLM(name="Test LLM", model="gpt-4")
    # SQLAlchemy defaults only apply when saved to DB, so in-memory objects have None
    assert llm.default is None  # Will be False when saved to DB


def test_chat_session_model():
    """Test ChatSession model creation and attributes."""
    llm_id = uuid.uuid4()
    chat_session = ChatSession(name="Test Chat", llm_id=llm_id)
    assert chat_session.name == "Test Chat"
    assert chat_session.llm_id == llm_id
    assert chat_session.created_at is None  # Default only applies when saved to DB
    assert chat_session.deleted_at is None


def test_chat_message_model():
    """Test ChatMessage model creation and attributes."""
    chat_session_id = uuid.uuid4()
    chat_message = ChatMessage(
        role=ChatRoleEnum.user,
        content="Hello, world!",
        position=1,
        chat_session_id=chat_session_id,
        message_type=MessageTypeEnum.message,
    )
    assert chat_message.role == ChatRoleEnum.user
    assert chat_message.content == "Hello, world!"
    assert chat_message.position == 1
    assert chat_message.chat_session_id == chat_session_id
    assert chat_message.message_type == MessageTypeEnum.message
    assert chat_message.sql_query is None
    assert chat_message.message_metadata is None
    assert chat_message.parent_message_id is None
    assert chat_message.created_at is None  # Default only applies when saved to DB


def test_chat_context_model():
    """Test ChatContext model creation and attributes."""
    message_id = uuid.uuid4()
    query_id = uuid.uuid4()
    query_version_id = uuid.uuid4()
    chat_context = ChatContext(
        message_id=message_id,
        query_id=query_id,
        query_version_id=query_version_id,
        active=True,  # Explicitly set to True
    )
    assert chat_context.message_id == message_id
    assert chat_context.query_id == query_id
    assert chat_context.query_version_id == query_version_id
    assert chat_context.active is True  # Explicitly set value
    assert chat_context.created_at is None  # Default only applies when saved to DB


def test_chat_context_model_default_value():
    """Test ChatContext model with database default for 'active' field."""
    message_id = uuid.uuid4()
    query_id = uuid.uuid4()
    chat_context = ChatContext(message_id=message_id, query_id=query_id)
    # SQLAlchemy defaults only apply when saved to DB, so in-memory objects have None
    assert chat_context.active is None  # Will be False when saved to DB


def test_query_trigger_enum():
    """Test QueryTriggerEnum values."""
    assert QueryTriggerEnum.manual.value == "manual"
    assert QueryTriggerEnum.run.value == "run"
    assert QueryTriggerEnum.ai.value == "ai"
    assert QueryTriggerEnum.on_exit.value == "on_exit"


def test_chat_role_enum():
    """Test ChatRoleEnum values."""
    assert ChatRoleEnum.user.value == "user"
    assert ChatRoleEnum.assistant.value == "assistant"
    assert ChatRoleEnum.system.value == "system"
    assert ChatRoleEnum.tool.value == "tool"


def test_message_type_enum():
    """Test MessageTypeEnum values."""
    assert MessageTypeEnum.message.value == "message"
    assert MessageTypeEnum.internal_message.value == "internal_message"
    assert MessageTypeEnum.tool_call.value == "tool_call"
    assert MessageTypeEnum.tool_response.value == "tool_response"


def test_soft_delete_mixin():
    """Test soft delete functionality on models that inherit from SoftDeleteMixin."""
    source = Source(name="Test Source", dbtype="postgres", creds={})

    # Initially not deleted
    assert source.is_deleted() is False
    assert source.deleted_at is None

    # Soft delete
    source.soft_delete()
    assert source.is_deleted() is True
    assert source.deleted_at is not None
    assert isinstance(source.deleted_at, datetime)

    # Restore
    source.restore()
    assert source.is_deleted() is False
    assert source.deleted_at is None


def test_model_with_explicit_created_at():
    """Test that we can explicitly set created_at when creating models."""
    now = datetime.now()
    source = Source(name="Test Source", dbtype="postgres", creds={}, created_at=now)
    assert source.created_at == now
    assert isinstance(source.created_at, datetime)
