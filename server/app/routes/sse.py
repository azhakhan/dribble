from fastapi import APIRouter, Query, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, Set
import asyncio
import json
import logging
import time
import uuid
from app.core.redis_subscriber import (
    query_results_subscriber,
)
from app.core.db import get_db
from app.models import QueryRun, QueryVersion
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stream", tags=["sse"])

# Store active client sessions (in production, use Redis or proper session management)
active_client_sessions: Set[str] = set()


def get_query_id_for_run(db: Session, query_run_id: str) -> Optional[str]:
    """Get the query_id for a given query_run_id"""
    try:
        query_run = db.query(QueryRun).filter(QueryRun.id == query_run_id).first()
        if query_run:
            query_version = (
                db.query(QueryVersion).filter(QueryVersion.id == query_run.query_version_id).first()
            )
            if query_version:
                return str(query_version.query_id)
    except Exception as e:
        logger.error(f"Error getting query_id for run {query_run_id}: {str(e)}")
    return None


@router.get("/events")
async def stream_events(client_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Single SSE connection that streams all query results multiplexed by query_run_id.

    Args:
        client_id: Optional client identifier (hardcoded for open source version)
    """
    # For open source version, generate a simple client ID if not provided
    if not client_id:
        client_id = f"client-{uuid.uuid4().hex[:8]}"

    # Track active session
    active_client_sessions.add(client_id)

    async def generate_multiplexed_sse_events():
        """Generate SSE events for all query results multiplexed through single connection"""
        try:
            logger.info(f"Starting SSE stream for client: {client_id}")

            # Send initial connection confirmation
            yield f"data: {json.dumps({'type': 'connection', 'client_id': client_id, 'status': 'connected', 'timestamp': time.time()})}\n\n"

            # Keep track of last seen timestamps per query to avoid duplicates
            last_seen_timestamps = {}
            heartbeat_interval = 30  # seconds
            last_heartbeat = time.time()

            while client_id in active_client_sessions:
                current_time = time.time()
                has_new_messages = False

                # Get all active queries and check for new messages
                active_query_run_ids = query_results_subscriber.get_active_queries()

                for query_run_id in active_query_run_ids:
                    last_timestamp = last_seen_timestamps.get(query_run_id, 0)
                    new_messages = query_results_subscriber.get_messages(
                        query_run_id, last_timestamp
                    )

                    for message in new_messages:
                        # Get the query_id for this run
                        query_id = get_query_id_for_run(db, query_run_id)

                        if not query_id:
                            logger.warning(f"Could not find query_id for run_id: {query_run_id}")
                            continue

                        # Add type field for multiplexing and include both IDs
                        multiplexed_message = {
                            "type": "query_result",
                            "query_run_id": query_run_id,
                            "query_id": query_id,
                            **message,
                        }

                        yield f"data: {json.dumps(multiplexed_message)}\n\n"

                        # Update last seen timestamp
                        msg_timestamp = message.get("timestamp", current_time)
                        last_seen_timestamps[query_run_id] = max(
                            last_seen_timestamps.get(query_run_id, 0), msg_timestamp
                        )
                        has_new_messages = True

                # Send heartbeat if no recent messages and enough time has passed
                if not has_new_messages and (current_time - last_heartbeat) >= heartbeat_interval:
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
        generate_multiplexed_sse_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.get("/query-status/{query_run_id}")
async def get_query_status(query_run_id: str):
    """
    Get current status of a specific query run (non-streaming endpoint)
    """
    latest_message = query_results_subscriber.get_latest_message(query_run_id)

    if not latest_message:
        return {
            "query_run_id": query_run_id,
            "status": "not_found",
            "timestamp": time.time(),
            "has_data": False,
            "has_error": False,
        }

    return {
        "query_run_id": query_run_id,
        "status": latest_message.get("status", "unknown"),
        "timestamp": latest_message.get("timestamp", time.time()),
        "has_data": "data" in latest_message,
        "has_error": "error" in latest_message,
    }


@router.get("/active-queries")
async def get_active_queries():
    """
    Get list of query runs that have stored results
    """
    active_query_run_ids = query_results_subscriber.get_active_queries()

    query_summaries = []
    for query_run_id in active_query_run_ids:
        latest_message = query_results_subscriber.get_latest_message(query_run_id)
        if latest_message:
            query_summaries.append(
                {
                    "query_run_id": query_run_id,
                    "status": latest_message.get("status", "unknown"),
                    "timestamp": latest_message.get("timestamp", time.time()),
                }
            )

    return {"active_queries": query_summaries, "total_count": len(query_summaries)}


@router.get("/active-clients")
async def get_active_clients():
    """
    Get list of active client sessions
    """
    return {
        "active_clients": list(active_client_sessions),
        "total_count": len(active_client_sessions),
    }
