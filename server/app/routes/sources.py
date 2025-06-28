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
from app.models import Worker
from app.core.db_utils import get_or_404, safe_delete, get_all_active
from pydantic import BaseModel

router = APIRouter(prefix="/sources", tags=["sources"])


class UpdateWorkerStatusRequest(BaseModel):
    task_id: str
    status: str  # "success" or "error"
    error_message: str = None


# add a source
@router.post("/")
async def add_source(
    request: CreateSourceRequest,
    db: Session = Depends(get_db),
):
    source = Source(
        name=request.name,
        dbtype=request.dbtype,
        creds=request.creds.model_dump(),
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


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


# get all sources
@router.get("/")
async def get_sources(db: Session = Depends(get_db)):
    sources = get_all_active(db, Source)
    return sources


@router.get("/connected/")
async def get_connected_sources(
    db: Session = Depends(get_db),
):
    # get all workers that are running, starting, or healthy
    workers = (
        db.query(Worker)
        .filter(
            Worker.status.in_(["healthy", "running", "starting"]),
        )
        .all()
    )
    return [{"id": worker.source_id, "source_id": worker.source_id} for worker in workers]


# get a specific source
@router.get("/{source_id}/")
async def get_source(source_id: UUID, db: Session = Depends(get_db)):
    source = get_or_404(db, Source, source_id)
    return source


# update source credentials
@router.put("/{source_id}/")
async def update_source_credentials(
    source_id: UUID,
    request: UpdateCredentialsRequest,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id)

    if request.creds:
        source.creds = request.creds.model_dump()

    db.commit()
    db.refresh(source)

    # Invalidate the schema cache for this source
    invalidate_source_schema_cache(source_id)

    return source


# rename source
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


# get schema for a source
@router.get("/{source_id}/schema/")
async def get_schema(source_id: UUID, db: Session = Depends(get_db)):
    return await get_source_schema(str(source_id), db)


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

        # Check if worker connection already exists
        db_worker = db.query(Worker).filter_by(source_id=source_id).first()

        if db_worker and db_worker.status in ["healthy", "running"]:
            # Connection already exists and is healthy
            await invalidate_source_schema_cache(str(source_id))
            return {"message": "Already connected", "status": "connected"}

        # Submit connect task to Redis queue
        task_id = await submit_connect_task(
            source_id=str(source_id), db_type=source.dbtype, creds=creds.model_dump(), role="reader"
        )

        # Create or update worker record with "connecting" status
        if db_worker:
            db_worker.status = "connecting"
            db_worker.container_id = None  # No container for Redis workers
            db_worker.port = None
            db_worker.host = f"redis-worker-{source_id}"
            db.commit()
            db.refresh(db_worker)
        else:
            worker = Worker(
                source_id=source_id,
                container_id=None,  # No container for Redis workers
                port=None,
                host=f"redis-worker-{source_id}",
                status="connecting",
            )
            db.add(worker)
            db.commit()
            db.refresh(worker)

        return {"task_id": task_id}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# delete a source
@router.delete("/{source_id}/")
async def delete_source(source_id: UUID, db: Session = Depends(get_db)):
    source = get_or_404(db, Source, source_id)

    # Clean up any workers for this source
    workers = db.query(Worker).filter_by(source_id=source_id).all()
    for worker in workers:
        # For Redis workers, connections will be cleaned up automatically
        # No need to stop containers since Redis workers manage connections internally

        # Remove worker from database
        db.delete(worker)

    # Invalidate the schema cache for this source
    invalidate_source_schema_cache(source_id)

    # Delete the source using soft delete
    safe_delete(db, source)

    return {"message": "Source deleted"}


@router.get("/status/{source_id}")
async def get_status(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    worker = db.query(Worker).filter_by(source_id=source_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"status": worker.status}


@router.get("/schemas/{source_id}")
async def get_schemas(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")

    # Check if there's already a connected worker for this source
    db_worker = db.query(Worker).filter_by(source_id=source_id).first()
    if not db_worker:
        raise HTTPException(status_code=400, detail="Source is not connected")

    try:
        return await get_source_schema(str(source.id), db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# add disconnect source
@router.delete("/disconnect/{source_id}")
async def disconnect_source(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    worker = db.query(Worker).filter_by(source_id=source_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # For Redis workers, we just need to clean up the connection pool
    # The worker will handle connection cleanup automatically
    # No need to stop containers since Redis workers manage connections internally

    # Delete the worker record
    db.delete(worker)
    db.commit()
    return {"message": "Disconnected"}


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
