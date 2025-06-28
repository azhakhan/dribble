from sqlalchemy import text
from sqlalchemy.exc import OperationalError
import logging

from ..common.connection_manager import get_database_connection

logger = logging.getLogger(__name__)


def get_postgres_schemas(engine):
    """
    Get comprehensive PostgreSQL schema information including tables, views,
    columns, primary keys, foreign keys, and relationships.

    Returns:
        Dict containing schema information organized by schema name
    """
    try:
        with get_database_connection(engine) as conn:
            # Get all tables
            tables_query = """
            SELECT 
                table_schema, 
                table_name 
            FROM 
                information_schema.tables 
            WHERE 
                table_schema NOT IN ('pg_catalog', 'information_schema')
                AND table_type = 'BASE TABLE'
            ORDER BY 
                table_schema, table_name;
            """
            tables_result = conn.execute(text(tables_query))
            tables = [dict(row._mapping) for row in tables_result]

            # Get all columns for each table
            columns_query = """
            SELECT 
                table_schema,
                table_name, 
                column_name, 
                data_type, 
                is_nullable
            FROM 
                information_schema.columns
            WHERE 
                table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                table_schema, table_name, ordinal_position;
            """
            columns_result = conn.execute(text(columns_query))
            columns = [dict(row._mapping) for row in columns_result]

            # Get primary key constraints
            primary_keys_query = """
            SELECT 
                tc.table_schema,
                tc.table_name,
                kcu.column_name
            FROM 
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
            WHERE 
                tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                tc.table_schema, tc.table_name, kcu.ordinal_position;
            """
            primary_keys_result = conn.execute(text(primary_keys_query))
            primary_keys = [dict(row._mapping) for row in primary_keys_result]

            # Get foreign key constraints with relationships
            foreign_keys_query = """
            SELECT 
                tc.table_schema,
                tc.table_name,
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM 
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu 
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
            WHERE 
                tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                tc.table_schema, tc.table_name, kcu.ordinal_position;
            """
            foreign_keys_result = conn.execute(text(foreign_keys_query))
            foreign_keys = [dict(row._mapping) for row in foreign_keys_result]

            # Get all views
            views_query = """
            SELECT 
                table_schema, 
                table_name,
                view_definition
            FROM 
                information_schema.views
            WHERE 
                table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                table_schema, table_name;
            """
            views_result = conn.execute(text(views_query))
            views = [dict(row._mapping) for row in views_result]

            # Format the result
            return _build_schema_structure(tables, columns, primary_keys, foreign_keys, views)

    except OperationalError as e:
        logger.error(f"Database connection error in get_postgres_schemas: {str(e)}")
        raise Exception(f"Error getting schemas: {e}") from e


def _build_schema_structure(tables, columns, primary_keys, foreign_keys, views):
    """
    Build the structured schema representation from raw query results.

    Args:
        tables: List of table dictionaries
        columns: List of column dictionaries
        primary_keys: List of primary key dictionaries
        foreign_keys: List of foreign key dictionaries
        views: List of view dictionaries

    Returns:
        Dict containing organized schema information
    """
    schemas = {}

    # Process tables and their columns
    for table in tables:
        schema_name = table["table_schema"]
        table_name = table["table_name"]

        if schema_name not in schemas:
            schemas[schema_name] = {"tables": {}, "views": {}}

        schemas[schema_name]["tables"][table_name] = {
            "columns": [],
            "primary_keys": [],
            "foreign_keys": [],
            "relationships": {
                "references": [],  # Tables this table references
                "referenced_by": [],  # Tables that reference this table
            },
        }

    # Add columns to their respective tables
    for column in columns:
        schema_name = column["table_schema"]
        table_name = column["table_name"]

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            schemas[schema_name]["tables"][table_name]["columns"].append(
                {
                    "name": column["column_name"],
                    "type": column["data_type"],
                    "nullable": column["is_nullable"] == "YES",
                }
            )

    # Add primary keys
    for pk in primary_keys:
        schema_name = pk["table_schema"]
        table_name = pk["table_name"]

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            schemas[schema_name]["tables"][table_name]["primary_keys"].append(pk["column_name"])

    # Add foreign keys and relationships
    for fk in foreign_keys:
        schema_name = fk["table_schema"]
        table_name = fk["table_name"]
        foreign_schema = fk["foreign_table_schema"]
        foreign_table = fk["foreign_table_name"]

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            # Add foreign key info
            fk_info = {
                "column": fk["column_name"],
                "references_table": f"{foreign_schema}.{foreign_table}",
                "references_column": fk["foreign_column_name"],
                "constraint_name": fk["constraint_name"],
            }
            schemas[schema_name]["tables"][table_name]["foreign_keys"].append(fk_info)

            # Add to relationships - this table references another
            relationship_info = {
                "table": f"{foreign_schema}.{foreign_table}",
                "type": "references",
                "local_column": fk["column_name"],
                "foreign_column": fk["foreign_column_name"],
            }
            schemas[schema_name]["tables"][table_name]["relationships"]["references"].append(
                relationship_info
            )

            # Add reverse relationship - the referenced table is referenced by this table
            if foreign_schema in schemas and foreign_table in schemas[foreign_schema]["tables"]:
                reverse_relationship = {
                    "table": f"{schema_name}.{table_name}",
                    "type": "referenced_by",
                    "local_column": fk["foreign_column_name"],
                    "foreign_column": fk["column_name"],
                }
                schemas[foreign_schema]["tables"][foreign_table]["relationships"][
                    "referenced_by"
                ].append(reverse_relationship)

    # Process views
    for view in views:
        schema_name = view["table_schema"]
        view_name = view["table_name"]

        if schema_name not in schemas:
            schemas[schema_name] = {"tables": {}, "views": {}}

        schemas[schema_name]["views"][view_name] = {"definition": view["view_definition"]}

    return schemas
