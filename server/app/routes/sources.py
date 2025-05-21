from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import CreateSourceRequest, UpdateSourceRequest, DeleteSourceRequest
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source

router = APIRouter(prefix="/sources", tags=["sources"])


# add a source
@router.post("/")
async def add_source(request: CreateSourceRequest, db: Session = Depends(get_db)):
    db.add(Source(name=request.name, dbtype=request.dbtype, creds=request.creds))
    db.commit()
    db.refresh(db.query(Source).filter_by(name=request.name).first())
    return db.query(Source).filter_by(name=request.name).first()


# edit a source
# delete a source
# get all sources
# get a source by id
