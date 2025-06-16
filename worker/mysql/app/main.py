from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
import asyncio
from app.helpers import set_result
import datetime
import time
import requests
import sys

# Import our modular components
from .models import QueryRequest, QueryVersionRequest, UpdateQueryRunRequest
from .connection_manager import create_database_engine, get_database_connection
from .query_executor import execute_query
from .sql_builder import SQLBuilder
from .schema_inspector import get_mysql_schemas
from .utils import setup_logging, validate_environment, test_connection_cli

# Configure logging
logger = setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup - validate environment and create database engine
    try:
        env_config = validate_environment()
        app.state.engine = create_database_engine(env_config["db_creds"])
        app.state.server_url = env_config["server_url"]

        # Test the connection immediately to catch credential issues early
        with get_database_connection(app.state.engine) as conn:
            conn.execute(text("SELECT 1"))
        logger.info("MySQL database connection test successful during startup")

    except OperationalError as e:
        logger.error(f"MySQL database connection failed during startup: {str(e)}")
        if hasattr(app.state, "engine"):
            app.state.engine.dispose()
        raise Exception(f"Database connection failed: {e}") from e
    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}")
        raise e

    yield

    # Teardown
    if hasattr(app.state, "engine"):
        app.state.engine.dispose()


app = FastAPI(lifespan=lifespan)


@app.post("/execute/")
async def run_query(request: QueryRequest):
    """Execute a SQL query asynchronously and return status"""
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
            result = execute_query(request.query, app.state.engine)
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


@app.post("/execute/version")
async def run_query_version(request: QueryVersionRequest):
    """Execute a query version with modifiers asynchronously and return status"""
    logger.info(f"Starting version query execution for ID: {request.query_run_id}")

    # Build SQL with modifiers using SQLBuilder
    sql_to_run = SQLBuilder.build_query_with_modifiers(request.sql, request.modifiers)

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
            result = execute_query(sql_to_run, app.state.engine)
            execution_time_ms = int((time.time() - start_time) * 1000)

            # Generate appropriate result message
            result_message = SQLBuilder.generate_result_message(result, execution_time_ms)

            # Create update request for the server
            update_request = UpdateQueryRunRequest(
                result_message=result_message,
                row_count=result["row_count"],
                execution_time_ms=execution_time_ms,
                error_message=None,
            )

            # Call the server to update the query run
            await _update_server_query_run(request.query_run_id, update_request)

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
            await _update_server_query_run(request.query_run_id, update_request)

            # Update the result cache with error
            await set_result(request.query_run_id, {"status": "error", "error": error_message})

    asyncio.create_task(execute_sql_query())
    return {"query_run_id": request.query_run_id, "status": "started"}


@app.get("/schema/")
def get_schema():
    """Get MySQL schema information"""
    return get_mysql_schemas(app.state.engine)


async def _update_server_query_run(query_run_id: str, update_request: UpdateQueryRunRequest):
    """Helper function to update query run on the server"""
    try:
        server_url = app.state.server_url
        response = requests.put(
            f"{server_url}/runs/{query_run_id}",
            json=update_request.model_dump(),
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        logger.info(f"Updated query run {query_run_id}, server response: {response.status_code}")
    except Exception as server_error:
        logger.error(f"Failed to update query run on server: {str(server_error)}")


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
    # CLI mode for testing connection
    if len(sys.argv) > 1 and sys.argv[1] == "test-connection":
        test_connection_cli()
