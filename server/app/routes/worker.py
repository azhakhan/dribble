from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import PostgresCreds, MysqlCreds
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from uuid import UUID
from app.core.db_utils import get_or_404
from app.core._redis import redis_client
from app.core.task_service import TaskService
import asyncio
import logging
from typing import Dict, Any
import json
from uuid import uuid4

from app.schemas.worker import TestDBTask

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/worker", tags=["worker"])

# Initialize TaskService
task_service = TaskService(redis_client)


async def submit_and_wait_for_task(
    task_data: Dict[str, Any], max_wait_time: int = 30, return_data_only: bool = False
) -> Dict[str, Any]:
    """
    Submit a task to the worker and wait for its completion.

    Args:
        task_data: The task data to submit
        max_wait_time: Maximum time to wait for task completion in seconds
        return_data_only: If True, return only the data field from the result

    Returns:
        Task result from the worker
    """
    try:
        # Submit task directly to Redis queue
        task_id = str(uuid4())
        task_data["task_id"] = task_id

        # Ensure we have consistent task types
        task_type = task_data.get("task_type")

        # Submit to Redis queue
        await redis_client.submit_task("query_tasks", json.dumps(task_data))
        logger.info(f"Submitted {task_type} task {task_id}")

        # Wait for task completion by polling Redis directly
        poll_interval = 0.5  # Poll every 500ms
        elapsed_time = 0

        while elapsed_time < max_wait_time:
            # Check if task result exists in Redis
            result = await task_service.get_task_result(task_id)

            if result:
                status = result.get("status")
                logger.debug(f"Task {task_id} status: {status}")

                if status in ["success", "error", "cancelled"]:
                    # Task completed
                    if status == "success":
                        return result.get("data") if return_data_only else result
                    elif status == "error":
                        error_message = result.get("error", "Task failed")
                        raise HTTPException(status_code=400, detail=error_message)
                    else:  # cancelled
                        raise HTTPException(status_code=408, detail="Task was cancelled")

            # Wait before next poll
            await asyncio.sleep(poll_interval)
            elapsed_time += poll_interval

        # Timeout reached
        logger.error(f"Task {task_id} timed out after {max_wait_time} seconds")
        raise HTTPException(status_code=408, detail="Task timed out")

    except HTTPException:
        # Re-raise HTTP exceptions as they are already properly formatted
        raise
    except Exception as e:
        logger.error(f"Error in task submission and polling: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# worker related endpoints
@router.post("/test_db/")
async def test_db(request: TestDBTask):
    task_data = {"task_type": "test_db", **request.model_dump()}
    return await submit_and_wait_for_task(task_data)


@router.get("/connect/{source_id}/")
async def connect(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = get_or_404(db, Source, source_id, "Source not found")

    try:
        # Parse credentials based on database type
        if source.dbtype == "postgres":
            creds = PostgresCreds(**source.creds)
        elif source.dbtype == "mysql":
            creds = MysqlCreds(**source.creds)
        else:
            raise ValueError(f"Unsupported database type: {source.dbtype}")

        task_data = {
            "task_type": "connect",
            "source_id": str(source_id),
            "dbtype": source.dbtype,
            "creds": creds.model_dump(),
            "role": "reader",
        }

        print("task_data", task_data)
        return await submit_and_wait_for_task(task_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in connect endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/connected/")
async def get_connected_sources():
    task_data = {"task_type": "connected"}
    return await submit_and_wait_for_task(task_data, return_data_only=True)


# get schema for a source
@router.get("/schemas/{source_id}/")
async def get_schemas(source_id: UUID):
    task_data = {
        "task_type": "schema",
        "source_id": str(source_id),
        "role": "reader",
    }
    return await submit_and_wait_for_task(task_data, return_data_only=True)


@router.delete("/disconnect/{source_id}/")
async def disconnect_source(source_id: UUID):
    task_data = {"task_type": "disconnect", "source_id": str(source_id)}
    return await submit_and_wait_for_task(task_data)


@router.get("/result/{task_id}/")
async def get_task_result_endpoint(task_id: str):
    """Get the full result data for a completed task using TaskService"""
    try:
        result = await task_service.get_task_result(task_id)
        if not result:
            raise HTTPException(status_code=404, detail="Task result not found")

        # Convert to dict if it's a Pydantic model
        result_dict = result.model_dump() if hasattr(result, "model_dump") else result
        return result_dict
    except Exception as e:
        logger.error(f"Error fetching result for task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e
