import os
import time
import uuid
import logging
import json
import binascii
import datetime
import decimal
from typing import Any, Dict, Optional
from dataclasses import dataclass

import redis
from sqlalchemy import create_engine, text, URL
from sqlalchemy.exc import OperationalError

# Configs
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_NAME = os.getenv("REDIS_QUEUE", "query_tasks")
HEARTBEAT_KEY = f"worker:heartbeat:{uuid.uuid4()}"
HEARTBEAT_INTERVAL = 5  # seconds

# Init Redis
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# Active connection pools: { f"{source_id}:{role}": {"engine": engine, "url": url, "db_type": db_type} }
ENGINES: Dict[str, Dict[str, Any]] = {}

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class TaskRequest:
    """Represents a task from the Redis queue"""

    task_type: str  # 'connect', 'test_db', 'execute', 'execute_version', 'schema'
    query_run_id: str

    # For connect/test_db tasks
    source_id: Optional[str] = None
    role: Optional[str] = None  # 'reader', 'writer', 'admin'
    db_type: Optional[str] = None
    creds: Optional[Dict] = None

    # For execute tasks (use existing connection)
    source_key: Optional[str] = None  # "{source_id}:{role}"
    sql: Optional[str] = None
    modifiers: Optional[Dict] = None


class WorkerError(Exception):
    """Base worker exception"""

    def __init__(self, message: str, original_exception: Exception = None):
        super().__init__(message)
        self.message = message
        self.original_exception = original_exception

    def __str__(self):
        if self.original_exception:
            return f"{self.message} (caused by: {str(self.original_exception)})"
        return self.message


class DatabaseConnectionError(WorkerError):
    """Database connection failures"""

    pass


class QueryExecutionError(WorkerError):
    """Query execution failures"""

    pass


def build_connection_url(db_type: str, creds: Dict) -> str:
    """Build database connection URL from credentials"""
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
        raise ValueError(f"Unsupported database type: {db_type}")


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


def detect_query_type(query: str) -> str:
    """Detect the type of SQL query"""
    query_trimmed = query.strip().upper()
    if query_trimmed.startswith("SELECT"):
        return "SELECT"
    elif query_trimmed.startswith("INSERT"):
        return "INSERT"
    elif query_trimmed.startswith("UPDATE"):
        return "UPDATE"
    elif query_trimmed.startswith("DELETE"):
        return "DELETE"
    elif query_trimmed.startswith("CREATE"):
        return "CREATE"
    elif query_trimmed.startswith("DROP"):
        return "DROP"
    elif query_trimmed.startswith("ALTER"):
        return "ALTER"
    elif query_trimmed.startswith("TRUNCATE"):
        return "TRUNCATE"
    elif query_trimmed.startswith("WITH"):
        # Common Table Expressions (CTE) - check if it's a SELECT
        if "SELECT" in query_trimmed:
            return "SELECT"
        else:
            return "CTE"
    else:
        return "OTHER"


def serialize_value(value):
    """Convert database values to JSON-serializable format"""
    # Handle binary data (bytea) by converting to hex string
    if isinstance(value, bytes):
        return "0x" + binascii.hexlify(value).decode("ascii")
    # Handle decimal values by converting to float
    elif isinstance(value, decimal.Decimal):
        return float(value)
    # Handle datetime objects by converting to ISO format string
    elif isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    # Handle UUID objects by converting to string
    elif isinstance(value, uuid.UUID):
        return str(value)
    # Handle timedelta objects by converting to total seconds
    elif isinstance(value, datetime.timedelta):
        return value.total_seconds()
    # Handle sets by converting to list
    elif isinstance(value, set):
        return list(value)
    # Handle any other non-JSON serializable types by converting to string
    elif not isinstance(value, (str, int, float, bool, list, dict, type(None))):
        return str(value)
    else:
        return value


def execute_query(sql: str, engine):
    """Execute a SQL query and return structured result"""
    query_type = detect_query_type(sql)

    try:
        with get_database_connection(engine) as conn:
            result = conn.execute(text(sql))

            if query_type == "SELECT":
                # Handle SELECT queries - fetch rows
                rows = result.fetchall()
                processed_rows = []

                if len(rows) == 0:
                    return {
                        "data": [],
                        "row_count": 0,
                        "is_select_query": True,
                        "query_type": query_type,
                    }

                for row in rows:
                    processed_row = {}
                    for key, value in row._mapping.items():
                        processed_row[key] = serialize_value(value)
                    processed_rows.append(processed_row)

                return {
                    "data": processed_rows,
                    "row_count": len(processed_rows),
                    "is_select_query": True,
                    "query_type": query_type,
                }
            else:
                # Handle non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
                affected_rows = result.rowcount if result.rowcount is not None else 0

                # For DDL and utility statements, rowcount is often -1 or None
                if (
                    query_type
                    in [
                        "CREATE",
                        "DROP",
                        "ALTER",
                        "GRANT",
                        "REVOKE",
                        "ANALYZE",
                        "VACUUM",
                        "EXPLAIN",
                    ]
                    and affected_rows <= 0
                ):
                    affected_rows = 0  # These statements don't have meaningful row counts

                return {
                    "data": [],
                    "row_count": affected_rows,
                    "is_select_query": False,
                    "query_type": query_type,
                }

    except OperationalError as e:
        logger.error(f"Database error: {str(e)}")
        raise QueryExecutionError(
            f"Error executing {query_type} query",
            original_exception=e,
        )
    except Exception as e:
        logger.error(f"Unexpected error during query execution: {str(e)}")
        raise QueryExecutionError(
            f"Unexpected error executing {query_type} query",
            original_exception=e,
        )


def build_query_with_modifiers(sql: str, modifiers: Optional[Dict] = None) -> str:
    """Build a SQL query with CTE wrapper and modifiers"""
    # Remove leading and trailing whitespace
    sql = sql.strip()

    # Remove trailing semicolon if it exists
    if sql.endswith(";"):
        sql = sql[:-1]

    # Wrap in CTE
    sql_to_run = f"WITH temp_query AS ({sql}) SELECT * FROM temp_query"

    # Apply modifiers if provided
    if modifiers:
        if modifiers.get("where"):
            sql_to_run += f" WHERE {modifiers['where']}"
        if modifiers.get("order_by"):
            sql_to_run += f" ORDER BY {modifiers['order_by']}"
        if modifiers.get("limit"):
            sql_to_run += f" LIMIT {modifiers['limit']}"
        if modifiers.get("offset"):
            sql_to_run += f" OFFSET {modifiers['offset']}"

    # Add semicolon
    sql_to_run += ";"
    return sql_to_run


def get_schema_info(engine, db_type: str):
    """Get schema information for different database types"""
    try:
        with get_database_connection(engine) as conn:
            if db_type == "postgresql":
                return get_postgresql_schema(conn)
            elif db_type == "mysql":
                return get_mysql_schema(conn)
            elif db_type == "sqlite":
                return get_sqlite_schema(conn)
            else:
                return {"error": f"Schema inspection not implemented for {db_type}"}
    except Exception as e:
        logger.error(f"Error getting schema: {str(e)}")
        return {"error": str(e)}


def get_postgresql_schema(conn):
    """Get PostgreSQL schema information"""
    # Get all tables
    tables_query = """
    SELECT 
        table_schema, 
        table_name 
    FROM 
        information_schema.tables 
    WHERE 
        table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
    ORDER BY 
        table_schema, table_name;
    """
    tables_result = conn.execute(text(tables_query))
    tables = [dict(row._mapping) for row in tables_result]

    # Get all columns
    columns_query = """
    SELECT 
        table_schema,
        table_name, 
        column_name, 
        data_type, 
        is_nullable
    FROM 
        information_schema.columns
    WHERE 
        table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 
        table_schema, table_name, ordinal_position;
    """
    columns_result = conn.execute(text(columns_query))
    columns = [dict(row._mapping) for row in columns_result]

    return build_schema_structure(tables, columns)


def get_mysql_schema(conn):
    """Get MySQL schema information"""
    # Get current database name
    db_result = conn.execute(text("SELECT DATABASE()"))
    db_name = db_result.fetchone()[0]

    if not db_name:
        return {"error": "No database selected"}

    # Get all tables
    tables_query = """
    SELECT 
        table_schema, 
        table_name 
    FROM 
        information_schema.tables 
    WHERE 
        table_schema = :db_name
        AND table_type = 'BASE TABLE'
    ORDER BY 
        table_name;
    """
    tables_result = conn.execute(text(tables_query), {"db_name": db_name})
    tables = [dict(row._mapping) for row in tables_result]

    # Get all columns
    columns_query = """
    SELECT 
        table_schema,
        table_name, 
        column_name, 
        data_type, 
        is_nullable
    FROM 
        information_schema.columns
    WHERE 
        table_schema = :db_name
    ORDER BY 
        table_name, ordinal_position;
    """
    columns_result = conn.execute(text(columns_query), {"db_name": db_name})
    columns = [dict(row._mapping) for row in columns_result]

    return build_schema_structure(tables, columns)


def get_sqlite_schema(conn):
    """Get SQLite schema information"""
    # Get all tables
    tables_query = "SELECT name as table_name FROM sqlite_master WHERE type='table'"
    tables_result = conn.execute(text(tables_query))
    tables = [{"table_schema": "main", "table_name": row[0]} for row in tables_result]

    columns = []
    for table in tables:
        table_name = table["table_name"]
        # Get columns for each table
        columns_query = f"PRAGMA table_info({table_name})"
        columns_result = conn.execute(text(columns_query))
        for col_row in columns_result:
            columns.append(
                {
                    "table_schema": "main",
                    "table_name": table_name,
                    "column_name": col_row[1],  # name
                    "data_type": col_row[2],  # type
                    "is_nullable": "YES" if col_row[3] == 0 else "NO",  # notnull
                }
            )

    return build_schema_structure(tables, columns)


def build_schema_structure(tables, columns):
    """Build the structured schema representation"""
    schemas = {}

    # Process tables and their columns
    for table in tables:
        schema_name = table["table_schema"]
        table_name = table["table_name"]

        if schema_name not in schemas:
            schemas[schema_name] = {"tables": {}}

        schemas[schema_name]["tables"][table_name] = {"columns": []}

    # Add columns to their respective tables
    for column in columns:
        schema_name = column["table_schema"]
        table_name = column["table_name"]

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            schemas[schema_name]["tables"][table_name]["columns"].append(
                {
                    "name": column["column_name"],
                    "type": column["data_type"],
                    "nullable": column["is_nullable"] == "YES",
                }
            )

    return schemas


def generate_result_message(result: dict, execution_time_ms: int) -> str:
    """Generate appropriate result message based on query type and results"""
    if result["is_select_query"]:
        if result["row_count"] == 0:
            return f"Query executed successfully. No rows returned in {execution_time_ms}ms"
        elif result["row_count"] == 1:
            return f"Query executed successfully. 1 row returned in {execution_time_ms}ms"
        else:
            return f"Query executed successfully. {result['row_count']} rows returned in {execution_time_ms}ms"
    else:
        query_type = result["query_type"]
        if query_type in [
            "CREATE",
            "DROP",
            "ALTER",
            "GRANT",
            "REVOKE",
            "ANALYZE",
            "VACUUM",
            "EXPLAIN",
        ]:
            return f"{query_type} executed successfully in {execution_time_ms}ms"
        elif result["row_count"] == 0:
            return f"{query_type} executed successfully. No rows affected in {execution_time_ms}ms"
        elif result["row_count"] == 1:
            return f"{query_type} executed successfully. 1 row affected in {execution_time_ms}ms"
        else:
            return f"{query_type} executed successfully. {result['row_count']} rows affected in {execution_time_ms}ms"


def set_result(query_run_id: str, result: dict, ttl: int = 900):
    """Store result in Redis"""
    try:
        r.set(f"query_run:{query_run_id}:result", json.dumps(result), ex=ttl)
        logger.debug(f"Successfully set result for query {query_run_id}")
    except Exception as e:
        logger.error(f"Failed to set result in Redis for query {query_run_id}: {str(e)}")
        raise


def publish_result(query_run_id: str, status: str, data: dict = None, error: str = None):
    """Publish query result to Redis pub/sub channel"""
    try:
        message = {
            "query_run_id": query_run_id,
            "status": status,
            "timestamp": time.time(),
        }

        if data is not None:
            message["data"] = data
        if error is not None:
            message["error"] = error

        channel = f"query_results:{query_run_id}"
        r.publish(channel, json.dumps(message))
        logger.debug(f"Published result for query run {query_run_id} to channel {channel}")
    except Exception as e:
        logger.error(f"Failed to publish result to Redis for query run {query_run_id}: {str(e)}")


def handle_connect_task(task: TaskRequest):
    """Handle database connection setup"""
    try:
        set_result(task.query_run_id, {"status": "connecting"})

        # Create source key
        source_key = f"{task.source_id}:{task.role}"

        # Check if connection already exists
        if source_key in ENGINES:
            logger.info(f"Connection {source_key} already exists, testing...")
            engine_info = ENGINES[source_key]
            if test_database_connection(engine_info["engine"]):
                set_result(
                    task.query_run_id,
                    {"status": "success", "message": "Connection already established and healthy"},
                )
                publish_result(
                    task.query_run_id, "success", data={"message": "Connection already established"}
                )
                return
            else:
                logger.warning(f"Existing connection {source_key} is unhealthy, recreating...")
                # Remove the bad connection
                ENGINES[source_key]["engine"].dispose()
                del ENGINES[source_key]

        # Create new engine
        engine, connection_url = create_database_engine(task.db_type, task.creds, task.role)

        # Test the connection
        if not test_database_connection(engine):
            engine.dispose()
            raise DatabaseConnectionError("Failed to establish database connection")

        # Store the engine info
        ENGINES[source_key] = {
            "engine": engine,
            "url": connection_url,
            "db_type": task.db_type,
            "role": task.role,
            "source_id": task.source_id,
        }

        logger.info(f"Successfully established connection {source_key}")
        set_result(
            task.query_run_id,
            {"status": "success", "message": f"Connection established for {source_key}"},
        )
        publish_result(task.query_run_id, "success", data={"source_key": source_key})

    except Exception as e:
        error_message = str(e)
        logger.error(f"Connection setup failed for {task.source_id}:{task.role}: {error_message}")

        set_result(task.query_run_id, {"status": "error", "error": error_message})
        publish_result(task.query_run_id, "error", error=error_message)


def handle_test_db_task(task: TaskRequest):
    """Handle database connection testing"""
    try:
        set_result(task.query_run_id, {"status": "testing"})

        # Create temporary engine for testing
        engine, connection_url = create_database_engine(
            task.db_type, task.creds, task.role or "reader"
        )

        try:
            # Test the connection
            start_time = time.time()
            connection_healthy = test_database_connection(engine)
            test_time_ms = int((time.time() - start_time) * 1000)

            if connection_healthy:
                message = f"Database connection test successful in {test_time_ms}ms"
                logger.info(f"DB test successful: {task.db_type}")
                set_result(task.query_run_id, {"status": "success", "message": message})
                publish_result(
                    task.query_run_id,
                    "success",
                    data={"message": message, "test_time_ms": test_time_ms},
                )
            else:
                message = f"Database connection test failed after {test_time_ms}ms"
                logger.error(f"DB test failed: {task.db_type}")
                set_result(task.query_run_id, {"status": "error", "error": message})
                publish_result(task.query_run_id, "error", error=message)

        finally:
            # Always dispose of the test engine
            engine.dispose()

    except Exception as e:
        error_message = str(e)
        logger.error(f"DB test failed for {task.db_type}: {error_message}")

        set_result(task.query_run_id, {"status": "error", "error": error_message})
        publish_result(task.query_run_id, "error", error=error_message)


def handle_execute_task(task: TaskRequest):
    """Handle basic query execution"""
    start_time = time.time()

    try:
        # Check if connection exists
        if task.source_key not in ENGINES:
            raise DatabaseConnectionError(
                f"No connection found for {task.source_key}. Use connect task first."
            )

        set_result(task.query_run_id, {"status": "running"})

        engine_info = ENGINES[task.source_key]
        result = execute_query(task.sql, engine_info["engine"])
        execution_time_ms = int((time.time() - start_time) * 1000)

        result_message = generate_result_message(result, execution_time_ms)
        logger.info(f"Query {task.query_run_id} executed successfully: {result_message}")

        set_result(task.query_run_id, {"status": "success", "data": result["data"]})
        publish_result(task.query_run_id, "success", data=result["data"])

    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(
            f"Query {task.query_run_id} failed after {execution_time_ms}ms: {error_message}"
        )

        set_result(task.query_run_id, {"status": "error", "error": error_message})
        publish_result(task.query_run_id, "error", error=error_message)


def handle_execute_version_task(task: TaskRequest):
    """Handle query execution with modifiers"""
    start_time = time.time()

    try:
        # Check if connection exists
        if task.source_key not in ENGINES:
            raise DatabaseConnectionError(
                f"No connection found for {task.source_key}. Use connect task first."
            )

        set_result(task.query_run_id, {"status": "running"})

        # Build SQL with modifiers
        sql_to_run = build_query_with_modifiers(task.sql, task.modifiers)
        logger.info(f"Executing query with modifiers: {sql_to_run}")

        engine_info = ENGINES[task.source_key]
        result = execute_query(sql_to_run, engine_info["engine"])
        execution_time_ms = int((time.time() - start_time) * 1000)

        result_message = generate_result_message(result, execution_time_ms)
        logger.info(f"Query {task.query_run_id} executed successfully: {result_message}")

        set_result(task.query_run_id, {"status": "success", "data": result["data"]})
        publish_result(task.query_run_id, "success", data=result["data"])

    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(
            f"Query {task.query_run_id} failed after {execution_time_ms}ms: {error_message}"
        )

        set_result(task.query_run_id, {"status": "error", "error": error_message})
        publish_result(task.query_run_id, "error", error=error_message)


def handle_schema_task(task: TaskRequest):
    """Handle schema inspection"""
    try:
        # Check if connection exists
        if task.source_key not in ENGINES:
            raise DatabaseConnectionError(
                f"No connection found for {task.source_key}. Use connect task first."
            )

        set_result(task.query_run_id, {"status": "running"})

        engine_info = ENGINES[task.source_key]
        schema_info = get_schema_info(engine_info["engine"], engine_info["db_type"])

        logger.info(f"Schema inspection completed for {task.query_run_id}")

        set_result(task.query_run_id, {"status": "success", "data": schema_info})
        publish_result(task.query_run_id, "success", data=schema_info)

    except Exception as e:
        error_message = str(e)
        logger.error(f"Schema inspection {task.query_run_id} failed: {error_message}")

        set_result(task.query_run_id, {"status": "error", "error": error_message})
        publish_result(task.query_run_id, "error", error=error_message)


def process_task(task_data: dict):
    """Process a task from the queue"""
    try:
        # Parse task data
        task = TaskRequest(
            task_type=task_data["task_type"],
            query_run_id=task_data["query_run_id"],
            # For connect/test_db tasks
            source_id=task_data.get("source_id"),
            role=task_data.get("role", "reader"),
            db_type=task_data.get("db_type"),
            creds=task_data.get("creds"),
            # For execute tasks
            source_key=task_data.get("source_key"),
            sql=task_data.get("sql"),
            modifiers=task_data.get("modifiers"),
        )

        logger.info(f"Processing {task.task_type} task: {task.query_run_id}")

        # Route to appropriate handler
        if task.task_type == "connect":
            handle_connect_task(task)
        elif task.task_type == "test_db":
            handle_test_db_task(task)
        elif task.task_type == "execute":
            handle_execute_task(task)
        elif task.task_type == "execute_version":
            handle_execute_version_task(task)
        elif task.task_type == "schema":
            handle_schema_task(task)
        else:
            raise ValueError(f"Unknown task type: {task.task_type}")

    except Exception as e:
        logger.error(f"Error processing task: {str(e)}")
        if "query_run_id" in task_data:
            set_result(task_data["query_run_id"], {"status": "error", "error": str(e)})
            publish_result(task_data["query_run_id"], "error", error=str(e))


def main_loop():
    """Main worker loop"""
    logger.info("Starting generic worker loop...")
    last_heartbeat = 0

    while True:
        # Heartbeat
        now = time.time()
        if now - last_heartbeat > HEARTBEAT_INTERVAL:
            r.set(HEARTBEAT_KEY, int(now))
            r.set("worker:connections", len(ENGINES))  # Track number of active connections
            last_heartbeat = now

        try:
            # Wait for tasks from the queue
            task = r.brpop(QUEUE_NAME, timeout=5)
            if not task:
                continue  # no task, loop

            _, task_raw = task

            # Parse task JSON
            try:
                task_data = json.loads(task_raw)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in task: {task_raw}, error: {e}")
                continue

            # Process the task
            process_task(task_data)

        except redis.RedisError as e:
            logger.error(f"Redis error in worker loop: {str(e)}")
            time.sleep(1)
        except Exception:
            logger.exception("Worker loop error")
            time.sleep(1)


if __name__ == "__main__":
    main_loop()
