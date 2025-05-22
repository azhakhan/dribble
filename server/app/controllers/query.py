from app.models import Source
from sqlalchemy import create_engine, text
from app.schemas.sources import PostgresCreds
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError
import binascii


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
