# Build the worker Docker image for a given type (e.g., pg)
build-worker name:
    #! /usr/bin/env bash
    if ! docker network ls | grep -q dribble-network
    then
        docker network create dribble-network
    fi
    if [ "{{name}}" = "pg" ]
    then
        actual_name=postgres
    else
        actual_name={{name}}
    fi
    docker build -t dribble-worker-$actual_name:latest ./worker/$actual_name

build-server:
    docker compose build server

build-client:
    docker compose build client

up:
    #! /usr/bin/env bash
    if ! docker network ls | grep -q dribble-network
    then
        docker network create dribble-network
    fi
    docker compose up

down:
    docker compose down

setup-test:
    #! /usr/bin/env bash
    # if the test-dribble-network doesn't exist, create it
    if ! docker network ls | grep -q test-dribble-network
    then
        docker network create test-dribble-network
    fi
    # start worker container
    docker run -d --rm --network test-dribble-network --name dribble-worker-postgres-84cd6fb6-2ad9-4f8b-8f95-b8701c09ea38 \
        -e DB_CREDS='{"host":"user-db-pg","port":5432,"user":"postgres","password":"postgres","dbname":"dribble"}' \
        -e REDIS_URL="redis://redis:6379/0" \
        dribble-worker-postgres:latest
    
    # start server stack
    docker compose -f server/tests/docker-compose.yml up -d

    # wait for server to be ready using our reliable script
    bash server/tests/wait-for-server.sh

    # # run tests
    pytest server/tests/
