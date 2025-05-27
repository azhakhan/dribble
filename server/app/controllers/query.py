from uuid import UUID
import requests
import logging

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
