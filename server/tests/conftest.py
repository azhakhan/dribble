import pytest
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Test database configuration
TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/dribble"

seed_data = """
INSERT INTO public.workspaces VALUES ('00000000-0000-0000-0000-000000000000', 'Default Workspace', '2025-05-21 16:19:59.854465') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users VALUES ('00000000-0000-0000-0000-000000000000', 'Admin', 'admin@example.com', '2025-05-21 16:19:59.854465') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.workspace_users VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'admin', '2025-05-21 16:19:59.854465') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sources VALUES ('84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38', 'test', 'postgres', '{"host": "6.tcp.ngrok.io", "port": 15311, "user": "postgres", "password": "postgres", "dbname": "dribble"}', '00000000-0000-0000-0000-000000000000', '2025-05-21 21:27:15.928878') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.workers VALUES ('285070b9-3a8a-4143-8912-d0932fd56fc3', '84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38', '51aa4c4508dbcb6241d9790ab5f7672ec815a93202cd40086fe655264693b622', 8029, 'http://dribble-worker-postgres-84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38:8000', 'healthy', '2025-05-29 20:24:28.665124', '00000000-0000-0000-0000-000000000000') ON CONFLICT (id) DO NOTHING;
"""  # noqa


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine for the entire test session."""
    # Use the test database URL from environment or default
    database_url = os.getenv("TEST_DATABASE_URL", TEST_DATABASE_URL)

    engine = create_engine(database_url, echo=False)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def seed_test_data(test_engine):
    """Seed the database with test source and worker data."""
    with test_engine.connect() as connection:
        # Split the seed data into individual statements and execute them
        statements = [stmt.strip() for stmt in seed_data.strip().split(";") if stmt.strip()]

        for statement in statements:
            try:
                connection.execute(text(statement))
            except Exception as e:
                print(f"Warning: Failed to execute statement: {statement}")
                print(f"Error: {e}")

        connection.commit()

    yield


@pytest.fixture
def db_session(test_engine, seed_test_data):
    """Create a database session for each test."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
