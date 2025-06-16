import logging
from typing import Optional
from .models import QueryRunModifiers

logger = logging.getLogger(__name__)


class SQLBuilder:
    """Safe SQL composition utilities"""

    @staticmethod
    def build_query_with_modifiers(sql: str, modifiers: Optional[QueryRunModifiers] = None) -> str:
        """
        Build a SQL query with CTE wrapper and modifiers.

        Args:
            sql: The base SQL query
            modifiers: Optional query modifiers (limit, offset, where, order_by)

        Returns:
            The composed SQL query string
        """
        # Remove leading and trailing whitespace
        sql = sql.strip()

        # Remove trailing semicolon if it exists
        if sql.endswith(";"):
            sql = sql[:-1]

        # Wrap in CTE
        sql_to_run = f"WITH temp_query AS ({sql}) SELECT * FROM temp_query"

        # Apply modifiers if provided
        if modifiers:
            if modifiers.where:
                sql_to_run += f" WHERE {SQLBuilder._sanitize_where_clause(modifiers.where)}"
            if modifiers.order_by:
                sql_to_run += (
                    f" ORDER BY {SQLBuilder._sanitize_order_by_clause(modifiers.order_by)}"
                )
            if modifiers.limit:
                sql_to_run += f" LIMIT {modifiers.limit}"
            if modifiers.offset:
                sql_to_run += f" OFFSET {modifiers.offset}"

        # Add semicolon
        sql_to_run += ";"

        logger.info(f"Composed SQL query: {sql_to_run}")
        return sql_to_run

    @staticmethod
    def _sanitize_where_clause(where_clause: str) -> str:
        """
        Basic sanitization for WHERE clause.

        Note: This is a basic implementation. For production use, consider
        using parameterized queries or a proper SQL parser.
        """
        # Remove potentially dangerous keywords
        dangerous_keywords = [
            "DROP",
            "DELETE",
            "INSERT",
            "UPDATE",
            "ALTER",
            "CREATE",
            "TRUNCATE",
            "EXEC",
            "EXECUTE",
            "UNION",
            "SCRIPT",
        ]

        where_upper = where_clause.upper()
        for keyword in dangerous_keywords:
            if keyword in where_upper:
                raise ValueError(f"Potentially dangerous keyword '{keyword}' found in WHERE clause")

        return where_clause

    @staticmethod
    def _sanitize_order_by_clause(order_by_clause: str) -> str:
        """
        Basic sanitization for ORDER BY clause.

        Note: This is a basic implementation. For production use, consider
        using parameterized queries or a proper SQL parser.
        """
        # Remove potentially dangerous keywords
        dangerous_keywords = [
            "DROP",
            "DELETE",
            "INSERT",
            "UPDATE",
            "ALTER",
            "CREATE",
            "TRUNCATE",
            "EXEC",
            "EXECUTE",
            "UNION",
            "SCRIPT",
        ]

        order_by_upper = order_by_clause.upper()
        for keyword in dangerous_keywords:
            if keyword in order_by_upper:
                raise ValueError(
                    f"Potentially dangerous keyword '{keyword}' found in ORDER BY clause"
                )

        return order_by_clause

    @staticmethod
    def generate_result_message(result: dict, execution_time_ms: int) -> str:
        """
        Generate appropriate result message based on query type and results.

        Args:
            result: Query execution result dictionary
            execution_time_ms: Execution time in milliseconds

        Returns:
            Formatted result message string
        """
        if result["is_select_query"]:
            if result["row_count"] == 0:
                return f"Query executed successfully. No rows returned in {execution_time_ms}ms"
            elif result["row_count"] == 1:
                return f"Query executed successfully. 1 row returned in {execution_time_ms}ms"
            else:
                return f"Query executed successfully. {result['row_count']} rows returned in {execution_time_ms}ms"
        else:
            query_type = result["query_type"]
            if query_type in [
                "CREATE",
                "DROP",
                "ALTER",
                "GRANT",
                "REVOKE",
                "ANALYZE",
                "VACUUM",
                "EXPLAIN",
            ]:
                # DDL and utility statements don't have meaningful row counts
                return f"{query_type} executed successfully in {execution_time_ms}ms"
            elif result["row_count"] == 0:
                return (
                    f"{query_type} executed successfully. No rows affected in {execution_time_ms}ms"
                )
            elif result["row_count"] == 1:
                return (
                    f"{query_type} executed successfully. 1 row affected in {execution_time_ms}ms"
                )
            else:
                return f"{query_type} executed successfully. {result['row_count']} rows affected in {execution_time_ms}ms"
