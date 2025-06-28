import time
import logging

from .common.models import TaskRequest
from .common.redis_client import set_result, publish_result
from .common.connection_manager import (
    add_connection,
    get_connection,
    create_database_engine,
    test_database_connection,
)
from .common.exceptions import InvalidTaskTypeError, UnsupportedDatabaseError
from .postgres.query_executor import execute_query
from .postgres.sql_builder import SQLBuilder
from .postgres.schema_inspector import get_postgres_schemas

logger = logging.getLogger(__name__)


def handle_connect_task(task: TaskRequest):
    """Handle database connection setup"""
    try:
        set_result(task.query_run_id, {"status": "connecting"})

        # Add connection to pool
        source_key = add_connection(
            source_id=task.source_id, role=task.role, db_type=task.db_type, creds=task.creds
        )

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
        engine, _ = create_database_engine(task.db_type, task.creds, task.role or "reader")

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
    """Handle query execution with modifiers"""
    start_time = time.time()

    try:
        # Get connection from pool
        connection_info = get_connection(task.source_key)

        set_result(task.query_run_id, {"status": "running"})

        if connection_info.db_type == "postgresql":
            sql_to_run = SQLBuilder.build_query_with_modifiers(task.sql, task.modifiers)
            logger.info(f"Executing query with modifiers: {sql_to_run}")

            result = execute_query(sql_to_run, connection_info.engine)
            execution_time_ms = int((time.time() - start_time) * 1000)

            result_message = SQLBuilder.generate_result_message(result, execution_time_ms)
            logger.info(f"Query {task.query_run_id} executed successfully: {result_message}")
        else:
            raise UnsupportedDatabaseError(
                f"Query execution not implemented for {connection_info.db_type}"
            )

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
        # Get connection from pool
        connection_info = get_connection(task.source_key)

        set_result(task.query_run_id, {"status": "running"})

        # For now, only PostgreSQL is supported
        if connection_info.db_type == "postgresql":
            schema_info = get_postgres_schemas(connection_info.engine)
        else:
            raise UnsupportedDatabaseError(
                f"Schema inspection not implemented for {connection_info.db_type}"
            )

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
        elif task.task_type == "schema":
            handle_schema_task(task)
        else:
            raise InvalidTaskTypeError(task.task_type)

    except Exception as e:
        logger.error(f"Error processing task: {str(e)}")
        if "query_run_id" in task_data:
            set_result(task_data["query_run_id"], {"status": "error", "error": str(e)})
            publish_result(task_data["query_run_id"], "error", error=str(e))
