from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import CreateSourceRequest, UpdateSourceRequest, DeleteSourceRequest
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from app.dependencies import get_current_workspace
from uuid import UUID
from app.controllers.sources import get_source_schemas


router = APIRouter(prefix="/sources", tags=["sources"])


# add a source
@router.post("/")
async def add_source(
    request: CreateSourceRequest,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    # convert creds to dict
    creds = request.creds.model_dump()
    db.add(Source(name=request.name, dbtype=request.dbtype, creds=creds, workspace_id=workspace.id))
    db.commit()
    db.refresh(db.query(Source).filter_by(name=request.name).first())
    return db.query(Source).filter_by(name=request.name).first()


# edit a source
@router.put("/{source_id}")
async def edit_source(
    source_id: UUID,
    request: UpdateSourceRequest,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    source.name = request.name if request.name else source.name
    source.dbtype = request.dbtype if request.dbtype else source.dbtype
    source.creds = request.creds if request.creds else source.creds

    db.commit()
    db.refresh(source)
    return source


# delete a source
@router.delete("/{source_id}")
async def delete_source(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"message": "Source deleted"}


@router.get("/schemas/{source_id}")
async def get_schemas(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return get_source_schemas(source)


# get all sources
@router.get("/")
async def get_sources(
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    # only return name and id
    sources = db.query(Source).filter_by(workspace_id=workspace.id).all()
    return [{"id": source.id, "name": source.name, "dbtype": source.dbtype} for source in sources]


# get a source by id
