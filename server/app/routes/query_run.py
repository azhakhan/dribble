from fastapi import APIRouter, Depends, Query as FastAPIQuery
from app.schemas.query_run import (
    QueryRunResponse,
    UpdateQueryRunRequest,
    QueryRunsPaginatedResponse,
)
from app.core.db import get_db
from app.controllers.query_service import QueryRunService
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
import math

router = APIRouter(prefix="/runs", tags=["query-runs"])


@router.get("/query/{query_id}", response_model=QueryRunsPaginatedResponse)
async def get_all_query_runs(
    query_id: UUID,
    page: int = FastAPIQuery(1, ge=1, description="Page number"),
    page_size: int = FastAPIQuery(25, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """Get paginated query runs"""
    runs, total = QueryRunService.get_runs_by_query_id_paginated(db, query_id, page, page_size)

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return QueryRunsPaginatedResponse(
        items=runs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


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
