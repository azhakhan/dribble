from app.models import Source
from sqlalchemy import create_engine, text
from app.schemas.sources import PostgresCreds
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError
import binascii
from uuid import UUID
from sqlalchemy.orm import Session
from app.models import Worker
import requests
import logging
from app.core._redis import get_result

# Set up logging
logger = logging.getLogger(__name__)


def execute_in_worker(source_id: UUID, query: str, db: Session):
    worker = db.query(Worker).filter_by(source_id=source_id).first()
    if not worker:
        raise Exception("Worker not found")

    response = requests.post(
        worker.host + "/execute/",
        json={"query": query, "query_id": str(source_id)},
        timeout=5,
    )
    print("Response", response.json())
    return response.json()


def get_query_results(query_id: str, db: Session):
    # check for results in redis
    result = get_result(query_id)
    # if results is successful, return the results
    if result["success"]:
        return result["data"]
    else:
        # return still running with 202 status code
        return {"status": "running"}, 202


def execute_query(source: Source, query: str):
    if source.dbtype == "postgres":
        creds = PostgresCreds(**source.creds)
        url = URL.create(
            "postgresql+psycopg",
            username=creds.user,
            password=creds.password,
            host=creds.host,
            port=creds.port,
            database=creds.dbname,
        )
        engine = create_engine(url, connect_args={"connect_timeout": 5})  # 5 second timeout
        try:
            with engine.connect() as conn:
                result = conn.execute(text(query))
                rows = result.fetchall()
                processed_rows = []
                for row in rows:
                    processed_row = {}
                    for key, value in row._mapping.items():
                        # Handle binary data (bytea) by converting to hex string
                        if isinstance(value, bytes):
                            hex_value = "0x" + binascii.hexlify(value).decode("ascii")
                            processed_row[key] = hex_value
                        else:
                            processed_row[key] = value
                    processed_rows.append(processed_row)
                return processed_rows
        except OperationalError as e:
            raise Exception(f"Error executing query: {e}") from e
    else:
        raise Exception("Unsupported database type")


def test_connection(source: Source):
    if source.dbtype == "postgres":
        creds = PostgresCreds(**source.creds)
        url = URL.create(
            "postgresql+psycopg",
            username=creds.user,
            password=creds.password,
            host=creds.host,
            port=creds.port,
            database=creds.dbname,
        )
        engine = create_engine(url, connect_args={"connect_timeout": 5})
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                return True
        except OperationalError:
            return False
    else:
        raise Exception("Unsupported database type")
