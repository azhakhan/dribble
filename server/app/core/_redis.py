import redis.asyncio as redis
import orjson
import os
import logging
import json
import uuid
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

REDIS = redis.from_url(
    os.environ.get("REDIS_URL", "redis://redis:6379"),
    decode_responses=True,
    encoding="utf-8",
    socket_connect_timeout=5,  # 5 second connection timeout
    socket_timeout=5,  # 5 second socket timeout
    retry_on_timeout=True,
    health_check_interval=30,  # Check connection health every 30 seconds
)

# Redis queue configuration
QUEUE_NAME = os.environ.get("REDIS_QUEUE", "query_tasks")


async def set_result(query_id, result: dict, ttl=900):
    try:
        await REDIS.set(f"query:{query_id}", orjson.dumps(result), ex=ttl)
        logger.debug(f"Successfully set result for query {query_id}")
    except Exception as e:
        logger.error(f"Failed to set result in Redis for query {query_id}: {str(e)}")
        raise


async def get_result(query_id):
    try:
        result = await REDIS.get(f"query:{query_id}")
        if result:
            return orjson.loads(result)
        return None
    except Exception as e:
        logger.error(f"Failed to get result from Redis for query {query_id}: {str(e)}")
        return None


async def submit_task(task_data: Dict[str, Any]) -> str:
    """Submit a task to the Redis queue and return the task ID"""
    try:
        task_id = str(uuid.uuid4())
        task_data["id"] = task_id

        await REDIS.lpush(QUEUE_NAME, json.dumps(task_data))
        logger.debug(f"Successfully submitted task {task_id} to queue")
        return task_id
    except Exception as e:
        logger.error(f"Failed to submit task to Redis queue: {str(e)}")
        raise


async def get_task_result(task_id: str) -> Optional[Dict[str, Any]]:
    """Get the result of a task from Redis"""
    try:
        raw = await REDIS.get(f"query_run:{task_id}:result")
        if raw:
            return json.loads(raw)
        return None
    except Exception as e:
        logger.error(f"Failed to get task result from Redis for task {task_id}: {str(e)}")
        return None
