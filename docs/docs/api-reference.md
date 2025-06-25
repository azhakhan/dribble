---
sidebar_position: 6
---

# API Reference

This reference covers the REST API endpoints available in Dribble's FastAPI backend. All endpoints return JSON responses and follow RESTful conventions.

## Base URL

```
http://localhost:8000/api
```

## Authentication

Currently, Dribble doesn't require authentication for local development. Future versions will include JWT-based authentication.

## Sources API

Manage database connections and data sources.

### List Sources

```http
GET /sources
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My PostgreSQL DB",
    "type": "postgresql",
    "created_at": "2024-01-01T00:00:00Z",
    "is_active": true,
    "connection_status": "connected"
  }
]
```

### Create Source

```http
POST /sources
```

**Request Body:**
```json
{
  "name": "My Database",
  "type": "postgresql",
  "connection_details": {
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "username": "user",
    "password": "password"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "My Database",
  "type": "postgresql",
  "created_at": "2024-01-01T00:00:00Z",
  "is_active": true
}
```

### Get Source

```http
GET /sources/{source_id}
```

### Update Source

```http
PUT /sources/{source_id}
```

### Delete Source

```http
DELETE /sources/{source_id}
```

### Test Connection

```http
POST /sources/{source_id}/test
```

**Response:**
```json
{
  "status": "success",
  "message": "Connection successful",
  "latency_ms": 45
}
```

### Get Schema

```http
GET /sources/{source_id}/schema
```

**Response:**
```json
{
  "schemas": [
    {
      "name": "public",
      "tables": [
        {
          "name": "users",
          "columns": [
            {
              "name": "id",
              "type": "integer",
              "nullable": false,
              "primary_key": true
            },
            {
              "name": "email",
              "type": "varchar(255)",
              "nullable": false
            }
          ]
        }
      ]
    }
  ]
}
```

## Queries API

Manage saved queries and their metadata.

### List Queries

```http
GET /queries
```

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Offset for pagination (default: 0)
- `search` (optional): Search term for query names

**Response:**
```json
{
  "queries": [
    {
      "id": "uuid",
      "name": "User Analysis",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "version_count": 3,
      "latest_version": {
        "id": "uuid",
        "version_number": 3,
        "sql_content": "SELECT * FROM users",
        "created_at": "2024-01-01T00:00:00Z"
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Create Query

```http
POST /queries
```

**Request Body:**
```json
{
  "name": "My Query",
  "sql_content": "SELECT * FROM users",
  "is_ephemeral": false
}
```

### Get Query

```http
GET /queries/{query_id}
```

### Update Query

```http
PUT /queries/{query_id}
```

### Delete Query

```http
DELETE /queries/{query_id}
```

## Query Versions API

Manage query version history.

### List Query Versions

```http
GET /queries/{query_id}/versions
```

**Response:**
```json
[
  {
    "id": "uuid",
    "query_id": "uuid",
    "version_number": 1,
    "sql_content": "SELECT * FROM users",
    "created_at": "2024-01-01T00:00:00Z",
    "created_by": "user@example.com"
  }
]
```

### Create Query Version

```http
POST /queries/{query_id}/versions
```

**Request Body:**
```json
{
  "sql_content": "SELECT id, email FROM users WHERE active = true"
}
```

### Get Query Version

```http
GET /queries/{query_id}/versions/{version_id}
```

## Query Execution API

Execute queries and manage query runs using an asynchronous pattern.

### Execute Query Version

```http
POST /execution/version
```

**Request Body:**
```json
{
  "query_version_id": "uuid",
  "modifiers": {
    "limit": 501,
    "offset": 0,
    "where": "active = true",
    "order_by": "created_at DESC"
  }
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "status": "started"
}
```

### Get Query Results

```http
GET /execution/run-results/{run_id}
```

**Response Codes:**
- `202 Accepted`: Query still running
- `200 OK`: Query completed successfully
- `500 Internal Server Error`: Query failed

**Success Response (200):**
```json
{
  "run_id": "uuid",
  "status": "success",
  "execution_time_ms": 234,
  "row_count": 150,
  "columns": [
    {"name": "id", "type": "integer"},
    {"name": "email", "type": "varchar"}
  ],
  "data": [
    [1, "user@example.com"],
    [2, "admin@example.com"]
  ]
}
```

### Get Query Run

```http
GET /runs/{run_id}
```

## Query Runs API

Access query execution history and results.

### List Query Runs

```http
GET /runs/query/{query_id}
```

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `page_size` (optional): Number of results per page (default: 10)

**Response:**
```json
{
  "runs": [
    {
      "id": "uuid",
      "query_version_id": "uuid",
      "source_id": "uuid",
      "status": "success",
      "execution_time_ms": 123,
      "row_count": 50,
      "created_at": "2024-01-01T00:00:00Z",
      "error_message": null
    }
  ],
  "total": 1
}
```

### Get Query Run Results

```http
GET /execution/run-results/{run_id}
```

**Response:**
```json
{
  "columns": [
    {"name": "id", "type": "integer"},
    {"name": "name", "type": "varchar"}
  ],
  "data": [
    [1, "John Doe"],
    [2, "Jane Smith"]
  ],
  "row_count": 2,
  "execution_time_ms": 45
}
```

## Chat API

Interact with the AI assistant.

### Send Chat Message

```http
POST /chat/
```

**Request Body:**
```json
{
  "message": "Show me all users created in the last week",
  "context": {
    "query_id": "uuid",
    "source_id": "uuid"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "message": "Here's a query to show users created in the last week:",
  "sql_query": "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '7 days'",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Get Chat History

```http
GET /chat/messages/{session_id}
```

### List Chat Sessions

```http
GET /chat/sessions
```

## LLM API

Manage AI/LLM configuration and models.

### List LLMs

```http
GET /llms/
```

### Create LLM

```http
POST /llms/
```

### Get LLM

```http
GET /llms/{llm_id}
```

### Update LLM

```http
PUT /llms/{llm_id}
```

### Delete LLM

```http
DELETE /llms/{llm_id}
```

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": {
    "field": "name",
    "message": "Name is required"
  }
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Query not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred",
  "request_id": "uuid"
}
```


## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

```http
GET /queries?limit=25&offset=50
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "total": 200,
  "limit": 25,
  "offset": 50,
  "has_next": true,
  "has_previous": true
}
```

## Filtering and Sorting

Many list endpoints support filtering and sorting:

```http
GET /query-runs?status=success&sort=created_at&order=desc
```

Available sort fields and filters are documented per endpoint.


## Client Integration

Use standard HTTP clients to interact with the API. The server provides CORS headers for browser-based clients.

## OpenAPI Specification

The complete OpenAPI specification is available at:
```
http://localhost:8000/docs
```

This provides interactive documentation and the ability to test endpoints directly.