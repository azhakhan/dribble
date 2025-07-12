#!/usr/bin/env python3
"""
Dribble Generic Worker

A modular worker that supports multiple databases with role-based connection pooling.
Supports PostgreSQL with plans for MySQL, SQLite, and Snowflake.

Architecture:
- Redis queue-based task processing
- Connection pooling per source_id:role combination
- Modular design with separate concerns
- Health monitoring and error handling
"""

import time
import uuid
import logging
import signal
import sys
import atexit
import threading

from common.redis_client import get_task_from_queue, set_worker_heartbeat, health_check
from common.connection_manager import get_connections_count, cleanup_all_connections
from common.models import TaskRequest
from task_manager import process_task
from task_adapter import adapt_task_data

# Configure logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Worker configuration
HEARTBEAT_INTERVAL = 5  # seconds
WORKER_ID = str(uuid.uuid4())
RUNNING = True
SHUTDOWN_TIMEOUT = 30  # seconds to wait for graceful shutdown
_cleanup_done = threading.Event()


def cleanup_handler():
    """Cleanup handler that ensures connections are always cleaned up"""
    if not _cleanup_done.is_set():
        logger.info("Running cleanup handler...")
        cleanup_all_connections()
        _cleanup_done.set()


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global RUNNING
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    RUNNING = False

    # Give the main loop a chance to exit gracefully
    if not _cleanup_done.wait(timeout=SHUTDOWN_TIMEOUT):
        logger.warning("Graceful shutdown timeout, forcing cleanup...")
        cleanup_handler()


def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    # Register cleanup to always run on exit
    atexit.register(cleanup_handler)

    # Handle common termination signals
    signal.signal(signal.SIGINT, signal_handler)  # Ctrl+C
    signal.signal(signal.SIGTERM, signal_handler)  # Termination request

    # Handle additional signals on Unix systems
    if hasattr(signal, "SIGHUP"):
        signal.signal(signal.SIGHUP, signal_handler)  # Terminal hangup
    if hasattr(signal, "SIGQUIT"):
        signal.signal(signal.SIGQUIT, signal_handler)  # Quit signal


def main_loop():
    """Main worker loop"""
    logger.info(f"Starting Dribble worker {WORKER_ID}")
    logger.info("Supported databases: PostgreSQL")
    logger.info("Supported task types: connect, test_db, execute, schema")

    last_heartbeat = 0

    try:
        while RUNNING:
            try:
                # Heartbeat
                now = time.time()
                if now - last_heartbeat > HEARTBEAT_INTERVAL:
                    connections_count = get_connections_count()
                    set_worker_heartbeat(WORKER_ID, connections_count)
                    last_heartbeat = now

                    if connections_count > 0:
                        logger.debug(f"Worker heartbeat: {connections_count} active connections")

                # Get and process tasks
                task_data = get_task_from_queue(timeout=5)
                if task_data:
                    logger.info(f"Received task from queue: {task_data}")
                    # Adapt task data to handle both old and new formats
                    adapted_data = adapt_task_data(task_data)
                    logger.debug(f"Adapted task data: {adapted_data}")
                    # Convert dictionary to TaskRequest object
                    task = TaskRequest(**adapted_data)
                    process_task(task)
                else:
                    # No task received, continue loop
                    continue

            except KeyboardInterrupt:
                logger.info("Received keyboard interrupt, shutting down...")
                break
            except Exception:
                logger.exception("Worker loop error")
                time.sleep(1)  # Avoid tight loop on persistent errors

    finally:
        # Always cleanup, even if an exception occurred
        logger.info("Main loop ended, cleaning up connections...")
        cleanup_handler()
        logger.info("Worker shutdown complete")


def health_check_worker():
    """Perform a health check of the worker"""
    try:
        # Check Redis connectivity
        if not health_check():
            logger.error("Redis health check failed")
            return False

        logger.info("Worker health check passed")
        return True
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return False


if __name__ == "__main__":
    # Handle command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "health":
            # Health check mode
            if health_check_worker():
                sys.exit(0)
            else:
                sys.exit(1)
        elif sys.argv[1] == "--help":
            print("Dribble Worker")
            print("Usage:")
            print("  python main.py        # Start worker")
            print("  python main.py health # Health check")
            sys.exit(0)

    # Set up signal handlers
    setup_signal_handlers()

    # Start the main loop
    try:
        main_loop()
    except Exception:
        logger.exception("Fatal error in main loop")
        cleanup_handler()
        sys.exit(1)
