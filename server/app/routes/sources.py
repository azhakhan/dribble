from fastapi import APIRouter, HTTPException, Depends
from app.schemas.sources import (
    CreateSourceRequest,
    UpdateCredentialsRequest,
    TestSourceRequest,
    RenameSourceRequest,
)
from app.core.db import get_db
from sqlalchemy.orm import Session
from app.models import Source
from app.dependencies import get_current_workspace
from uuid import UUID
from app.controllers.sources import get_source_schemas
from app.controllers.query import test_connection
from app.core.spawn_worker import start_worker
from app.schemas.sources import PostgresCreds
from app.models import Worker

router = APIRouter(prefix="/sources", tags=["sources"])


# add a source
@router.post("/")
async def add_source(
    request: CreateSourceRequest,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    db.add(
        Source(
            name=request.name,
            dbtype=request.dbtype,
            creds=request.creds.model_dump(),
            workspace_id=workspace.id,
        )
    )
    db.commit()
    db.refresh(db.query(Source).filter_by(name=request.name).first())
    return db.query(Source).filter_by(name=request.name).first()


@router.post("/test/")
async def test(request: TestSourceRequest, workspace=Depends(get_current_workspace)):
    # check if source connected

    source = Source(
        name="Testing Source",
        dbtype=request.dbtype,
        creds=request.creds.model_dump(),
        workspace_id=workspace.id,
    )

    try:
        if not test_connection(source):
            raise HTTPException(status_code=500, detail="Connection failed")
        return {"message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/rename/{source_id}/")
async def rename_source(
    source_id: UUID,
    request: RenameSourceRequest,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    source.name = request.name
    db.commit()
    db.refresh(source)
    return source


# delete a source
@router.delete("/{source_id}/")
async def delete_source(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"message": "Source deleted"}


@router.get("/schemas/{source_id}")
async def get_schemas(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        source = db.query(Source).filter_by(id=source_id).first()

        creds = PostgresCreds(**source.creds)
        worker = start_worker(source_id, creds, db)
        print(worker)

        if not source:
            raise HTTPException(status_code=404, detail="Source not found")
        return get_source_schemas(source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Add a test endpoint for worker connectivity
@router.get("/worker-test/{source_id}")
async def test_worker_connectivity(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    import requests
    import logging

    logger = logging.getLogger(__name__)

    worker = db.query(Worker).filter_by(source_id=source_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    results = {}

    # Try host as stored in database
    try:
        logger.info(f"Testing connection to {worker.host}/test-connection/")
        response = requests.get(f"{worker.host}/test-connection/", timeout=2)
        results["host_url"] = {
            "success": True,
            "status_code": response.status_code,
            "response": response.json() if response.status_code == 200 else response.text,
        }
    except Exception as e:
        results["host_url"] = {"success": False, "error": str(e)}

    # Try with IP directly
    try:
        ip_url = f"http://{worker.ip_address}:8000/test-connection/"
        logger.info(f"Testing connection to {ip_url}")
        response = requests.get(ip_url, timeout=2)
        results["ip_url"] = {
            "success": True,
            "status_code": response.status_code,
            "response": response.json() if response.status_code == 200 else response.text,
        }
    except Exception as e:
        results["ip_url"] = {"success": False, "error": str(e)}

    # Try with container name
    try:
        container_name = f"dribble-worker-postgres-{source_id}"
        container_url = f"http://{container_name}:8000/test-connection/"
        logger.info(f"Testing connection to {container_url}")
        response = requests.get(container_url, timeout=2)
        results["container_url"] = {
            "success": True,
            "status_code": response.status_code,
            "response": response.json() if response.status_code == 200 else response.text,
        }
    except Exception as e:
        results["container_url"] = {"success": False, "error": str(e)}

    return {
        "worker_info": {
            "id": str(worker.id),
            "source_id": str(worker.source_id),
            "host": worker.host,
            "ip_address": worker.ip_address,
            "port": worker.port,
            "status": worker.status,
        },
        "connectivity_tests": results,
    }


# get all sources
@router.get("/")
async def get_sources(
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    # only return name and id
    sources = db.query(Source).filter_by(workspace_id=workspace.id).all()
    return [{"id": source.id, "name": source.name, "dbtype": source.dbtype} for source in sources]


# get a source by id
@router.get("/credentials/{source_id}/")
async def get_credentials(
    source_id: UUID,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    # remove password from creds
    creds = source.creds
    creds.pop("password", None)
    return {"name": source.name, "dbtype": source.dbtype, "creds": creds}


# edit a credential
@router.put("/credentials/{source_id}/")
async def edit_source(
    source_id: UUID,
    request: UpdateCredentialsRequest,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter_by(id=source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    source.creds = request.creds.model_dump()
    db.commit()
    db.refresh(source)
    return source
