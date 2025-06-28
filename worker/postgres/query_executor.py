from sqlalchemy import text
from sqlalchemy.exc import OperationalError
import binascii
import logging
import datetime
import decimal
import uuid

from ..common.connection_manager import get_database_connection
from ..common.exceptions import QueryExecutionError, DatabaseConnectionError

logger = logging.getLogger(__name__)


def detect_query_type(query: str) -> str:
    """Detect the type of SQL query"""
    query_trimmed = query.strip().upper()
    if query_trimmed.startswith("SELECT"):
        return "SELECT"
    elif query_trimmed.startswith("INSERT"):
        return "INSERT"
    elif query_trimmed.startswith("UPDATE"):
        return "UPDATE"
    elif query_trimmed.startswith("DELETE"):
        return "DELETE"
    elif query_trimmed.startswith("CREATE"):
        return "CREATE"
    elif query_trimmed.startswith("DROP"):
        return "DROP"
    elif query_trimmed.startswith("ALTER"):
        return "ALTER"
    elif query_trimmed.startswith("TRUNCATE"):
        return "TRUNCATE"
    elif query_trimmed.startswith("GRANT"):
        return "GRANT"
    elif query_trimmed.startswith("REVOKE"):
        return "REVOKE"
    elif query_trimmed.startswith("COPY"):
        return "COPY"
    elif query_trimmed.startswith("ANALYZE"):
        return "ANALYZE"
    elif query_trimmed.startswith("VACUUM"):
        return "VACUUM"
    elif query_trimmed.startswith("EXPLAIN"):
        return "EXPLAIN"
    elif query_trimmed.startswith("WITH"):
        # Common Table Expressions (CTE) - check if it's a SELECT
        if "SELECT" in query_trimmed:
            return "SELECT"
        else:
            return "CTE"
    else:
        return "OTHER"


def execute_query(query: str, engine):
    """
    Execute a SQL query and return structured result with appropriate messaging.

    Examples of result messages:
    - SELECT: "Query executed successfully. 42 rows returned in 156ms"
    - INSERT: "INSERT executed successfully. 5 rows affected in 23ms"
    - UPDATE: "UPDATE executed successfully. 1 row affected in 12ms"
    - DELETE: "DELETE executed successfully. No rows affected in 8ms"
    - CREATE: "CREATE executed successfully in 45ms"
    - DROP: "DROP executed successfully in 12ms"
    """
    logger.info(f"[{datetime.datetime.now()}] In execute_query function")
    query_type = detect_query_type(query)

    try:
        with get_database_connection(engine) as conn:
            logger.info(f"[{datetime.datetime.now()}] Connected to database")
            result = conn.execute(text(query))

            if query_type == "SELECT":
                # Handle SELECT queries - fetch rows
                rows = result.fetchall()
                processed_rows = []
                logger.info(f"[{datetime.datetime.now()}] Rows fetched: {len(rows)}")

                if len(rows) == 0:
                    return {
                        "data": [],
                        "row_count": 0,
                        "is_select_query": True,
                        "query_type": query_type,
                    }

                for row in rows:
                    processed_row = {}
                    for key, value in row._mapping.items():
                        # Handle binary data (bytea) by converting to hex string
                        if isinstance(value, bytes):
                            hex_value = "0x" + binascii.hexlify(value).decode("ascii")
                            processed_row[key] = hex_value
                        # Handle decimal values by converting to float
                        elif isinstance(value, decimal.Decimal):
                            processed_row[key] = float(value)
                        # Handle datetime objects by converting to ISO format string
                        elif isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
                            processed_row[key] = value.isoformat()
                        # Handle UUID objects by converting to string
                        elif isinstance(value, uuid.UUID):
                            processed_row[key] = str(value)
                        # Handle timedelta objects by converting to total seconds
                        elif isinstance(value, datetime.timedelta):
                            processed_row[key] = value.total_seconds()
                        # Handle sets by converting to list
                        elif isinstance(value, set):
                            processed_row[key] = list(value)
                        # Handle any other non-JSON serializable types by converting to string
                        elif not isinstance(value, (str, int, float, bool, list, dict, type(None))):
                            processed_row[key] = str(value)
                        else:
                            processed_row[key] = value
                    processed_rows.append(processed_row)

                logger.info(f"[{datetime.datetime.now()}] Processed rows: {processed_rows}")
                return {
                    "data": processed_rows,
                    "row_count": len(processed_rows),
                    "is_select_query": True,
                    "query_type": query_type,
                }
            else:
                # Handle non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
                affected_rows = result.rowcount if result.rowcount is not None else 0
                logger.info(
                    f"[{datetime.datetime.now()}] {query_type} query affected {affected_rows} rows"
                )

                # For DDL and utility statements, rowcount is often -1 or None
                if (
                    query_type
                    in [
                        "CREATE",
                        "DROP",
                        "ALTER",
                        "GRANT",
                        "REVOKE",
                        "ANALYZE",
                        "VACUUM",
                        "EXPLAIN",
                    ]
                    and affected_rows <= 0
                ):
                    affected_rows = 0  # These statements don't have meaningful row counts

                return {
                    "data": [],
                    "row_count": affected_rows,
                    "is_select_query": False,
                    "query_type": query_type,
                }

    except OperationalError as e:
        logger.error(f"[{datetime.datetime.now()}] Database error: {str(e)}")
        raise QueryExecutionError(
            f"Error executing {query_type} query",
            original_exception=e,
            query=query,
            query_type=query_type,
        )
    except DatabaseConnectionError:
        # Re-raise database connection errors as-is
        raise
    except Exception as e:
        logger.error(
            f"[{datetime.datetime.now()}] Unexpected error during query execution: {str(e)}"
        )
        raise QueryExecutionError(
            f"Unexpected error executing {query_type} query",
            original_exception=e,
            query=query,
            query_type=query_type,
        )
