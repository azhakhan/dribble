from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Dict, Any
from datetime import datetime
import enum


class LLMName(str, enum.Enum):
    openai = "openai"
    anthropic = "anthropic"
    gemini = "gemini"
    ollama = "ollama"


class CreateLLMRequest(BaseModel):
    # name is enum of openai, anthropic, gemini, etc.
    name: LLMName
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class UpdateLLMRequest(BaseModel):
    name: Optional[LLMName] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class LLMResponse(BaseModel):
    id: UUID
    name: LLMName
    model: str
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    workspace_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class LLMListResponse(BaseModel):
    id: UUID
    name: LLMName
    model: str

    class Config:
        from_attributes = True


class ChatLLMRequest(BaseModel):
    source_id: UUID
    llm_id: UUID
    message: str
    query: Optional[str] = None
