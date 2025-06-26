# Error Handling Improvements

## Overview

This document describes the structured error handling improvements implemented for both PostgreSQL and MySQL workers as part of the codebase refactoring plan.

## New Exception Classes

### Base Exception Class

```python
class WorkerError(Exception):
    """Base worker exception"""
```

The base exception class that all other worker exceptions inherit from. It includes:

- `message`: The error message
- `original_exception`: The original exception that caused this error (if any)
- Enhanced `__str__` method that includes original exception information

### Specific Exception Classes

#### DatabaseConnectionError

```python
class DatabaseConnectionError(WorkerError):
    """Database connection failures"""
```

Used for all database connection-related failures including:

- Connection timeouts
- Authentication failures
- Network connectivity issues
- SSL/TLS connection problems

Additional attributes:

- `connection_details`: Dictionary containing connection metadata (max_retries, retry_delay, database_type)

#### QueryExecutionError

```python
class QueryExecutionError(WorkerError):
    """Query execution failures"""
```

Used for SQL query execution failures including:

- Syntax errors
- Permission denied errors
- Resource exhaustion
- Query timeouts

Additional attributes:

- `query`: The SQL query that failed
- `query_type`: The type of query (SELECT, INSERT, UPDATE, etc.)

#### ValidationError

```python
class ValidationError(WorkerError):
    """Input validation failures"""
```

Used for input validation failures including:

- Invalid environment variables
- Malformed JSON in configuration
- Missing required fields

Additional attributes:

- `field_name`: The name of the field that failed validation
- `invalid_value`: The value that caused the validation failure

## Implementation Details

### Files Modified

#### PostgreSQL Worker

- `worker/postgres/app/exceptions.py` - New exception classes
- `worker/postgres/app/connection_manager.py` - Updated to use `DatabaseConnectionError`
- `worker/postgres/app/query_executor.py` - Updated to use `QueryExecutionError` and `DatabaseConnectionError`
- `worker/postgres/app/utils.py` - Updated to use `ValidationError` for environment validation
- `worker/postgres/app/main.py` - Updated to handle all new exception types

#### MySQL Worker

- `worker/mysql/app/exceptions.py` - New exception classes
- `worker/mysql/app/connection_manager.py` - Updated to use `DatabaseConnectionError`
- `worker/mysql/app/query_executor.py` - Updated to use `QueryExecutionError` and `DatabaseConnectionError`
- `worker/mysql/app/utils.py` - Updated to use `ValidationError` for environment validation
- `worker/mysql/app/main.py` - Updated to handle all new exception types

### Key Improvements

1. **Better Error Classification**: Errors are now categorized by their root cause, making debugging easier
2. **Enhanced Error Context**: Each exception includes relevant metadata (query text, connection details, field names)
3. **Consistent Error Handling**: Both workers now use the same error handling patterns
4. **Preserved Stack Traces**: Original exceptions are preserved using the `original_exception` attribute
5. **Improved Logging**: Error messages now include more context about the failure
6. **Better User Experience**: API responses now provide more specific error messages

### Usage Examples

#### Database Connection Errors

```python
try:
    conn = get_database_connection(engine)
except DatabaseConnectionError as e:
    logger.error(f"Connection failed: {e}")
    # e.connection_details contains retry info
    # e.original_exception contains the SQLAlchemy error
```

#### Query Execution Errors

```python
try:
    result = execute_query(sql, engine)
except QueryExecutionError as e:
    logger.error(f"Query failed: {e}")
    # e.query contains the SQL that failed
    # e.query_type contains the query type (SELECT, INSERT, etc.)
```

#### Validation Errors

```python
try:
    config = validate_environment()
except ValidationError as e:
    logger.error(f"Validation failed: {e}")
    # e.field_name contains the field that failed
    # e.invalid_value contains the invalid value
```

## Benefits

1. **Easier Debugging**: Structured error information makes it easier to identify and fix issues
2. **Better Monitoring**: Different error types can be monitored and alerted on separately
3. **Improved User Experience**: More specific error messages help users understand what went wrong
4. **Code Maintainability**: Consistent error handling patterns across both workers
5. **Future Extensibility**: Easy to add new exception types as needed

## Testing

All exception classes have been tested to ensure:

- Proper inheritance hierarchy
- Correct attribute handling
- Proper string representation
- Original exception preservation

The implementation maintains backward compatibility while providing enhanced error information for new error handling code.
