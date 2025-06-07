from sqlalchemy.orm import Session
from app.models import Query, QueryVersion, QueryRun
from app.core.db_utils import get_or_404, safe_create, safe_update, safe_delete
from app.schemas.query import CreateQueryRequest, UpdateQueryRequest
from uuid import UUID
from typing import List, Dict
from itertools import groupby


class QueryService:
    @staticmethod
    def get_all_queries_grouped_by_source(db: Session) -> Dict[UUID, List[Query]]:
        """Get all queries grouped by source_id"""
        queries = db.query(Query).order_by(Query.source_id).all()
        
        grouped_queries = {}
        for source_id, group in groupby(queries, lambda x: x.source_id):
            grouped_queries[source_id] = list(group)
        
        return grouped_queries
    
    @staticmethod
    def get_query_by_id(db: Session, query_id: UUID) -> Query:
        """Get a specific query by ID"""
        return get_or_404(db, Query, query_id, "Query not found")
    
    @staticmethod
    def create_query(db: Session, request: CreateQueryRequest, user_id: UUID) -> Query:
        """Create a new query"""
        query = Query(source_id=request.source_id, created_by=user_id)
        return safe_create(db, query)
    
    @staticmethod
    def update_query(db: Session, query_id: UUID, request: UpdateQueryRequest) -> Query:
        """Update a query"""
        query = get_or_404(db, Query, query_id, "Query not found")
        
        if request.name is not None:
            query.name = request.name
        
        return safe_update(db, query)
    
    @staticmethod
    def delete_query(db: Session, query_id: UUID) -> dict:
        """Delete a query"""
        query = get_or_404(db, Query, query_id, "Query not found")
        return safe_delete(db, query)


class QueryVersionService:
    @staticmethod
    def get_versions_by_query_id(db: Session, query_id: UUID) -> List[QueryVersion]:
        """Get all versions for a specific query"""
        get_or_404(db, Query, query_id, "Query not found")
        
        return (
            db.query(QueryVersion)
            .filter_by(query_id=query_id)
            .order_by(QueryVersion.created_at.desc())
            .all()
        )
    
    @staticmethod
    def get_latest_version_by_query_id(db: Session, query_id: UUID) -> QueryVersion:
        """Get the latest version for a specific query"""
        get_or_404(db, Query, query_id, "Query not found")
        
        return (
            db.query(QueryVersion)
            .filter_by(query_id=query_id)
            .order_by(QueryVersion.created_at.desc())
            .first()
        )
    
    @staticmethod
    def get_version_by_id(db: Session, version_id: UUID) -> QueryVersion:
        """Get a specific query version by ID"""
        return get_or_404(db, QueryVersion, version_id, "Query version not found")
    
    @staticmethod
    def create_version(db: Session, request) -> QueryVersion:
        """Create a new query version"""
        get_or_404(db, Query, request.query_id, "Parent query not found")
        
        version = QueryVersion(
            sql=request.sql,
            save_trigger=request.save_trigger,
            query_id=request.query_id,
            created_by=request.created_by,
        )
        return safe_create(db, version)
    
    @staticmethod
    def delete_version(db: Session, version_id: UUID) -> dict:
        """Delete a query version"""
        version = get_or_404(db, QueryVersion, version_id, "Query version not found")
        return safe_delete(db, version)


class QueryRunService:
    @staticmethod
    def get_runs_by_query_id(db: Session, query_id: UUID) -> List[QueryRun]:
        """Get all runs for a specific query"""
        get_or_404(db, Query, query_id, "Query not found")
        
        return (
            db.query(QueryRun)
            .filter_by(query_id=query_id)
            .order_by(QueryRun.created_at.desc())
            .all()
        )
    
    @staticmethod
    def get_runs_by_version_id(db: Session, version_id: UUID) -> List[QueryRun]:
        """Get all runs for a specific query version"""
        get_or_404(db, QueryVersion, version_id, "Query version not found")
        
        return (
            db.query(QueryRun)
            .filter_by(query_version_id=version_id)
            .order_by(QueryRun.created_at.desc())
            .all()
        )
    
    @staticmethod
    def get_run_by_id(db: Session, run_id: UUID) -> QueryRun:
        """Get a specific query run by ID"""
        return get_or_404(db, QueryRun, run_id, "Query run not found")
    
    @staticmethod
    def delete_run(db: Session, run_id: UUID) -> dict:
        """Delete a query run"""
        run = get_or_404(db, QueryRun, run_id, "Query run not found")
        return safe_delete(db, run)