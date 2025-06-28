import time
import logging
from typing import Dict
from sqlalchemy import create_engine, text, URL
from sqlalchemy.exc import OperationalError

from common.models import ConnectionInfo, SUPPORTED_DB_TYPES
from common.exceptions import DatabaseConnectionError, UnsupportedDatabaseError

logger = logging.getLogger(__name__)

# Active connection pools: { f"{source_id}:{role}": ConnectionInfo }
ENGINES: Dict[str, ConnectionInfo] = {}

# Connection statistics for monitoring
_connection_stats = {
    "total_created": 0,
    "total_disposed": 0,
    "current_active": 0,
    "failed_connections": 0,
}


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
    _connection_stats["total_created"] += 1
    return engine, str(connection_url)


def test_database_connection(engine) -> bool:
    """Test database connection"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        _connection_stats["failed_connections"] += 1
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
            _dispose_single_connection(source_key, connection_info)

    # Create new engine
    engine, connection_url = create_database_engine(db_type, creds, role)

    # Test the connection
    if not test_database_connection(engine):
        engine.dispose()
        _connection_stats["total_disposed"] += 1
        raise DatabaseConnectionError("Failed to establish database connection")

    # Store the connection info
    connection_info = ConnectionInfo(
        engine=engine, url=connection_url, db_type=db_type, role=role, source_id=source_id
    )
    ENGINES[source_key] = connection_info
    _connection_stats["current_active"] = len(ENGINES)

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
        _dispose_single_connection(source_key, connection_info)
        raise DatabaseConnectionError(f"Connection {source_key} is unhealthy and has been removed")

    return connection_info


def get_connections_count() -> int:
    """Get the number of active connections"""
    return len(ENGINES)


def get_connection_stats() -> Dict:
    """Get connection statistics for monitoring"""
    return {
        **_connection_stats,
        "current_active": len(ENGINES),
        "active_connections": list(ENGINES.keys()),
    }


def _dispose_single_connection(source_key: str, connection_info: ConnectionInfo):
    """Dispose a single connection safely"""
    try:
        connection_info.engine.dispose()
        logger.info(f"Disposed connection {source_key}")
        _connection_stats["total_disposed"] += 1
    except Exception as e:
        logger.error(f"Error disposing connection {source_key}: {str(e)}")
    finally:
        if source_key in ENGINES:
            del ENGINES[source_key]
            _connection_stats["current_active"] = len(ENGINES)


def remove_connection(source_key: str):
    """Remove a connection from the pool"""
    if source_key in ENGINES:
        connection_info = ENGINES[source_key]
        _dispose_single_connection(source_key, connection_info)
        logger.info(f"Removed connection {source_key}")


def cleanup_all_connections():
    """Clean up all connections (for shutdown)"""
    if not ENGINES:
        logger.info("No connections to clean up")
        return

    logger.info(f"Cleaning up {len(ENGINES)} connections...")

    # Log current connection stats before cleanup
    stats = get_connection_stats()
    logger.info(f"Connection stats before cleanup: {stats}")

    # Dispose all connections
    connections_to_cleanup = list(ENGINES.items())
    for source_key, connection_info in connections_to_cleanup:
        _dispose_single_connection(source_key, connection_info)

    # Final cleanup
    ENGINES.clear()
    _connection_stats["current_active"] = 0

    logger.info("All connections cleaned up successfully")
    logger.info(f"Final connection stats: {get_connection_stats()}")


def health_check_connections() -> Dict:
    """Health check all active connections"""
    healthy_connections = []
    unhealthy_connections = []

    for source_key, connection_info in ENGINES.items():
        if test_database_connection(connection_info.engine):
            healthy_connections.append(source_key)
        else:
            unhealthy_connections.append(source_key)

    return {
        "total_connections": len(ENGINES),
        "healthy_connections": healthy_connections,
        "unhealthy_connections": unhealthy_connections,
        "health_percentage": len(healthy_connections) / len(ENGINES) * 100 if ENGINES else 100,
    }
