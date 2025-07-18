from uuid import UUID
import logging
from app.core._redis import redis_client
from app.core.task_service import TaskService
from app.schemas.query_execute import ExecuteQueryVersionRequest
from sqlalchemy.orm import Session
from app.models import Source

# Set up logging
logger = logging.getLogger(__name__)

# Initialize TaskService
task_service = TaskService(redis_client)


async def publish_cancellation_result(query_run_id: str, query_id: str, message: str):
    """Publish query cancellation using new TaskService"""
    cancel_task = task_service.create_query_cancel_task(
        query_run_id=query_run_id,
        worker_session_id=query_id,  # Using query_id as worker session id for now
    )
    task_id = await task_service.submit_task(cancel_task, "default_queue")
    return {"task_id": task_id}


async def execute_in_worker_version(request: ExecuteQueryVersionRequest, db: Session):
    """Submit query execution task using new TaskService"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == request.source_id).first()
    if not source:
        raise Exception(f"Source {request.source_id} not found")

    # Create a proper typed task for query execution
    # Note: This is a simplified version - in practice, you'd need proper query_run_id and worker_session_id
    execution_task = task_service.create_query_execution_task(
        query_version_id=str(request.query_version_id),
        source_id=str(request.source_id),
        query_run_id=str(UUID()),  # Generate a new UUID for the query run
        sql=request.sql,
        worker_session_id=str(UUID()),  # Generate a new UUID for the worker session
    )

    task_id = await task_service.submit_task(execution_task, "default_queue")
    return {"task_id": task_id}


async def cancel_query_in_worker(query_run_id: UUID, source_id: UUID, db: Session):
    """Submit query cancellation task using new TaskService"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise Exception(f"Source {source_id} not found")

    # Create a proper typed task for query cancellation
    cancel_task = task_service.create_query_cancel_task(
        query_run_id=str(query_run_id),
        worker_session_id=str(UUID()),  # Generate a new UUID for the worker session
    )

    task_id = await task_service.submit_task(cancel_task, "default_queue")
    return {"task_id": task_id}
