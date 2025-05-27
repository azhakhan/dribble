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
    docker compose build dribble-server

build-client:
    docker compose build dribble-client

up:
    #! /usr/bin/env bash
    if ! docker network ls | grep -q dribble-network
    then
        docker network create dribble-network
    fi
    docker compose up

down:
    docker compose down

