from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import PostgresCreds, MysqlCreds
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from uuid import UUID
from app.core.db_utils import get_or_404
from app.core._redis import submit_task, get_task_result
import logging

from app.schemas.worker import TestDBTask

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/worker", tags=["worker"])


# worker related endpoints
@router.post("/test_db/")
async def test_db(request: TestDBTask):
    try:
        task_data = {"task_type": "test_db", **request.model_dump()}
        task_id = await submit_task(task_data)
        logger.info(f"Submitted test task {task_id} for {request.dbtype}")
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/tasks/{task_id}/result")
async def get_task_result_endpoint(task_id: str):
    """Get the full result data for a completed task"""
    try:
        result = await get_task_result(task_id)
        if not result:
            raise HTTPException(status_code=404, detail="Task result not found")

        return result
    except Exception as e:
        logger.error(f"Error fetching result for task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/connect/{source_id}")
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
            "db_type": source.dbtype,
            "creds": creds,
            "role": "reader",
        }

        task_id = await submit_task(task_data)
        logger.info(f"Submitted connect task {task_id} for source {source_id}")
        return {"task_id": task_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/connected/")
async def get_connected_sources():
    try:
        task_data = {"task_type": "connected"}
        task_id = await submit_task(task_data)
        logger.info(f"Submitted connected task {task_id}")
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# get schema for a source
@router.get("/schemas/{source_id}")
async def get_schemas(source_id: UUID):
    try:
        task_data = {
            "task_type": "schema",
            "source_id": str(source_id),
            "role": "reader",
        }
        task_id = await submit_task(task_data)
        logger.info(f"Submitted schema task {task_id} for source {source_id}")
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/disconnect/{source_id}")
async def disconnect_source(source_id: UUID):
    try:
        task_data = {"task_type": "disconnect", "source_id": str(source_id)}
        task_id = await submit_task(task_data)
        logger.info(f"Submitted disconnect task {task_id} for source {source_id}")
        return {"task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
