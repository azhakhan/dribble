from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.sources import router as sources_router
from app.routes.query import router as query_router
from app.controllers.start import ensure_user_and_workspace
from app.core.worker_health_check import start_health_check, stop_health_check


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_user_and_workspace()
    start_health_check()
    yield
    stop_health_check()


app = FastAPI(lifespan=lifespan)


app.include_router(sources_router)
app.include_router(query_router)
