# stop all workers
import logging
from app.models import Worker
from app.core.spawn_worker import stop_worker
from app.core.db import SessionLocal

logger = logging.getLogger(__name__)


def stop_workers():
    """Stop all worker containers and clean up database records.
    This should only be called during a proper server shutdown, not during hot reloads.
    """
    logger.info("Stopping all worker containers")
    db = SessionLocal()
    try:
        workers = db.query(Worker).all()
        logger.info(f"Found {len(workers)} workers to stop")

        for worker in workers:
            try:
                logger.info(f"Stopping worker {worker.id} (container {worker.container_id})")
                stop_worker(worker.container_id)
                # Update status before deleting
                worker.status = "stopped"
                db.commit()
                # remove worker from db
                db.delete(worker)
                db.commit()
                logger.info(f"Successfully stopped and removed worker {worker.id}")
            except Exception as e:
                logger.error(f"Error stopping worker {worker.id}: {str(e)}")
                # Even if stopping fails, mark as stopped in DB
                try:
                    worker.status = "error"
                    db.commit()
                except Exception:
                    pass
    except Exception as e:
        logger.error(f"Error in stop_workers: {str(e)}")
    finally:
        db.close()
        logger.info("Finished stopping all workers")
