from fastapi import APIRouter, HTTPException, Depends
from app.schemas.llm import (
    CreateLLMRequest,
    UpdateLLMRequest,
    LLMResponse,
    LLMListResponse,
)
from app.core.db import get_db
from app.core.encryption import encrypt_password
from sqlalchemy.orm import Session
from app.models import LLM
from uuid import UUID
from typing import List
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


@router.get("/{llm_id}/", response_model=LLMResponse)
async def get_llm(
    llm_id: UUID,
    db: Session = Depends(get_db),
):
    """Get a specific LLM by ID"""
    llm = get_or_404(db, LLM, llm_id, "LLM not found")
    return LLMResponse.model_validate(llm)


@router.put("/{llm_id}/", response_model=LLMResponse)
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


@router.delete("/{llm_id}/")
async def delete_llm(
    llm_id: UUID,
    db: Session = Depends(get_db),
):
    """Delete an LLM configuration"""
    llm = get_or_404(db, LLM, llm_id, "LLM not found")
    return safe_delete(db, llm)
