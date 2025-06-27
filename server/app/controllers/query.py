from uuid import UUID
import requests
import logging
import asyncio
import time
import orjson
from concurrent.futures import ThreadPoolExecutor
from app.core._redis import get_result, set_result, REDIS
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


def cancel_query_in_worker(query_run_id: UUID, source_id: UUID, db: Session):
    """Cancel a running query in the appropriate worker container"""
    # Get the source to determine the database type
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise Exception(f"Source {source_id} not found")

    container_name = f"dribble-worker-{source.dbtype}-{source_id}"
    try:
        # Use a shorter timeout and make it more resilient
        response = requests.post(
            f"http://{container_name}:8000/cancel/{query_run_id}",
            timeout=3,  # Shorter timeout to fail fast
        )
        if response.status_code == 404:
            raise Exception("Query not found or already completed")
        elif response.status_code == 400:
            raise Exception("Query is already completed")
        elif response.status_code != 200:
            raise Exception(f"Worker returned error: {response.text}")

        return response.json()
    except requests.exceptions.Timeout as e:
        # For timeout errors, we'll assume the cancellation request was received
        # even if we didn't get a response. The worker might be too busy to respond
        # but the cancellation signal should still be processed.
        logger.warning(
            f"Timeout cancelling query {query_run_id} in worker, but cancellation signal sent: {str(e)}"
        )
        # Return a success response indicating cancellation was requested
        return {"query_run_id": str(query_run_id), "status": "cancellation_requested"}
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error cancelling query {query_run_id} in worker: {str(e)}")
        raise Exception("Unable to connect to worker - query may still be running") from e
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to cancel query {query_run_id} in worker: {str(e)}")
        raise Exception(f"Failed to communicate with worker: {str(e)}") from e


async def cancel_query_in_worker_async(query_run_id: UUID, source_id: UUID, db: Session):
    """Async version of cancel_query_in_worker with better timeout handling"""

    def _make_cancel_request():
        return cancel_query_in_worker(query_run_id, source_id, db)

    # Use ThreadPoolExecutor to run the blocking request in a separate thread
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=1)

    try:
        # Run the cancel request with a timeout
        result = await asyncio.wait_for(
            loop.run_in_executor(executor, _make_cancel_request),
            timeout=5.0,  # 5 second timeout for the entire operation
        )
        return result
    except asyncio.TimeoutError:
        # If we timeout, assume the cancellation request was sent but didn't get a response
        logger.warning(
            f"Async timeout cancelling query {query_run_id}, assuming cancellation was sent"
        )

        # Set cancelled status in Redis so SSE can pick it up
        error_msg = "Query cancellation requested (worker timeout)"
        try:
            await set_result(query_run_id, {"status": "cancelled", "error": error_msg})
            # Also publish to the pub/sub channel for real-time updates
            await publish_cancellation_result(str(query_run_id), None, error_msg)
        except Exception as redis_error:
            logger.error(f"Failed to set cancelled status in Redis: {redis_error}")

        return {"query_run_id": str(query_run_id), "status": "cancellation_requested"}
    finally:
        executor.shutdown(wait=False)


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
