from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from typing import Optional
import asyncio
import json
import logging
from app.core.redis_subscriber import (
    get_query_messages,
    get_latest_query_message,
    query_results_subscriber,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["sse"])


@router.get("/query-results/{query_id}")
async def stream_query_results(query_id: str, last_timestamp: Optional[float] = None):
    """
    Stream query execution results via Server-Sent Events.

    Args:
        query_id: The query or query_run ID to stream results for
        last_timestamp: Optional timestamp to get only newer messages
    """

    async def generate_sse_events():
        """Generate SSE events for query results"""
        try:
            # Send any existing messages first
            existing_messages = get_query_messages(query_id, last_timestamp)
            for message in existing_messages:
                yield f"data: {json.dumps(message)}\n\n"

            # If we have a final status (success/error), close the stream
            latest_message = get_latest_query_message(query_id)
            if latest_message and latest_message.get("status") in ["success", "error"]:
                yield "event: close\ndata: Query completed\n\n"
                return

            # Keep the connection alive and stream new messages
            last_seen_timestamp = latest_message.get("timestamp", 0) if latest_message else 0

            while True:
                # Check for new messages
                new_messages = get_query_messages(query_id, last_seen_timestamp)

                for message in new_messages:
                    yield f"data: {json.dumps(message)}\n\n"
                    last_seen_timestamp = max(last_seen_timestamp, message.get("timestamp", 0))

                    # If this is a final status, close the stream
                    if message.get("status") in ["success", "error"]:
                        yield "event: close\ndata: Query completed\n\n"
                        return

                # Send heartbeat to keep connection alive
                yield "event: heartbeat\ndata: ping\n\n"

                # Wait before checking again
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.info(f"SSE stream cancelled for query {query_id}")
            raise
        except Exception as e:
            logger.error(f"Error in SSE stream for query {query_id}: {str(e)}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate_sse_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.get("/query-status/{query_id}")
async def get_query_status(query_id: str):
    """
    Get the current status of a query without streaming.
    Useful for initial status checks.
    """
    latest_message = get_latest_query_message(query_id)

    if not latest_message:
        return {"query_id": query_id, "status": "not_found", "message": "No status available"}

    return {
        "query_id": query_id,
        "status": latest_message.get("status", "unknown"),
        "timestamp": latest_message.get("timestamp"),
        "has_data": "data" in latest_message,
        "has_error": "error" in latest_message,
    }


@router.get("/active-queries")
async def get_active_queries():
    """Get list of queries that have active status messages"""
    active_queries = query_results_subscriber.get_active_queries()

    query_statuses = []
    for query_id in active_queries:
        latest_message = get_latest_query_message(query_id)
        if latest_message:
            query_statuses.append(
                {
                    "query_id": query_id,
                    "status": latest_message.get("status"),
                    "timestamp": latest_message.get("timestamp"),
                }
            )

    return {"active_queries": query_statuses, "total_count": len(query_statuses)}
