from fastapi import APIRouter, HTTPException, Response
from app.schemas.query import ExecuteQueryRequest
from app.controllers.query import execute_in_worker
from uuid import UUID
from app.core._redis import get_result

router = APIRouter(prefix="/execution", tags=["query-execution"])


@router.post("/")
async def execute_query_string(request: ExecuteQueryRequest):
    """Execute a query string directly"""
    try:
        return execute_in_worker(request.source_id, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/results/{query_id}")
async def get_query_results(query_id: UUID, response: Response):
    """Get query execution results"""
    try:
        # check for results in redis
        result = await get_result(query_id)
        if not result:
            raise HTTPException(status_code=404, detail="Query results not found")
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