from app.core.db import get_db
from app.models import Worker
from app.core.spawn_worker import is_healthy

from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()


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


def start_health_check():
    scheduler.add_job(check_workers_health, "interval", seconds=5)
    scheduler.start()


def stop_health_check():
    scheduler.shutdown()
