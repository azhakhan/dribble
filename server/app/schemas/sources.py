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


class SqliteCreds(BaseModel):
    path: str


class SourceType(str, Enum):
    postgres = "postgres"
    mysql = "mysql"
    sqlite = "sqlite"


class CreateSourceRequest(BaseModel):
    name: str
    dbtype: SourceType
    creds: PostgresCreds | MysqlCreds | SqliteCreds


class TestSourceRequest(BaseModel):
    dbtype: SourceType
    creds: PostgresCreds | MysqlCreds | SqliteCreds


class UpdateSourceRequest(BaseModel):
    name: str | None = None
    dbtype: SourceType | None = None
    creds: PostgresCreds | MysqlCreds | SqliteCreds | None = None


class DeleteSourceRequest(BaseModel):
    id: UUID
