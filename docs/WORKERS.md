# Worker Management in Dribble

This document explains how workers (database connection containers) are managed in the dribble system, including testing, starting, usage, and cleanup processes.

## Overview

Workers in dribble are Docker containers that provide isolated database connections for each data source. Each worker runs a FastAPI application that handles database queries and schema introspection for a specific database connection.

## Worker Architecture

- **Worker Image**: `dribble-worker-postgres:latest` (currently only PostgreSQL is supported)
- **Container Naming**: `dribble-worker-postgres-{source_id}`
- **Network**: Uses `dribble-network` Docker network for inter-container communication
- **Port Assignment**: Random port between 8001-8999 for external access, internal port 8000
- **Environment Variables**:
  - `DB_CREDS`: JSON-encoded database credentials
  - `REDIS_URL`: Redis connection string for result storage

## Worker Testing

### Connection Testing

Workers are tested before being started to ensure database connectivity:

```python
# Located in: server/app/core/spawn_worker.py
def test(self):
    # Runs a temporary container with test command
    result = client.containers.run(
        image="dribble-worker-postgres:latest",
        name=f"{self.container_name}-test",
        environment={
            "DB_CREDS": self.creds.model_dump_json(),
            "REDIS_URL": self.redis_url,
        },
        network=self.network_name,
        restart_policy={"Name": "no"},
        detach=False,
        remove=True,  # Auto-remove test container
        command=["/bin/sh", "-c", "python -m app.main test_connection 2>&1"],
    )
```

The test command (`test_connection_cli` in `worker/postgres/app/main.py`) performs:

1. Parses database credentials from environment
2. Creates SQLAlchemy engine with provided credentials
3. Executes `SELECT 1` to verify connectivity
4. Returns JSON result: `{"status": "success"}` or `{"status": "error", "message": "..."}`

### Test Scenarios Handled

- **Connection failures**: Network unreachable, wrong host/port
- **Authentication failures**: Invalid username/password
- **Database access**: Database doesn't exist or no permissions
- **Missing dependencies**: Worker image not found

### Unit Testing

Workers are tested through:

- **Model tests**: `server/tests/tests/test_models.py` - Tests Worker model creation
- **Database seeding tests**: `server/tests/tests/test_database_seeding.py` - Tests worker data persistence
- **Integration tests**: Uses test database with seeded worker data

## Worker Startup Process

### 1. Manual Connection

Workers are started when a user connects to a data source via the `/sources/connect/{source_id}` endpoint:

```python
# Located in: server/app/routes/sources.py
@router.get("/connect/{source_id}")
async def connect(source_id: UUID, workspace, db):
    # 1. Retrieve source and credentials
    source = db.query(Source).filter_by(id=source_id).first()
    creds = PostgresCreds(**source.creds)

    # 2. Create worker container instance
    worker = WorkerContainer(source.id, creds)

    # 3. Check if container already exists
    container_exists = worker.already_exists()

    # 4. Start container if needed
    if not container_exists:
        worker.start(workspace.id, db)
```

### 2. Automatic Reconciliation

Workers are automatically started during application startup and periodically reconciled:

```python
# Located in: server/app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_user_and_workspace()
    reconcile_workers()  # Start missing workers
    start_health_check()  # Begin health monitoring
    yield
    stop_health_check()
```

### 3. Container Startup Process

The `WorkerContainer.start()` method:

1. **Pre-flight test**: Validates database credentials
2. **Container creation**: Runs Docker container with:
   - Database credentials as environment variables
   - Random port assignment
   - Network attachment to `dribble-network`
   - Restart policy: `unless-stopped`
3. **Database record**: Creates/updates Worker record in database
4. **Health verification**: Waits up to 10 seconds for container to be running
5. **Error handling**: Cleans up container on failure

### 4. Container Configuration

```python
container = client.containers.run(
    image="dribble-worker-postgres:latest",
    name=self.container_name,
    environment={
        "DB_CREDS": self.creds.model_dump_json(),
        "REDIS_URL": self.redis_url,
    },
    ports={"8000/tcp": self.port},
    network=self.network_name,
    restart_policy={"Name": "unless-stopped"},
    detach=True,
)
```

## Worker Usage

### Execute Endpoint

Workers provide a `/execute/` endpoint for running SQL queries:

**Endpoint**: `POST http://{container_name}:8000/execute/`

**Request Format**:

```json
{
  "query": "SELECT * FROM users LIMIT 10",
  "query_id": "unique-query-identifier"
}
```

**Response**:

```json
{
  "query_id": "unique-query-identifier",
  "status": "started"
}
```

**Implementation** (`worker/postgres/app/main.py`):

```python
@app.post("/execute/")
async def run_query(request: QueryRequest):
    # Set initial status
    await set_result(request.query_id, {"status": "running"})

    # Execute query asynchronously
    async def execute_sql_query():
        try:
            result = execute_query(request.query)
            await set_result(request.query_id, {"status": "success", "data": result})
        except Exception as e:
            await set_result(request.query_id, {"status": "error", "error": str(e)})

    asyncio.create_task(execute_sql_query())
    return {"query_id": request.query_id, "status": "started"}
```

**Usage from Server** (`server/app/controllers/query.py`):

```python
def execute_in_worker(source_id: UUID, query: str):
    container_name = f"dribble-worker-postgres-{source_id}"
    response = requests.post(
        f"http://{container_name}:8000/execute/",
        json={"query": query, "query_id": str(source_id)},
        timeout=5,
    )
    return response.json()
```

### Schema Endpoint

Workers provide a `/schema/` endpoint for database introspection:

**Endpoint**: `GET http://{container_name}:8000/schema/`

**Response**: Hierarchical schema information including:

- Tables with columns and data types
- Views with definitions
- Organized by schema/namespace

**Implementation**:

```python
@app.get("/schema/")
def get_postgres_schemas():
    # Query information_schema for tables, columns, and views
    # Returns structured schema information
```

**Usage from Server** (`server/app/routes/sources.py`):

```python
@router.get("/schemas/{source_id}")
async def get_schemas(source_id: UUID, db):
    # Verify worker exists
    db_worker = db.query(Worker).filter_by(source_id=source_id).first()

    # Make request to worker
    container_name = f"dribble-worker-postgres-{source_id}"
    response = requests.get(f"http://{container_name}:8000/schema/", timeout=5)
    return response.json()
```

## Worker Cleanup and Health Management

### Health Check System

The health check system runs continuously to monitor worker status:

**Startup** (`server/app/main.py`):

```python
def start_health_check():
    scheduler.add_job(check_workers_health, "interval", seconds=5)
    scheduler.add_job(cleanup_orphaned_containers, "interval", seconds=30)
    scheduler.start()
```

### Health Monitoring (`check_workers_health`)

Runs every 5 seconds to check all workers:

```python
def check_workers_health():
    workers = db.query(Worker).all()
    for worker in workers:
        healthy = is_healthy(worker.container_id)
        if not healthy:
            # Check if container exists
            try:
                client.containers.get(worker.container_id)
                # Container exists but unhealthy
                worker.status = "unhealthy"
            except docker.errors.NotFound:
                # Container missing - remove worker record
                db.delete(worker)
        elif healthy and worker.status not in ["healthy", "running"]:
            worker.status = "healthy"
```

**Health Check Logic**:

- **Healthy**: Container exists and status is "running"
- **Unhealthy**: Container exists but not running
- **Missing**: Container doesn't exist - worker record is removed

### Orphaned Container Cleanup (`cleanup_orphaned_containers`)

Runs every 30 seconds to clean up containers without database records:

```python
def cleanup_orphaned_containers():
    # Get all worker container IDs from database
    db_workers = db.query(Worker).all()
    db_worker_container_ids = {w.container_id for w in db_workers}

    # Find containers without DB records
    containers = client.containers.list(filters={"name": "dribble-worker-postgres-"})
    for container in containers:
        if (container.id not in db_worker_container_ids and
            "-test" not in container.name):
            # Check age to avoid race conditions
            if age_seconds > 60:
                stop_worker(container.id)
```

**Cleanup Rules**:

- Only removes containers older than 60 seconds (prevents race conditions)
- Excludes test containers (auto-remove)
- Logs cleanup actions for monitoring

### Worker Reconciliation (`reconcile_workers`)

Runs at startup to synchronize database records with running containers:

```python
def reconcile_workers():
    # 1. Stop orphaned containers (no DB record)
    orphaned_container_ids = set(running_containers.keys()) - db_worker_container_ids
    for container_id in orphaned_container_ids:
        stop_worker(container_id)

    # 2. Start missing containers (DB record but no container)
    for worker in db_workers:
        if worker.container_id not in running_containers:
            # Recreate container for this worker
            worker_container = WorkerContainer(source_id=source.id, creds=creds)
            worker_container.start(worker.workspace_id, db)

            # Update worker record
            worker.container_id = worker_container.container_id
            worker.port = worker_container.port
            worker.host = worker_container.container_url
            worker.status = "running"
```

### Manual Worker Cleanup

Workers can be manually stopped and cleaned up:

```python
def stop_worker(container_id: str) -> bool:
    try:
        container = client.containers.get(container_id)
        container.stop()
        container.remove()
        return True
    except docker.errors.NotFound:
        return True  # Already removed
    except Exception:
        return False
```

## Building Workers

Workers are built using Docker:

```bash
# Build postgres worker
just build-worker pg

# Or manually:
docker build -t dribble-worker-postgres:latest ./worker/postgres
```

The worker uses:

- **Base image**: `ghcr.io/astral-sh/uv:python3.13-bookworm-slim`
- **Dependencies**: Managed by `uv` (Python package manager)
- **PostgreSQL client**: `libpq-dev` for database connectivity
- **FastAPI**: Web framework for API endpoints
- **SQLAlchemy**: Database ORM and connection management

## Error Handling and Monitoring

### Container Failures

- Failed containers are automatically restarted (restart policy: `unless-stopped`)
- Health checks detect and mark unhealthy workers
- Reconciliation recreates missing containers

### Database Connection Issues

- Pre-flight testing prevents starting workers with bad credentials
- Connection errors are logged and returned to clients
- Workers with connection issues are marked as "error" status

### Resource Management

- Containers are automatically cleaned up when no longer needed
- Test containers are ephemeral (auto-remove)
- Port conflicts are avoided through random port assignment

### Logging

- All worker operations are logged with appropriate levels
- Container startup/shutdown events are tracked
- Health check results are logged for monitoring

## Development and Testing

### Local Development

```bash
# Start development environment
docker compose up

# Build and test workers
just build-worker pg
just setup-test
```

### Test Environment

- Uses separate Docker network: `test-dribble-network`
- Test database with seeded data
- Automated cleanup after tests
- Health check verification during startup

This comprehensive worker management system ensures reliable database connectivity while providing automatic cleanup, health monitoring, and error recovery capabilities.
