from app.models import Source
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.schemas.sources import PostgresCreds
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError


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
                return [dict(row._mapping) for row in rows]
        except OperationalError as e:
            raise Exception(f"Error executing query: {e}")
    else:
        raise Exception("Unsupported database type")
