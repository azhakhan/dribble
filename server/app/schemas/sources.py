from pydantic import BaseModel
from uuid import UUID
from enum import Enum


class PostgresCreds(BaseModel):
    host: str
    port: int
    user: str
    password: str
    dbname: str


class MysqlCreds(BaseModel):
    host: str
    port: int
    user: str
    password: str
    dbname: str


class SourceType(str, Enum):
    postgres = "postgres"
    mysql = "mysql"
    sqlite = "sqlite"


class CreateSourceRequest(BaseModel):
    name: str
    dbtype: SourceType
    creds: PostgresCreds | MysqlCreds


class TestSourceRequest(BaseModel):
    dbtype: SourceType
    creds: PostgresCreds | MysqlCreds


class UpdateCredentialsRequest(BaseModel):
    creds: PostgresCreds | MysqlCreds | None = None


class RenameSourceRequest(BaseModel):
    name: str


class DeleteSourceRequest(BaseModel):
    id: UUID
