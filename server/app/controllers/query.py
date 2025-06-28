from uuid import UUID
import requests
import logging
import time
import orjson
from app.core._redis import get_result, REDIS
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


def execute_in_worker(source_id: UUID, query: str, db: Session):
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise Exception(f"Source {source_id} not found")

    container_name = f"dribble-worker-{source.dbtype}-{source_id}"
    response = requests.post(
        f"http://{container_name}:8000/execute/",
        json={"query": query, "query_id": str(source_id)},
        timeout=5,
    )
    return response.json()


def execute_in_worker_version(request: ExecuteQueryVersionRequest, db: Session):
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == request.source_id).first()
    if not source:
        raise Exception(f"Source {request.source_id} not found")

    container_name = f"dribble-worker-{source.dbtype}-{request.source_id}"
    response = requests.post(
        f"http://{container_name}:8000/execute/version",
        json={
            "query_run_id": str(request.query_run_id),
            "sql": request.sql,
            "modifiers": request.modifiers.model_dump() if request.modifiers else None,
        },
        timeout=5,
    )
    return response.json()


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
