"""
Centralized task management service.
Handles task creation, submission, and result processing with proper typing.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Optional, Type, TypeVar
from uuid import uuid4

from pydantic import ValidationError

from app.core._redis import RedisClient
from app.core.task_types import (
    TaskData,
    TaskResult,
    TaskResultData,
    TaskStatus,
    TaskStatusUpdate,
    TaskType,
    QueryExecutionTaskData,
    QueryCancelTaskData,
    SourceTestTaskData,
    SourceConnectTaskData,
    QueryExecutionResult,
    QueryCancelResult,
    SourceTestResult,
    SourceConnectResult,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=TaskData)
R = TypeVar("R", bound=TaskResultData)


class TaskService:
    """
    Service for managing tasks with proper typing and error handling.
    """

    def __init__(self, redis_client: RedisClient):
        self.redis = redis_client
        self._task_handlers: Dict[TaskType, Type[TaskResultData]] = {
            TaskType.QUERY_EXECUTION: QueryExecutionResult,
            TaskType.QUERY_CANCEL: QueryCancelResult,
            TaskType.SOURCE_TEST: SourceTestResult,
            TaskType.SOURCE_CONNECT: SourceConnectResult,
        }

    async def submit_task(self, task_data: TaskData, queue_name: str) -> str:
        """
        Submit a task to the worker queue.

        Args:
            task_data: The task data to submit
            queue_name: Name of the Redis queue

        Returns:
            Task ID
        """
        try:
            # Generate task ID if not provided
            if not task_data.task_id:
                task_data.task_id = str(uuid4())

            # Add timestamp
            task_data.created_at = datetime.utcnow().isoformat()

            # Serialize and submit to Redis
            task_json = task_data.model_dump_json()
            await self.redis.submit_task(queue_name, task_json)

            logger.info(f"Task submitted: {task_data.task_id} ({task_data.task_type})")
            return task_data.task_id

        except Exception as e:
            logger.error(f"Failed to submit task: {e}")
            raise

    async def get_task_result(self, task_id: str) -> Optional[TaskResultData]:
        """
        Get task result from Redis.

        Args:
            task_id: Task identifier

        Returns:
            Task result or None if not found
        """
        try:
            result_json = await self.redis.get_task_result(task_id)
            if not result_json:
                return None

            result_data = json.loads(result_json)

            # Determine result type based on task type
            if "task_type" in result_data:
                task_type = TaskType(result_data["task_type"])
                result_class = self._task_handlers.get(task_type)
                if result_class:
                    return result_class.model_validate(result_data)

            # Fallback to generic TaskResult
            return TaskResult.model_validate(result_data)

        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Failed to parse task result {task_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error getting task result {task_id}: {e}")
            return None

    async def publish_status_update(self, update: TaskStatusUpdate) -> None:
        """
        Publish a task status update via Redis pub/sub.

        Args:
            update: The status update to publish
        """
        try:
            # Add timestamp if not provided
            if not update.timestamp:
                update.timestamp = datetime.utcnow().isoformat()

            update_json = update.model_dump_json()
            await self.redis.publish_status("task_status", update_json)

            logger.debug(f"Status update published: {update.task_id} -> {update.status}")

        except Exception as e:
            logger.error(f"Failed to publish status update: {e}")
            raise

    async def cancel_task(self, task_id: str, queue_name: str) -> bool:
        """
        Cancel a task by removing it from queue or sending cancel signal.

        Args:
            task_id: Task identifier
            queue_name: Name of the Redis queue

        Returns:
            True if task was cancelled
        """
        try:
            # Try to remove from queue first
            removed = await self.redis.remove_task_from_queue(queue_name, task_id)
            if removed:
                # Publish cancellation status
                update = TaskStatusUpdate(
                    task_id=task_id,
                    status=TaskStatus.CANCELLED,
                    task_type=TaskType.QUERY_CANCEL,  # Will be overridden by actual type
                    message="Task cancelled before execution",
                )
                await self.publish_status_update(update)
                return True

            # If not in queue, task might be running - this requires worker support
            logger.warning(f"Task {task_id} not found in queue - might be running")
            return False

        except Exception as e:
            logger.error(f"Failed to cancel task {task_id}: {e}")
            return False

    def create_query_execution_task(
        self,
        query_version_id: str,
        source_id: str,
        query_run_id: str,
        sql: str,
        worker_session_id: str,
    ) -> QueryExecutionTaskData:
        """Create a query execution task."""
        return QueryExecutionTaskData(
            task_id=str(uuid4()),
            query_version_id=query_version_id,
            source_id=source_id,
            query_run_id=query_run_id,
            sql=sql,
            worker_session_id=worker_session_id,
        )

    def create_query_cancel_task(
        self, query_run_id: str, worker_session_id: str
    ) -> QueryCancelTaskData:
        """Create a query cancellation task."""
        return QueryCancelTaskData(
            task_id=str(uuid4()), query_run_id=query_run_id, worker_session_id=worker_session_id
        )

    def create_source_test_task(
        self, source_id: str, connection_params: Dict
    ) -> SourceTestTaskData:
        """Create a source testing task."""
        return SourceTestTaskData(
            task_id=str(uuid4()), source_id=source_id, connection_params=connection_params
        )

    def create_source_connect_task(
        self, source_id: str, connection_params: Dict
    ) -> SourceConnectTaskData:
        """Create a source connection task."""
        return SourceConnectTaskData(
            task_id=str(uuid4()), source_id=source_id, connection_params=connection_params
        )
