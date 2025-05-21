from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.sources import router as sources_router
from app.routes.query import router as query_router
from app.controllers.start import ensure_user_and_workspace


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_user_and_workspace()
    yield


app = FastAPI(lifespan=lifespan)


app.include_router(sources_router)
app.include_router(query_router)
