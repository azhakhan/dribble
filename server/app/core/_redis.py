import redis.asyncio as redis
import orjson
import os

REDIS = redis.from_url(
    os.environ.get("REDIS_URL", "redis://redis:6379"), decode_responses=True, encoding="utf-8"
)


async def set_result(query_id, result: dict, ttl=900):
    await REDIS.set(f"query:{query_id}", orjson.dumps(result), ex=ttl)


async def get_result(query_id):
    raw = await REDIS.get(f"query:{query_id}")
    if raw:
        return orjson.loads(raw)
    return None
