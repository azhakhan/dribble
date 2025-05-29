from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.sources import router as sources_router
from app.routes.query import router as query_router
from app.core.start import ensure_user_and_workspace
from app.core.worker_health_check import start_health_check, stop_health_check
from app.core.reconcile import reconcile_workers
import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_user_and_workspace()
    reconcile_workers()
    start_health_check()
    yield
    # TODO: stop workers only when not in development mode with hot reloading
    # stop_workers()
    stop_health_check()


app = FastAPI(lifespan=lifespan)


app.include_router(sources_router)
app.include_router(query_router)
