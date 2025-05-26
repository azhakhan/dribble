import docker
import uuid
import os
from app.schemas.sources import PostgresCreds
from uuid import UUID
from app.models import Worker
from sqlalchemy.orm import Session

client = docker.from_env()


def start_worker(source_id: UUID, creds: PostgresCreds, db: Session):
    container_name = f"dribble-worker-postgres-{source_id}"
    port = 8000 + (int(uuid.uuid4().int % 1000))  # random-ish port for local dev

    # Check if container with the same name already exists and remove it
    try:
        existing_container = client.containers.get(container_name)
        print(f"Container {container_name} already exists. Removing it...")
        if existing_container.status == "running":
            return
        else:
            existing_container.stop()
            existing_container.remove()
            print(f"Container {container_name} removed.")
    except docker.errors.NotFound:
        # Container doesn't exist, which is fine
        pass
    except Exception as e:
        print(f"Error while removing existing container: {str(e)}")

    # Always use the same network defined in docker-compose.yml
    network_name = "dribble-network"

    # Check if the network exists, create it if it doesn't
    try:
        client.networks.get(network_name)
        print(f"Using existing network: {network_name}")
    except docker.errors.NotFound:
        print(f"Network {network_name} not found. Creating it...")
        client.networks.create(network_name, driver="bridge")
        print(f"Network {network_name} created.")

    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379")

    container = client.containers.run(
        image="dribble-worker-postgres:latest",
        name=container_name,
        environment={
            "DB_CREDS": creds.model_dump_json(),
            "REDIS_URL": redis_url,
        },
        ports={"8000/tcp": port},
        network=network_name,
        restart_policy={"Name": "unless-stopped"},
        detach=True,
    )

    # Get container IP address within the Docker network
    container.reload()  # Refresh container data
    network_settings = container.attrs["NetworkSettings"]
    container_ip = network_settings["Networks"][network_name]["IPAddress"]

    # Container accessible URL for internal network communication
    container_url = f"http://{container_name}:8000"

    # save worker to db
    worker = Worker(
        source_id=source_id,
        container_id=container.id,
        port=port,
        host=container_url,
        ip_address=container_ip,
        status="running",
    )
    db.add(worker)
    db.commit()

    return {
        "container_id": container.id,
        "port": port,
        "host": container_url,
        "external_host": f"http://localhost:{port}",  # For access from host machine
        "ip_address": container_ip,  # Raw IP address if needed
    }


def stop_worker(container_id: str):
    container = client.containers.get(container_id)
    container.stop()
    container.remove()


def get_worker_status(container_id: str):
    container = client.containers.get(container_id)
    return container.status


def get_worker_logs(container_id: str):
    container = client.containers.get(container_id)
    return container.logs()
