from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.sources import router as sources_router
from app.routes.query import router as query_router
from app.routes.query_version import router as query_version_router
from app.routes.query_run import router as query_run_router
from app.routes.query_execution import router as query_execution_router
from app.routes.llm import router as llm_router
from app.routes.chat import router as chat_router
from app.routes.sse import router as sse_router
from app.core.session_naming import start_session_naming, stop_session_naming
from app.core.redis_subscriber import start_redis_subscriber, stop_redis_subscriber
import logging

# Suppress APScheduler logs to reduce noise
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_session_naming()
    await start_redis_subscriber()
    yield
    # TODO: stop workers only when not in development mode with hot reloading
    # stop_workers()
    stop_session_naming()
    await stop_redis_subscriber()


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
app.include_router(sse_router)
