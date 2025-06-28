from app.models import Source  # noqa
from sqlalchemy import text  # noqa


def test_source_seeding(db_session):
    """Test that the source is properly seeded with test data."""
    sources = (
        db_session.query(Source).filter(Source.id == "84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38").all()
    )  # noqa
    assert len(sources) == 1
    assert sources[0].name == "test"
    assert sources[0].dbtype == "postgres"


def test_database_connection(test_engine):
    """Test that the database connection is working."""
    with test_engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        assert result.fetchone()[0] == 1
