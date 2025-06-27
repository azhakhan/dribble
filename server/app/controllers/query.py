from uuid import UUID
import requests
import logging
from app.core._redis import get_result
from app.schemas.query_execute import ExecuteQueryVersionRequest
from sqlalchemy.orm import Session
from app.models import Source

# Set up logging
logger = logging.getLogger(__name__)


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
        response = requests.post(
            f"http://{container_name}:8000/cancel/{query_run_id}",
            timeout=10,  # Longer timeout for cancellation
        )
        if response.status_code == 404:
            raise Exception("Query not found or already completed")
        elif response.status_code == 400:
            raise Exception("Query is already completed")
        elif response.status_code != 200:
            raise Exception(f"Worker returned error: {response.text}")

        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to cancel query {query_run_id} in worker: {str(e)}")
        raise Exception(f"Failed to communicate with worker: {str(e)}") from e


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
