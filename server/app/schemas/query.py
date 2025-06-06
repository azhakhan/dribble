from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum


class CreateQueryRequest(BaseModel):
    source_id: UUID


class UpdateQueryRequest(BaseModel):
    name: Optional[str] = None


class ExecuteQueryRequest(BaseModel):
    query: str
    source_id: UUID


class QueryTriggerEnum(str, Enum):
    manual = "manual"
    run = "run"
    ai = "ai"
    on_exit = "on_exit"


# QueryVersion schemas
class CreateQueryVersionRequest(BaseModel):
    sql: str
    save_trigger: QueryTriggerEnum
    query_id: UUID
    created_by: UUID


class QueryVersionResponse(BaseModel):
    id: UUID
    sql: str
    save_trigger: QueryTriggerEnum
    query_id: UUID
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# QueryRun schemas
class CreateQueryRunRequest(BaseModel):
    result_message: Optional[str] = None
    error_message: Optional[str] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    query_version_id: UUID
    created_by: UUID


class QueryRunResponse(BaseModel):
    id: UUID
    result_message: Optional[str]
    error_message: Optional[str]
    row_count: Optional[int]
    execution_time_ms: Optional[int]
    query_version_id: UUID
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Query response schemas
class QueryResponse(BaseModel):
    id: UUID
    name: Optional[str]
    source_id: UUID
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True
