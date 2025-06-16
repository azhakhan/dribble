import os
import json
import sys
import logging
from sqlalchemy import text
from .models import PostgresCreds
from .connection_manager import create_database_engine, get_database_connection

logger = logging.getLogger(__name__)


def test_connection_cli():
    """
    CLI utility to test database connection.
    Reads DB_CREDS from environment and tests the connection.
    Outputs JSON result and exits with status code.
    """
    try:
        os_creds = os.environ.get("DB_CREDS")
        if not os_creds:
            raise Exception("DB_CREDS is not set")

        creds = PostgresCreds(**json.loads(os_creds))
        engine = create_database_engine(creds)

        with get_database_connection(engine) as conn:
            res = conn.execute(text("SELECT 1")).fetchone()
            if res:
                print(json.dumps({"status": "success"}))
                sys.exit(0)
            else:
                print(json.dumps({"status": "error", "message": "Failed to connect to database"}))
                sys.exit(0)

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(0)


def setup_logging():
    """Configure logging for the application"""
    logging.basicConfig(level=logging.INFO)
    return logging.getLogger(__name__)


def validate_environment():
    """
    Validate that required environment variables are set.

    Returns:
        dict: Environment configuration

    Raises:
        Exception: If required environment variables are missing
    """
    db_creds = os.environ.get("DB_CREDS")
    if not db_creds:
        raise Exception("DB_CREDS environment variable is required")

    try:
        creds = PostgresCreds(**json.loads(db_creds))
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid JSON in DB_CREDS: {e}") from e
    except Exception as e:
        raise Exception(f"Invalid DB_CREDS format: {e}") from e

    server_url = os.environ.get("SERVER_URL", "http://server:8000")

    return {"db_creds": creds, "server_url": server_url}
