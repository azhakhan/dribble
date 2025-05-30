import sys
import pathlib

# Add the server app directory to the Python path so we can import models
server_dir = pathlib.Path(__file__).parent.parent.parent / "app"
sys.path.insert(0, str(server_dir))

from models import Source, Worker  # noqa
from sqlalchemy import text  # noqa


def test_source_seeding(db_session):
    """Test that the source is properly seeded with test data."""
    sources = (
        db_session.query(Source).filter(Source.id == "84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38").all()
    )  # noqa
    assert len(sources) == 1
    assert sources[0].name == "test"
    assert sources[0].dbtype == "postgres"


def test_worker_seeding(db_session):
    """Test that the worker is properly seeded with test data."""
    workers = (
        db_session.query(Worker).filter(Worker.id == "285070b9-3a8a-4143-8912-d0932fd56fc3").all()
    )  # noqa
    assert len(workers) == 1
    assert workers[0].status == "healthy"
    assert str(workers[0].source_id) == "84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38"


def test_database_connection(test_engine):
    """Test that the database connection is working."""
    with test_engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        assert result.fetchone()[0] == 1
