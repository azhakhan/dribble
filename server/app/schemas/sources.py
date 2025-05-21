from pydantic import BaseModel
from uuid import UUID


class CreateSourceRequest(BaseModel):
    name: str
    dbtype: str
    creds: dict


class UpdateSourceRequest(BaseModel):
    source_id: UUID
    name: str | None = None
    dbtype: str | None = None
    creds: dict | None = None


class DeleteSourceRequest(BaseModel):
    source_id: UUID
