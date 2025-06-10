from fastapi import APIRouter, Depends
from app.schemas.query_run import QueryRunResponse, UpdateQueryRunRequest
from app.core.db import get_db
from app.controllers.query_service import QueryRunService
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

router = APIRouter(prefix="/runs", tags=["query-runs"])


@router.get("/query/{query_id}", response_model=List[QueryRunResponse])
async def get_all_query_runs(query_id: UUID, db: Session = Depends(get_db)):
    """Get all query runs"""
    return QueryRunService.get_runs_by_query_id(db, query_id)


@router.get("/version/{version_id}", response_model=List[QueryRunResponse])
async def get_query_runs_by_version_id(version_id: UUID, db: Session = Depends(get_db)):
    """Get all runs for a specific query version"""
    return QueryRunService.get_runs_by_version_id(db, version_id)


@router.get("/{run_id}", response_model=QueryRunResponse)
async def get_query_run_by_id(run_id: UUID, db: Session = Depends(get_db)):
    """Get a specific query run by ID"""
    return QueryRunService.get_run_by_id(db, run_id)


@router.delete("/{run_id}")
async def delete_query_run(run_id: UUID, db: Session = Depends(get_db)):
    """Delete a query run"""
    return QueryRunService.delete_run(db, run_id)


# called by worker
@router.put("/{run_id}")
async def update_query_run(run_id: UUID, run: UpdateQueryRunRequest, db: Session = Depends(get_db)):
    """Update a query run"""
    return QueryRunService.update_run(db, run_id, run)
