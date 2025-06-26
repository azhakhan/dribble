import asyncio
import logging
from typing import Dict, List, Optional
from collections import defaultdict, deque
import time
import orjson
from app.core._redis import REDIS

logger = logging.getLogger(__name__)


class QueryResultsSubscriber:
    """Background Redis subscriber for query results with in-memory storage for SSE"""

    def __init__(self, max_messages_per_query: int = 100):
        self.max_messages_per_query = max_messages_per_query
        self.subscribers: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=max_messages_per_query)
        )
        self.client_connections: Dict[str, List] = defaultdict(list)
        self._subscriber_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        """Start the Redis subscriber"""
        if self._running:
            logger.warning("Redis subscriber is already running")
            return

        self._running = True
        self._subscriber_task = asyncio.create_task(self._subscribe_to_results())
        logger.info("Redis subscriber started for query results")

    async def stop(self):
        """Stop the Redis subscriber"""
        if not self._running:
            return

        self._running = False
        if self._subscriber_task and not self._subscriber_task.done():
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

        logger.info("Redis subscriber stopped")

    async def _subscribe_to_results(self):
        """Background task to subscribe to query_results:* channels"""
        pubsub_redis = None
        try:
            # Create a separate Redis connection for pub/sub
            pubsub_redis = REDIS.pubsub()
            await pubsub_redis.psubscribe("query_results:*")

            logger.info("Subscribed to query_results:* channels")

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
                    self._subscriber_task = asyncio.create_task(self._subscribe_to_results())
        finally:
            if pubsub_redis:
                try:
                    await pubsub_redis.punsubscribe("query_results:*")
                    await pubsub_redis.close()
                except Exception as e:
                    logger.error(f"Error closing pub/sub connection: {str(e)}")

    async def _handle_message(self, message):
        """Handle incoming Redis pub/sub message"""
        try:
            channel = message["channel"]
            data = message["data"]

            # Extract query_id from channel name (query_results:query_id)
            if not channel.startswith("query_results:"):
                return

            query_id = channel[14:]  # Remove "query_results:" prefix

            # Parse the message
            try:
                parsed_message = orjson.loads(data)
            except orjson.JSONDecodeError:
                logger.error(f"Failed to parse message for query {query_id}: {data}")
                return

            # Add timestamp if not present
            if "timestamp" not in parsed_message:
                parsed_message["timestamp"] = time.time()

            # Store in memory for this query
            self.subscribers[query_id].append(parsed_message)

            logger.debug(f"Stored message for query {query_id}: {parsed_message['status']}")

        except Exception as e:
            logger.error(f"Error handling Redis message: {str(e)}")

    def get_messages(self, query_id: str, since_timestamp: Optional[float] = None) -> List[dict]:
        """Get stored messages for a query, optionally since a timestamp"""
        messages = list(self.subscribers[query_id])

        if since_timestamp is not None:
            messages = [msg for msg in messages if msg.get("timestamp", 0) > since_timestamp]

        return messages

    def get_latest_message(self, query_id: str) -> Optional[dict]:
        """Get the latest message for a query"""
        messages = self.subscribers[query_id]
        return messages[-1] if messages else None

    def clear_messages(self, query_id: str):
        """Clear stored messages for a query"""
        if query_id in self.subscribers:
            self.subscribers[query_id].clear()

    def get_active_queries(self) -> List[str]:
        """Get list of query IDs that have stored messages"""
        return list(self.subscribers.keys())


# Global subscriber instance
query_results_subscriber = QueryResultsSubscriber()


async def start_redis_subscriber():
    """Start the Redis subscriber service"""
    await query_results_subscriber.start()


async def stop_redis_subscriber():
    """Stop the Redis subscriber service"""
    await query_results_subscriber.stop()


def get_query_messages(query_id: str, since_timestamp: Optional[float] = None) -> List[dict]:
    """Get messages for a query"""
    return query_results_subscriber.get_messages(query_id, since_timestamp)


def get_latest_query_message(query_id: str) -> Optional[dict]:
    """Get the latest message for a query"""
    return query_results_subscriber.get_latest_message(query_id)
