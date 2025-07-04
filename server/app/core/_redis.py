import redis.asyncio as redis
import os
import logging
import json
from typing import Optional

logger = logging.getLogger(__name__)


class RedisClient:
    """
    Redis client with improved methods for task management.
    """

    def __init__(self):
        self.redis = redis.from_url(
            os.environ.get("REDIS_URL", "redis://redis:6379"),
            decode_responses=True,
            encoding="utf-8",
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )

    async def submit_task(self, queue_name: str, task_data: str) -> None:
        """Submit a task to the Redis queue."""
        try:
            await self.redis.lpush(queue_name, task_data)
            logger.debug(f"Task submitted to queue {queue_name}")
        except Exception as e:
            logger.error(f"Failed to submit task to Redis queue {queue_name}: {e}")
            raise

    async def get_task_result(self, task_id: str) -> Optional[str]:
        """Get the result of a task from Redis."""
        try:
            return await self.redis.get(f"query_run:{task_id}:result")
        except Exception as e:
            logger.error(f"Failed to get task result for {task_id}: {e}")
            return None

    async def publish_status(self, channel: str, message: str) -> None:
        """Publish a status message to Redis pub/sub."""
        try:
            await self.redis.publish(channel, message)
            logger.debug(f"Status published to channel {channel}")
        except Exception as e:
            logger.error(f"Failed to publish to channel {channel}: {e}")
            raise

    async def subscribe(self, channel: str):
        """Subscribe to a Redis pub/sub channel."""
        try:
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(channel)
            return pubsub
        except Exception as e:
            logger.error(f"Failed to subscribe to channel {channel}: {e}")
            raise

    async def remove_task_from_queue(self, queue_name: str, task_id: str) -> bool:
        """Remove a specific task from the queue (for cancellation)."""
        try:
            # This is a basic implementation - in practice, you might need
            # a more sophisticated approach for task removal
            queue_items = await self.redis.lrange(queue_name, 0, -1)
            for item in queue_items:
                try:
                    task_data = json.loads(item)
                    if task_data.get("task_id") == task_id:
                        await self.redis.lrem(queue_name, 1, item)
                        return True
                except json.JSONDecodeError:
                    continue
            return False
        except Exception as e:
            logger.error(f"Failed to remove task {task_id} from queue {queue_name}: {e}")
            return False

    async def close(self):
        """Close Redis connection."""
        await self.redis.close()


# Global Redis client instance
redis_client = RedisClient()
