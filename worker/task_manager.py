import time
import logging

from common.models import TaskRequest
from common.redis_client import set_result, publish_status
from common.connection_manager import (
    add_connection,
    get_connection,
    create_database_engine,
    test_database_connection,
    remove_connections_by_source_id,
    get_all_connections,
)
from common.exceptions import InvalidTaskTypeError, UnsupportedDatabaseError
from postgres.query_executor import execute_query_with_modifiers
from postgres.schema_inspector import get_postgres_schemas

logger = logging.getLogger(__name__)


def handle_connect_task(task: TaskRequest):
    """Handle database connection setup"""
    try:
        task_id = task.task_id or task.id
        set_result(task_id, {"task_id": task_id, "status": "connecting"})

        # Add connection to pool
        source_key = add_connection(
            source_id=task.source_id, role=task.role, dbtype=task.dbtype, creds=task.creds
        )

        logger.info(f"Successfully established connection {source_key}")
        set_result(task_id, {"task_id": task_id, "status": "success"})
        publish_status(task_id, "success")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Connection setup failed for {task.source_id}:{task.role}: {error_message}")
        task_id = task.task_id or task.id
        set_result(task_id, {"task_id": task_id, "status": "error", "error": error_message})
        publish_status(task_id, "error")


def handle_test_db_task(task: TaskRequest):
    """Handle database connection testing"""
    try:
        task_id = task.task_id or task.id
        set_result(task_id, {"task_id": task_id, "status": "testing"})

        # Create temporary engine for testing
        engine, _ = create_database_engine(task.dbtype, task.creds, task.role or "reader")

        try:
            # Test the connection
            start_time = time.time()
            connection_healthy = test_database_connection(engine)
            test_time_ms = int((time.time() - start_time) * 1000)

            if connection_healthy:
                message = f"Database connection test successful in {test_time_ms}ms"
                logger.info(f"DB test successful: {task.dbtype}")
                set_result(task_id, {"task_id": task_id, "status": "success", "message": message})
                publish_status(task_id, "success")
            else:
                message = f"Database connection test failed after {test_time_ms}ms"
                logger.error(f"DB test failed: {task.dbtype}")
                set_result(task_id, {"task_id": task_id, "status": "error", "error": message})
                publish_status(task_id, "error")

        finally:
            # Always dispose of the test engine
            engine.dispose()

    except Exception as e:
        error_message = str(e)
        logger.error(f"DB test failed for {task.dbtype}: {error_message}")
        task_id = task.task_id or task.id
        set_result(task_id, {"task_id": task_id, "status": "error", "error": error_message})
        publish_status(task_id, "error")


def handle_execute_task(task: TaskRequest):
    """Handle query execution"""
    task_id = task.task_id or task.id
    start_time = time.time()

    try:
        source_key = f"{task.source_id}:{task.role}"
        # Get connection from pool
        connection_info = get_connection(source_key)

        set_result(task_id, {"task_id": task_id, "status": "running"})
        publish_status(task_id, "running")

        if connection_info.dbtype == "postgres":
            result = execute_query_with_modifiers(
                sql=task.sql,
                modifiers=task.modifiers,
                engine=connection_info.engine,
                id=task_id,
            )
        else:
            raise UnsupportedDatabaseError(
                f"Query execution not implemented for {connection_info.dbtype}"
            )

        # Store the complete result with data
        set_result(
            task_id,
            {
                "task_id": task_id,
                "status": "success",
                "data": result.get("data"),
                "row_count": result.get("row_count"),
                "execution_time_ms": result.get("execution_time_ms"),
                "result_message": result.get("result_message"),
            },
        )
        publish_status(task_id, "success")

    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(f"Query {task_id} failed after {execution_time_ms}ms: {error_message}")

        set_result(
            task_id,
            {
                "task_id": task_id,
                "status": "error",
                "error": error_message,
                "execution_time_ms": execution_time_ms,
            },
        )
        publish_status(task_id, "error")


def handle_schema_task(task: TaskRequest):
    """Handle schema inspection"""
    try:
        task_id = task.task_id or task.id
        # Get connection from pool
        source_key = f"{task.source_id}:{task.role}"
        connection_info = get_connection(source_key)

        set_result(task_id, {"task_id": task_id, "status": "running"})
        publish_status(task_id, "running")

        # For now, only PostgreSQL is supported
        if connection_info.dbtype == "postgres":
            schema_info = get_postgres_schemas(connection_info.engine)
        else:
            raise UnsupportedDatabaseError(
                f"Schema inspection not implemented for {connection_info.dbtype}"
            )

        logger.info(f"Schema inspection completed for {task_id}")

        set_result(task_id, {"task_id": task_id, "status": "success", "data": schema_info})
        publish_status(task_id, "success")

    except Exception as e:
        error_message = str(e)
        task_id = task.task_id or task.id
        logger.error(f"Schema inspection {task_id} failed: {error_message}")

        set_result(task_id, {"task_id": task_id, "status": "error", "error": error_message})
        publish_status(task_id, "error")


def handle_disconnect_task(task: TaskRequest):
    """Handle database disconnection"""
    try:
        task_id = task.task_id or task.id
        set_result(task_id, {"task_id": task_id, "status": "disconnecting"})

        # Remove all connections for this source
        removed_count = remove_connections_by_source_id(task.source_id)

        message = f"Removed {removed_count} connections for source {task.source_id}"
        logger.info(message)

        set_result(task_id, {"task_id": task_id, "status": "success", "message": message})
        publish_status(task_id, "success")

    except Exception as e:
        error_message = str(e)
        task_id = task.task_id or task.id
        logger.error(f"Disconnect task {task_id} failed: {error_message}")

        set_result(task_id, {"task_id": task_id, "status": "error", "error": error_message})
        publish_status(task_id, "error")


def handle_connected_task(task: TaskRequest):
    """Handle getting all connected sources"""
    try:
        task_id = task.task_id or task.id
        set_result(task_id, {"task_id": task_id, "status": "fetching"})

        # Get all active connections
        all_connections = get_all_connections()

        # Convert to array format expected by client
        connected_sources = []
        processed_sources = set()

        for _, connection_info in all_connections.items():
            source_id = connection_info["source_id"]
            if source_id not in processed_sources:
                connected_sources.append(
                    {
                        "id": source_id,
                        "source_id": source_id,
                    }
                )
                processed_sources.add(source_id)

        logger.info(
            f"Connected sources fetched: {len(connected_sources)} sources, {len(all_connections)} total connections"
        )

        set_result(task_id, {"task_id": task_id, "status": "success", "data": connected_sources})
        publish_status(task_id, "success")

    except Exception as e:
        error_message = str(e)
        task_id = task.task_id or task.id
        logger.error(f"Connected task {task_id} failed: {error_message}")

        set_result(task_id, {"task_id": task_id, "status": "error", "error": error_message})
        publish_status(task_id, "error")


def handle_cancel_task(task: TaskRequest):
    """Handle query cancellation"""
    try:
        task_id = task.task_id or task.id
        logger.info(f"Processing cancel request for query_run_id: {task.query_run_id}")

        # For now, just mark it as cancelled
        # In future, we should actually cancel the running query in the database
        set_result(
            task_id,
            {"task_id": task_id, "status": "cancelled", "message": "Query cancellation requested"},
        )
        publish_status(task_id, "cancelled")

    except Exception as e:
        error_message = str(e)
        task_id = task.task_id or task.id
        logger.error(f"Cancel task {task_id} failed: {error_message}")

        set_result(task_id, {"task_id": task_id, "status": "error", "error": error_message})
        publish_status(task_id, "error")


def process_task(task: TaskRequest):
    """Process a task from the queue"""
    try:
        task_id = task.task_id or task.id
        logger.info(f"Processing {task.task_type} task: {task_id}")
        logger.debug(f"Task data: {task.model_dump()}")

        # Simple task routing - one task type per handler
        if task.task_type == "connect":
            handle_connect_task(task)
        elif task.task_type == "test_db":
            handle_test_db_task(task)
        elif task.task_type == "query_execution":
            handle_execute_task(task)
        elif task.task_type == "schema":
            handle_schema_task(task)
        elif task.task_type == "disconnect":
            handle_disconnect_task(task)
        elif task.task_type == "connected":
            handle_connected_task(task)
        elif task.task_type == "query_cancel":
            handle_cancel_task(task)
        else:
            raise InvalidTaskTypeError(task.task_type)

    except Exception as e:
        logger.error(f"Error processing task: {str(e)}")
        if task:
            task_id = task.task_id or task.id
            set_result(task_id, {"task_id": task_id, "status": "error", "error": str(e)})
            publish_status(task_id, "error")
