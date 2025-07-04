"""
Service for streaming query results and task updates via SSE.
Provides direct streaming without separate fetch operations.
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Dict, Optional, Set
from uuid import UUID

from fastapi import Request
from sse_starlette import EventSourceResponse

from app.core.task_service import TaskService
from app.core.task_types import TaskStatus, TaskStatusUpdate, TaskType
from app.core.query_execution_service import QueryExecutionService

logger = logging.getLogger(__name__)


class ResultsStreamingService:
    """
    Service for streaming task results directly via SSE.
    Eliminates the need for separate result fetching.
    """

    def __init__(self, task_service: TaskService, query_service: QueryExecutionService):
        self.task_service = task_service
        self.query_service = query_service
        self._active_streams: Dict[str, Set[str]] = {}  # client_id -> set of task_ids

    async def stream_task_updates(
        self, request: Request, client_id: str, task_ids: Optional[Set[str]] = None
    ) -> EventSourceResponse:
        """
        Stream task updates for specific tasks or all tasks for a client.

        Args:
            request: FastAPI request object
            client_id: Unique client identifier
            task_ids: Optional set of task IDs to track

        Returns:
            SSE response with task updates
        """

        async def event_generator() -> AsyncGenerator[str, None]:
            """Generate SSE events for task updates."""

            # Initialize client tracking
            if client_id not in self._active_streams:
                self._active_streams[client_id] = set()

            if task_ids:
                self._active_streams[client_id].update(task_ids)

            # Subscribe to Redis pub/sub
            pubsub = await self.task_service.redis.subscribe("task_status")

            try:
                while True:
                    # Check if client disconnected
                    if await request.is_disconnected():
                        logger.info(f"Client {client_id} disconnected")
                        break

                    # Get message from Redis
                    message = await pubsub.get_message(timeout=1.0)
                    if message is None:
                        # Send heartbeat
                        yield f"event: heartbeat\ndata: {json.dumps({'timestamp': 'now'})}\n\n"
                        continue

                    if message["type"] != "message":
                        continue

                    try:
                        # Parse task update
                        update_data = json.loads(message["data"])
                        update = TaskStatusUpdate.model_validate(update_data)

                        # Check if this client is interested in this task
                        if not task_ids or update.task_id in self._active_streams.get(
                            client_id, set()
                        ):
                            # Handle task completion
                            if update.status in [
                                TaskStatus.COMPLETED,
                                TaskStatus.FAILED,
                                TaskStatus.CANCELLED,
                            ]:
                                await self._handle_task_completion(update)

                                # Remove from tracking
                                if client_id in self._active_streams:
                                    self._active_streams[client_id].discard(update.task_id)

                            # Stream the update
                            event_data = {
                                "task_id": update.task_id,
                                "status": update.status.value,
                                "task_type": update.task_type.value,
                                "progress": update.progress,
                                "message": update.message,
                                "error": update.error,
                                "timestamp": update.timestamp,
                            }

                            # Include result data if available
                            if update.result:
                                event_data["result"] = update.result.model_dump()

                            yield f"event: task_update\ndata: {json.dumps(event_data)}\n\n"

                    except Exception as e:
                        logger.error(f"Error processing task update: {e}")
                        continue

            except asyncio.CancelledError:
                logger.info(f"Stream cancelled for client {client_id}")
            except Exception as e:
                logger.error(f"Error in event stream for client {client_id}: {e}")
            finally:
                # Cleanup
                if client_id in self._active_streams:
                    del self._active_streams[client_id]
                await pubsub.unsubscribe("task_status")

        return EventSourceResponse(event_generator())

    async def add_task_to_stream(self, client_id: str, task_id: str) -> None:
        """
        Add a task to be tracked for a specific client.

        Args:
            client_id: Client identifier
            task_id: Task to track
        """
        if client_id not in self._active_streams:
            self._active_streams[client_id] = set()

        self._active_streams[client_id].add(task_id)
        logger.debug(f"Added task {task_id} to stream for client {client_id}")

    async def remove_task_from_stream(self, client_id: str, task_id: str) -> None:
        """
        Remove a task from tracking for a specific client.

        Args:
            client_id: Client identifier
            task_id: Task to stop tracking
        """
        if client_id in self._active_streams:
            self._active_streams[client_id].discard(task_id)
            logger.debug(f"Removed task {task_id} from stream for client {client_id}")

    async def _handle_task_completion(self, update: TaskStatusUpdate) -> None:
        """
        Handle task completion by updating database and processing results.

        Args:
            update: Task status update
        """
        try:
            # Handle different task types
            if update.task_type == TaskType.QUERY_EXECUTION:
                await self.query_service.handle_task_completion(
                    task_id=update.task_id,
                    status=update.status,
                    result_data=update.result.model_dump() if update.result else None,
                    error=update.error,
                )
            elif update.task_type == TaskType.QUERY_CANCEL:
                # Handle query cancellation
                await self.query_service.handle_task_completion(
                    task_id=update.task_id, status=update.status, error=update.error
                )
            # Add handlers for other task types as needed

        except Exception as e:
            logger.error(f"Error handling task completion {update.task_id}: {e}")

    async def get_active_streams(self) -> Dict[str, Set[str]]:
        """Get information about active streams for debugging."""
        return dict(self._active_streams)

    async def cleanup_client(self, client_id: str) -> None:
        """
        Cleanup resources for a disconnected client.

        Args:
            client_id: Client identifier
        """
        if client_id in self._active_streams:
            del self._active_streams[client_id]
            logger.info(f"Cleaned up resources for client {client_id}")


class StreamingQueryService:
    """
    High-level service that combines query execution with streaming.
    Provides a simplified interface for the API routes.
    """

    def __init__(
        self,
        task_service: TaskService,
        query_service: QueryExecutionService,
        streaming_service: ResultsStreamingService,
    ):
        self.task_service = task_service
        self.query_service = query_service
        self.streaming_service = streaming_service

    async def execute_query_with_streaming(
        self, query_version_id: UUID, client_id: str, db_session
    ) -> str:
        """
        Execute a query and set up streaming for the client.

        Args:
            query_version_id: Query version to execute
            client_id: Client identifier for streaming
            db_session: Database session

        Returns:
            Task ID
        """
        # Execute the query
        task_id = await self.query_service.execute_query_version(query_version_id, db_session)

        # Add to streaming for the client
        await self.streaming_service.add_task_to_stream(client_id, task_id)

        return task_id

    async def cancel_query_with_streaming(
        self, query_run_id: UUID, client_id: str, db_session
    ) -> bool:
        """
        Cancel a query and handle streaming cleanup.

        Args:
            query_run_id: Query run to cancel
            client_id: Client identifier
            db_session: Database session

        Returns:
            True if cancellation was successful
        """
        success = await self.query_service.cancel_query_execution(query_run_id, db_session)

        # The streaming service will handle cleanup when the cancellation completes
        return success
