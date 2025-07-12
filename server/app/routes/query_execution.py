from fastapi import APIRouter, HTTPException, Header, Depends
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session

from app.schemas.query_execute import CreateQueryRunRequest
from app.core.db import get_db
from app.core._redis import redis_client
from app.core.task_service import TaskService
from app.core.query_execution_service import QueryExecutionService
from app.core.results_streaming_service import ResultsStreamingService, StreamingQueryService


router = APIRouter(prefix="/execution", tags=["query-execution"])

# Initialize services
task_service = TaskService(redis_client)
query_execution_service = QueryExecutionService(task_service)
streaming_service = ResultsStreamingService(task_service, query_execution_service)
streaming_query_service = StreamingQueryService(
    task_service, query_execution_service, streaming_service
)


@router.post("/")
async def execute_query_version_run(
    request: CreateQueryRunRequest,
    client_id: Optional[str] = Header(None, alias="X-Client-ID"),
    db: Session = Depends(get_db),
):
    """Execute a query run with improved typed flow"""
    try:
        # Use new typed service for execution
        task_id = await streaming_query_service.execute_query_with_streaming(
            query_version_id=request.query_version_id,
            client_id=client_id or "default",
            db_session=db,
        )

        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Query execution queued successfully",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/cancel/{query_run_id}")
async def cancel_query_run_immediate(
    query_run_id: UUID,
    client_id: Optional[str] = Header(None, alias="X-Client-ID"),
    db: Session = Depends(get_db),
):
    """Cancel a query run with improved typed flow"""
    try:
        # Use new typed service for cancellation
        success = await streaming_query_service.cancel_query_with_streaming(
            query_run_id=query_run_id, client_id=client_id or "default", db_session=db
        )

        if success:
            return {
                "query_run_id": str(query_run_id),
                "status": "cancelled",
                "message": "Query cancellation requested",
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to cancel query")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
