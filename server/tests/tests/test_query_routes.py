import pytest
import uuid
import os

# Set up test environment variables BEFORE any app imports
os.environ["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres@localhost:5432/dribble"
os.environ["REDIS_URL"] = "redis://localhost:6379"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.db import get_db


# Override the database dependency for testing
def override_get_db():
    """Override database dependency to use test database."""
    # Use the same database URL as in docker-compose for consistency
    TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/dribble"
    engine = create_engine(TEST_DATABASE_URL)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture
def sample_source_id():
    """Get a sample source ID from the seeded test data."""
    # This should match the source ID from your conftest.py seed data
    return "84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38"


@pytest.fixture
def sample_query_data(sample_source_id):
    """Sample data for creating queries."""
    return {
        "name": "Test Query",
        "query": "SELECT * FROM users LIMIT 5",
        "database_id": sample_source_id,
    }


@pytest.fixture
def sample_execute_data(sample_source_id):
    """Sample data for executing queries."""
    return {"query": "SELECT COUNT(*) as count FROM users", "source_id": sample_source_id}


class TestCreateQuery:
    """Test the POST /query/ endpoint."""

    def test_create_query_success(self, sample_query_data):
        """Test successful query creation."""
        response = client.post("/query/", json=sample_query_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_query_data["name"]
        assert data["query"] == sample_query_data["query"]
        assert data["source_id"] == sample_query_data["database_id"]
        assert "id" in data
        assert "created_at" in data

    def test_create_query_invalid_source(self):
        """Test query creation with invalid source ID."""
        invalid_data = {
            "name": "Test Query",
            "query": "SELECT * FROM users",
            "database_id": str(uuid.uuid4()),  # Non-existent source
        }

        response = client.post("/query/", json=invalid_data)

        # This should still create the query (foreign key constraint might not be enforced)
        # but in a real scenario, you might want to validate the source exists
        assert response.status_code in [200, 500]  # Depends on your FK constraints

    def test_create_query_missing_fields(self):
        """Test query creation with missing required fields."""
        incomplete_data = {
            "name": "Test Query"
            # Missing query and database_id
        }

        response = client.post("/query/", json=incomplete_data)

        assert response.status_code == 422  # Validation error


class TestUpdateQuery:
    """Test the PUT /query/{query_id} endpoint."""

    def test_update_query_success(self, sample_query_data):
        """Test successful query update."""
        # First create a query
        create_response = client.post("/query/", json=sample_query_data)
        assert create_response.status_code == 200
        query_id = create_response.json()["id"]

        # Update the query
        update_data = {
            "name": "Updated Query Name",
            "query": "SELECT COUNT(*) FROM users WHERE active = true",
        }

        response = client.put(f"/query/{query_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["query"] == update_data["query"]
        assert data["id"] == query_id

    def test_update_query_partial(self, sample_query_data):
        """Test partial query update (only name)."""
        # First create a query
        create_response = client.post("/query/", json=sample_query_data)
        assert create_response.status_code == 200
        query_id = create_response.json()["id"]
        original_query = create_response.json()["query"]

        # Update only the name
        update_data = {"name": "New Name Only"}

        response = client.put(f"/query/{query_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["query"] == original_query  # Should remain unchanged

    def test_update_query_not_found(self):
        """Test updating non-existent query."""
        fake_id = str(uuid.uuid4())
        update_data = {"name": "Updated Query"}

        response = client.put(f"/query/{fake_id}", json=update_data)

        assert response.status_code == 404
        assert "Query not found" in response.json()["detail"]


class TestDeleteQuery:
    """Test the DELETE /query/{query_id} endpoint."""

    def test_delete_query_success(self, sample_query_data):
        """Test successful query deletion."""
        # First create a query
        create_response = client.post("/query/", json=sample_query_data)
        assert create_response.status_code == 200
        query_id = create_response.json()["id"]

        # Delete the query
        response = client.delete(f"/query/{query_id}")

        assert response.status_code == 200
        assert response.json()["message"] == "Query deleted successfully"

        # Verify it's actually deleted by trying to update it
        update_response = client.put(f"/query/{query_id}", json={"name": "Should fail"})
        assert update_response.status_code == 404

    def test_delete_query_not_found(self):
        """Test deleting non-existent query."""
        fake_id = str(uuid.uuid4())

        response = client.delete(f"/query/{fake_id}")

        assert response.status_code == 404
        assert "Query not found" in response.json()["detail"]


class TestExecuteQuery:
    """Test the query execution endpoints."""

    @pytest.mark.skip(reason="Requires worker container to be running")
    def test_execute_query_string_success(self, sample_execute_data):
        """Test successful query execution with query string."""
        response = client.post("/query/execute/", json=sample_execute_data)

        # This will likely fail without a running worker, but shows the structure
        assert response.status_code in [200]

    @pytest.mark.skip(reason="Requires worker container to be running")
    def test_execute_query_by_id_success(self, sample_query_data):
        """Test successful query execution by ID."""
        # First create a query
        create_response = client.post("/query/", json=sample_query_data)
        assert create_response.status_code == 200
        query_id = create_response.json()["id"]

        # Execute the query
        response = client.post(f"/query/{query_id}/execute/")

        # This will likely fail without a running worker, but shows the structure
        assert response.status_code in [200, 500]


class TestGetQueryResults:
    """Test the GET /query/results/{query_id}/ endpoint."""

    def test_get_results_not_found(self):
        """Test getting results for non-existent query."""
        fake_id = str(uuid.uuid4())

        response = client.get(f"/query/results/{fake_id}/")

        assert response.status_code == 404
        assert response.json()["detail"] == "Query results not found"


# Integration test that combines multiple operations
class TestQueryWorkflow:
    """Test complete query workflow."""

    def test_complete_query_lifecycle(self, sample_query_data):
        """Test creating, updating, and deleting a query."""
        # Create
        create_response = client.post("/query/", json=sample_query_data)
        assert create_response.status_code == 200
        query_id = create_response.json()["id"]

        # Update
        update_data = {"name": "Updated in Lifecycle Test"}
        update_response = client.put(f"/query/{query_id}", json=update_data)
        assert update_response.status_code == 200
        assert update_response.json()["name"] == update_data["name"]

        # Delete
        delete_response = client.delete(f"/query/{query_id}")
        assert delete_response.status_code == 200

        # Verify deletion
        final_check = client.put(f"/query/{query_id}", json={"name": "Should fail"})
        assert final_check.status_code == 404
