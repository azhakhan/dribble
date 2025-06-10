from uuid import UUID
import requests
import logging
from app.core._redis import get_result
from app.schemas.query_execute import ExecuteQueryVersionRequest

# Set up logging
logger = logging.getLogger(__name__)


def execute_in_worker(source_id: UUID, query: str):
    container_name = f"dribble-worker-postgres-{source_id}"
    response = requests.post(
        f"http://{container_name}:8000/execute/",
        json={"query": query, "query_id": str(source_id)},
        timeout=5,
    )
    return response.json()


def execute_in_worker_version(request: ExecuteQueryVersionRequest):
    container_name = f"dribble-worker-postgres-{request.source_id}"
    response = requests.post(
        f"http://{container_name}:8000/execute/version",
        json={
            "query_run_id": str(request.query_run_id),
            "sql": request.sql,
            "modifiers": request.modifiers.model_dump_json() if request.modifiers else None,
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
