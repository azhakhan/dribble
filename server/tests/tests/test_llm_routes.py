import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.models import LLM
from app.core.db import SessionLocal
from app.controllers.llm import is_safe_query

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_llms_table():
    db = SessionLocal()
    try:
        db.query(LLM).delete()
        db.commit()
    finally:
        db.close()


@pytest.fixture
def sample_llm_data():
    return {
        "name": "openai",
        "model": "gpt-3.5-turbo",
        "api_key": "test-api-key",
        "base_url": "https://api.openai.com/v1",
        "api_version": "v1",
        "settings": {"temperature": 0.7},
    }


@pytest.fixture
def sample_llm_update_data():
    return {
        "name": "openai",
        "model": "gpt-4",
        "api_key": "updated-api-key",
        "base_url": "https://api.openai.com/v2",
        "api_version": "v2",
        "settings": {"temperature": 0.2},
    }


class TestCreateLLM:
    def test_create_llm_success(self, sample_llm_data):
        response = client.post("/llms/", json=sample_llm_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_llm_data["name"]
        assert data["model"] == sample_llm_data["model"]
        assert data["base_url"] == sample_llm_data["base_url"]
        assert data["api_version"] == sample_llm_data["api_version"]
        assert data["settings"] == sample_llm_data["settings"]
        assert "id" in data
        assert "created_at" in data

    def test_create_llm_missing_fields(self):
        incomplete_data = {"name": "openai"}
        response = client.post("/llms/", json=incomplete_data)
        assert response.status_code == 422

    def test_create_llm_duplicate_name(self, sample_llm_data):
        # Create first
        response1 = client.post("/llms/", json=sample_llm_data)
        assert response1.status_code == 200
        # Try to create again with same name
        response2 = client.post("/llms/", json=sample_llm_data)
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]


class TestGetLLM:
    def test_get_llms(self, sample_llm_data):
        # Create one
        client.post("/llms/", json=sample_llm_data)
        response = client.get("/llms/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(llm["name"] == sample_llm_data["name"] for llm in data)

    def test_get_llm_by_id(self, sample_llm_data):
        create_response = client.post("/llms/", json=sample_llm_data)
        assert create_response.status_code == 200
        llm_id = create_response.json()["id"]
        response = client.get(f"/llms/{llm_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == llm_id
        assert data["name"] == sample_llm_data["name"]

    def test_get_llm_not_found(self):
        fake_id = str(uuid.uuid4())
        response = client.get(f"/llms/{fake_id}")
        assert response.status_code == 404
        assert "LLM not found" in response.json()["detail"]


class TestUpdateLLM:
    def test_update_llm_success(self, sample_llm_data, sample_llm_update_data):
        create_response = client.post("/llms/", json=sample_llm_data)
        assert create_response.status_code == 200
        llm_id = create_response.json()["id"]
        response = client.put(f"/llms/{llm_id}", json=sample_llm_update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["model"] == sample_llm_update_data["model"]
        assert data["base_url"] == sample_llm_update_data["base_url"]
        assert data["api_version"] == sample_llm_update_data["api_version"]
        assert data["settings"] == sample_llm_update_data["settings"]

    def test_update_llm_not_found(self, sample_llm_update_data):
        fake_id = str(uuid.uuid4())
        response = client.put(f"/llms/{fake_id}", json=sample_llm_update_data)
        assert response.status_code == 404
        assert "LLM not found" in response.json()["detail"]

    def test_update_llm_duplicate_name(self, sample_llm_data):
        # Create two LLMs
        data1 = sample_llm_data.copy()
        data2 = sample_llm_data.copy()
        data2["name"] = "anthropic"
        data2["model"] = "claude-2"
        resp1 = client.post("/llms/", json=data1)
        resp2 = client.post("/llms/", json=data2)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        llm1_id = resp1.json()["id"]
        # Try to update llm1 to have the same name as llm2
        update_data = {"name": "anthropic"}
        response = client.put(f"/llms/{llm1_id}", json=update_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]


class TestDeleteLLM:
    def test_delete_llm_success(self, sample_llm_data):
        create_response = client.post("/llms/", json=sample_llm_data)
        assert create_response.status_code == 200
        llm_id = create_response.json()["id"]
        response = client.delete(f"/llms/{llm_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "LLM deleted successfully"
        # Verify deletion
        get_response = client.get(f"/llms/{llm_id}")
        assert get_response.status_code == 404

    def test_delete_llm_not_found(self):
        fake_id = str(uuid.uuid4())
        response = client.delete(f"/llms/{fake_id}")
        assert response.status_code == 404
        assert "LLM not found" in response.json()["detail"]


@pytest.mark.skip(reason="Skipping LLM workflow test for now")
class TestLLMWorkflow:
    def test_complete_llm_lifecycle(self, sample_llm_data, sample_llm_update_data):
        # Create
        create_response = client.post("/llms/", json=sample_llm_data)
        assert create_response.status_code == 200
        llm_id = create_response.json()["id"]
        # Update
        update_response = client.put(f"/llms/{llm_id}", json=sample_llm_update_data)
        assert update_response.status_code == 200
        # Get
        get_response = client.get(f"/llms/{llm_id}")
        assert get_response.status_code == 200
        # Delete
        delete_response = client.delete(f"/llms/{llm_id}")
        assert delete_response.status_code == 200
        # Verify deletion
        final_check = client.get(f"/llms/{llm_id}")
        assert final_check.status_code == 404


class TestLLMTools:
    """Test the LLM tool functionality and safety checks."""

    def test_is_safe_query_select_allowed(self):
        """Test that SELECT queries are allowed."""
        safe_queries = [
            "SELECT * FROM users",
            "select name, email from users where active = true",
            "SELECT COUNT(*) FROM orders",
            "WITH recent_orders AS (SELECT * FROM orders WHERE created_at > '2023-01-01') SELECT * FROM recent_orders",
        ]

        for query in safe_queries:
            assert is_safe_query(query), f"Query should be safe: {query}"

    def test_is_safe_query_dangerous_blocked(self):
        """Test that dangerous queries are blocked."""
        dangerous_queries = [
            "DELETE FROM users",
            "DROP TABLE users",
            "INSERT INTO users (name) VALUES ('test')",
            "UPDATE users SET active = false",
            "TRUNCATE TABLE orders",
            "ALTER TABLE users ADD COLUMN test VARCHAR(50)",
            "CREATE TABLE test (id INT)",
            "GRANT ALL ON users TO public",
            "EXEC sp_delete_user",
            "EXECUTE IMMEDIATE 'DROP TABLE users'",
        ]

        for query in dangerous_queries:
            assert not is_safe_query(query), f"Query should be blocked: {query}"

    def test_is_safe_query_with_comments(self):
        """Test that queries with comments are handled correctly."""
        queries_with_comments = [
            "-- This is a comment\nSELECT * FROM users",
            "SELECT * FROM users -- inline comment",
            "/* multi\nline\ncomment */ SELECT * FROM users",
            "SELECT * FROM users /* inline block comment */ WHERE active = true",
        ]

        for query in queries_with_comments:
            assert is_safe_query(query), f"Query with comments should be safe: {query}"

    def test_is_safe_query_case_insensitive(self):
        """Test that safety checks are case insensitive."""
        unsafe_queries = [
            "delete from users",
            "Delete From Users",
            "DELETE from USERS",
            "dElEtE fRoM uSeRs",
        ]

        for query in unsafe_queries:
            assert not is_safe_query(query), f"Query should be blocked regardless of case: {query}"
