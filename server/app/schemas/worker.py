from pydantic import BaseModel
from typing import Dict, Any, Optional
from enum import Enum


class SourceType(str, Enum):
    postgres = "postgres"
    mysql = "mysql"


class TestDBTask(BaseModel):
    dbtype: SourceType
    role: Optional[str] = "reader"
    creds: Dict[str, Any]


class ExecuteTask(BaseModel):
    source_id: str
    sql: str
    modifiers: Optional[Dict[str, Any]] = None
