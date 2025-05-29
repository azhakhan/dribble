import docker
import os
from app.schemas.sources import PostgresCreds
from uuid import UUID
import random
from sqlalchemy.orm import Session
from app.models import Worker
import logging
import time

logging.basicConfig(level=logging.INFO)
client = docker.from_env()

network_name = os.environ.get("DOCKER_NETWORK", "dribble-network")


class WorkerContainer:
    def __init__(self, source_id: UUID, creds: PostgresCreds):
        self.source_id = source_id
        self.creds = creds
        self.container_name = f"dribble-worker-postgres-{self.source_id}"
        self.port = 8000 + (int(random.randint(1, 999)))
        self.network_name = network_name
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
                existing_container.remove(force=True)
                return False
        except docker.errors.NotFound:
            return False

    def start(self):
        # Test credentials first
        test_result = self.test()
        if test_result.get("status") != "success":
            error_msg = test_result.get("message", "Database connection test failed")
            raise Exception(f"Database connection failed: {error_msg}")

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

        # Wait and verify container is running
        time.sleep(2)
        container.reload()
        if container.status != "running":
            container.remove(force=True)
            raise Exception("Container failed to start")

    def save_worker(self, workspace_id: UUID, db: Session):
        existing_worker = (
            db.query(Worker).filter_by(source_id=self.source_id, workspace_id=workspace_id).first()
        )

        if existing_worker:
            existing_worker.container_id = self.container_id
            existing_worker.port = self.port
            existing_worker.host = self.container_url
            existing_worker.status = "running"
            db.commit()
            db.refresh(existing_worker)
            return existing_worker
        else:
            worker = Worker(
                source_id=self.source_id,
                container_id=self.container_id,
                port=self.port,
                host=self.container_url,
                workspace_id=workspace_id,
                status="running",
            )
            db.add(worker)
            db.commit()
            db.refresh(worker)
            return worker

    def stop(self):
        if not self.container_id:
            raise Exception("Cannot stop worker: no container ID available")
        try:
            container = client.containers.get(self.container_id)
            container.stop()
            container.remove()
        except docker.errors.NotFound:
            # Container already removed, that's fine
            pass
        except Exception as e:
            raise Exception(f"Failed to stop container: {str(e)}") from e

    def test(self):
        try:
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
                remove=True,
                command=["/bin/sh", "-c", "python -m app.main test_connection 2>&1"],
            )
            output = result.decode("utf-8").strip()
            import json

            result_json = json.loads(output)
            return result_json
        except docker.errors.ContainerError as e:
            error_output = e.stderr.decode("utf-8") if e.stderr else str(e)
            try:
                import json

                return json.loads(error_output)
            except json.JSONDecodeError:
                # If we can't parse the error as JSON, provide a more helpful message
                if "connection" in error_output.lower():
                    return {
                        "status": "error",
                        "message": f"Database connection failed: {error_output}",
                    }
                elif "authentication" in error_output.lower() or "password" in error_output.lower():
                    return {
                        "status": "error",
                        "message": "Authentication failed: Invalid username or password",
                    }
                elif "host" in error_output.lower() or "resolve" in error_output.lower():
                    msg = f"Cannot reach database host: {self.creds.host}:{self.creds.port}"
                    return {
                        "status": "error",
                        "message": msg,
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"Database connection test failed: {error_output}",
                    }
        except docker.errors.ImageNotFound:
            return {
                "status": "error",
                "message": "Worker image not found. Please build the worker image first.",
            }
        except docker.errors.APIError as e:
            return {"status": "error", "message": f"Docker API error: {str(e)}"}
        except Exception as e:
            return {"status": "error", "message": f"Test failed: {str(e)}"}


def stop_worker(container_id: str) -> bool:
    try:
        container = client.containers.get(container_id)
        container.stop()
        container.remove()
        return True
    except docker.errors.NotFound:
        return True
    except Exception:
        return False


def is_healthy(container_id: str):
    try:
        container = client.containers.get(container_id)
        return container.status == "running"
    except docker.errors.NotFound:
        return False
    except Exception:
        return False
