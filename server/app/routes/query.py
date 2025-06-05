from fastapi import APIRouter, HTTPException, Depends, Response
from app.schemas.query import (
    ExecuteQueryRequest,
    CreateQueryRequest,
    UpdateQueryRequest,
)
from app.controllers.query import execute_in_worker
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Query
from uuid import UUID
from app.core._redis import get_result

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
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/{query_id}")
async def update(query_id: UUID, request: UpdateQueryRequest, db: Session = Depends(get_db)):
    # Check if query exists first
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    try:
        # update query
        query.name = request.name if request.name else query.name
        query.query = request.query if request.query else query.query
        db.commit()
        db.refresh(query)
        return query
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/{query_id}")
async def delete(query_id: UUID, db: Session = Depends(get_db)):
    # Check if query exists first
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    try:
        db.delete(query)
        db.commit()
        return {"message": "Query deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/execute/")
async def execute_query_string(request: ExecuteQueryRequest):
    try:
        return execute_in_worker(request.source_id, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/{query_id}/execute/")
async def execute_query_id(query_id: UUID, db: Session = Depends(get_db)):
    try:
        query = db.query(Query).filter_by(id=query_id).first()
        execute_in_worker(query.source_id, query.query, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/results/{query_id}/")
async def get_query_results(query_id: UUID, response: Response):
    try:
        # check for results in redis
        result = await get_result(query_id)
        if not result:
            raise HTTPException(status_code=404, detail="Query results not found")
        if result.get("status") == "running":
            response.status_code = 202
            return {"status": "running"}
        if result.get("status") == "error":
            response.status_code = 500
            return {"status": "error", "error": result["error"]}
        if result.get("status") == "success":
            return result["data"] if result.get("data") else []
        else:
            response.status_code = 500
            return {"status": "error", "error": "Unknown error"}
    except HTTPException:
        # Re-raise HTTPExceptions (like 404) without converting to 500
        raise
    except Exception as e:
        # Only catch non-HTTP exceptions and convert to 500
        raise HTTPException(status_code=500, detail=str(e)) from e
