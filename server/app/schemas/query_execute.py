from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from app.schemas.query_run import QueryRunModifiers


class ExecuteQueryVersionRequest(BaseModel):
    query_run_id: UUID
    source_id: UUID
    sql: str
    modifiers: Optional[QueryRunModifiers] = None
