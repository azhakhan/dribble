import docker
from app.models import Worker, Source
from app.core.db import SessionLocal
from app.core.spawn_worker import WorkerContainer, stop_worker
from app.schemas.sources import PostgresCreds
import logging

logger = logging.getLogger(__name__)
client = docker.from_env()


def reconcile_workers():
    """
    Reconcile worker records in the database with actual running Docker containers.
    Simplified logic:
    1. For containers without DB records: stop them and remove them
    2. For DB records without containers: create new containers
    """
    db = SessionLocal()
    try:
        # Get all worker records from the database
        db_workers = db.query(Worker).all()
        db_worker_container_ids = {w.container_id for w in db_workers}

        # Get all running containers with our naming pattern
        running_containers = {}
        try:
            containers = client.containers.list(filters={"name": "dribble-worker-postgres-"})
            for container in containers:
                running_containers[container.id] = container
        except Exception as e:
            logger.error(f"Error listing containers: {str(e)}")
            return

        # 1. Handle containers without DB records - stop and remove them
        orphaned_container_ids = set(running_containers.keys()) - db_worker_container_ids
        for container_id in orphaned_container_ids:
            container = running_containers[container_id]
            logger.info(f"Found orphaned container {container.name}, stopping and removing it")
            try:
                stop_worker(container_id)
            except Exception as e:
                logger.error(f"Error stopping orphaned container {container.name}: {str(e)}")

        # 2. Handle DB records without containers - create new containers
        for worker in db_workers:
            if worker.container_id not in running_containers:
                logger.info(f"Worker {worker.id} has no running container, starting a new one")
                try:
                    # Get the source for this worker to get credentials
                    source = db.query(Source).filter_by(id=worker.source_id).first()
                    if not source:
                        logger.error(
                            f"Could not find source {worker.source_id}" + " for worker {worker.id}"
                        )
                        continue

                    # Create credentials object from JSON
                    creds = PostgresCreds(**source.creds)

                    # Create and start a new container
                    worker_container = WorkerContainer(source_id=source.id, creds=creds)
                    worker_container.start(worker.workspace_id, db)

                    # Update worker record with new container info
                    worker.container_id = worker_container.container_id
                    worker.port = worker_container.port
                    worker.host = worker_container.container_url
                    worker.status = "running"
                    db.commit()

                    logger.info(
                        f"Started new container {worker_container.container_id} for",
                        "worker {worker.id}",
                    )
                except Exception as e:
                    logger.error(f"Error starting new container for worker {worker.id}: {str(e)}")
                    worker.status = "error"
                    db.commit()

        new_containers_started = len(
            [w for w in db_workers if w.container_id not in running_containers]
        )
        logger.info(
            f"Reconciliation complete: {len(orphaned_container_ids)} orphaned containers removed, "
            f"{new_containers_started} new containers started"
        )

    finally:
        db.close()
