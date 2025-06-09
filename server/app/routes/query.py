from fastapi import APIRouter, Depends
from app.schemas.query import (
    CreateQueryRequest,
    UpdateQueryRequest,
    QueryResponse,
    CreateEphemeralQueryRequest,
    ConvertEphemeralQueryRequest,
)
from app.core.db import get_db
from app.controllers.query_service import QueryService
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Dict
from app.dependencies import get_current_user

router = APIRouter(prefix="/query", tags=["query"])


@router.get("/", response_model=Dict[UUID, List[QueryResponse]])
async def get_all_queries(db: Session = Depends(get_db)):
    """Get all queries grouped by source_id"""
    return QueryService.get_all_queries_grouped_by_source(db)


@router.get("/{query_id}", response_model=QueryResponse)
async def get_query_by_id(query_id: UUID, db: Session = Depends(get_db)):
    """Get a specific query by ID"""
    return QueryService.get_query_by_id(db, query_id)


@router.post("/", response_model=QueryResponse)
async def create_query(
    request: CreateQueryRequest, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    """Create a new query"""
    return QueryService.create_query(db, request, user.id)


@router.post("/ephemeral", response_model=QueryResponse)
async def get_or_create_ephemeral_query(
    request: CreateEphemeralQueryRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get existing ephemeral query or create new one for table preview"""
    return QueryService.get_or_create_ephemeral_query(db, request, user.id)


@router.put("/{query_id}", response_model=QueryResponse)
async def update_query(query_id: UUID, request: UpdateQueryRequest, db: Session = Depends(get_db)):
    """Update a query"""
    # TODO: save who updated the query
    return QueryService.update_query(db, query_id, request)


@router.put("/{query_id}/convert", response_model=QueryResponse)
async def convert_ephemeral_to_regular(
    query_id: UUID, request: ConvertEphemeralQueryRequest, db: Session = Depends(get_db)
):
    """Convert an ephemeral query to a regular query"""
    return QueryService.convert_ephemeral_to_regular(db, query_id, request)


@router.delete("/{query_id}")
async def delete_query(query_id: UUID, db: Session = Depends(get_db)):
    """Delete a query"""
    # TODO: check if user has permission to delete the query
    return QueryService.delete_query(db, query_id)
