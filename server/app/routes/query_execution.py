from fastapi import APIRouter, HTTPException, Response
from app.controllers.query import (
    execute_in_worker_version,
    cancel_query_in_worker,
    cancel_query_in_worker_async,
)
from uuid import UUID
from app.core._redis import get_result
from app.schemas.query_execute import CreateQueryRunRequest
from app.controllers.query_service import QueryRunService, QueryVersionService
from app.schemas.query_execute import ExecuteQueryVersionRequest
from app.core.db import get_db
from app.models import Source, Query, QueryRun
from sqlalchemy.orm import Session
from fastapi import Depends
from app.core.db_utils import get_or_404
from datetime import datetime
import asyncio
import requests
from app.schemas.query_run import UpdateQueryRunRequest
from app.controllers.query import publish_cancellation_result


router = APIRouter(prefix="/execution", tags=["query-execution"])


@router.post("/version")
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

    # Cancel any existing running query runs for this query
    existing_runs = QueryRunService.get_running_runs_for_query(db, query.id)
    for existing_run in existing_runs:
        try:
            cancel_query_in_worker(existing_run.id, query.source_id, db)
        except Exception:
            # If cancellation fails, continue anyway - the new run will take precedence
            pass

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
        return execute_in_worker_version(query_run_request, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/cancel/{query_run_id}")
async def cancel_query_run(
    query_run_id: UUID,
    db: Session = Depends(get_db),
):
    """Cancel a running query by query_run_id"""
    try:
        # Get the query run to find the source
        query_run = get_or_404(db, QueryRun, query_run_id, "Query run not found")

        # Get the query version to get the query
        version = QueryVersionService.get_version_by_id(db, query_run.query_version_id)
        query = get_or_404(db, Query, version.query_id, "Query not found")

        # Cancel the query in the worker using async version for better timeout handling
        result = await cancel_query_in_worker_async(query_run_id, query.source_id, db)

        # Handle the case where cancellation was requested but timed out
        if result.get("status") == "cancellation_requested":
            # Return success with a message indicating the request was sent
            return {
                "query_run_id": str(query_run_id),
                "status": "requested",
                "message": "Cancellation request sent - query should stop soon",
            }

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/cancel-immediate/{query_run_id}")
async def cancel_query_run_immediate(
    query_run_id: UUID,
    db: Session = Depends(get_db),
):
    """Immediately mark a query run as cancelled without waiting for worker response"""
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
        _ = QueryRunService.update_run(db, query_run_id, update_request)

        # Try to send cancellation to worker but don't wait for response
        # This is fire-and-forget to let worker know it can stop processing
        try:
            source = get_or_404(db, Source, query.source_id, "Source not found")
            container_name = f"dribble-worker-{source.dbtype}-{query.source_id}"
            asyncio.create_task(
                asyncio.wait_for(
                    asyncio.to_thread(
                        lambda: requests.post(
                            f"http://{container_name}:8000/cancel/{query_run_id}", timeout=1
                        )
                    ),
                    timeout=1.5,
                )
            )
        except Exception:
            # Ignore worker communication errors - cancellation is already marked in DB
            pass

        # Publish cancellation result to SSE
        await publish_cancellation_result(
            str(query_run_id), str(query.id), "Query execution was cancelled by user"
        )

        return {
            "query_run_id": str(query_run_id),
            "status": "cancelled",
            "execution_time_ms": execution_time_ms,
            "message": "Query marked as cancelled",
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/run-results/{run_id}")
async def get_query_run_results(run_id: UUID, response: Response):
    """Get query run execution results"""
    try:
        # check for results in redis using run_id
        result = await get_result(run_id)
        if not result:
            raise HTTPException(status_code=404, detail="Query run results not found")
        if result.get("status") == "running":
            response.status_code = 202
            return {"status": "running"}
        if result.get("status") == "error":
            response.status_code = 500
            return {"status": "error", "error": result["error"]}
        if result.get("status") == "cancelled":
            response.status_code = 409  # Conflict status for cancelled
            return {"status": "cancelled", "error": result.get("error", "Query was cancelled")}
        if result.get("status") == "success":
            return result["data"] if result.get("data") else []
        else:
            response.status_code = 500
            return {"status": "error", "error": "Unknown error"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
