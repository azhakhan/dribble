# dribble

a web based database manager

## Getting Started

```bash
docker compose up --build
```

## Features

- 🎨 **Rich SQL Editor**: Monaco Editor with intelligent auto-complete
- 🧠 **Schema-Aware Completions**: Table and column suggestions from your database
- 🔍 **Multi-Database Support**: PostgreSQL and MySQL
- 🌙 **Dark Theme**: Professional coding environment
- 📊 **Query Results**: Interactive data tables
- 🐳 **Docker-Based**: Isolated database connections

## Documentation

- **[SQL Editor & Auto-Complete](docs/EDITOR.md)** - Comprehensive guide to the SQL editor and intelligent completion system
- **[Workers](docs/WORKERS.md)** - Database connection management and worker architecture

## DB Migrations

```bash
cd server
# if you haven't already, install uv
uv sync
# run migrations
cd app/
alembic upgrade head
```

you might need to restart docker compose after running migrations

## Building worker

```bash
docker compose build worker-postgres
```

## Creating network

```bash
docker network create dribble-network
```
