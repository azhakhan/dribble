import sys
import pathlib
import uuid
from datetime import datetime

# Add the server app directory to the Python path so we can import models
server_dir = pathlib.Path(__file__).parent.parent.parent / "app"
sys.path.insert(0, str(server_dir))

from models import User, Workspace, Source, Worker, Query, RoleEnum, WorkspaceUser  # noqa


def test_user_model():
    """Test User model creation and attributes."""
    user = User(name="Test User", email="test@example.com")
    assert user.name == "Test User"
    assert user.email == "test@example.com"
    assert user.id is None  # Not set until saved to DB
    assert user.created_at is None  # Default only applies when saved to DB


def test_workspace_model():
    """Test Workspace model creation and attributes."""
    workspace = Workspace(name="Test Workspace")
    assert workspace.name == "Test Workspace"
    assert workspace.id is None  # Not set until saved to DB
    assert workspace.created_at is None  # Default only applies when saved to DB


def test_source_model():
    """Test Source model creation and attributes."""
    workspace_id = uuid.uuid4()
    creds = {"host": "localhost", "port": 5432}
    source = Source(name="Test Source", dbtype="postgres", creds=creds, workspace_id=workspace_id)
    assert source.name == "Test Source"
    assert source.dbtype == "postgres"
    assert source.creds == creds
    assert source.workspace_id == workspace_id
    assert source.created_at is None  # Default only applies when saved to DB


def test_worker_model():
    """Test Worker model creation and attributes."""
    source_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    worker = Worker(
        source_id=source_id,
        container_id="test-container",
        port=8000,
        host="localhost",
        status="healthy",
        workspace_id=workspace_id,
    )
    assert worker.source_id == source_id
    assert worker.container_id == "test-container"
    assert worker.port == 8000
    assert worker.host == "localhost"
    assert worker.status == "healthy"
    assert worker.workspace_id == workspace_id
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


def test_workspace_user_model():
    """Test WorkspaceUser model creation and attributes."""
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()
    workspace_user = WorkspaceUser(workspace_id=workspace_id, user_id=user_id, role=RoleEnum.admin)
    assert workspace_user.workspace_id == workspace_id
    assert workspace_user.user_id == user_id
    assert workspace_user.role == RoleEnum.admin
    assert workspace_user.created_at is None  # Default only applies when saved to DB


def test_model_with_explicit_created_at():
    """Test that we can explicitly set created_at when creating models."""
    now = datetime.now()
    user = User(name="Test User", email="test@example.com", created_at=now)
    assert user.created_at == now
    assert isinstance(user.created_at, datetime)
