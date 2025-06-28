from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import (
    CreateSourceRequest,
    UpdateCredentialsRequest,
    TestSourceRequest,
    RenameSourceRequest,
    PostgresCreds,
    MysqlCreds,
)
from app.controllers.sources import get_source_schema, invalidate_source_schema_cache
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from uuid import UUID
from app.core._redis import submit_test_db_task, submit_connect_task
from app.core.db_utils import get_or_404, safe_delete, get_all_active
from pydantic import BaseModel

router = APIRouter(prefix="/sources", tags=["sources"])


class UpdateWorkerStatusRequest(BaseModel):
    task_id: str
    status: str  # "success" or "error"
    error_message: str = None


# add a source
@router.post("/")
async def add_source(request: CreateSourceRequest, db: Session = Depends(get_db)):
    source = Source(
        name=request.name,
        dbtype=request.dbtype,
        creds=request.creds.model_dump(),
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


# get all sources
@router.get("/")
async def get_sources(db: Session = Depends(get_db)):
    sources = get_all_active(db, Source)
    return sources


@router.put("/rename/{source_id}/")
async def rename_source(
    source_id: UUID,
    request: RenameSourceRequest,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id)

    source.name = request.name
    db.commit()
    db.refresh(source)

    return source


@router.get("/credentials/{source_id}/")
async def get_credentials(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")
    # Remove sensitive data before returning
    creds = source.creds.copy()
    if "password" in creds:
        creds["password"] = "***"
    return {"name": source.name, "dbtype": source.dbtype, "creds": creds}


@router.put("/credentials/{source_id}/")
async def edit_source(
    source_id: UUID,
    request: UpdateCredentialsRequest,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")
    source.creds = request.creds.model_dump()
    db.commit()
    db.refresh(source)
    return source


@router.delete("/{source_id}/")
async def delete_source(source_id: UUID, db: Session = Depends(get_db)):
    source = get_or_404(db, Source, source_id)

    # TODO: remove source connections in worker

    # Invalidate the schema cache for this source
    invalidate_source_schema_cache(source_id)

    # Delete the source using soft delete
    safe_delete(db, source)

    return {"message": "Source deleted"}


# worker related endpoints
@router.post("/test_db/")
async def test_db(request: TestSourceRequest):
    try:
        # Submit test task to Redis queue and return task ID
        task_id = await submit_test_db_task(
            db_type=request.dbtype, creds=request.creds.model_dump()
        )

        return {"task_id": task_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# get schema for a source
@router.get("/schemas/{source_id}")
async def get_schemas(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")

    try:
        return await get_source_schema(str(source.id), db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/connect/{source_id}")
async def connect(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")

    try:
        # Parse credentials based on database type
        if source.dbtype == "postgres":
            creds = PostgresCreds(**source.creds)
        elif source.dbtype == "mysql":
            creds = MysqlCreds(**source.creds)
        else:
            raise ValueError(f"Unsupported database type: {source.dbtype}")

        # Submit connect task to Redis queue
        task_id = await submit_connect_task(
            source_id=str(source_id), db_type=source.dbtype, creds=creds.model_dump(), role="reader"
        )

        return {"task_id": task_id}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/connected/")
async def get_connected_sources():
    # TODO: get all connected sources
    return []


@router.delete("/disconnect/{source_id}")
async def disconnect_source(source_id: UUID):
    # TODO: disconnect source in worker
    return {"message": "Disconnected"}
