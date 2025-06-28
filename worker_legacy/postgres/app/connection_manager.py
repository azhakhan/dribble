from sqlalchemy import create_engine, text
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError
import time
import logging
from .models import PostgresCreds
from .exceptions import DatabaseConnectionError

logger = logging.getLogger(__name__)


def create_database_engine(creds: PostgresCreds):
    """Create a database engine with proper SSL and connection settings"""
    url = URL.create(
        "postgresql+psycopg",
        username=creds.user,
        password=creds.password,
        host=creds.host,
        port=creds.port,
        database=creds.dbname,
    )

    # Create engine with connection pooling and SSL settings
    engine = create_engine(
        url,
        # Connection pool settings
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # Validate connections before use
        pool_recycle=3600,  # Recycle connections every hour
        # Connection arguments for psycopg
        connect_args={
            "sslmode": "prefer",  # Try SSL, fallback to non-SSL
            "connect_timeout": 10,
            "application_name": "dribble_worker",
        },
    )
    return engine


def get_database_connection(engine, max_retries: int = 3, retry_delay: float = 1.0):
    """Get a database connection with retry logic"""
    connection_details = {
        "max_retries": max_retries,
        "retry_delay": retry_delay,
        "database_type": "postgresql",
    }

    for attempt in range(max_retries):
        try:
            conn = engine.connect()
            # Test the connection
            conn.execute(text("SELECT 1"))
            return conn
        except OperationalError as e:
            logger.warning(f"Database connection attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (2**attempt))  # Exponential backoff
                continue
            else:
                raise DatabaseConnectionError(
                    f"Failed to establish database connection after {max_retries} attempts",
                    original_exception=e,
                    connection_details=connection_details,
                )
