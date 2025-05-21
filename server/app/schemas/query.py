from pydantic import BaseModel
from uuid import UUID


class CreateQueryRequest(BaseModel):
    name: str
    query: str
    database_id: UUID


class UpdateQueryRequest(BaseModel):
    name: str | None = None
    query: str | None = None
    database_id: UUID | None = None


class ExecuteQueryRequest(BaseModel):
    query: str
    database_id: UUID
