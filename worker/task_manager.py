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
        set_result(task.id, {"status": "connecting"})

        # Add connection to pool
        source_key = add_connection(
            source_id=task.source_id, role=task.role, dbtype=task.dbtype, creds=task.creds
        )

        logger.info(f"Successfully established connection {source_key}")
        set_result(task.id, {"status": "success"})
        publish_status(task.id, "success")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Connection setup failed for {task.source_id}:{task.role}: {error_message}")
        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def handle_test_db_task(task: TaskRequest):
    """Handle database connection testing"""
    try:
        set_result(task.id, {"status": "testing"})

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
                set_result(task.id, {"status": "success", "message": message})
                publish_status(task.id, "success")
            else:
                message = f"Database connection test failed after {test_time_ms}ms"
                logger.error(f"DB test failed: {task.dbtype}")
                set_result(task.id, {"status": "error", "error": message})
                publish_status(task.id, "error")

        finally:
            # Always dispose of the test engine
            engine.dispose()

    except Exception as e:
        error_message = str(e)
        logger.error(f"DB test failed for {task.dbtype}: {error_message}")

        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def handle_execute_task(task: TaskRequest):
    """Handle query execution with modifiers"""
    start_time = time.time()

    try:
        source_key = f"{task.source_id}:{task.role}"
        # Get connection from pool
        connection_info = get_connection(source_key)

        set_result(task.id, {"status": "running"})

        if connection_info.dbtype == "postgres":
            result = execute_query_with_modifiers(
                sql=task.sql,
                modifiers=task.modifiers,
                engine=connection_info.engine,
                id=task.id,
            )
        else:
            raise UnsupportedDatabaseError(
                f"Query execution not implemented for {connection_info.dbtype}"
            )

        set_result(task.id, {"status": "success", "data": result["data"]})
        publish_status(task.id, "success")

    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        error_message = str(e)
        logger.error(f"Query {task.id} failed after {execution_time_ms}ms: {error_message}")

        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def handle_schema_task(task: TaskRequest):
    """Handle schema inspection"""
    try:
        # Get connection from pool
        source_key = f"{task.source_id}:{task.role}"
        connection_info = get_connection(source_key)

        set_result(task.id, {"status": "running"})

        # For now, only PostgreSQL is supported
        if connection_info.dbtype == "postgres":
            schema_info = get_postgres_schemas(connection_info.engine)
        else:
            raise UnsupportedDatabaseError(
                f"Schema inspection not implemented for {connection_info.dbtype}"
            )

        logger.info(f"Schema inspection completed for {task.id}")

        set_result(task.id, {"status": "success", "data": schema_info})
        publish_status(task.id, "success")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Schema inspection {task.id} failed: {error_message}")

        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def handle_disconnect_task(task: TaskRequest):
    """Handle disconnecting all engines for a source"""
    try:
        set_result(task.id, {"status": "disconnecting"})

        # Remove all connections for the source_id
        removed_connections = remove_connections_by_source_id(task.source_id)

        if removed_connections:
            logger.info(f"Disconnect successful: {task.source_id}")
            set_result(task.id, {"status": "success"})
            publish_status(task.id, "success")
        else:
            message = f"No active connections found for source {task.source_id}"
            logger.info(f"Disconnect task: {message}")
            set_result(task.id, {"status": "success", "message": message})
            publish_status(task.id, "success")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Disconnect task {task.id} failed for {task.source_id}: {error_message}")

        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def handle_connected_task(task: TaskRequest):
    """Handle getting all connected sources"""
    try:
        set_result(task.id, {"status": "fetching"})

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

        set_result(
            task.id,
            {"status": "success", "data": connected_sources},
        )
        publish_status(task.id, "success")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Connected task {task.id} failed: {error_message}")

        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def handle_cancel_task(task: TaskRequest):
    """Handle query cancellation"""
    try:
        set_result(task.id, {"status": "cancelling"})

        # Note: In a real implementation, this would need to track running queries
        # and actually cancel them. For now, we just acknowledge the cancellation.
        # The actual cancellation logic would depend on the specific database
        # implementation and how queries are being tracked.

        message = f"Cancel request received for query run {task.id}"
        logger.info(f"Cancel task: {message}")

        # Publish cancellation result directly to the query run's channel
        if task.id:
            publish_status(task.id, "cancelled")

        set_result(task.id, {"status": "success", "message": message})
        publish_status(task.id, "success")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Cancel task {task.id} failed: {error_message}")

        set_result(task.id, {"status": "error", "error": error_message})
        publish_status(task.id, "error")


def process_task(task: TaskRequest):
    """Process a task from the queue"""
    try:
        logger.info(f"Processing {task.task_type} task: {task.id}")

        # Route to appropriate handler
        if task.task_type == "connect":
            handle_connect_task(task)
        elif task.task_type == "test_db":
            handle_test_db_task(task)
        elif task.task_type == "execute":
            handle_execute_task(task)
        elif task.task_type == "schema":
            handle_schema_task(task)
        elif task.task_type == "disconnect":
            handle_disconnect_task(task)
        elif task.task_type == "connected":
            handle_connected_task(task)
        elif task.task_type == "cancel":
            handle_cancel_task(task)
        else:
            raise InvalidTaskTypeError(task.task_type)

    except Exception as e:
        logger.error(f"Error processing task: {str(e)}")
        if task.id:
            set_result(task.id, {"status": "error", "error": str(e)})
            publish_status(task.id, "error", error=str(e), task_type=task.task_type)
