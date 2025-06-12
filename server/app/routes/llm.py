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
from app.models import LLM, Source, ChatSession
from uuid import UUID
from typing import List
import json
from app.core.db_utils import get_or_404, safe_delete, get_all_active

router = APIRouter(prefix="/llms", tags=["llms"])


@router.post("/", response_model=LLMResponse)
async def create_llm(
    request: CreateLLMRequest,
    db: Session = Depends(get_db),
):
    """Create a new LLM configuration"""
    # Check if LLM with same name already exists
    existing_llms = get_all_active(db, LLM)
    if len(existing_llms) > 0 and request.name in [llm.name for llm in existing_llms]:
        raise HTTPException(
            status_code=400,
            detail=f"LLM with name '{request.name}' already exists",
        )

    llm = LLM(
        name=request.name,
        model=request.model,
        api_key=encrypt_password(request.api_key),
        base_url=request.base_url,
        api_version=request.api_version,
        settings=request.settings,
        default=True if len(existing_llms) == 0 else False,
    )

    db.add(llm)
    db.commit()
    db.refresh(llm)
    return llm


@router.get("/", response_model=List[LLMListResponse])
async def get_llms(
    db: Session = Depends(get_db),
):
    """Get all LLMs"""
    llms = get_all_active(db, LLM)
    return [LLMListResponse.model_validate(llm) for llm in llms]


@router.get("/{llm_id}", response_model=LLMResponse)
async def get_llm(
    llm_id: UUID,
    db: Session = Depends(get_db),
):
    """Get a specific LLM by ID"""
    llm = get_or_404(db, LLM, llm_id, "LLM not found")
    return LLMResponse.model_validate(llm)


@router.put("/{llm_id}", response_model=LLMResponse)
async def update_llm(
    llm_id: UUID,
    request: UpdateLLMRequest,
    db: Session = Depends(get_db),
):
    """Update an existing LLM configuration"""
    llm = get_or_404(db, LLM, llm_id, "LLM not found")

    # Check if new name conflicts with existing LLM (if name is being changed)
    if request.name and request.name != llm.name:
        existing_llm = db.query(LLM).filter_by(name=request.name, deleted_at=None).first()
        if existing_llm:
            raise HTTPException(
                status_code=400,
                detail=f"LLM with name '{request.name}' already exists",
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
):
    """Delete an LLM configuration"""
    llm = get_or_404(db, LLM, llm_id, "LLM not found")
    return safe_delete(db, llm)


@router.post("/chat")
async def chat_llm_req(
    request: ChatLLMRequest,
    db: Session = Depends(get_db),
):
    """Chat with an LLM - supports both streaming and non-streaming"""
    llm = db.query(LLM).filter_by(id=request.llm_id).first()
    if not llm:
        raise HTTPException(status_code=404, detail="LLM not found")

    source = db.query(Source).filter_by(id=request.source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    chat_session = db.query(ChatSession).filter_by(id=request.session_id).first()
    if not chat_session:
        chat_session = ChatSession(
            id=request.session_id,
            source_id=request.source_id,
            llm_id=request.llm_id,
        )
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)

    try:
        service = ChatService(llm, source, chat_session, db)

        if request.stream:
            # Return streaming response
            async def generate_stream():
                async for chunk in await service.chat(request, stream=True):
                    # Convert StreamChunk to JSON
                    chunk_data = {
                        "content": chunk.content,
                        "is_complete": chunk.is_complete,
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
                    sql_query=response.sql_query,
                    metadata=response.metadata,
                )
            else:
                raise HTTPException(status_code=500, detail="Unexpected response type")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
