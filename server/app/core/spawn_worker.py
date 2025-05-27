import docker
import os
from app.schemas.sources import PostgresCreds
from uuid import UUID
import random
from sqlalchemy.orm import Session
from app.models import Worker

client = docker.from_env()


class WorkerContainer:
    def __init__(self, source_id: UUID, creds: PostgresCreds):
        self.source_id = source_id
        self.creds = creds
        self.container_name = f"dribble-worker-postgres-{self.source_id}"
        self.port = 8000 + (int(random.randint(1, 999)))
        self.network_name = "dribble-network"
        self.container_url = f"http://{self.container_name}:8000"
        self.redis_url = os.environ.get("REDIS_URL", "redis://redis:6379")
        self.container_id = None
        self.worker_id = None

    def already_exists(self):
        try:
            existing_container = client.containers.get(self.container_name)
            if existing_container.status == "running":
                self.container_id = existing_container.id
                return True
            else:
                # Container exists but not running, try to restart it
                try:
                    existing_container.start()
                    self.container_id = existing_container.id
                    return True
                except Exception:
                    # If restart fails, remove it
                    existing_container.stop()
                    existing_container.remove()
                    return False
        except docker.errors.NotFound:
            # Container doesn't exist, which is fine
            return False
        except Exception as e:
            raise Exception(f"Error while checking existing container: {str(e)}") from e

    def start(self):
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
        self.container_id = container.id

    def save_worker(self, db: Session):
        # Check if worker already exists for this source
        existing_worker = db.query(Worker).filter_by(source_id=self.source_id).first()

        if existing_worker:
            # Update existing worker record
            existing_worker.container_id = self.container_id
            existing_worker.port = self.port
            existing_worker.host = self.container_url
            existing_worker.status = "running"
            db.commit()
            db.refresh(existing_worker)
            return existing_worker
        else:
            # Create new worker record
            worker = Worker(
                source_id=self.source_id,
                container_id=self.container_id,
                port=self.port,
                host=self.container_url,
                status="starting",
            )
            db.add(worker)
            db.commit()
            db.refresh(worker)
            return worker

    def stop(self):
        container = client.containers.get(self.container_id)
        container.stop()
        container.remove()

    def test(self):
        try:
            return client.containers.run(
                image="dribble-worker-postgres:latest",
                name=self.container_name,
                environment={
                    "DB_CREDS": self.creds.model_dump_json(),
                    "REDIS_URL": self.redis_url,
                },
                ports={"8000/tcp": self.port},
                network=self.network_name,
                restart_policy={"Name": "no"},
                detach=False,
                remove=True,
                command=["/bin/sh", "-c", "python -m app.main test_connection 2>&1"],
            )
        except docker.errors.ContainerError as e:
            return e.stderr or str(e)


def stop_worker(container_id: str):
    container = client.containers.get(container_id)
    container.stop()
    container.remove()


def is_healthy(container_id: str):
    try:
        container = client.containers.get(container_id)
        return container.status == "running"
    except docker.errors.NotFound:
        # Container doesn't exist anymore
        return False
    except Exception:
        # Any other error means the container is not healthy
        return False
