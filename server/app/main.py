from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.sources import router as sources_router
from app.routes.query import router as query_router
from app.routes.query_version import router as query_version_router
from app.routes.query_run import router as query_run_router
from app.routes.query_execution import router as query_execution_router
from app.routes.llm import router as llm_router
from app.routes.chat import router as chat_router
from app.core.worker_health_check import start_health_check, stop_health_check
from app.core.reconcile import reconcile_workers
from app.core.session_naming import start_session_naming, stop_session_naming
import logging

# Suppress APScheduler logs to reduce noise
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    reconcile_workers()
    start_health_check()
    start_session_naming()
    yield
    # TODO: stop workers only when not in development mode with hot reloading
    # stop_workers()
    stop_health_check()
    stop_session_naming()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(sources_router)
app.include_router(query_router)
app.include_router(query_version_router)
app.include_router(query_run_router)
app.include_router(query_execution_router)
app.include_router(llm_router)
app.include_router(chat_router)
