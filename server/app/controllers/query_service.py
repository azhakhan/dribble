from sqlalchemy.orm import Session
from app.models import Query, QueryVersion, QueryRun
from app.core.db_utils import get_or_404, safe_create, safe_update, safe_delete
from app.schemas.query import (
    CreateQueryRequest,
    UpdateQueryRequest,
    CreateEphemeralQueryRequest,
    ConvertEphemeralQueryRequest,
)
from app.schemas.query_execute import QueryRunModifiers
from app.schemas.query_run import UpdateQueryRunRequest
from uuid import UUID
from typing import List, Dict
from itertools import groupby
from app.schemas.query_version import CreateQueryVersionRequest


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
        query = Query(
            source_id=request.source_id,
            created_by=user_id,
            is_ephemeral=request.is_ephemeral or False,
            preview_key=request.preview_key,
        )
        return safe_create(db, query)

    @staticmethod
    def update_query(db: Session, query_id: UUID, request: UpdateQueryRequest) -> Query:
        """Update a query"""
        query = get_or_404(db, Query, query_id, "Query not found")

        if request.name is not None:
            query.name = request.name

        if request.is_ephemeral is not None:
            query.is_ephemeral = request.is_ephemeral

        return safe_update(db, query)

    @staticmethod
    def delete_query(db: Session, query_id: UUID) -> dict:
        """Delete a query"""
        query = get_or_404(db, Query, query_id, "Query not found")
        return safe_delete(db, query)

    @staticmethod
    def get_or_create_ephemeral_query(
        db: Session, request: CreateEphemeralQueryRequest, user_id: UUID
    ) -> Query:
        """Get existing ephemeral query or create new one for table preview"""
        # Try to find existing ephemeral query
        existing_query = (
            db.query(Query)
            .filter(
                Query.source_id == request.source_id,
                Query.is_ephemeral == True,  # noqa: E712
                Query.preview_key == request.preview_key,
            )
            .first()
        )

        if existing_query:
            return existing_query

        # Create new ephemeral query
        query = Query(
            source_id=request.source_id,
            created_by=user_id,
            is_ephemeral=True,
            preview_key=request.preview_key,
        )
        query = safe_create(db, query)

        # Create initial version with SELECT * query
        # Extract table name from preview_key (format: "table-source_id.schema.table" or "view-source_id.schema.table")

        # New format: "table-source_id.schema.table" or "view-source_id.schema.table"
        _, rest = request.preview_key.split("-", 1)
        parts = rest.split(".")
        if len(parts) >= 3:
            schema = parts[-2]
            table = parts[-1]
            sql = f"SELECT * FROM {schema}.{table} LIMIT 101"
        else:
            # Fallback if format is unexpected
            sql = f"SELECT * FROM {rest} LIMIT 101"

        version_request = CreateQueryVersionRequest(
            sql=sql, save_trigger="manual", query_id=query.id, created_by=user_id
        )
        QueryVersionService.create_version(db, version_request)

        return query

    @staticmethod
    def convert_ephemeral_to_regular(
        db: Session, query_id: UUID, request: ConvertEphemeralQueryRequest
    ) -> Query:
        """Convert an ephemeral query to a regular query (idempotent)"""
        query = get_or_404(db, Query, query_id, "Query not found")

        # If already regular, just update the name and return
        if not query.is_ephemeral:
            if request.name and request.name != query.name:
                query.name = request.name
                return safe_update(db, query)
            return query

        # Update query to be regular
        query.is_ephemeral = False
        query.name = request.name
        # Keep preview_key for reference but it's no longer used for lookup

        return safe_update(db, query)


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
    def create_run(
        db: Session, query_version_id: UUID, modifiers: QueryRunModifiers, user_id: UUID
    ) -> QueryRun:
        """Create a new query run"""
        run = QueryRun(
            query_version_id=query_version_id,
            modifiers=modifiers.model_dump() if modifiers else None,
            created_by=user_id,
        )
        return safe_create(db, run)

    @staticmethod
    def update_run(db: Session, run_id: UUID, request: UpdateQueryRunRequest) -> QueryRun:
        """Update a query run"""
        query_run = get_or_404(db, QueryRun, run_id, "Query run not found")

        if request.result_message is not None:
            query_run.result_message = request.result_message
        if request.error_message is not None:
            query_run.error_message = request.error_message
        if request.row_count is not None:
            query_run.row_count = request.row_count
        if request.execution_time_ms is not None:
            query_run.execution_time_ms = request.execution_time_ms

        return safe_update(db, query_run)

    @staticmethod
    def get_runs_by_query_id(db: Session, query_id: UUID) -> List[QueryRun]:
        """Get all runs for a specific query"""
        get_or_404(db, Query, query_id, "Query not found")

        return (
            db.query(QueryRun)
            .join(QueryVersion, QueryRun.query_version_id == QueryVersion.id)
            .join(Query, QueryVersion.query_id == Query.id)
            .filter(Query.id == query_id)
            .order_by(QueryRun.created_at.desc())
            .all()
        )

    @staticmethod
    def get_runs_by_query_id_paginated(
        db: Session, query_id: UUID, page: int = 1, page_size: int = 25
    ) -> tuple[List[QueryRun], int]:
        """Get paginated runs for a specific query"""
        get_or_404(db, Query, query_id, "Query not found")

        # Get total count
        total_query = (
            db.query(QueryRun)
            .join(QueryVersion, QueryRun.query_version_id == QueryVersion.id)
            .join(Query, QueryVersion.query_id == Query.id)
            .filter(Query.id == query_id)
        )
        total = total_query.count()

        # Get paginated results
        offset = (page - 1) * page_size
        runs = (
            total_query.order_by(QueryRun.created_at.desc()).offset(offset).limit(page_size).all()
        )

        return runs, total

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
