from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import (
    CreateSourceRequest,
    UpdateCredentialsRequest,
    TestSourceRequest,
    RenameSourceRequest,
)
from app.controllers.sources import get_source_schema, invalidate_source_schema_cache
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from uuid import UUID
from app.core.spawn_worker import WorkerContainer, stop_worker
from app.schemas.sources import PostgresCreds
from uuid import uuid4
from app.models import Worker
from app.core.db_utils import get_or_404, safe_delete, get_all_active

router = APIRouter(prefix="/sources", tags=["sources"])


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


@router.post("/test/")
async def test(request: TestSourceRequest):
    try:
        source_id = str(uuid4())
        worker = WorkerContainer(source_id, request.creds)
        return worker.test()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/rename/{source_id}/")
async def rename_source(
    source_id: UUID,
    request: RenameSourceRequest,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")
    source.name = request.name
    db.commit()
    db.refresh(source)
    return source


# delete a source
@router.delete("/{source_id}/")
async def delete_source(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")
    return safe_delete(db, source)


@router.get("/connect/{source_id}")
async def connect(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")

    try:
        creds = PostgresCreds(**source.creds)
        worker = None

        try:
            worker = WorkerContainer(source.id, creds)
            container_exists = worker.already_exists()

            # Check if worker record exists in the database
            db_worker = db.query(Worker).filter_by(source_id=source_id).first()

            if not container_exists:
                # Container doesn't exist, start it and create worker record
                worker.start(db)
            else:
                # Container exists, ensure worker record exists and is up-to-date
                if not db_worker:
                    worker.save_worker(db)
                else:
                    # Update existing worker record with current container info
                    db_worker.container_id = worker.container_id
                    db_worker.port = worker.port
                    db_worker.host = worker.container_url
                    db_worker.status = "running"
                    db.commit()
                    db.refresh(db_worker)

        except Exception as e:
            # Clean up worker if it was created but failed
            if worker and worker.container_id:
                try:
                    worker.stop()
                except Exception:
                    pass  # Ignore cleanup errors
            raise HTTPException(status_code=500, detail=str(e)) from e

        # invalidate source schema cache to ensure fresh data after connection
        await invalidate_source_schema_cache(str(source_id))

        return {"message": "Connected"}

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        return await get_source_schema(str(source.id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# get all sources
@router.get("/")
async def get_sources(
    db: Session = Depends(get_db),
):
    # only return name and id
    sources = get_all_active(db, Source)
    return [{"id": source.id, "name": source.name, "dbtype": source.dbtype} for source in sources]


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


# add disconnect source
@router.delete("/disconnect/{source_id}")
async def disconnect_source(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    worker = db.query(Worker).filter_by(source_id=source_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # stop the worker
    stop_worker(worker.container_id)
    # delete the worker
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
    return creds


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
