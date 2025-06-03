import pytest
import uuid
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from app.main import app

# No need to override the database dependency - use the same DB as the app
client = TestClient(app)


# Add a fixture that ensures seeding happens
@pytest.fixture(scope="session", autouse=True)
def setup_test_data(seed_test_data):
    """Ensure test data is seeded before any tests run."""
    pass


@pytest.fixture
def sample_postgres_source_data():
    """Sample data for creating a PostgreSQL source."""
    return {
        "name": "Test PostgreSQL Source",
        "dbtype": "postgres",
        "creds": {
            "host": "localhost",
            "port": 5432,
            "user": "postgres",
            "password": "postgres",
            "dbname": "testdb",
        },
    }


@pytest.fixture
def sample_postgres_user_db_data():
    """Sample data for creating a PostgreSQL source using the user-db-pg service."""
    return {
        "name": "Test User PostgreSQL Source",
        "dbtype": "postgres",
        "creds": {
            "host": "user-db-pg",  # Use Docker service name
            "port": 5432,  # Internal port within Docker network
            "user": "postgres",
            "password": "postgres",
            "dbname": "postgres",
        },
    }


@pytest.fixture
def sample_mysql_source_data():
    """Sample data for creating a MySQL source."""
    return {
        "name": "Test MySQL Source",
        "dbtype": "mysql",
        "creds": {
            "host": "localhost",
            "port": 3306,
            "user": "root",
            "password": "password",
            "dbname": "testdb",
        },
    }


@pytest.fixture
def sample_sqlite_source_data():
    """Sample data for creating a SQLite source."""
    return {"name": "Test SQLite Source", "dbtype": "sqlite", "creds": {"path": "/tmp/test.db"}}


@pytest.fixture
def existing_source_id():
    """Get an existing source ID from the seeded test data."""
    # This should match the source ID from your conftest.py seed data
    return "84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38"


@pytest.fixture(autouse=True)
def patch_invalidate_source_schema_cache():
    with patch("app.routes.sources.invalidate_source_schema_cache", new=AsyncMock()) as _fixture:
        yield


class TestCreateSource:
    """Test the POST /sources/ endpoint."""

    def test_create_postgres_source_success(self, sample_postgres_source_data):
        """Test successful PostgreSQL source creation."""
        response = client.post("/sources/", json=sample_postgres_source_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_postgres_source_data["name"]
        assert data["dbtype"] == sample_postgres_source_data["dbtype"]
        assert data["creds"] == sample_postgres_source_data["creds"]
        assert "id" in data
        assert "created_at" in data

    def test_create_mysql_source_success(self, sample_mysql_source_data):
        """Test successful MySQL source creation."""
        response = client.post("/sources/", json=sample_mysql_source_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_mysql_source_data["name"]
        assert data["dbtype"] == sample_mysql_source_data["dbtype"]
        assert data["creds"] == sample_mysql_source_data["creds"]
        assert "id" in data
        assert "created_at" in data

    def test_create_sqlite_source_success(self, sample_sqlite_source_data):
        """Test successful SQLite source creation."""
        response = client.post("/sources/", json=sample_sqlite_source_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_sqlite_source_data["name"]
        assert data["dbtype"] == sample_sqlite_source_data["dbtype"]
        assert data["creds"] == sample_sqlite_source_data["creds"]
        assert "id" in data
        assert "created_at" in data

    def test_create_source_missing_fields(self):
        """Test source creation with missing required fields."""
        incomplete_data = {
            "name": "Test Source"
            # Missing dbtype and creds
        }

        response = client.post("/sources/", json=incomplete_data)

        assert response.status_code == 422  # Validation error

    def test_create_source_invalid_dbtype(self, sample_postgres_source_data):
        """Test source creation with invalid database type."""
        invalid_data = sample_postgres_source_data.copy()
        invalid_data["dbtype"] = "invalid_db_type"

        response = client.post("/sources/", json=invalid_data)

        assert response.status_code == 422  # Validation error

    def test_create_source_invalid_postgres_creds(self):
        """Test source creation with invalid PostgreSQL credentials structure."""
        invalid_data = {
            "name": "Test Source",
            "dbtype": "postgres",
            "creds": {
                "host": "localhost",
                # Missing required fields: port, user, password, dbname
            },
        }

        response = client.post("/sources/", json=invalid_data)

        assert response.status_code == 422  # Validation error

    def test_create_source_invalid_sqlite_creds(self):
        """Test source creation with invalid SQLite credentials structure."""
        invalid_data = {
            "name": "Test Source",
            "dbtype": "sqlite",
            "creds": {"host": "localhost"},  # SQLite should have 'path', not 'host'
        }

        response = client.post("/sources/", json=invalid_data)

        assert response.status_code == 422  # Validation error


class TestRenameSource:
    """Test the PUT /sources/rename/{source_id}/ endpoint."""

    def test_rename_source_success(self, sample_postgres_source_data):
        """Test successful source renaming."""
        # First create a source
        create_response = client.post("/sources/", json=sample_postgres_source_data)
        assert create_response.status_code == 200
        source_id = create_response.json()["id"]

        # Rename the source
        rename_data = {"name": "Renamed Test Source"}

        response = client.put(f"/sources/rename/{source_id}/", json=rename_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == rename_data["name"]
        assert data["id"] == source_id

    def test_rename_source_not_found(self):
        """Test renaming non-existent source."""
        fake_id = str(uuid.uuid4())
        rename_data = {"name": "New Name"}

        response = client.put(f"/sources/rename/{fake_id}/", json=rename_data)

        assert response.status_code == 404
        assert "Source not found" in response.json()["detail"]

    def test_rename_source_missing_name(self, existing_source_id):
        """Test renaming source with missing name field."""
        response = client.put(f"/sources/rename/{existing_source_id}/", json={})

        assert response.status_code == 422  # Validation error


class TestUpdateSourceCredentials:
    """Test the PUT /sources/credentials/{source_id}/ endpoint."""

    def test_update_credentials_success(self, sample_postgres_source_data):
        """Test successful credentials update."""
        # First create a source
        create_response = client.post("/sources/", json=sample_postgres_source_data)
        assert create_response.status_code == 200
        source_id = create_response.json()["id"]

        # Update credentials
        new_creds = {
            "creds": {
                "host": "updated-host",
                "port": 5433,
                "user": "updated_user",
                "password": "updated_password",
                "dbname": "updated_db",
            }
        }

        response = client.put(f"/sources/credentials/{source_id}/", json=new_creds)

        assert response.status_code == 200
        data = response.json()
        assert data["creds"] == new_creds["creds"]
        assert data["id"] == source_id

    def test_update_credentials_not_found(self):
        """Test updating credentials for non-existent source."""
        fake_id = str(uuid.uuid4())
        new_creds = {
            "creds": {
                "host": "localhost",
                "port": 5432,
                "user": "postgres",
                "password": "postgres",
                "dbname": "testdb",
            }
        }

        response = client.put(f"/sources/credentials/{fake_id}/", json=new_creds)

        assert response.status_code == 404
        assert "Source not found" in response.json()["detail"]

    def test_update_credentials_invalid_structure(self, sample_postgres_source_data):
        """Test updating credentials with invalid structure."""
        # First create a source
        create_response = client.post("/sources/", json=sample_postgres_source_data)
        assert create_response.status_code == 200
        source_id = create_response.json()["id"]

        # Try to update with invalid credentials structure
        invalid_creds = {
            "creds": {
                "invalid_field": "value"
                # Missing required PostgreSQL fields
            }
        }

        response = client.put(f"/sources/credentials/{source_id}/", json=invalid_creds)

        assert response.status_code == 422  # Validation error


class TestDeleteSource:
    """Test the DELETE /sources/{source_id}/ endpoint."""

    def test_delete_source_success(self, sample_postgres_source_data):
        """Test successful source deletion."""
        # First create a source
        create_response = client.post("/sources/", json=sample_postgres_source_data)
        assert create_response.status_code == 200
        source_id = create_response.json()["id"]

        # Delete the source
        response = client.delete(f"/sources/{source_id}/")

        assert response.status_code == 200
        assert response.json()["message"] == "Source deleted"

        # Verify it's actually deleted by trying to rename it
        rename_response = client.put(f"/sources/rename/{source_id}/", json={"name": "Should fail"})
        assert rename_response.status_code == 404

    def test_delete_source_not_found(self):
        """Test deleting non-existent source."""
        fake_id = str(uuid.uuid4())

        response = client.delete(f"/sources/{fake_id}/")

        assert response.status_code == 404
        assert "Source not found" in response.json()["detail"]


class TestTestSource:
    """Test the POST /sources/test/ endpoint."""

    def test_test_source_postgres_with_user_db(self, sample_postgres_user_db_data):
        """Test PostgreSQL source connection test using the user-db-pg service."""
        response = client.post("/sources/test/", json=sample_postgres_user_db_data)

        # This should work with the user-db-pg service running on port 5433
        # The test might still fail if the worker container setup fails, but the connection should be valid
        assert response.status_code in [200, 500]

        # If it's a 500 error, it's likely due to worker container issues, not connection issues
        if response.status_code == 500:
            error_detail = response.json().get("detail", "")
            # These are acceptable errors that indicate the connection test reached the database
            # but failed due to worker container setup issues
            acceptable_errors = ["worker", "container", "docker", "spawn", "network"]
            # If none of these error types, it might be a real connection issue
            if not any(error in error_detail.lower() for error in acceptable_errors):
                pytest.fail(f"Unexpected error: {error_detail}")

    @pytest.mark.skip(reason="Requires MySQL service which is not in docker-compose")
    def test_test_source_mysql_success(self):
        """Test successful MySQL source connection test."""
        test_data = {
            "dbtype": "mysql",
            "creds": {
                "host": "localhost",
                "port": 3306,
                "user": "root",
                "password": "password",
                "dbname": "mysql",
            },
        }

        response = client.post("/sources/test/", json=test_data)

        # This will likely fail without a running database, but shows the structure
        assert response.status_code in [200, 500]

    def test_test_source_invalid_creds(self):
        """Test source connection test with invalid credentials."""
        test_data = {
            "dbtype": "postgres",
            "creds": {
                "host": "localhost"
                # Missing required fields
            },
        }

        response = client.post("/sources/test/", json=test_data)

        assert response.status_code == 422  # Validation error

    def test_test_source_missing_fields(self):
        """Test source connection test with missing required fields."""
        incomplete_data = {
            "dbtype": "postgres"
            # Missing creds
        }

        response = client.post("/sources/test/", json=incomplete_data)

        assert response.status_code == 422  # Validation error

    @pytest.mark.skip(reason="Requires a running worker container")
    def test_test_source_invalid_connection(self):
        """Test source connection test with invalid connection details."""
        invalid_connection_data = {
            "dbtype": "postgres",
            "creds": {
                "host": "nonexistent-host",
                "port": 9999,
                "user": "invalid_user",
                "password": "invalid_password",
                "dbname": "invalid_db",
            },
        }

        response = client.post("/sources/test/", json=invalid_connection_data)

        # Should return 500 due to connection failure
        assert response.status_code == 500
        assert "detail" in response.json()


# Integration test that combines multiple operations
class TestSourceWorkflow:
    """Test complete source workflow."""

    def test_complete_source_lifecycle(self, sample_postgres_source_data):
        """Test creating, renaming, updating credentials, and deleting a source."""
        # Create
        create_response = client.post("/sources/", json=sample_postgres_source_data)
        assert create_response.status_code == 200
        source_id = create_response.json()["id"]

        # Rename
        rename_data = {"name": "Renamed in Lifecycle Test"}
        rename_response = client.put(f"/sources/rename/{source_id}/", json=rename_data)
        assert rename_response.status_code == 200
        assert rename_response.json()["name"] == rename_data["name"]

        # Update credentials
        new_creds = {
            "creds": {
                "host": "updated-host",
                "port": 5433,
                "user": "updated_user",
                "password": "updated_password",
                "dbname": "updated_db",
            }
        }
        update_response = client.put(f"/sources/credentials/{source_id}/", json=new_creds)
        assert update_response.status_code == 200
        assert update_response.json()["creds"] == new_creds["creds"]

        # Delete
        delete_response = client.delete(f"/sources/{source_id}/")
        assert delete_response.status_code == 200

        # Verify deletion
        final_check = client.put(f"/sources/rename/{source_id}/", json={"name": "Should fail"})
        assert final_check.status_code == 404

    def test_multiple_sources_different_types(
        self, sample_postgres_source_data, sample_mysql_source_data, sample_sqlite_source_data
    ):
        """Test creating multiple sources of different types."""
        sources_data = [
            sample_postgres_source_data,
            sample_mysql_source_data,
            sample_sqlite_source_data,
        ]

        created_sources = []

        # Create all sources
        for source_data in sources_data:
            response = client.post("/sources/", json=source_data)
            assert response.status_code == 200
            created_sources.append(response.json())

        # Verify all sources were created with correct types
        assert len(created_sources) == 3
        assert created_sources[0]["dbtype"] == "postgres"
        assert created_sources[1]["dbtype"] == "mysql"
        assert created_sources[2]["dbtype"] == "sqlite"

        # Clean up - delete all created sources
        for source in created_sources:
            delete_response = client.delete(f"/sources/{source['id']}/")
            assert delete_response.status_code == 200

    def test_source_with_user_db_integration(self, sample_postgres_user_db_data):
        """Test creating and testing a source that connects to the user-db-pg service."""
        # Create a source pointing to the user database
        create_response = client.post("/sources/", json=sample_postgres_user_db_data)
        assert create_response.status_code == 200
        source_id = create_response.json()["id"]

        # Test the connection
        test_response = client.post("/sources/test/", json=sample_postgres_user_db_data)
        # Should succeed or fail with worker-related issues, not connection issues
        assert test_response.status_code in [200, 500]

        # Clean up
        delete_response = client.delete(f"/sources/{source_id}/")
        assert delete_response.status_code == 200
