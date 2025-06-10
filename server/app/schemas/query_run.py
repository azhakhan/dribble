from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Generic, TypeVar


class QueryRunModifiers(BaseModel):
    limit: int = Field(501, ge=10, le=1001, description="Limit the number of rows returned")
    offset: int = Field(0, ge=0, description="Offset the number of rows returned")
    where: Optional[str] = None
    order_by: Optional[str] = None


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
    modifiers: Optional[QueryRunModifiers] = None
    result_message: Optional[str]
    error_message: Optional[str]
    row_count: Optional[int]
    execution_time_ms: Optional[int]
    query_version_id: UUID
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Pagination schemas
T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class QueryRunsPaginatedResponse(PaginatedResponse[QueryRunResponse]):
    pass


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
