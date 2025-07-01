from pydantic import BaseModel, Field
from typing import Optional


class PostgresCreds(BaseModel):
    host: str
    port: int
    user: str
    password: str
    dbname: str


class QueryRequest(BaseModel):
    query: str
    query_id: str


class QueryResponse(BaseModel):
    query_id: str
    result: list[dict]


class QueryRunModifiers(BaseModel):
    limit: int = Field(501, ge=10, le=1001, description="Limit the number of rows returned")
    offset: int = Field(0, ge=0, description="Offset the number of rows returned")
    where: Optional[str] = None
    order_by: Optional[str] = None


class QueryVersionRequest(BaseModel):
    query_run_id: str
    sql: str
    modifiers: Optional[QueryRunModifiers] = None


class UpdateQueryRunRequest(BaseModel):
    result_message: Optional[str] = None
    error_message: Optional[str] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None


class QueryExecutionResult(BaseModel):
    data: list[dict]
    execution_time_ms: int
    row_count: int
    result_message: str
    is_select_query: bool
