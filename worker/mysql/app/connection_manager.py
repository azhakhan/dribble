from sqlalchemy import create_engine, text
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError
import time
import logging
from .models import MySQLCreds

logger = logging.getLogger(__name__)


def create_database_engine(creds: MySQLCreds):
    """Create a MySQL database engine with proper SSL and connection settings"""
    url = URL.create(
        "mysql+mysqldb",
        username=creds.user,
        password=creds.password,
        host=creds.host,
        port=creds.port,
        database=creds.dbname,
    )

    # Create engine with connection pooling and MySQL-specific settings
    engine = create_engine(
        url,
        # Connection pool settings
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # Validate connections before use
        pool_recycle=3600,  # Recycle connections every hour
        # Connection arguments for MySQL
        connect_args={
            "connect_timeout": 10,
            "charset": "utf8mb4",
            "autocommit": True,
        },
    )
    return engine


def get_database_connection(engine, max_retries: int = 3, retry_delay: float = 1.0):
    """Get a database connection with retry logic"""
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
                raise e
