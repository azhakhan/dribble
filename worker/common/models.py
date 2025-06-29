from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from dataclasses import dataclass


# Database credential models
class PostgresCreds(BaseModel):
    host: str
    port: int = 5432
    user: str
    password: str
    dbname: str


class DatabaseCreds(BaseModel):
    """Generic database credentials - can hold any DB type creds"""

    host: str
    port: Optional[int] = None
    user: Optional[str] = None
    username: Optional[str] = None  # Alternative to user
    password: str
    database: Optional[str] = None
    dbname: Optional[str] = None  # Alternative to database
    # Snowflake specific
    account: Optional[str] = None
    warehouse: Optional[str] = None
    schema: Optional[str] = None
    # SQLite specific
    path: Optional[str] = None


# Query modifiers
class QueryRunModifiers(BaseModel):
    limit: int = Field(501, ge=10, le=1001, description="Limit the number of rows returned")
    offset: int = Field(0, ge=0, description="Offset the number of rows returned")
    where: Optional[str] = None
    order_by: Optional[str] = None


# Task request models
class TaskRequest(BaseModel):
    """Represents a task from the Redis queue"""

    task_type: str  # 'connect', 'test_db', 'execute', 'schema', 'cancel'
    id: str

    # For connect/test_db tasks
    source_id: Optional[str] = None
    role: Optional[str] = None  # 'reader', 'writer', 'admin'
    dbtype: Optional[str] = None
    creds: Optional[Dict] = None

    # For execute tasks (use existing connection)
    sql: Optional[str] = None
    modifiers: Optional[QueryRunModifiers] = None


# Connection info storage
@dataclass
class ConnectionInfo:
    """Information about a stored database connection"""

    engine: Any
    url: str
    dbtype: str
    role: str
    source_id: str


# Query execution results
class QueryExecutionResult(BaseModel):
    data: list[dict]
    execution_time_ms: int
    row_count: int
    result_message: str
    is_select_query: bool
    query_type: str


# Response models
class TaskResponse(BaseModel):
    id: str
    status: str
    message: Optional[str] = None
    data: Optional[Dict] = None
    error: Optional[str] = None


# Supported roles
SUPPORTED_ROLES = ["reader", "writer", "admin"]
