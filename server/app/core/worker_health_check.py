from app.core.db import get_db
from app.models import Worker
from app.core.spawn_worker import is_healthy, stop_worker
import docker
import logging

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
            if not healthy and worker.status != "unhealthy":
                worker.status = "unhealthy"
                db.commit()
                # TODO: kill the container if it's been unhealthy for too long
            elif healthy and worker.status != "healthy":
                worker.status = "healthy"
                db.commit()
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
                    msg = f"Found orphaned container {container.name}, stopping and removing it"
                    logger.info(msg)
                    try:
                        stop_worker(container.id)
                        orphaned_count += 1
                    except Exception as e:
                        msg = f"Error stopping orphaned container {container.name}: {str(e)}"
                        logger.error(msg)

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
