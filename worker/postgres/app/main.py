from fastapi import FastAPI
from pydantic import BaseModel
import os
from contextlib import asynccontextmanager
from sqlalchemy import create_engine, text
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError
import binascii
import asyncio
from app.helpers import set_result
import json
import logging
import datetime
import sys
import decimal
import uuid
import time
from typing import Optional, List
from enum import Enum
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PostgresCreds(BaseModel):
    host: str
    port: int
    user: str
    password: str
    dbname: str


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup
    os_creds = os.environ.get("DB_CREDS")
    if not os_creds:
        raise Exception("DB_CREDS is not set")
    creds = PostgresCreds(**json.loads(os_creds))

    app.state.engine = create_database_engine(creds)

    # Test the connection immediately to catch credential issues early
    try:
        with get_database_connection(app.state.engine) as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection test successful during startup")
    except OperationalError as e:
        logger.error(f"Database connection failed during startup: {str(e)}")
        app.state.engine.dispose()
        raise Exception(f"Database connection failed: {e}") from e

    yield
    # Teardown
    # Since this is a synchronous engine, we don't await its disposal
    app.state.engine.dispose()


app = FastAPI(lifespan=lifespan)


class QueryRequest(BaseModel):
    query: str
    query_id: str


class QueryResponse(BaseModel):
    query_id: str
    result: list[dict]


@app.post("/execute/")
async def run_query(request: QueryRequest):
    logger.info(f"[{datetime.datetime.now()}] Starting query execution for ID: {request.query_id}")

    try:
        await set_result(request.query_id, {"status": "running"})
    except Exception as e:
        logger.error(
            f"Failed to set initial status in Redis for query {request.query_id}: {str(e)}"
        )
        # Continue anyway, the background task will still try to set results

    async def execute_sql_query():
        start_time = time.time()
        try:
            result = execute_query(request.query)
            execution_time_ms = int((time.time() - start_time) * 1000)
            if result["is_select_query"]:
                logger.info(
                    f"Query {request.query_id} executed successfully in {execution_time_ms}ms, {result['row_count']} rows returned"
                )
            else:
                logger.info(
                    f"Query {request.query_id} executed successfully in {execution_time_ms}ms, {result['row_count']} rows affected ({result['query_type']})"
                )
            await set_result(request.query_id, {"status": "success", "data": result["data"]})
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Query {request.query_id} failed after {execution_time_ms}ms: {str(e)}")
            await set_result(request.query_id, {"status": "error", "error": str(e)})

    asyncio.create_task(execute_sql_query())
    return {"query_id": request.query_id, "status": "started"}


class QueryRunOperator(str, Enum):
    eq = "eq"
    ne = "ne"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    in_ = "in"
    not_in = "not_in"
    like = "like"
    not_like = "not_like"
    is_null = "is_null"
    is_not_null = "is_not_null"


class QueryRunFilter(BaseModel):
    column: str
    operator: QueryRunOperator
    value: str | int | float | bool | list[str] | list[int] | list[float] | list[bool]


class QueryRunOrderBy(BaseModel):
    column: str
    direction: str


class QueryRunModifiers(BaseModel):
    filters: Optional[List[QueryRunFilter]] = None
    order_by: Optional[List[QueryRunOrderBy]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class QueryVersionRequest(BaseModel):
    query_run_id: str
    sql: str
    modifiers: Optional[QueryRunModifiers] = None


class UpdateQueryRunRequest(BaseModel):
    result_message: Optional[str] = None
    error_message: Optional[str] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None


class QueryExecutionResult(BaseModel):
    data: list[dict]
    execution_time_ms: int
    row_count: int
    result_message: str
    is_select_query: bool


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
    elif query_trimmed.startswith("GRANT"):
        return "GRANT"
    elif query_trimmed.startswith("REVOKE"):
        return "REVOKE"
    elif query_trimmed.startswith("COPY"):
        return "COPY"
    elif query_trimmed.startswith("ANALYZE"):
        return "ANALYZE"
    elif query_trimmed.startswith("VACUUM"):
        return "VACUUM"
    elif query_trimmed.startswith("EXPLAIN"):
        return "EXPLAIN"
    elif query_trimmed.startswith("WITH"):
        # Common Table Expressions (CTE) - check if it's a SELECT
        if "SELECT" in query_trimmed:
            return "SELECT"
        else:
            return "CTE"
    else:
        return "OTHER"


def execute_query(query: str):
    """
    Execute a SQL query and return structured result with appropriate messaging.

    Examples of result messages:
    - SELECT: "Query executed successfully. 42 rows returned in 156ms"
    - INSERT: "INSERT executed successfully. 5 rows affected in 23ms"
    - UPDATE: "UPDATE executed successfully. 1 row affected in 12ms"
    - DELETE: "DELETE executed successfully. No rows affected in 8ms"
    - CREATE: "CREATE executed successfully in 45ms"
    - DROP: "DROP executed successfully in 12ms"
    """
    logger.info(f"[{datetime.datetime.now()}] In execute_query function")
    query_type = detect_query_type(query)

    try:
        with get_database_connection(app.state.engine) as conn:
            logger.info(f"[{datetime.datetime.now()}] Connected to database")
            result = conn.execute(text(query))

            if query_type == "SELECT":
                # Handle SELECT queries - fetch rows
                rows = result.fetchall()
                processed_rows = []
                logger.info(f"[{datetime.datetime.now()}] Rows fetched: {len(rows)}")

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
                        # Handle binary data (bytea) by converting to hex string
                        if isinstance(value, bytes):
                            hex_value = "0x" + binascii.hexlify(value).decode("ascii")
                            processed_row[key] = hex_value
                        # Handle decimal values by converting to float
                        elif isinstance(value, decimal.Decimal):
                            processed_row[key] = float(value)
                        # Handle datetime objects by converting to ISO format string
                        elif isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
                            processed_row[key] = value.isoformat()
                        # Handle UUID objects by converting to string
                        elif isinstance(value, uuid.UUID):
                            processed_row[key] = str(value)
                        # Handle timedelta objects by converting to total seconds
                        elif isinstance(value, datetime.timedelta):
                            processed_row[key] = value.total_seconds()
                        # Handle sets by converting to list
                        elif isinstance(value, set):
                            processed_row[key] = list(value)
                        # Handle any other non-JSON serializable types by converting to string
                        elif not isinstance(value, (str, int, float, bool, list, dict, type(None))):
                            processed_row[key] = str(value)
                        else:
                            processed_row[key] = value
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
                logger.info(
                    f"[{datetime.datetime.now()}] {query_type} query affected {affected_rows} rows"
                )

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
        logger.error(f"[{datetime.datetime.now()}] Database error: {str(e)}")
        raise Exception(f"Error executing query: {e}") from e


@app.post("/execute/version")
async def run_query_version(request: QueryVersionRequest):
    logger.info(f"Starting version query execution for ID: {request.query_run_id}")

    # compose sql with modifiers
    sql = request.sql
    if request.modifiers:
        if request.modifiers.filters:
            # Build WHERE clause with proper SQL formatting and parameter binding
            where_conditions = []
            for filter in request.modifiers.filters:

                def format_value(value):
                    """Format value for SQL based on its type"""
                    if isinstance(value, str):
                        # Escape single quotes in strings
                        escaped_value = value.replace("'", "''")
                        return f"'{escaped_value}'"
                    elif isinstance(value, (int, float)):
                        return str(value)
                    elif isinstance(value, bool):
                        return "TRUE" if value else "FALSE"
                    else:
                        return f"'{str(value)}'"

                if filter.operator == QueryRunOperator.eq:
                    where_conditions.append(f"{filter.column} = {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.ne:
                    where_conditions.append(f"{filter.column} != {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.gt:
                    where_conditions.append(f"{filter.column} > {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.gte:
                    where_conditions.append(f"{filter.column} >= {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.lt:
                    where_conditions.append(f"{filter.column} < {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.lte:
                    where_conditions.append(f"{filter.column} <= {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.in_:
                    if isinstance(filter.value, list):
                        values = ", ".join([format_value(v) for v in filter.value])
                        where_conditions.append(f"{filter.column} IN ({values})")
                    else:
                        where_conditions.append(
                            f"{filter.column} IN ({format_value(filter.value)})"
                        )
                elif filter.operator == QueryRunOperator.not_in:
                    if isinstance(filter.value, list):
                        values = ", ".join([format_value(v) for v in filter.value])
                        where_conditions.append(f"{filter.column} NOT IN ({values})")
                    else:
                        where_conditions.append(
                            f"{filter.column} NOT IN ({format_value(filter.value)})"
                        )
                elif filter.operator == QueryRunOperator.like:
                    where_conditions.append(f"{filter.column} LIKE {format_value(filter.value)}")
                elif filter.operator == QueryRunOperator.not_like:
                    where_conditions.append(
                        f"{filter.column} NOT LIKE {format_value(filter.value)}"
                    )
                elif filter.operator == QueryRunOperator.is_null:
                    where_conditions.append(f"{filter.column} IS NULL")
                elif filter.operator == QueryRunOperator.is_not_null:
                    where_conditions.append(f"{filter.column} IS NOT NULL")

            if where_conditions:
                sql += " WHERE " + " AND ".join(where_conditions)

        if request.modifiers.order_by:
            order_clauses = [
                f"{order_by.column} {order_by.direction}" for order_by in request.modifiers.order_by
            ]
            sql += " ORDER BY " + ", ".join(order_clauses)

        if request.modifiers.limit:
            sql += f" LIMIT {request.modifiers.limit}"

        if request.modifiers.offset:
            sql += f" OFFSET {request.modifiers.offset}"

    logger.info(f"Composed SQL query: {sql}")

    try:
        logger.info(f"Setting initial status to running for query {request.query_run_id}")
        await set_result(request.query_run_id, {"status": "running"})
        logger.info(f"Successfully set initial status for query {request.query_run_id}")
    except Exception as e:
        logger.error(
            f"Failed to set initial status in Redis for query {request.query_run_id}: {str(e)}"
        )
        # Continue anyway, the background task will still try to set results

    async def execute_sql_query():
        start_time = time.time()
        try:
            # Execute the composed SQL with modifiers
            result = execute_query(sql)
            execution_time_ms = int((time.time() - start_time) * 1000)

            # Generate appropriate result message based on query type
            if result["is_select_query"]:
                if result["row_count"] == 0:
                    result_message = (
                        f"Query executed successfully. No rows returned in {execution_time_ms}ms"
                    )
                elif result["row_count"] == 1:
                    result_message = (
                        f"Query executed successfully. 1 row returned in {execution_time_ms}ms"
                    )
                else:
                    result_message = f"Query executed successfully. {result['row_count']} rows returned in {execution_time_ms}ms"
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
                    # DDL and utility statements don't have meaningful row counts
                    result_message = f"{query_type} executed successfully in {execution_time_ms}ms"
                elif result["row_count"] == 0:
                    result_message = f"{query_type} executed successfully. No rows affected in {execution_time_ms}ms"
                elif result["row_count"] == 1:
                    result_message = f"{query_type} executed successfully. 1 row affected in {execution_time_ms}ms"
                else:
                    result_message = f"{query_type} executed successfully. {result['row_count']} rows affected in {execution_time_ms}ms"

            # Create update request for the server
            update_request = UpdateQueryRunRequest(
                result_message=result_message,
                row_count=result["row_count"],
                execution_time_ms=execution_time_ms,
                error_message=None,
            )

            # Call the server to update the query run
            server_url = os.environ.get("SERVER_URL", "http://server:8000")
            try:
                response = requests.put(
                    f"{server_url}/runs/{request.query_run_id}",
                    json=update_request.model_dump(),
                    headers={"Content-Type": "application/json"},
                    timeout=10,
                )
                logger.info(
                    f"Updated query run {request.query_run_id}, server response: {response.status_code}"
                )
            except Exception as server_error:
                logger.error(f"Failed to update query run on server: {str(server_error)}")

            # Update the result cache
            await set_result(request.query_run_id, {"status": "success", "data": result["data"]})

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_message = str(e)
            logger.error(f"Query execution failed: {error_message}")

            # Create error update request for the server
            update_request = UpdateQueryRunRequest(
                result_message=None,
                row_count=0,
                execution_time_ms=execution_time_ms,
                error_message=error_message,
            )

            # Call the server to update the query run with error
            server_url = os.environ.get("SERVER_URL", "http://server:8000")
            try:
                response = requests.put(
                    f"{server_url}/runs/{request.query_run_id}",
                    json=update_request.model_dump(),
                    headers={"Content-Type": "application/json"},
                    timeout=10,
                )
                logger.info(
                    f"Updated query run {request.query_run_id} with error, server response: {response.status_code}"
                )
            except Exception as server_error:
                logger.error(
                    f"Failed to update query run on server with error: {str(server_error)}"
                )

            # Update the result cache with error
            await set_result(request.query_run_id, {"status": "error", "error": error_message})

    asyncio.create_task(execute_sql_query())
    return {"query_run_id": request.query_run_id, "status": "started"}


@app.get("/schema/")
def get_postgres_schemas():
    try:
        with get_database_connection(app.state.engine) as conn:
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

            # Get all columns for each table
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

            # Get primary key constraints
            primary_keys_query = """
            SELECT 
                tc.table_schema,
                tc.table_name,
                kcu.column_name
            FROM 
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
            WHERE 
                tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                tc.table_schema, tc.table_name, kcu.ordinal_position;
            """
            primary_keys_result = conn.execute(text(primary_keys_query))
            primary_keys = [dict(row._mapping) for row in primary_keys_result]

            # Get foreign key constraints with relationships
            foreign_keys_query = """
            SELECT 
                tc.table_schema,
                tc.table_name,
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM 
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu 
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
            WHERE 
                tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                tc.table_schema, tc.table_name, kcu.ordinal_position;
            """
            foreign_keys_result = conn.execute(text(foreign_keys_query))
            foreign_keys = [dict(row._mapping) for row in foreign_keys_result]

            # Get all views
            views_query = """
            SELECT 
                table_schema, 
                table_name,
                view_definition
            FROM 
                information_schema.views
            WHERE 
                table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                table_schema, table_name;
            """
            views_result = conn.execute(text(views_query))
            views = [dict(row._mapping) for row in views_result]

            # Format the result
            schemas = {}

            # Process tables and their columns
            for table in tables:
                schema_name = table["table_schema"]
                table_name = table["table_name"]

                if schema_name not in schemas:
                    schemas[schema_name] = {"tables": {}, "views": {}}

                schemas[schema_name]["tables"][table_name] = {
                    "columns": [],
                    "primary_keys": [],
                    "foreign_keys": [],
                    "relationships": {
                        "references": [],  # Tables this table references
                        "referenced_by": [],  # Tables that reference this table
                    },
                }

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

            # Add primary keys
            for pk in primary_keys:
                schema_name = pk["table_schema"]
                table_name = pk["table_name"]

                if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
                    schemas[schema_name]["tables"][table_name]["primary_keys"].append(
                        pk["column_name"]
                    )

            # Add foreign keys and relationships
            for fk in foreign_keys:
                schema_name = fk["table_schema"]
                table_name = fk["table_name"]
                foreign_schema = fk["foreign_table_schema"]
                foreign_table = fk["foreign_table_name"]

                if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
                    # Add foreign key info
                    fk_info = {
                        "column": fk["column_name"],
                        "references_table": f"{foreign_schema}.{foreign_table}",
                        "references_column": fk["foreign_column_name"],
                        "constraint_name": fk["constraint_name"],
                    }
                    schemas[schema_name]["tables"][table_name]["foreign_keys"].append(fk_info)

                    # Add to relationships - this table references another
                    relationship_info = {
                        "table": f"{foreign_schema}.{foreign_table}",
                        "type": "references",
                        "local_column": fk["column_name"],
                        "foreign_column": fk["foreign_column_name"],
                    }
                    schemas[schema_name]["tables"][table_name]["relationships"][
                        "references"
                    ].append(relationship_info)

                    # Add reverse relationship - the referenced table is referenced by this table
                    if (
                        foreign_schema in schemas
                        and foreign_table in schemas[foreign_schema]["tables"]
                    ):
                        reverse_relationship = {
                            "table": f"{schema_name}.{table_name}",
                            "type": "referenced_by",
                            "local_column": fk["foreign_column_name"],
                            "foreign_column": fk["column_name"],
                        }
                        schemas[foreign_schema]["tables"][foreign_table]["relationships"][
                            "referenced_by"
                        ].append(reverse_relationship)

            # Process views
            for view in views:
                schema_name = view["table_schema"]
                view_name = view["table_name"]

                if schema_name not in schemas:
                    schemas[schema_name] = {"tables": {}, "views": {}}

                schemas[schema_name]["views"][view_name] = {"definition": view["view_definition"]}

            return schemas

    except OperationalError as e:
        logger.error(f"Database connection error in get_postgres_schemas: {str(e)}")
        raise Exception(f"Error getting schemas: {e}") from e


def test_connection_cli():
    try:
        os_creds = os.environ.get("DB_CREDS")
        if not os_creds:
            raise Exception("DB_CREDS is not set")
        creds = PostgresCreds(**json.loads(os_creds))
        engine = create_database_engine(creds)
        with get_database_connection(engine) as conn:
            res = conn.execute(text("SELECT 1")).fetchone()
            if res:
                print(json.dumps({"status": "success"}))
                sys.exit(0)
            else:
                print(json.dumps({"status": "error", "message": "Failed to connect to database"}))
                sys.exit(0)
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(0)


@app.get("/health")
async def health_check():
    """Health check endpoint to verify database and Redis connectivity"""
    health_status = {"status": "healthy", "checks": {}}

    # Check database connection
    try:
        with get_database_connection(app.state.engine) as conn:
            conn.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check Redis connection
    try:
        from app.helpers import REDIS

        await REDIS.ping()
        health_status["checks"]["redis"] = "healthy"
    except Exception as e:
        health_status["checks"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    return health_status


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test_connection":
        test_connection_cli()
