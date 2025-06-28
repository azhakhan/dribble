from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from typing import Optional, Set
import asyncio
import json
import logging
import time
import uuid
from app.core.redis_subscriber import task_status_subscriber

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["sse"])

# Store active client sessions
active_client_sessions: Set[str] = set()


@router.get("/events")
async def stream_events(client_id: Optional[str] = Query(None)):
    """
    Simple SSE connection that streams only task status updates.
    No data is sent via SSE - clients should use /api/tasks/{task_id}/result for data.
    """
    # Generate client ID if not provided
    if not client_id:
        client_id = f"client-{uuid.uuid4().hex[:8]}"

    # Track active session
    active_client_sessions.add(client_id)

    async def generate_status_events():
        """Generate SSE events for task status updates only"""
        try:
            logger.info(f"Starting SSE stream for client: {client_id}")

            # Send initial connection confirmation
            connection_msg = {
                "type": "connection",
                "client_id": client_id,
                "status": "connected",
                "timestamp": time.time(),
            }
            yield f"data: {json.dumps(connection_msg)}\n\n"

            # Track last seen timestamps to avoid duplicates
            last_seen_timestamps = {}
            heartbeat_interval = 30  # seconds
            last_heartbeat = time.time()

            while client_id in active_client_sessions:
                current_time = time.time()
                has_new_updates = False

                # Get all active tasks
                active_task_ids = task_status_subscriber.get_all_active_tasks()

                for task_id in active_task_ids:
                    # Get latest status for this task
                    status_msg = task_status_subscriber.get_status(task_id)
                    if not status_msg:
                        continue

                    # Check if this is a new message
                    msg_timestamp = status_msg.get("timestamp", current_time)
                    last_timestamp = last_seen_timestamps.get(task_id, 0)

                    # TODO: AZ remove tasks that are not active

                    if msg_timestamp > last_timestamp:
                        # Send status update
                        sse_message = {
                            "type": "task_status",
                            "task_id": task_id,
                            "status": status_msg.get("status"),
                            "task_type": status_msg.get("task_type"),
                            "timestamp": msg_timestamp,
                        }

                        yield f"data: {json.dumps(sse_message)}\n\n"

                        # Update last seen timestamp
                        last_seen_timestamps[task_id] = msg_timestamp
                        has_new_updates = True

                # Send heartbeat if no recent updates
                if not has_new_updates and (current_time - last_heartbeat) >= heartbeat_interval:
                    yield f"event: heartbeat\ndata: {json.dumps({'type': 'heartbeat', 'timestamp': current_time})}\n\n"
                    last_heartbeat = current_time

                # Wait before next iteration
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.info(f"SSE stream cancelled for client {client_id}")
            raise
        except Exception as e:
            logger.error(f"Error in SSE stream for client {client_id}: {str(e)}")
            yield f"event: error\ndata: {json.dumps({'type': 'error', 'error': str(e), 'timestamp': time.time()})}\n\n"
        finally:
            # Clean up client session
            active_client_sessions.discard(client_id)
            logger.info(f"SSE stream closed for client {client_id}")

    return StreamingResponse(
        generate_status_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )
