"""
Structured error handling for the generic worker.

This module defines custom exception classes to provide better error handling
and categorization of different types of failures in the worker.
"""


class WorkerError(Exception):
    """Base worker exception"""

    def __init__(self, message: str, original_exception: Exception = None):
        super().__init__(message)
        self.message = message
        self.original_exception = original_exception

    def __str__(self):
        if self.original_exception:
            return f"{self.message} (caused by: {str(self.original_exception)})"
        return self.message


class DatabaseConnectionError(WorkerError):
    """Database connection failures"""

    def __init__(
        self, message: str, original_exception: Exception = None, connection_details: dict = None
    ):
        super().__init__(message, original_exception)
        self.connection_details = connection_details or {}


class QueryExecutionError(WorkerError):
    """Query execution failures"""

    def __init__(
        self,
        message: str,
        original_exception: Exception = None,
        query: str = None,
        query_type: str = None,
    ):
        super().__init__(message, original_exception)
        self.query = query
        self.query_type = query_type


class ValidationError(WorkerError):
    """Input validation failures"""

    def __init__(
        self,
        message: str,
        original_exception: Exception = None,
        field_name: str = None,
        invalid_value=None,
    ):
        super().__init__(message, original_exception)
        self.field_name = field_name
        self.invalid_value = invalid_value


class ConnectionNotFoundError(WorkerError):
    """Connection not found in engine pool"""

    def __init__(self, source_key: str):
        message = f"No connection found for {source_key}. Use connect task first."
        super().__init__(message)
        self.source_key = source_key


class UnsupportedDatabaseError(WorkerError):
    """Unsupported database type"""

    def __init__(self, db_type: str):
        message = f"Unsupported database type: {db_type}"
        super().__init__(message)
        self.db_type = db_type


class InvalidTaskTypeError(WorkerError):
    """Invalid task type"""

    def __init__(self, task_type: str):
        message = f"Unknown task type: {task_type}"
        super().__init__(message)
        self.task_type = task_type


class RedisError(WorkerError):
    """Redis operation failures"""

    pass
