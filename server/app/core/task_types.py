"""
Task types and schemas for the worker system.
Provides type safety and consistency across client, server, and worker.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel
from uuid import UUID


class TaskType(str, Enum):
    """Enumeration of all supported task types."""

    QUERY_EXECUTION = "query_execution"
    QUERY_CANCEL = "query_cancel"
    SOURCE_TEST = "source_test"
    SOURCE_CONNECT = "source_connect"


class TaskStatus(str, Enum):
    """Enumeration of task statuses."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BaseTaskData(BaseModel):
    """Base class for all task data."""

    task_type: TaskType
    task_id: str
    created_at: Optional[str] = None


class QueryExecutionTaskData(BaseTaskData):
    """Data for query execution tasks."""

    task_type: TaskType = TaskType.QUERY_EXECUTION
    query_version_id: UUID
    source_id: UUID
    query_run_id: UUID
    sql: str
    worker_session_id: str


class QueryCancelTaskData(BaseTaskData):
    """Data for query cancellation tasks."""

    task_type: TaskType = TaskType.QUERY_CANCEL
    query_run_id: UUID
    worker_session_id: str


class SourceTestTaskData(BaseTaskData):
    """Data for source connection testing tasks."""

    task_type: TaskType = TaskType.SOURCE_TEST
    source_id: UUID
    connection_params: Dict[str, Any]


class SourceConnectTaskData(BaseTaskData):
    """Data for source connection establishment tasks."""

    task_type: TaskType = TaskType.SOURCE_CONNECT
    source_id: UUID
    connection_params: Dict[str, Any]


# Union type for all task data
TaskData = Union[
    QueryExecutionTaskData, QueryCancelTaskData, SourceTestTaskData, SourceConnectTaskData
]


class TaskResult(BaseModel):
    """Base class for task results."""

    task_id: str
    status: TaskStatus
    error: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class QueryExecutionResult(TaskResult):
    """Result for query execution tasks."""

    columns: Optional[list] = None
    data: Optional[list] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[float] = None


class QueryCancelResult(TaskResult):
    """Result for query cancellation tasks."""

    cancelled: bool = False


class SourceTestResult(TaskResult):
    """Result for source testing tasks."""

    connected: bool = False
    schema_info: Optional[Dict[str, Any]] = None


class SourceConnectResult(TaskResult):
    """Result for source connection tasks."""

    connected: bool = False
    worker_session_id: Optional[str] = None
    data: Optional[Union[List[Dict[str, Any]], Dict[str, Any]]] = None


# Union type for all task results
TaskResultData = Union[
    QueryExecutionResult, QueryCancelResult, SourceTestResult, SourceConnectResult
]


class TaskStatusUpdate(BaseModel):
    """Task status update message for SSE."""

    task_id: str
    status: str  # Accept string statuses: "success", "error", "running", "pending", "cancelled"
    task_type: str  # Accept string task types: "query_execution", "query_cancel", etc.
    progress: Optional[float] = None
    message: Optional[str] = None
    result: Optional[TaskResultData] = None
    error: Optional[str] = None
    timestamp: Optional[str] = None
