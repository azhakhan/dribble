from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from enum import Enum


class QueryRunOperator(str, Enum):
    eq = "eq"
    ne = "ne"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    in_ = "in"
    not_in = "not_in"
    like = "like"
    not_like = "not_like"
    is_null = "is_null"
    is_not_null = "is_not_null"


class QueryRunFilter(BaseModel):
    column: str
    operator: QueryRunOperator
    value: str | int | float | bool | list[str] | list[int] | list[float] | list[bool]


class QueryRunOrderBy(BaseModel):
    column: str
    direction: str


class QueryRunModifiers(BaseModel):
    filters: Optional[List[QueryRunFilter]] = None
    order_by: Optional[List[QueryRunOrderBy]] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


# QueryRun schemas
class CreateQueryRunRequest(BaseModel):
    query_version_id: UUID
    modifiers: Optional[QueryRunModifiers] = None


class UpdateQueryRunRequest(BaseModel):
    result_message: Optional[str] = None
    error_message: Optional[str] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None


class QueryRunResponse(BaseModel):
    id: UUID
    modifiers: Optional[dict] = None
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
    is_ephemeral: Optional[bool]
    preview_key: Optional[str]
    source_id: UUID
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Ephemeral query schemas
class CreateEphemeralQueryRequest(BaseModel):
    source_id: UUID
    preview_key: str


class ConvertEphemeralQueryRequest(BaseModel):
    name: str
