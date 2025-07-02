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
from app.core.redis_subscriber import start_redis_subscriber, stop_redis_subscriber
import logging
import os


# Suppress APScheduler logs to reduce noise
logging.getLogger("apscheduler").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_session_naming()
    await start_redis_subscriber()
    yield
    # Shutdown - clean up connections first for faster reload
    cleanup_sse_connections()
    # TODO: stop workers only when not in development mode with hot reloading
    # stop_workers()
    stop_session_naming()
    await stop_redis_subscriber()


app = FastAPI(lifespan=lifespan)


# Get allowed origins from environment or use defaults
allowed_origins = ["http://localhost:3000"]  # Default for development

# If running on Fly.io, get the client URL from environment
if os.getenv("FLY_APP_NAME"):  # Running on Fly.io
    client_url = os.getenv("CLIENT_URL")
    if client_url:
        allowed_origins = [
            client_url,
            "http://localhost:3000",  # Keep localhost for local testing
        ]
    else:
        # Fallback: derive from server app name if CLIENT_URL not set
        server_app_name = os.getenv("FLY_APP_NAME")
        if server_app_name and server_app_name.endswith("-server"):
            client_app_name = server_app_name.replace("-server", "-client")
            allowed_origins = [f"https://{client_app_name}.fly.dev", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
