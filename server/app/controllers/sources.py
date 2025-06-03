import httpx
import orjson
import asyncio
from app.core._redis import REDIS


async def get_source_schema(source_id: str):
    # Try to get from cache first
    cache_key = f"source_schema:{source_id}"
    cached_result = await REDIS.get(cache_key)

    if cached_result:
        return orjson.loads(cached_result)

    # If not in cache, fetch from the worker with retry logic
    container_name = f"dribble-worker-postgres-{source_id}"

    max_retries = 3
    base_delay = 1.0  # seconds
    max_delay = 10.0  # seconds

    for attempt in range(max_retries + 1):  # 0, 1, 2, 3 (4 total attempts)
        try:
            async with httpx.AsyncClient() as client:
                # Increase timeout on retries since container might be starting
                timeout = 10 if attempt == 0 else 15
                response = await client.get(
                    f"http://{container_name}:8000/schema/",
                    timeout=timeout,
                )
                response.raise_for_status()
                schema_data = response.json()

            # Cache the result for 1 hour (3600 seconds)
            # Schema data doesn't change frequently, so this is a reasonable TTL
            await REDIS.set(cache_key, orjson.dumps(schema_data), ex=3600)

            return schema_data

        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
            if attempt < max_retries:
                # Calculate delay with exponential backoff
                delay = min(base_delay * (2**attempt), max_delay)
                await asyncio.sleep(delay)
                continue
            else:
                # Last attempt failed, raise the original error
                raise Exception(f"All connection attempts failed: {str(e)}") from e
        except Exception as e:
            # For other exceptions, don't retry
            raise Exception(f"Schema fetch failed: {str(e)}") from e


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
