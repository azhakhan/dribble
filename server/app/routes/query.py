from fastapi import APIRouter, HTTPException, Depends
from app.schemas.query import ExecuteQueryRequest, CreateQueryRequest, UpdateQueryRequest
from app.controllers.query import execute_query
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Query, Source
from uuid import UUID


router = APIRouter(prefix="/query", tags=["query"])


@router.post("/")
async def query(request: CreateQueryRequest, db: Session = Depends(get_db)):
    try:
        # create query
        query = Query(name=request.name, query=request.query, source_id=request.database_id)
        db.add(query)
        db.commit()
        db.refresh(query)
        return query
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{query_id}")
async def update(query_id: UUID, request: UpdateQueryRequest, db: Session = Depends(get_db)):
    try:
        # update query
        query = db.query(Query).filter_by(id=query_id).first()
        if not query:
            raise HTTPException(status_code=404, detail="Query not found")
        query.name = request.name if request.name else query.name
        query.query = request.query if request.query else query.query
        db.commit()
        db.refresh(query)
        return query
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{query_id}")
async def delete(query_id: UUID, db: Session = Depends(get_db)):
    try:
        query = db.query(Query).filter_by(id=query_id).first()
        if not query:
            raise HTTPException(status_code=404, detail="Query not found")
        db.delete(query)
        db.commit()
        return {"message": "Query deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute/")
async def execute_query_string(request: ExecuteQueryRequest, db: Session = Depends(get_db)):
    try:
        source = db.query(Source).filter_by(id=request.database_id).first()
        if not source:
            raise Exception("Source not found")
        return execute_query(source, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{query_id}/execute/")
async def execute_query_id(query_id: UUID, db: Session = Depends(get_db)):
    try:
        query = db.query(Query).filter_by(id=query_id).first()
        if not query:
            raise Exception("Query not found")
        source = db.query(Source).filter_by(id=query.source_id).first()
        if not source:
            raise Exception("Source not found")
        return execute_query(source, query.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
