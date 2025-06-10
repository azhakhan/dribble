from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class QueryRunModifiers(BaseModel):
    limit: int = Field(501, ge=10, le=1001, description="Limit the number of rows returned")
    offset: int = Field(0, ge=0, description="Offset the number of rows returned")
    where: Optional[str] = Field(None, description="WHERE clause for the query")
    order_by: Optional[str] = Field(None, description="ORDER BY clause for the query")


# QueryRun schemas
class CreateQueryRunRequest(BaseModel):
    query_version_id: UUID
    modifiers: Optional[QueryRunModifiers] = None


class ExecuteQueryVersionRequest(BaseModel):
    query_run_id: UUID
    source_id: UUID
    sql: str
    modifiers: Optional[QueryRunModifiers] = None
