from fastapi import APIRouter, Depends
from app.schemas.sources import CreateSourceRequest, UpdateCredentialsRequest, RenameSourceRequest
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from uuid import UUID
from app.core._redis import redis_client
from app.core.task_service import TaskService
from app.core.task_types import TaskType
from app.core.db_utils import get_or_404, safe_delete, get_all_active

router = APIRouter(prefix="/sources", tags=["sources"])

# Initialize TaskService
task_service = TaskService(redis_client)


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

    # Create a proper typed task for disconnection
    disconnect_task = task_service.create_source_connect_task(
        source_id=str(source_id), connection_params={"action": "disconnect"}
    )
    disconnect_task.task_type = TaskType.SOURCE_CONNECT  # Override to indicate disconnection

    # Submit the task
    await task_service.submit_task(disconnect_task, "default_queue")

    safe_delete(db, source)
    return {"message": "Source deleted"}
