from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from enum import Enum


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
