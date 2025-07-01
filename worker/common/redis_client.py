import os
import time
import json
import logging
import redis

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_NAME = os.getenv("REDIS_QUEUE", "query_tasks")

# Initialize Redis client
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def set_result(task_id: str, result: dict, ttl: int = 900):
    """Store result in Redis"""
    try:
        r.set(f"query_run:{task_id}:result", json.dumps(result), ex=ttl)
        logger.debug(f"Successfully set result for task {task_id}")
    except Exception as e:
        logger.error(f"Failed to set result in Redis for task {task_id}: {str(e)}")
        raise


def publish_status(task_id: str, status: str):
    """Publish simple task status to Redis pub/sub channel (no data, only status)"""
    try:
        message = {"task_id": task_id, "status": status, "timestamp": time.time()}
        channel = f"task_status:{task_id}"
        r.publish(channel, json.dumps(message))
        logger.debug(f"Published status '{status}' for task {task_id}")
    except Exception as e:
        logger.error(f"Failed to publish status to Redis for task {task_id}: {str(e)}")


def get_task_from_queue(timeout: int = 5):
    """Get a task from the Redis queue"""
    try:
        task = r.brpop(QUEUE_NAME, timeout=timeout)
        if task:
            _, task_raw = task
            return json.loads(task_raw)
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in task: {task_raw}, error: {e}")
        return None
    except Exception as e:
        logger.error(f"Redis error getting task: {str(e)}")
        return None


def set_worker_heartbeat(worker_id: str, connections_count: int = 0):
    """Set worker heartbeat in Redis"""
    try:
        r.set(f"worker:heartbeat:{worker_id}", int(time.time()))
        r.set("worker:connections", connections_count)
    except Exception as e:
        logger.error(f"Failed to set heartbeat: {str(e)}")


def health_check():
    """Check Redis connectivity"""
    try:
        r.ping()
        return True
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        return False
