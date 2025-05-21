from app.models import Source
from sqlalchemy import create_engine, text
from sqlalchemy import URL
from app.schemas.sources import PostgresCreds
from sqlalchemy.exc import OperationalError


def get_source_schemas(source: Source):
    if source.dbtype == "postgres":
        return get_postgres_schemas(source)
    else:
        raise Exception("Unsupported database type")


def get_postgres_schemas(source: Source):
    creds = PostgresCreds(**source.creds)
    url = URL.create(
        "postgresql+psycopg",
        username=creds.user,
        password=creds.password,
        host=creds.host,
        port=creds.port,
        database=creds.dbname,
    )

    engine = create_engine(url, connect_args={"connect_timeout": 10})

    try:
        with engine.connect() as conn:
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
            schemas = {}

            # Process tables and their columns
            for table in tables:
                schema_name = table["table_schema"]
                table_name = table["table_name"]

                if schema_name not in schemas:
                    schemas[schema_name] = {"tables": {}, "views": {}}

                schemas[schema_name]["tables"][table_name] = {"columns": []}

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

            # Process views
            for view in views:
                schema_name = view["table_schema"]
                view_name = view["table_name"]

                if schema_name not in schemas:
                    schemas[schema_name] = {"tables": {}, "views": {}}

                schemas[schema_name]["views"][view_name] = {"definition": view["view_definition"]}

            return schemas

    except OperationalError as e:
        raise Exception(f"Error connecting to database: {e}")
