import asyncio
import logging
from typing import Dict, List, Optional
import time
import orjson
from app.core._redis import REDIS

logger = logging.getLogger(__name__)


class TaskStatusSubscriber:
    """Simple Redis subscriber for task status updates (no data, only status)"""

    def __init__(self, max_messages_per_task: int = 10):
        self.max_messages_per_task = max_messages_per_task
        # Only store latest status per task
        self.task_status: Dict[str, dict] = {}
        self._subscriber_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """Start the Redis subscriber"""
        if self._running:
            logger.warning("Redis subscriber is already running")
            return

        self._running = True
        self._subscriber_task = asyncio.create_task(self._subscribe_to_status())
        logger.info("Redis subscriber started for task status")

    async def stop(self):
        """Stop the Redis subscriber"""
        if not self._running:
            return

        self._running = False
        if self._subscriber_task and not self._subscriber_task.done():
            self._subscriber_task.cancel()
            try:
                # Add timeout to prevent hanging during shutdown
                await asyncio.wait_for(self._subscriber_task, timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

        logger.info("Redis subscriber stopped")

    async def _subscribe_to_status(self):
        """Subscribe to task_status:* channels"""
        pubsub_redis = None
        try:
            pubsub_redis = REDIS.pubsub()
            await pubsub_redis.psubscribe("task_status:*")

            logger.info("Subscribed to task_status:* channels")

            async for message in pubsub_redis.listen():
                if not self._running:
                    break

                if message["type"] == "pmessage":
                    await self._handle_message(message)

        except asyncio.CancelledError:
            logger.info("Redis subscriber task cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in Redis subscriber: {str(e)}")
            if self._running:
                # Retry after a delay
                await asyncio.sleep(5)
                if self._running:
                    self._subscriber_task = asyncio.create_task(self._subscribe_to_status())
        finally:
            if pubsub_redis:
                try:
                    await pubsub_redis.punsubscribe("task_status:*")
                    await pubsub_redis.close()
                except Exception as e:
                    logger.error(f"Error closing pub/sub connection: {str(e)}")

    async def _handle_message(self, message):
        """Handle incoming Redis pub/sub message"""
        try:
            channel = message["channel"]
            data = message["data"]

            # Extract task_id from channel name (task_status:task_id)
            if not channel.startswith("task_status:"):
                return

            task_id = channel[12:]  # Remove "task_status:" prefix

            # Parse the message
            try:
                parsed_message = orjson.loads(data)
            except orjson.JSONDecodeError:
                logger.error(f"Failed to parse message for task {task_id}: {data}")
                return

            # Add timestamp if not present
            if "timestamp" not in parsed_message:
                parsed_message["timestamp"] = time.time()

            # Check if this is a terminal status (success or error) and if we need to update query run
            status = parsed_message.get("status")
            if status in ["success", "error"]:
                await self._maybe_update_query_run(task_id)

            # Store only the latest status for this task
            self.task_status[task_id] = parsed_message

            logger.debug(
                f"Updated status for task {task_id}: {parsed_message.get('status', 'unknown')}"
            )

        except Exception as e:
            logger.error(f"Error handling Redis message: {str(e)}")

    async def _maybe_update_query_run(self, task_id: str):
        """
        DEPRECATED: This method is no longer used.
        Use QueryExecutionService.handle_task_completion instead.

        This method is kept only for reference and will be removed in future versions.
        """
        logger.warning(
            f"Deprecated _maybe_update_query_run called for task {task_id}. "
            "This method should not be used anymore."
        )

    def get_status(self, task_id: str) -> Optional[dict]:
        """Get the latest status for a task"""
        return self.task_status.get(task_id)

    def get_all_active_tasks(self) -> List[str]:
        """Get all task IDs that have status"""
        return list(self.task_status.keys())

    def clear_status(self, task_id: str):
        """Clear stored status for a task"""
        self.task_status.pop(task_id, None)


# Global subscriber instance
task_status_subscriber = TaskStatusSubscriber()


async def start_redis_subscriber():
    """Start the Redis subscriber service"""
    await task_status_subscriber.start()


async def stop_redis_subscriber():
    """Stop the Redis subscriber service"""
    await task_status_subscriber.stop()
