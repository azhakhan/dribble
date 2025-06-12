from fastapi import APIRouter, HTTPException, Response
from app.controllers.query import execute_in_worker_version
from uuid import UUID
from app.core._redis import get_result
from app.schemas.query_execute import CreateQueryRunRequest
from app.controllers.query_service import QueryRunService, QueryVersionService
from app.schemas.query_execute import ExecuteQueryVersionRequest
from app.core.db import get_db
from app.models import Source, Query
from sqlalchemy.orm import Session
from fastapi import Depends
from app.core.db_utils import get_or_404


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
        return execute_in_worker_version(query_run_request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        if result.get("status") == "success":
            return result["data"] if result.get("data") else []
        else:
            response.status_code = 500
            return {"status": "error", "error": "Unknown error"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
