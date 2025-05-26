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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PostgresCreds(BaseModel):
    host: str
    port: int
    user: str
    password: str
    dbname: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup
    os_creds = os.environ.get("DB_CREDS")
    if not os_creds:
        raise Exception("DB_CREDS is not set")
    creds = PostgresCreds(**json.loads(os_creds))
    url = URL.create(
        "postgresql+psycopg",
        username=creds.user,
        password=creds.password,
        host=creds.host,
        port=creds.port,
        database=creds.dbname,
    )
    app.state.engine = create_engine(url)
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


@app.get("/test-connection/")
def test_connection():
    try:
        with app.state.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            return {"status": "success"}
    except OperationalError:
        return {"status": "error", "message": "Failed to connect to database"}


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
        with app.state.engine.connect() as conn:
            logger.info(f"[{datetime.datetime.now()}] Connected to database")
            result = conn.execute(text(query))
            rows = result.fetchall()
            processed_rows = []
            logger.info(f"[{datetime.datetime.now()}] Rows fetched: {len(rows)}")
            for row in rows:
                processed_row = {}
                for key, value in row._mapping.items():
                    # Handle binary data (bytea) by converting to hex string
                    if isinstance(value, bytes):
                        hex_value = "0x" + binascii.hexlify(value).decode("ascii")
                        processed_row[key] = hex_value
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
        with app.state.engine.connect() as conn:
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

            # Process views
            for view in views:
                schema_name = view["table_schema"]
                view_name = view["table_name"]

                if schema_name not in schemas:
                    schemas[schema_name] = {"tables": {}, "views": {}}

                schemas[schema_name]["views"][view_name] = {"definition": view["view_definition"]}

            return schemas

    except OperationalError as e:
        raise Exception(f"Error getting schemas: {e}") from e
