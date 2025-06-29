from uuid import UUID
import logging
from app.core._redis import submit_task
from app.schemas.query_execute import ExecuteQueryVersionRequest
from sqlalchemy.orm import Session
from app.models import Source

# Set up logging
logger = logging.getLogger(__name__)


async def publish_cancellation_result(query_run_id: str, query_id: str, message: str):
    # TODO: AZ implement using new worker
    """Publish query cancellation to Redis pub/sub channel for real-time notifications"""
    task_data = {
        "task_type": "cancel",
        "query_run_id": query_run_id,
        "query_id": query_id,
        "message": message,
    }
    task_id = await submit_task(task_data)
    return {"task_id": task_id}


async def execute_in_worker_version(request: ExecuteQueryVersionRequest, db: Session):
    """Submit query execution task to Redis worker and return task ID"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == request.source_id).first()
    if not source:
        raise Exception(f"Source {request.source_id} not found")

    task_data = {
        "task_type": "execute",
        "source_id": str(request.source_id),
        "role": "reader",
        "dbtype": source.dbtype,
        "sql": request.sql,
        "modifiers": request.modifiers.model_dump() if request.modifiers else None,
    }
    task_id = await submit_task(task_data)
    return {"task_id": task_id}


async def cancel_query_in_worker(query_run_id: UUID, source_id: UUID, db: Session):
    """Submit query cancellation task to Redis worker"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise Exception(f"Source {source_id} not found")

    task_data = {
        "task_type": "cancel_query",
        "query_run_id": str(query_run_id),
        "source_id": str(source_id),
        "dbtype": source.dbtype,
    }
    task_id = await submit_task(task_data)
    return {"task_id": task_id}
