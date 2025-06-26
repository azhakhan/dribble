import pytest
import uuid

from fastapi.testclient import TestClient
from app.main import app

# No need to override the database dependency - use the same DB as the app
client = TestClient(app)


@pytest.fixture
def sample_source_id():
    """Get the sample source ID from the seeded test data."""
    # This should match the source ID from conftest.py seed data
    return "84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38"


@pytest.fixture
def sample_query_data(sample_source_id):
    """Sample data for creating queries."""
    return {
        "source_id": sample_source_id,
        "name": "Test Query for Runs",
    }


@pytest.fixture
def sample_version_data():
    """Sample data for creating query versions."""
    return {
        "sql": "SELECT COUNT(*) as count FROM users",
        "save_trigger": "manual",
    }


@pytest.fixture
def sample_run_update_data():
    """Sample data for updating query runs."""
    return {
        "result_message": "Query executed successfully",
        "row_count": 10,
        "execution_time_ms": 150,
    }


@pytest.fixture
def created_query_and_version(sample_query_data, sample_version_data):
    """Create a query and version for run testing."""
    # Create query
    query_response = client.post("/query/", json=sample_query_data)
    assert query_response.status_code == 200
    query_id = query_response.json()["id"]

    # Create version
    version_data = {**sample_version_data, "query_id": query_id}
    version_response = client.post("/versions/", json=version_data)
    assert version_response.status_code == 200
    version_id = version_response.json()["id"]

    return query_id, version_id


@pytest.fixture
def created_run(created_query_and_version):
    """Create a query run and return its ID for testing."""
    query_id, version_id = created_query_and_version

    # Create run by calling the execution endpoint
    # Since we're skipping worker tests, we'll create a run through the update endpoint
    # First, let's simulate a run creation through the backend
    from app.core.db import get_db
    from app.models import QueryRun

    # Use the database session to create a run manually for testing
    # This simulates what the worker would do
    db = next(get_db())
    try:
        run = QueryRun(
            query_version_id=version_id,
            modifiers=None,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run.id, query_id, version_id
    finally:
        db.close()


class TestUpdateQueryRun:
    """Test the PUT /runs/{run_id} endpoint."""

    def test_update_run_success(self, created_run, sample_run_update_data):
        """Test successful query run update."""
        run_id, query_id, version_id = created_run

        response = client.put(f"/runs/{run_id}", json=sample_run_update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["result_message"] == sample_run_update_data["result_message"]
        assert data["row_count"] == sample_run_update_data["row_count"]
        assert data["execution_time_ms"] == sample_run_update_data["execution_time_ms"]
        assert data["id"] == str(run_id)

    def test_update_run_partial(self, created_run):
        """Test partial query run update."""
        run_id, query_id, version_id = created_run

        partial_data = {"result_message": "Partial update"}

        response = client.put(f"/runs/{run_id}", json=partial_data)

        assert response.status_code == 200
        data = response.json()
        assert data["result_message"] == partial_data["result_message"]
        # Other fields should remain unchanged (null or previous values)

    def test_update_run_with_error(self, created_run):
        """Test updating run with error message."""
        run_id, query_id, version_id = created_run

        error_data = {"error_message": "Syntax error in SQL query", "execution_time_ms": 50}

        response = client.put(f"/runs/{run_id}", json=error_data)

        assert response.status_code == 200
        data = response.json()
        assert data["error_message"] == error_data["error_message"]
        assert data["execution_time_ms"] == error_data["execution_time_ms"]

    def test_update_run_not_found(self, sample_run_update_data):
        """Test updating non-existent run."""
        fake_id = str(uuid.uuid4())

        response = client.put(f"/runs/{fake_id}", json=sample_run_update_data)

        assert response.status_code == 404
        assert "Query run not found" in response.json()["detail"]

    def test_update_run_empty_data(self, created_run):
        """Test updating run with empty data."""
        run_id, query_id, version_id = created_run

        response = client.put(f"/runs/{run_id}", json={})

        assert response.status_code == 200
        # Should return the unchanged run


class TestGetQueryRuns:
    """Test the GET /runs/query/{query_id} endpoint."""

    def test_get_runs_by_query_id_success(self, created_run, sample_run_update_data):
        """Test getting runs for a specific query."""
        run_id, query_id, version_id = created_run

        # Update the run first to have some data
        client.put(f"/runs/{run_id}", json=sample_run_update_data)

        response = client.get(f"/runs/query/{query_id}")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

        # Verify the run is in the results
        run_found = any(item["id"] == str(run_id) for item in data["items"])
        assert run_found

    def test_get_runs_pagination(self, created_run):
        """Test runs pagination."""
        run_id, query_id, version_id = created_run

        # Test first page
        response = client.get(f"/runs/query/{query_id}?page=1&page_size=5")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert "has_next" in data
        assert "has_prev" in data
        assert "total_pages" in data

    def test_get_runs_invalid_query(self):
        """Test getting runs for non-existent query."""
        fake_id = str(uuid.uuid4())

        response = client.get(f"/runs/query/{fake_id}")

        assert response.status_code == 404
        assert "Query not found" in response.json()["detail"]

    def test_get_runs_empty_query(self, created_query_and_version):
        """Test getting runs for query with no runs."""
        query_id, version_id = created_query_and_version

        response = client.get(f"/runs/query/{query_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0


class TestGetQueryRunsByVersion:
    """Test the GET /runs/version/{version_id} endpoint."""

    def test_get_runs_by_version_id_success(self, created_run):
        """Test getting runs for a specific version."""
        run_id, query_id, version_id = created_run

        response = client.get(f"/runs/version/{version_id}")

        assert response.status_code == 200
        runs = response.json()
        assert len(runs) >= 1

        # Verify the run is in the results
        run_found = any(run["id"] == str(run_id) for run in runs)
        assert run_found

    def test_get_runs_by_version_invalid_version(self):
        """Test getting runs for non-existent version."""
        fake_id = str(uuid.uuid4())

        response = client.get(f"/runs/version/{fake_id}")

        assert response.status_code == 404
        assert "Query version not found" in response.json()["detail"]

    def test_get_runs_by_version_empty_version(self, created_query_and_version):
        """Test getting runs for version with no runs."""
        query_id, version_id = created_query_and_version

        response = client.get(f"/runs/version/{version_id}")

        assert response.status_code == 200
        runs = response.json()
        assert len(runs) == 0


class TestGetQueryRunById:
    """Test the GET /runs/{run_id} endpoint."""

    def test_get_run_by_id_success(self, created_run, sample_run_update_data):
        """Test getting a specific run by ID."""
        run_id, query_id, version_id = created_run

        # Update the run first
        client.put(f"/runs/{run_id}", json=sample_run_update_data)

        response = client.get(f"/runs/{run_id}")

        assert response.status_code == 200
        run = response.json()
        assert run["id"] == str(run_id)
        assert run["query_version_id"] == str(version_id)
        assert run["result_message"] == sample_run_update_data["result_message"]
        assert "created_at" in run

    def test_get_run_by_id_not_found(self):
        """Test getting non-existent run."""
        fake_id = str(uuid.uuid4())

        response = client.get(f"/runs/{fake_id}")

        assert response.status_code == 404
        assert "Query run not found" in response.json()["detail"]


class TestQueryRunWorkflow:
    """Test complete query run workflow."""

    def test_complete_run_lifecycle(self, created_run, sample_run_update_data):
        """Test creating, updating, retrieving a run."""
        run_id, query_id, version_id = created_run

        # Update run
        update_response = client.put(f"/runs/{run_id}", json=sample_run_update_data)
        assert update_response.status_code == 200

        # Get by ID
        get_response = client.get(f"/runs/{run_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == str(run_id)

        # Get by query ID
        query_runs_response = client.get(f"/runs/query/{query_id}")
        assert query_runs_response.status_code == 200
        runs = query_runs_response.json()["items"]
        assert any(r["id"] == str(run_id) for r in runs)

        # Get by version ID
        version_runs_response = client.get(f"/runs/version/{version_id}")
        assert version_runs_response.status_code == 200
        version_runs = version_runs_response.json()
        assert any(r["id"] == str(run_id) for r in version_runs)

    def test_run_status_transitions(self, created_run):
        """Test different run status transitions through updates."""
        run_id, query_id, version_id = created_run

        # Start with running state (no result yet)
        initial_response = client.get(f"/runs/{run_id}")
        assert initial_response.status_code == 200
        initial_data = initial_response.json()
        assert initial_data["result_message"] is None
        assert initial_data["error_message"] is None

        # Update to success state
        success_data = {
            "result_message": "Query completed successfully",
            "row_count": 5,
            "execution_time_ms": 100,
        }
        success_response = client.put(f"/runs/{run_id}", json=success_data)
        assert success_response.status_code == 200

        # Update to error state
        error_data = {"error_message": "Connection timeout", "execution_time_ms": 5000}
        error_response = client.put(f"/runs/{run_id}", json=error_data)
        assert error_response.status_code == 200

        # Verify final state
        final_response = client.get(f"/runs/{run_id}")
        assert final_response.status_code == 200
        final_data = final_response.json()
        assert final_data["error_message"] == error_data["error_message"]
        assert final_data["execution_time_ms"] == error_data["execution_time_ms"]


class TestQueryRunPagination:
    """Test pagination functionality for query runs."""

    def test_pagination_parameters(self, created_run):
        """Test various pagination parameters."""
        run_id, query_id, version_id = created_run

        # Test default pagination
        response1 = client.get(f"/runs/query/{query_id}")
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["page"] == 1
        assert data1["page_size"] == 25

        # Test custom page size
        response2 = client.get(f"/runs/query/{query_id}?page_size=10")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["page_size"] == 10

        # Test page boundaries
        response3 = client.get(f"/runs/query/{query_id}?page=1&page_size=1")
        assert response3.status_code == 200
        data3 = response3.json()
        assert data3["page"] == 1
        assert data3["page_size"] == 1

    def test_pagination_edge_cases(self, created_run):
        """Test pagination edge cases."""
        run_id, query_id, version_id = created_run

        # Test page out of bounds
        response = client.get(f"/runs/query/{query_id}?page=999")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 0

        # Test invalid page size
        response = client.get(f"/runs/query/{query_id}?page_size=0")
        assert response.status_code == 422  # Validation error

        # Test maximum page size
        response = client.get(f"/runs/query/{query_id}?page_size=100")
        assert response.status_code == 200

        # Test exceeding maximum page size
        response = client.get(f"/runs/query/{query_id}?page_size=101")
        assert response.status_code == 422  # Validation error
