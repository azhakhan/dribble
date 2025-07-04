from fastapi import APIRouter, Query, Request
from typing import Optional
import uuid
import logging

from app.core._redis import redis_client
from app.core.task_service import TaskService
from app.core.query_execution_service import QueryExecutionService
from app.core.results_streaming_service import ResultsStreamingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["sse"])

# Initialize services for new streaming
task_service = TaskService(redis_client)
query_execution_service = QueryExecutionService(task_service)
streaming_service = ResultsStreamingService(task_service, query_execution_service)


@router.get("/events")
async def stream_events(request: Request, client_id: Optional[str] = Query(None)):
    """Stream task events with direct result streaming."""
    # Generate client ID if not provided
    if not client_id:
        client_id = f"client-{uuid.uuid4().hex[:8]}"

    # Use new streaming service
    return await streaming_service.stream_task_updates(request, client_id)


@router.post("/track/{task_id}")
async def track_task_for_client(task_id: str, client_id: str = Query(...)):
    """Add a task to be tracked for a specific client."""
    await streaming_service.add_task_to_stream(client_id, task_id)
    return {"status": "ok", "message": f"Task {task_id} added to stream for client {client_id}"}


@router.delete("/track/{task_id}")
async def untrack_task_for_client(task_id: str, client_id: str = Query(...)):
    """Remove a task from tracking for a specific client."""
    await streaming_service.remove_task_from_stream(client_id, task_id)
    return {"status": "ok", "message": f"Task {task_id} removed from stream for client {client_id}"}


@router.get("/debug/streams")
async def debug_active_streams():
    """Debug endpoint to see active streams."""
    streams = await streaming_service.get_active_streams()
    return {"active_streams": streams}
