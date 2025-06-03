import httpx
import orjson
from app.core._redis import REDIS


async def get_source_schema(source_id: str):
    # Try to get from cache first
    cache_key = f"source_schema:{source_id}"
    cached_result = await REDIS.get(cache_key)

    if cached_result:
        return orjson.loads(cached_result)

    # If not in cache, fetch from the worker
    container_name = f"dribble-worker-postgres-{source_id}"

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://{container_name}:8000/schema/",
            timeout=5,
        )
        response.raise_for_status()
        schema_data = response.json()

    # Cache the result for 1 hour (3600 seconds)
    # Schema data doesn't change frequently, so this is a reasonable TTL
    await REDIS.set(cache_key, orjson.dumps(schema_data), ex=3600)

    return schema_data


async def invalidate_source_schema_cache(source_id: str):
    """Invalidate the cached schema for a specific source."""
    cache_key = f"source_schema:{source_id}"
    await REDIS.delete(cache_key)


async def invalidate_all_source_schema_caches():
    """Invalidate all cached source schemas. Useful for administrative purposes."""
    pattern = "source_schema:*"
    keys = await REDIS.keys(pattern)
    if keys:
        await REDIS.delete(*keys)
