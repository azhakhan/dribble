from sqlalchemy import text
from sqlalchemy.exc import OperationalError
import logging
from .connection_manager import get_database_connection

logger = logging.getLogger(__name__)


def get_mysql_schemas(engine):
    """
    Get comprehensive MySQL schema information including tables, views,
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
                table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
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
                is_nullable,
                column_default,
                extra
            FROM 
                information_schema.columns
            WHERE 
                table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            ORDER BY 
                table_schema, table_name, ordinal_position;
            """
            columns_result = conn.execute(text(columns_query))
            columns = [dict(row._mapping) for row in columns_result]

            # Get primary key constraints
            primary_keys_query = """
            SELECT 
                kcu.table_schema,
                kcu.table_name,
                kcu.column_name
            FROM 
                information_schema.key_column_usage kcu
                JOIN information_schema.table_constraints tc 
                    ON kcu.constraint_name = tc.constraint_name
                    AND kcu.table_schema = tc.table_schema
                    AND kcu.table_name = tc.table_name
            WHERE 
                tc.constraint_type = 'PRIMARY KEY'
                AND kcu.table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            ORDER BY 
                kcu.table_schema, kcu.table_name, kcu.ordinal_position;
            """
            primary_keys_result = conn.execute(text(primary_keys_query))
            primary_keys = [dict(row._mapping) for row in primary_keys_result]

            # Get foreign key constraints with relationships
            foreign_keys_query = """
            SELECT 
                kcu.table_schema,
                kcu.table_name,
                kcu.column_name,
                kcu.referenced_table_schema AS foreign_table_schema,
                kcu.referenced_table_name AS foreign_table_name,
                kcu.referenced_column_name AS foreign_column_name,
                kcu.constraint_name
            FROM 
                information_schema.key_column_usage kcu
            WHERE 
                kcu.referenced_table_name IS NOT NULL
                AND kcu.table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            ORDER BY 
                kcu.table_schema, kcu.table_name, kcu.ordinal_position;
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
                table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            ORDER BY 
                table_schema, table_name;
            """
            views_result = conn.execute(text(views_query))
            views = [dict(row._mapping) for row in views_result]

            # Format the result
            return _build_schema_structure(tables, columns, primary_keys, foreign_keys, views)

    except OperationalError as e:
        logger.error(f"Database connection error in get_mysql_schemas: {str(e)}")
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
        # Debug: log available keys if table_schema is missing
        if "table_schema" not in table:
            logger.error(
                f"Missing table_schema key in table dict. Available keys: {list(table.keys())}"
            )
            logger.error(f"Table dict content: {table}")
            # Try common alternative key names
            if "TABLE_SCHEMA" in table:
                schema_name = table["TABLE_SCHEMA"]
            elif "schema_name" in table:
                schema_name = table["schema_name"]
            else:
                logger.error("Cannot find schema name in table dict, skipping table")
                continue
        else:
            schema_name = table["table_schema"]

        if "table_name" not in table:
            if "TABLE_NAME" in table:
                table_name = table["TABLE_NAME"]
            elif "name" in table:
                table_name = table["name"]
            else:
                logger.error("Cannot find table name in table dict, skipping table")
                continue
        else:
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
        # Handle case-sensitivity issues in column names
        if "table_schema" not in column:
            if "TABLE_SCHEMA" in column:
                schema_name = column["TABLE_SCHEMA"]
            else:
                logger.error(
                    f"Missing table_schema in column dict. Available keys: {list(column.keys())}"
                )
                continue
        else:
            schema_name = column["table_schema"]

        if "table_name" not in column:
            if "TABLE_NAME" in column:
                table_name = column["TABLE_NAME"]
            else:
                logger.error(
                    f"Missing table_name in column dict. Available keys: {list(column.keys())}"
                )
                continue
        else:
            table_name = column["table_name"]

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            # Handle case-sensitivity for column field names
            column_name = column.get("column_name") or column.get("COLUMN_NAME")
            data_type = column.get("data_type") or column.get("DATA_TYPE")
            is_nullable = column.get("is_nullable") or column.get("IS_NULLABLE")
            column_default = column.get("column_default") or column.get("COLUMN_DEFAULT")
            extra = column.get("extra") or column.get("EXTRA")

            if not column_name or not data_type:
                logger.error(f"Missing required column info. Available keys: {list(column.keys())}")
                continue

            column_info = {
                "name": column_name,
                "type": data_type,
                "nullable": is_nullable == "YES",
            }

            # Add default value if present
            if column_default is not None:
                column_info["default"] = column_default

            # Add extra information (like auto_increment)
            if extra:
                column_info["extra"] = extra

            schemas[schema_name]["tables"][table_name]["columns"].append(column_info)

    # Add primary keys
    for pk in primary_keys:
        schema_name = pk.get("table_schema") or pk.get("TABLE_SCHEMA")
        table_name = pk.get("table_name") or pk.get("TABLE_NAME")
        column_name = pk.get("column_name") or pk.get("COLUMN_NAME")

        if not schema_name or not table_name or not column_name:
            logger.error(f"Missing required pk info. Available keys: {list(pk.keys())}")
            continue

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            schemas[schema_name]["tables"][table_name]["primary_keys"].append(column_name)

    # Add foreign keys and relationships
    for fk in foreign_keys:
        schema_name = fk.get("table_schema") or fk.get("TABLE_SCHEMA")
        table_name = fk.get("table_name") or fk.get("TABLE_NAME")
        foreign_schema = fk.get("foreign_table_schema") or fk.get("FOREIGN_TABLE_SCHEMA")
        foreign_table = fk.get("foreign_table_name") or fk.get("FOREIGN_TABLE_NAME")
        column_name = fk.get("column_name") or fk.get("COLUMN_NAME")
        foreign_column_name = fk.get("foreign_column_name") or fk.get("FOREIGN_COLUMN_NAME")
        constraint_name = fk.get("constraint_name") or fk.get("CONSTRAINT_NAME")

        if not all(
            [
                schema_name,
                table_name,
                foreign_schema,
                foreign_table,
                column_name,
                foreign_column_name,
            ]
        ):
            logger.error(f"Missing required fk info. Available keys: {list(fk.keys())}")
            continue

        if schema_name in schemas and table_name in schemas[schema_name]["tables"]:
            # Add foreign key info
            fk_info = {
                "column": column_name,
                "references_table": f"{foreign_schema}.{foreign_table}",
                "references_column": foreign_column_name,
                "constraint_name": constraint_name,
            }
            schemas[schema_name]["tables"][table_name]["foreign_keys"].append(fk_info)

            # Add to relationships - this table references another
            relationship_info = {
                "table": f"{foreign_schema}.{foreign_table}",
                "type": "references",
                "via_column": column_name,
            }
            schemas[schema_name]["tables"][table_name]["relationships"]["references"].append(
                relationship_info
            )

            # Add reverse relationship - the referenced table is referenced by this table
            if foreign_schema in schemas and foreign_table in schemas[foreign_schema]["tables"]:
                reverse_relationship_info = {
                    "table": f"{schema_name}.{table_name}",
                    "type": "referenced_by",
                    "via_column": foreign_column_name,
                }
                schemas[foreign_schema]["tables"][foreign_table]["relationships"][
                    "referenced_by"
                ].append(reverse_relationship_info)

    # Process views
    for view in views:
        schema_name = view.get("table_schema") or view.get("TABLE_SCHEMA")
        view_name = view.get("table_name") or view.get("TABLE_NAME")
        view_definition = view.get("view_definition") or view.get("VIEW_DEFINITION")

        if not schema_name or not view_name:
            logger.error(f"Missing required view info. Available keys: {list(view.keys())}")
            continue

        if schema_name not in schemas:
            schemas[schema_name] = {"tables": {}, "views": {}}

        schemas[schema_name]["views"][view_name] = {
            "definition": view_definition,
            "columns": [],  # We could add view columns if needed
        }

    return schemas
