from fastapi import APIRouter, HTTPException, Depends, Response
from app.schemas.query import (
    ExecuteQueryRequest,
    CreateQueryRequest,
    UpdateQueryRequest,
    CreateQueryVersionRequest,
    QueryVersionResponse,
    QueryRunResponse,
    QueryResponse,
)
from app.controllers.query import execute_in_worker
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Query, QueryVersion, QueryRun
from uuid import UUID
from app.core._redis import get_result
from typing import List
from app.dependencies import get_current_user

router = APIRouter(prefix="/query", tags=["query"])


# ==================== QUERY ENDPOINTS ====================


@router.get("/", response_model=List[QueryResponse])
async def get_all_queries(db: Session = Depends(get_db)):
    """Get all queries"""
    # TODO: add limit by workspace_id?
    queries = db.query(Query).all()
    return queries


@router.get("/{query_id}", response_model=QueryResponse)
async def get_query_by_id(query_id: UUID, db: Session = Depends(get_db)):
    """Get a specific query by ID"""
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    return query


@router.post("/", response_model=QueryResponse)
async def create_query(
    request: CreateQueryRequest, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    """Create a new query"""
    query = Query(source_id=request.source_id, created_by=user.id)
    db.add(query)
    db.commit()
    db.refresh(query)
    return query


@router.put("/{query_id}", response_model=QueryResponse)
async def update_query(query_id: UUID, request: UpdateQueryRequest, db: Session = Depends(get_db)):
    """Update a query"""
    # TODO: save who updated the query
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    if request.name is not None:
        query.name = request.name
    db.commit()
    db.refresh(query)
    return query


@router.delete("/{query_id}")
async def delete_query(query_id: UUID, db: Session = Depends(get_db)):
    """Delete a query"""
    # TODO: check if user has permission to delete the query
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    db.delete(query)
    db.commit()
    return {"message": "Query deleted successfully"}


# ==================== QUERY VERSION ENDPOINTS ====================


@router.get("/{query_id}/versions/", response_model=List[QueryVersionResponse])
async def get_query_versions_by_query_id(query_id: UUID, db: Session = Depends(get_db)):
    """Get all versions for a specific query"""
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    versions = (
        db.query(QueryVersion)
        .filter_by(query_id=query_id)
        .order_by(QueryVersion.created_at.desc())
        .all()
    )
    return versions


@router.get("/{query_id}/versions/latest", response_model=QueryVersionResponse)
async def get_latest_query_version(query_id: UUID, db: Session = Depends(get_db)):
    """Get the latest version for a specific query"""
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    latest_version = (
        db.query(QueryVersion)
        .filter_by(query_id=query_id)
        .order_by(QueryVersion.created_at.desc())
        .first()
    )

    return latest_version  # Will be None if no versions exist


@router.get("/versions/{version_id}", response_model=QueryVersionResponse)
async def get_query_version_by_id(version_id: UUID, db: Session = Depends(get_db)):
    """Get a specific query version by ID"""
    version = db.query(QueryVersion).filter_by(id=version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Query version not found")
    return version


@router.post("/versions/", response_model=QueryVersionResponse)
async def create_query_version(request: CreateQueryVersionRequest, db: Session = Depends(get_db)):
    """Create a new query version"""
    # Check if the parent query exists
    query = db.query(Query).filter_by(id=request.query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Parent query not found")

    version = QueryVersion(
        sql=request.sql,
        save_trigger=request.save_trigger,
        query_id=request.query_id,
        created_by=request.created_by,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.delete("/versions/{version_id}")
async def delete_query_version(version_id: UUID, db: Session = Depends(get_db)):
    """Delete a query version"""
    version = db.query(QueryVersion).filter_by(id=version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Query version not found")

    db.delete(version)
    db.commit()
    return {"message": "Query version deleted successfully"}


# ==================== QUERY RUN ENDPOINTS ====================


@router.get("/runs/query/{query_id}", response_model=List[QueryRunResponse])
async def get_all_query_runs(query_id: UUID, db: Session = Depends(get_db)):
    """Get all query runs"""
    query = db.query(Query).filter_by(id=query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    runs = (
        db.query(QueryRun).filter_by(query_id=query_id).order_by(QueryRun.created_at.desc()).all()
    )
    return runs


@router.get("/runs/version/{version_id}", response_model=List[QueryRunResponse])
async def get_query_runs_by_version_id(version_id: UUID, db: Session = Depends(get_db)):
    """Get all runs for a specific query version"""
    version = db.query(QueryVersion).filter_by(id=version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Query version not found")

    runs = (
        db.query(QueryRun)
        .filter_by(query_version_id=version_id)
        .order_by(QueryRun.created_at.desc())
        .all()
    )
    return runs


@router.get("/runs/run/{run_id}", response_model=QueryRunResponse)
async def get_query_run_by_id(run_id: UUID, db: Session = Depends(get_db)):
    """Get a specific query run by ID"""
    run = db.query(QueryRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Query run not found")
    return run


@router.delete("/runs/{run_id}")
async def delete_query_run(run_id: UUID, db: Session = Depends(get_db)):
    """Delete a query run"""
    run = db.query(QueryRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Query run not found")

    db.delete(run)
    db.commit()
    return {"message": "Query run deleted successfully"}


# ==================== EXECUTION ENDPOINTS ====================


@router.post("/execute/")
async def execute_query_string(request: ExecuteQueryRequest):
    """Execute a query string directly"""
    try:
        return execute_in_worker(request.source_id, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/results/{query_id}/")
async def get_query_results(query_id: UUID, response: Response):
    """Get query execution results"""
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
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
