import uuid
from datetime import datetime

from app.models import User, Source, Worker, Query, RoleEnum  # noqa


def test_source_model():
    """Test Source model creation and attributes."""
    creds = {"host": "localhost", "port": 5432}
    source = Source(name="Test Source", dbtype="postgres", creds=creds)
    assert source.name == "Test Source"
    assert source.dbtype == "postgres"
    assert source.creds == creds
    assert source.created_at is None  # Default only applies when saved to DB


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


def test_query_model():
    """Test Query model creation and attributes."""
    source_id = uuid.uuid4()
    query = Query(name="Test Query", query="SELECT * FROM users", source_id=source_id)
    assert query.name == "Test Query"
    assert query.query == "SELECT * FROM users"
    assert query.source_id == source_id
    assert query.created_at is None  # Default only applies when saved to DB


def test_role_enum():
    """Test RoleEnum values."""
    assert RoleEnum.admin.value == "admin"
    assert RoleEnum.editor.value == "editor"
    assert RoleEnum.viewer.value == "viewer"


def test_model_with_explicit_created_at():
    """Test that we can explicitly set created_at when creating models."""
    now = datetime.now()
    user = User(name="Test User", email="test@example.com", created_at=now)
    assert user.created_at == now
    assert isinstance(user.created_at, datetime)
