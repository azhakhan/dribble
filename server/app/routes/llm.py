from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from app.schemas.llm import (
    CreateLLMRequest,
    UpdateLLMRequest,
    LLMResponse,
    LLMListResponse,
    ChatLLMRequest,
    ChatLLMResponse,
)
from app.controllers.llm import ChatService, ChatResponse
from app.core.db import get_db
from app.core.encryption import encrypt_password
from sqlalchemy.orm import Session
from app.models import LLM, Source
from app.dependencies import get_current_workspace
from uuid import UUID
from typing import List
import json

router = APIRouter(prefix="/llms", tags=["llms"])


@router.post("/", response_model=LLMResponse)
async def create_llm(
    request: CreateLLMRequest,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    """Create a new LLM configuration"""
    # Check if LLM with same name already exists in workspace
    existing_llms = db.query(LLM).filter_by(workspace_id=workspace.id).all()
    if len(existing_llms) > 0 and request.name in [llm.name for llm in existing_llms]:
        raise HTTPException(
            status_code=400,
            detail=f"LLM with name '{request.name}' already exists in this workspace",
        )

    llm = LLM(
        name=request.name,
        model=request.model,
        api_key=encrypt_password(request.api_key),
        base_url=request.base_url,
        api_version=request.api_version,
        settings=request.settings,
        workspace_id=workspace.id,
        default=True if len(existing_llms) == 0 else False,
    )

    db.add(llm)
    db.commit()
    db.refresh(llm)
    return llm


@router.get("/", response_model=List[LLMListResponse])
async def get_llms(
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    """Get all LLMs in the current workspace"""
    llms = db.query(LLM).filter_by(workspace_id=workspace.id).all()
    return [LLMListResponse.model_validate(llm) for llm in llms]


@router.get("/{llm_id}", response_model=LLMResponse)
async def get_llm(
    llm_id: UUID,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    """Get a specific LLM by ID"""
    llm = db.query(LLM).filter_by(id=llm_id, workspace_id=workspace.id).first()
    if not llm:
        raise HTTPException(status_code=404, detail="LLM not found")
    return LLMResponse.model_validate(llm)


@router.put("/{llm_id}", response_model=LLMResponse)
async def update_llm(
    llm_id: UUID,
    request: UpdateLLMRequest,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    """Update an existing LLM configuration"""
    llm = db.query(LLM).filter_by(id=llm_id, workspace_id=workspace.id).first()
    if not llm:
        raise HTTPException(status_code=404, detail="LLM not found")

    # Check if new name conflicts with existing LLM (if name is being changed)
    if request.name and request.name != llm.name:
        existing_llm = db.query(LLM).filter_by(name=request.name, workspace_id=workspace.id).first()
        if existing_llm:
            raise HTTPException(
                status_code=400,
                detail=f"LLM with name '{request.name}' already exists in this workspace",
            )

    # Update only provided fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(llm, field, value)

    db.commit()
    db.refresh(llm)
    return llm


@router.delete("/{llm_id}")
async def delete_llm(
    llm_id: UUID,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    """Delete an LLM configuration"""
    llm = db.query(LLM).filter_by(id=llm_id, workspace_id=workspace.id).first()
    if not llm:
        raise HTTPException(status_code=404, detail="LLM not found")

    db.delete(llm)
    db.commit()
    return {"message": "LLM deleted successfully"}


@router.post("/chat")
async def chat_llm_req(
    request: ChatLLMRequest,
    db: Session = Depends(get_db),
    workspace=Depends(get_current_workspace),
):
    """Chat with an LLM - supports both streaming and non-streaming"""
    llm = db.query(LLM).filter_by(id=request.llm_id, workspace_id=workspace.id).first()
    if not llm:
        raise HTTPException(status_code=404, detail="LLM not found")

    source = db.query(Source).filter_by(id=request.source_id, workspace_id=workspace.id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        service = ChatService(llm, source)

        if request.stream:
            # Return streaming response
            async def generate_stream():
                async for chunk in await service.chat(request, stream=True):
                    # Convert StreamChunk to JSON
                    chunk_data = {
                        "content": chunk.content,
                        "is_complete": chunk.is_complete,
                        "action": chunk.action.value if chunk.action else None,
                        "metadata": chunk.metadata,
                    }
                    yield f"data: {json.dumps(chunk_data)}\n\n"

                    # Send final chunk to end stream
                    if chunk.is_complete:
                        break

                # Send end signal
                yield "data: [DONE]\n\n"

            return StreamingResponse(
                generate_stream(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Content-Type": "text/event-stream",
                },
            )
        else:
            # Return regular response
            response = await service.chat(request, stream=False)
            if isinstance(response, ChatResponse):
                return ChatLLMResponse(
                    content=response.content,
                    action=response.action,
                    sql_query=response.sql_query,
                    metadata=response.metadata,
                )
            else:
                raise HTTPException(status_code=500, detail="Unexpected response type")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
