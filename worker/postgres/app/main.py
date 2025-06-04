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
    await set_result(request.query_id, {"status": "running"})

    async def execute_sql_query():
        try:
            result = execute_query(request.query)
            await set_result(request.query_id, {"status": "success", "data": result})
        except Exception as e:
            await set_result(request.query_id, {"status": "error", "error": str(e)})

    asyncio.create_task(execute_sql_query())
    return {"query_id": request.query_id, "status": "started"}


def execute_query(query: str):
    # 5 second timeout
    logger.info(f"[{datetime.datetime.now()}] In execute_query function")
    try:
        with get_database_connection(app.state.engine) as conn:
            logger.info(f"[{datetime.datetime.now()}] Connected to database")
            result = conn.execute(text(query))
            rows = result.fetchall()
            processed_rows = []
            logger.info(f"[{datetime.datetime.now()}] Rows fetched: {len(rows)}")
            if len(rows) == 0:
                return []

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
            return processed_rows
    except OperationalError as e:
        logger.error(f"[{datetime.datetime.now()}] Database error: {str(e)}")
        raise Exception(f"Error executing query: {e}") from e


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


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test_connection":
        test_connection_cli()
