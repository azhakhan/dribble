from app.core.db import get_db
from app.models import Worker
from app.core.spawn_worker import is_healthy, stop_worker
import docker
import logging
import datetime

from apscheduler.schedulers.background import BackgroundScheduler

# Suppress APScheduler logs to reduce noise
logging.getLogger("apscheduler").setLevel(logging.WARNING)

scheduler = BackgroundScheduler()
logger = logging.getLogger(__name__)
client = docker.from_env()


def check_workers_health():
    db_gen = get_db()
    db = next(db_gen)
    try:
        workers = db.query(Worker).all()
        for worker in workers:
            healthy = is_healthy(worker.container_id)
            if not healthy:
                try:
                    # Check if container actually exists
                    client.containers.get(worker.container_id)
                    # Container exists but is not healthy
                    if worker.status != "unhealthy":
                        worker.status = "unhealthy"
                        db.commit()
                        logger.warning(f"Worker {worker.id} marked as unhealthy")
                except docker.errors.NotFound:
                    # Container doesn't exist, remove worker record
                    logger.info(
                        f"Container {worker.container_id} not found, removing worker record {worker.id}"
                    )
                    db.delete(worker)
                    db.commit()
                except Exception as e:
                    logger.error(f"Error checking container {worker.container_id}: {str(e)}")
                    if worker.status != "error":
                        worker.status = "error"
                        db.commit()
            elif healthy and worker.status not in ["healthy", "running"]:
                worker.status = "healthy"
                db.commit()
                logger.info(f"Worker {worker.id} marked as healthy")
    finally:
        # Exhaust the generator to call the close method
        try:
            next(db_gen)
        except StopIteration:
            pass


def cleanup_orphaned_containers():
    """Clean up containers that exist but have no database records"""
    db_gen = get_db()
    db = next(db_gen)
    try:
        # Get all worker container IDs from the database
        db_workers = db.query(Worker).all()
        db_worker_container_ids = {w.container_id for w in db_workers}

        # Get all running containers with our naming pattern
        try:
            containers = client.containers.list(filters={"name": "dribble-worker-postgres-"})
            orphaned_count = 0
            for container in containers:
                # Clean up containers without DB records
                # (excluding test containers which auto-remove)
                if container.id not in db_worker_container_ids and "-test" not in container.name:
                    # Check container age to avoid removing containers that are still starting up
                    created_time = datetime.datetime.fromisoformat(
                        container.attrs["Created"].replace("Z", "+00:00")
                    )
                    now = datetime.datetime.now(datetime.timezone.utc)
                    age_seconds = (now - created_time).total_seconds()

                    # Only remove containers older than 60 seconds to avoid race conditions
                    if age_seconds > 60:
                        msg = f"Found orphaned container {container.name} (age: {age_seconds:.1f}s), stopping and removing it"
                        logger.info(msg)
                        try:
                            stop_worker(container.id)
                            orphaned_count += 1
                        except Exception as e:
                            msg = f"Error stopping orphaned container {container.name}: {str(e)}"
                            logger.error(msg)
                    else:
                        logger.debug(
                            f"Skipping recently created container {container.name} (age: {age_seconds:.1f}s)"
                        )

            if orphaned_count > 0:
                logger.info(f"Cleaned up {orphaned_count} orphaned containers")

        except Exception as e:
            logger.error(f"Error during orphaned container cleanup: {str(e)}")
    finally:
        # Exhaust the generator to call the close method
        try:
            next(db_gen)
        except StopIteration:
            pass


def start_health_check():
    scheduler.add_job(check_workers_health, "interval", seconds=5)
    # Add periodic cleanup of orphaned containers every 30 seconds
    scheduler.add_job(cleanup_orphaned_containers, "interval", seconds=30)
    scheduler.start()


def stop_health_check():
    scheduler.shutdown()
