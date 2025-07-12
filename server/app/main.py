from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes.sources import router as sources_router
from app.routes.query import router as query_router
from app.routes.query_version import router as query_version_router
from app.routes.query_run import router as query_run_router
from app.routes.query_execution import router as query_execution_router
from app.routes.llm import router as llm_router
from app.routes.chat import router as chat_router
from app.routes.sse import router as sse_router, cleanup_sse_connections
from app.routes.worker import router as worker_router
from app.core.session_naming import start_session_naming, stop_session_naming
import logging

# Suppress APScheduler logs to reduce noise
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_session_naming()
    # redis_subscriber not needed - worker endpoints poll Redis directly
    yield
    # Shutdown - clean up connections first for faster reload
    cleanup_sse_connections()
    # TODO: stop workers only when not in development mode with hot reloading
    # stop_workers()
    stop_session_naming()


app = FastAPI(lifespan=lifespan)

# Add CORS middleware for SSE and cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://127.0.0.1:3000",  # Alternative localhost
        "http://0.0.0.0:3000",  # Docker internal
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
app.include_router(worker_router)
