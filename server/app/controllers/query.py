from uuid import UUID
import logging
import time
import orjson
from app.core._redis import get_result, REDIS, submit_execute_task, submit_cancel_task
from app.schemas.query_execute import ExecuteQueryVersionRequest
from sqlalchemy.orm import Session
from app.models import Source

# Set up logging
logger = logging.getLogger(__name__)


async def publish_cancellation_result(query_run_id: str, query_id: str = None, error: str = None):
    """Publish query cancellation to Redis pub/sub channel for real-time notifications"""
    try:
        message = {
            "type": "query_result",
            "query_run_id": query_run_id,
            "status": "cancelled",
            "timestamp": time.time(),
        }

        if query_id is not None:
            message["query_id"] = query_id

        if error is not None:
            message["error"] = error

        channel = f"query_results:{query_run_id}"
        await REDIS.publish(channel, orjson.dumps(message))
        logger.debug(f"Published cancellation for query run {query_run_id} to channel {channel}")
    except Exception as e:
        logger.error(
            f"Failed to publish cancellation to Redis for query run {query_run_id}: {str(e)}"
        )
        # Don't raise - publishing is not critical to cancellation


async def execute_in_worker_version(request: ExecuteQueryVersionRequest, db: Session):
    """Submit query execution task to Redis worker and return task ID"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == request.source_id).first()
    if not source:
        raise Exception(f"Source {request.source_id} not found")

    # Submit execution task to Redis queue
    task_id = await submit_execute_task(
        source_id=str(request.source_id),
        db_type=source.dbtype,
        sql=request.sql,
        modifiers=request.modifiers.model_dump() if request.modifiers else None,
    )

    return {"task_id": task_id}


async def cancel_query_in_worker(query_run_id: UUID, source_id: UUID, db: Session):
    """Submit query cancellation task to Redis worker"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise Exception(f"Source {source_id} not found")

    # Submit cancellation task to Redis queue
    task_id = await submit_cancel_task(
        query_run_id=str(query_run_id),
        source_id=str(source_id),
        db_type=source.dbtype,
    )

    return {"task_id": task_id}


async def get_query_results(query_id: UUID):
    # check for results in redis
    result = await get_result(query_id)
    if not result:
        raise Exception("Query results not found")
    if result.get("status") == "running":
        return {"status": "running"}
    if result.get("status") == "error":
        return {"status": "error", "error": result["error"]}
    if result.get("status") == "success":
        return {"status": "success", "data": result["data"] if result.get("data") else []}
    else:
        return {"status": "error", "error": "Unknown error"}
