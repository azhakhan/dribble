import redis.asyncio as redis
import orjson
import logging

logger = logging.getLogger(__name__)

REDIS = redis.from_url(
    "redis://redis:6379",
    decode_responses=True,
    encoding="utf-8",
    socket_connect_timeout=5,  # 5 second connection timeout
    socket_timeout=5,  # 5 second socket timeout
    retry_on_timeout=True,
    health_check_interval=30,  # Check connection health every 30 seconds
)


async def set_result(query_id, result: dict, ttl=900):
    try:
        await REDIS.set(f"query:{query_id}", orjson.dumps(result), ex=ttl)
        logger.debug(f"Successfully set result for query {query_id}")
    except Exception as e:
        logger.error(f"Failed to set result in Redis for query {query_id}: {str(e)}")
        raise


async def get_result(query_id):
    try:
        raw = await REDIS.get(f"query:{query_id}")
        if raw:
            return orjson.loads(raw)
        return None
    except Exception as e:
        logger.error(f"Failed to get result from Redis for query {query_id}: {str(e)}")
        return None
