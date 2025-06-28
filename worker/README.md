# Dribble Generic Worker

A modular, Redis-based worker that supports multiple database types with role-based connection pooling.

## Architecture

The worker has been refactored into a clean, modular structure:

```
worker/
├── main.py                    # Main worker loop (simple!)
├── task_manager.py           # Task routing and handling
├── common/                   # Shared modules
│   ├── __init__.py
│   ├── redis_client.py       # Redis operations
│   ├── models.py            # Data structures
│   ├── exceptions.py        # Error handling
│   └── connection_manager.py # DB connection pooling
└── postgres/                # PostgreSQL-specific modules
    ├── query_executor.py    # SQL execution & serialization
    ├── sql_builder.py       # Query modifiers (CTE wrapper)
    └── schema_inspector.py  # Schema introspection
```

## Features

### 🔗 **Connect-First Architecture**

No more redundant `data_source_url` in every request. Establish connections once, reuse many times:

```json
// 1. Connect
{
  "task_type": "connect",
  "query_run_id": "uuid",
  "source_id": "prod_db",
  "role": "reader",
  "db_type": "postgresql",
  "creds": { "host": "...", "user": "...", "password": "..." }
}

// 2. Execute queries using the connection
{
  "task_type": "execute",
  "query_run_id": "uuid",
  "source_key": "prod_db:reader",
  "sql": "SELECT * FROM users LIMIT 10"
}
```

### 👥 **Role-Based Connection Pooling**

- **Reader**: 3 pool size, 7 max overflow (read-heavy workloads)
- **Writer**: 5 pool size, 10 max overflow (balanced)
- **Admin**: 2 pool size, 5 max overflow (administrative tasks)

### 🧪 **Database Testing**

Test connections without storing them:

```json
{
  "task_type": "test_db",
  "query_run_id": "uuid",
  "db_type": "postgresql",
  "creds": { "host": "...", "user": "...", "password": "..." }
}
```

### 📊 **Schema Inspection**

Get comprehensive database schema information:

```json
{
  "task_type": "schema",
  "query_run_id": "uuid",
  "source_key": "prod_db:reader"
}
```

### 🔧 **Query Modifiers**

Execute queries with limits, offsets, WHERE clauses, and ORDER BY:

```json
{
  "task_type": "execute_version",
  "query_run_id": "uuid",
  "source_key": "prod_db:reader",
  "sql": "SELECT * FROM users",
  "modifiers": {
    "limit": 100,
    "offset": 0,
    "where": "active = true",
    "order_by": "created_at DESC"
  }
}
```

## Supported Task Types

| Task Type         | Description                   | Required Fields                         |
| ----------------- | ----------------------------- | --------------------------------------- |
| `connect`         | Establish database connection | `source_id`, `role`, `db_type`, `creds` |
| `test_db`         | Test database connectivity    | `db_type`, `creds`                      |
| `execute`         | Run SQL query                 | `source_key`, `sql`                     |
| `execute_version` | Run SQL with modifiers        | `source_key`, `sql`, `modifiers`        |
| `schema`          | Get database schema           | `source_key`                            |

## Supported Databases

- ✅ **PostgreSQL** - Full support with schema inspection
- 🚧 **MySQL** - Planned
- 🚧 **SQLite** - Planned
- 🚧 **Snowflake** - Planned

## Health & Monitoring

### Worker Health Check

```bash
python main.py health
```

### Connection Monitoring

- Worker heartbeat every 5 seconds
- Active connection count tracking
- Automatic connection health checks
- Connection recovery on failure

## Usage

### Start the Worker

```bash
python main.py
```

### Environment Variables

- `REDIS_URL`: Redis connection string (default: `redis://redis:6379/0`)
- `REDIS_QUEUE`: Queue name (default: `query_tasks`)

### Graceful Shutdown

The worker handles `SIGINT` and `SIGTERM` signals gracefully:

- Stops accepting new tasks
- Cleans up all database connections
- Exits cleanly

## Module Details

### `common/redis_client.py`

- Synchronous Redis operations
- Task queue management
- Result storage and pub/sub
- Worker heartbeat

### `common/connection_manager.py`

- Database engine creation per DB type
- Role-specific connection pooling
- Connection health monitoring
- Automatic connection recovery

### `common/models.py`

- Pydantic models for validation
- Task request structures
- Database credential models
- Query modifiers

### `common/exceptions.py`

- Structured error hierarchy
- Context-aware error messages
- Error categorization

### `postgres/query_executor.py`

- SQL execution with retry logic
- Data type serialization (binary, decimal, datetime, UUID)
- Query type detection
- Comprehensive error handling

### `postgres/sql_builder.py`

- Safe SQL composition with CTE wrapper
- Query modifier application
- SQL injection prevention
- Result message generation

### `postgres/schema_inspector.py`

- Full PostgreSQL schema inspection
- Tables, columns, primary keys, foreign keys
- Relationships mapping
- Views support

## Benefits

✅ **Modular & Maintainable** - Clean separation of concerns  
✅ **Performance** - Connection reuse, smart pooling  
✅ **Reliability** - Health checks, error recovery  
✅ **Security** - Role-based access, SQL injection prevention  
✅ **Monitoring** - Comprehensive logging and metrics  
✅ **Extensible** - Easy to add new database types
