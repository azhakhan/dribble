from fastapi import APIRouter, Depends
from app.schemas.query_version import QueryVersionResponse, CreateQueryVersionRequest
from app.core.db import get_db
from app.controllers.query_service import QueryVersionService
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

router = APIRouter(prefix="/versions", tags=["query-versions"])


@router.get("/query/{query_id}/", response_model=List[QueryVersionResponse])
async def get_query_versions_by_query_id(query_id: UUID, db: Session = Depends(get_db)):
    """Get all versions for a specific query"""
    return QueryVersionService.get_versions_by_query_id(db, query_id)


@router.get("/query/{query_id}/latest", response_model=Optional[QueryVersionResponse])
async def get_latest_query_version(query_id: UUID, db: Session = Depends(get_db)):
    """Get the latest version for a specific query"""
    return QueryVersionService.get_latest_version_by_query_id(db, query_id)


@router.get("/{version_id}", response_model=QueryVersionResponse)
async def get_query_version_by_id(version_id: UUID, db: Session = Depends(get_db)):
    """Get a specific query version by ID"""
    return QueryVersionService.get_version_by_id(db, version_id)


@router.post("/", response_model=QueryVersionResponse)
async def create_query_version(request: CreateQueryVersionRequest, db: Session = Depends(get_db)):
    """Create a new query version"""
    return QueryVersionService.create_version(db, request)


@router.delete("/{version_id}")
async def delete_query_version(version_id: UUID, db: Session = Depends(get_db)):
    """Delete a query version"""
    return QueryVersionService.delete_version(db, version_id)
