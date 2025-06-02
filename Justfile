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

test:
    #! /usr/bin/env bash

    echo "🌐 Setting up test network..."
    # if the test-dribble-network doesn't exist, create it
    if ! docker network ls | grep -q test-dribble-network
    then
        docker network create test-dribble-network
    fi
    
    echo "🚀 Starting server stack..."
    # start server stack
    docker compose -f server/tests/docker-compose.yml up -d

    echo "🧪 Running tests..."
    # run tests from server directory so coverage can find the app module
    cd server && pytest tests/

    echo "🧹 Cleaning up..."
    # stop server stack (tmpfs data will be automatically cleaned)
    docker compose -f tests/docker-compose.yml down


test-setup:
    #! /usr/bin/env bash

    echo "🌐 Setting up test network..."
    # if the test-dribble-network doesn't exist, create it
    if ! docker network ls | grep -q test-dribble-network
    then
        docker network create test-dribble-network
    fi
    
    echo "🚀 Starting server stack..."
    # start server stack
    docker compose -f server/tests/docker-compose.yml up -d

    echo "⏳ Waiting for server to be ready..."
    # wait for server to be ready using our reliable script
    bash server/tests/wait-for-server.sh


test-cov:
    #! /usr/bin/env bash
    cd server
    coverage html && open htmlcov/index.html


user-db +ARGS:
    #! /usr/bin/env bash
    docker compose -f worker/samples/docker-compose.yml {{ARGS}}
