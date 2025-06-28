import time
import logging
from typing import Dict
from sqlalchemy import create_engine, text, URL
from sqlalchemy.exc import OperationalError

from .models import ConnectionInfo, SUPPORTED_DB_TYPES
from .exceptions import DatabaseConnectionError, UnsupportedDatabaseError

logger = logging.getLogger(__name__)

# Active connection pools: { f"{source_id}:{role}": ConnectionInfo }
ENGINES: Dict[str, ConnectionInfo] = {}


def build_connection_url(db_type: str, creds: Dict) -> str:
    """Build database connection URL from credentials"""
    if db_type not in SUPPORTED_DB_TYPES:
        raise UnsupportedDatabaseError(db_type)

    if db_type == "postgresql":
        return URL.create(
            "postgresql+psycopg",
            username=creds.get("user") or creds.get("username"),
            password=creds["password"],
            host=creds["host"],
            port=creds.get("port", 5432),
            database=creds.get("dbname") or creds.get("database"),
        )
    elif db_type == "mysql":
        return URL.create(
            "mysql+pymysql",
            username=creds.get("user") or creds.get("username"),
            password=creds["password"],
            host=creds["host"],
            port=creds.get("port", 3306),
            database=creds.get("database") or creds.get("dbname"),
        )
    elif db_type == "sqlite":
        # SQLite just needs the database path
        db_path = creds.get("database") or creds.get("path")
        return f"sqlite:///{db_path}"
    elif db_type == "snowflake":
        # Snowflake URL format
        account = creds["account"]
        warehouse = creds.get("warehouse", "")
        database = creds.get("database", "")
        schema = creds.get("schema", "")
        return URL.create(
            "snowflake",
            username=creds["username"],
            password=creds["password"],
            host=f"{account}.snowflakecomputing.com",
            database=database,
            query={
                "warehouse": warehouse,
                "schema": schema,
            },
        )
    else:
        raise UnsupportedDatabaseError(db_type)


def get_role_specific_config(db_type: str, role: str) -> Dict:
    """Get role-specific database configuration"""
    base_config = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }

    # Adjust pool size based on role
    if role == "reader":
        base_config["pool_size"] = 3
        base_config["max_overflow"] = 7
    elif role == "writer":
        base_config["pool_size"] = 5
        base_config["max_overflow"] = 10
    elif role == "admin":
        base_config["pool_size"] = 2
        base_config["max_overflow"] = 5

    # Database-specific configurations
    if db_type == "postgresql":
        base_config["connect_args"] = {
            "sslmode": "prefer",
            "connect_timeout": 10,
            "application_name": f"dribble_worker_{role}",
        }
    elif db_type == "mysql":
        base_config["connect_args"] = {
            "connect_timeout": 10,
            "autocommit": True,
        }

    return base_config


def create_database_engine(db_type: str, creds: Dict, role: str):
    """Create a database engine with proper settings based on DB type and role"""
    connection_url = build_connection_url(db_type, creds)
    engine_config = get_role_specific_config(db_type, role)

    engine = create_engine(connection_url, **engine_config)
    logger.info(f"Created {db_type} engine for role {role}")
    return engine, str(connection_url)


def test_database_connection(engine) -> bool:
    """Test database connection"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        return False


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
                raise DatabaseConnectionError(
                    f"Failed to establish database connection after {max_retries} attempts",
                    original_exception=e,
                )


def add_connection(source_id: str, role: str, db_type: str, creds: Dict) -> str:
    """Add a new database connection to the pool"""
    source_key = f"{source_id}:{role}"

    # Check if connection already exists
    if source_key in ENGINES:
        logger.info(f"Connection {source_key} already exists, testing...")
        connection_info = ENGINES[source_key]
        if test_database_connection(connection_info.engine):
            logger.info(f"Existing connection {source_key} is healthy")
            return source_key
        else:
            logger.warning(f"Existing connection {source_key} is unhealthy, recreating...")
            # Remove the bad connection
            ENGINES[source_key].engine.dispose()
            del ENGINES[source_key]

    # Create new engine
    engine, connection_url = create_database_engine(db_type, creds, role)

    # Test the connection
    if not test_database_connection(engine):
        engine.dispose()
        raise DatabaseConnectionError("Failed to establish database connection")

    # Store the connection info
    connection_info = ConnectionInfo(
        engine=engine, url=connection_url, db_type=db_type, role=role, source_id=source_id
    )
    ENGINES[source_key] = connection_info

    logger.info(f"Successfully established connection {source_key}")
    return source_key


def get_connection(source_key: str) -> ConnectionInfo:
    """Get an existing connection from the pool"""
    if source_key not in ENGINES:
        raise DatabaseConnectionError(
            f"No connection found for {source_key}. Use connect task first."
        )

    connection_info = ENGINES[source_key]

    # Test connection health
    if not test_database_connection(connection_info.engine):
        logger.warning(f"Connection {source_key} is unhealthy, removing from pool")
        connection_info.engine.dispose()
        del ENGINES[source_key]
        raise DatabaseConnectionError(f"Connection {source_key} is unhealthy and has been removed")

    return connection_info


def get_connections_count() -> int:
    """Get the number of active connections"""
    return len(ENGINES)


def remove_connection(source_key: str):
    """Remove a connection from the pool"""
    if source_key in ENGINES:
        ENGINES[source_key].engine.dispose()
        del ENGINES[source_key]
        logger.info(f"Removed connection {source_key}")


def cleanup_all_connections():
    """Clean up all connections (for shutdown)"""
    for source_key, connection_info in ENGINES.items():
        try:
            connection_info.engine.dispose()
            logger.info(f"Disposed connection {source_key}")
        except Exception as e:
            logger.error(f"Error disposing connection {source_key}: {str(e)}")

    ENGINES.clear()
    logger.info("All connections cleaned up")
