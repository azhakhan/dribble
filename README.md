# dribble

a web based database manager

## Getting Started

```bash
docker compose up --build
```

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
