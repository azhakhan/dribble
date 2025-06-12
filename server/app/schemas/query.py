from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum


class CreateQueryRequest(BaseModel):
    source_id: UUID
    name: Optional[str] = None
    is_ephemeral: Optional[bool] = False
    preview_key: Optional[str] = None


class UpdateQueryRequest(BaseModel):
    name: Optional[str] = None
    is_ephemeral: Optional[bool] = None


class QueryTriggerEnum(str, Enum):
    manual = "manual"
    run = "run"
    ai = "ai"
    on_exit = "on_exit"


# Query response schemas
class QueryResponse(BaseModel):
    id: UUID
    name: Optional[str]
    is_ephemeral: Optional[bool]
    preview_key: Optional[str]
    source_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Ephemeral query schemas
class CreateEphemeralQueryRequest(BaseModel):
    source_id: UUID
    preview_key: str


class ConvertEphemeralQueryRequest(BaseModel):
    name: str
