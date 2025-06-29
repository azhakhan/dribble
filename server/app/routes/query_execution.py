from fastapi import APIRouter, HTTPException
from app.controllers.query import (
    execute_in_worker_version,
    cancel_query_in_worker,
)
from uuid import UUID
from app.schemas.query_execute import CreateQueryRunRequest
from app.controllers.query_service import QueryRunService, QueryVersionService
from app.schemas.query_execute import ExecuteQueryVersionRequest
from app.core.db import get_db
from app.models import Source, Query, QueryRun
from sqlalchemy.orm import Session
from fastapi import Depends
from app.core.db_utils import get_or_404
from datetime import datetime
from app.schemas.query_run import UpdateQueryRunRequest
from app.controllers.query import publish_cancellation_result


router = APIRouter(prefix="/execution", tags=["query-execution"])


@router.post("/")
async def execute_query_version_run(
    request: CreateQueryRunRequest,
    db: Session = Depends(get_db),
):
    # get version
    version = QueryVersionService.get_version_by_id(db, request.query_version_id)

    # check if version is a select query
    query = get_or_404(db, Query, version.query_id, "Query not found")

    # check if source exists
    get_or_404(db, Source, query.source_id, "Source not found")

    # create a run
    run = QueryRunService.create_run(db, request.query_version_id, request.modifiers)

    """Execute a query run"""
    try:
        query_run_request = ExecuteQueryVersionRequest(
            query_run_id=run.id,
            source_id=query.source_id,
            sql=version.sql,
            modifiers=request.modifiers,
        )
        return await execute_in_worker_version(query_run_request, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/cancel/{query_run_id}")
async def cancel_query_run_immediate(
    query_run_id: UUID,
    db: Session = Depends(get_db),
):
    """Immediately mark a query run as cancelled and submit cancellation task to worker"""
    try:
        # Get the query run
        query_run = get_or_404(db, QueryRun, query_run_id, "Query run not found")

        # Get the query version to get the query and source
        version = QueryVersionService.get_version_by_id(db, query_run.query_version_id)
        query = get_or_404(db, Query, version.query_id, "Query not found")

        # Calculate execution time from creation until now
        execution_time_ms = int((datetime.now() - query_run.created_at).total_seconds() * 1000)

        # Update query run as cancelled in database
        update_request = UpdateQueryRunRequest(
            error_message="Query execution was cancelled by user",
            execution_time_ms=execution_time_ms,
        )
        QueryRunService.update_run(db, query_run_id, update_request)

        # Submit cancellation task to Redis worker
        try:
            result = await cancel_query_in_worker(query_run_id, query.source_id, db)
            cancel_task_id = result.get("task_id")
        except Exception:
            # Continue even if worker cancellation fails
            cancel_task_id = None

        # Publish cancellation result to SSE
        await publish_cancellation_result(
            str(query_run_id), str(query.id), "Query execution was cancelled by user"
        )

        return {
            "query_run_id": str(query_run_id),
            "status": "cancelled",
            "execution_time_ms": execution_time_ms,
            "message": "Query marked as cancelled",
            "cancel_task_id": cancel_task_id,
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
