from app.schemas.llm import LLMName, ChatLLMRequest
from app.models import LLM, Source
from openai import OpenAI
from app.core.encryption import decrypt_password
from app.controllers.sources import get_source_schema
from app.controllers.query import execute_in_worker, get_query_results
import json
import re
import time


async def chat_llm(llm: LLM, source: Source, request: ChatLLMRequest):
    schema = await get_source_schema(str(source.id))
    system_prompt = compose_system_prompt(schema, dialect=source.dbtype, query=request.query)

    # Define tools that the LLM can use
    tools = [
        {
            "type": "function",
            "function": {
                "name": "execute_sql_query",
                "description": "Execute a SQL query against the database and return the results. Use this to run queries and analyze data before providing your final response. Only use SELECT queries for data exploration. Avoid destructive operations.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The SQL query to execute (SELECT statements only)",
                        },
                        "reasoning": {
                            "type": "string",
                            "description": "Brief explanation of why you're running this query",
                        },
                    },
                    "required": ["query", "reasoning"],
                },
            },
        }
    ]

    # get llm connection
    if llm.name == LLMName.openai:
        client = OpenAI(api_key=decrypt_password(llm.api_key))

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message},
        ]

        # Track tool usage for safety
        tool_call_count = 0
        max_tool_calls = 5  # Prevent infinite loops

        # Initial call with tools
        response = client.chat.completions.create(
            model=llm.model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=1,
            max_tokens=2048,
            top_p=1,
        )

        # Handle tool calls
        while response.choices[0].message.tool_calls and tool_call_count < max_tool_calls:
            tool_call_count += 1

            # Add the assistant's message with tool calls to conversation
            messages.append(response.choices[0].message)

            # Process each tool call
            for tool_call in response.choices[0].message.tool_calls:
                if tool_call.function.name == "execute_sql_query":
                    try:
                        # Parse function arguments
                        function_args = json.loads(tool_call.function.arguments)
                        sql_query = function_args["query"]
                        reasoning = function_args["reasoning"]

                        # Basic safety check for destructive queries
                        if not is_safe_query(sql_query):
                            error_response = {
                                "role": "tool",
                                "content": json.dumps(
                                    {
                                        "error": "Query rejected for safety reasons. Only SELECT queries are allowed for data exploration.",
                                        "query": sql_query,
                                    }
                                ),
                                "tool_call_id": tool_call.id,
                            }
                            messages.append(error_response)
                            continue

                        print(f"LLM is executing query: {sql_query}")
                        print(f"Reasoning: {reasoning}")

                        # Execute the query
                        result = execute_in_worker(source.id, sql_query)

                        query_id = result.get("query_id")
                        if query_id:
                            # try to get query results multiple times
                            for _ in range(5):
                                result = await get_query_results(query_id)
                                if result.get("status") == "success":
                                    break
                                time.sleep(1)

                            if result.get("status") == "error":
                                result = result.get("error")
                            else:
                                result = result.get("data")

                        # Add tool response to conversation
                        tool_response = {
                            "role": "tool",
                            "content": json.dumps(
                                {
                                    "query": sql_query,
                                    "result": result,
                                    "reasoning": reasoning,
                                    "status": "success",
                                }
                            ),
                            "tool_call_id": tool_call.id,
                        }
                        messages.append(tool_response)

                    except Exception as e:
                        # Handle query execution errors
                        error_response = {
                            "role": "tool",
                            "content": json.dumps(
                                {
                                    "error": f"Query execution failed: {str(e)}",
                                    "query": function_args.get("query", "Unknown query"),
                                    "status": "error",
                                }
                            ),
                            "tool_call_id": tool_call.id,
                        }
                        messages.append(error_response)

            # Make follow-up call to get LLM's response after tool execution
            response = client.chat.completions.create(
                model=llm.model,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=1,
                max_tokens=2048,
                top_p=1,
            )

        content = response.choices[0].message.content
    else:
        raise ValueError(f"Unsupported LLM: {llm.name}")

    return {"response": content}


def is_safe_query(query: str) -> bool:
    """
    Basic safety check to ensure only SELECT queries are executed.
    This prevents destructive operations like DELETE, DROP, etc.
    """
    # Remove comments and normalize whitespace
    cleaned_query = re.sub(r"--.*$", "", query, flags=re.MULTILINE)
    cleaned_query = re.sub(r"/\*.*?\*/", "", cleaned_query, flags=re.DOTALL)
    cleaned_query = " ".join(cleaned_query.split()).strip().upper()

    # Check if query starts with SELECT or WITH (for CTEs)
    if not (cleaned_query.startswith("SELECT") or cleaned_query.startswith("WITH")):
        return False

    # Check for dangerous keywords
    dangerous_keywords = [
        "DELETE",
        "DROP",
        "TRUNCATE",
        "INSERT",
        "UPDATE",
        "ALTER",
        "CREATE",
        "GRANT",
        "REVOKE",
        "EXEC",
        "EXECUTE",
    ]

    for keyword in dangerous_keywords:
        if keyword in cleaned_query:
            return False

    return True


def compose_system_prompt(schema: dict, dialect: str, query: str | None = None):
    system_prompt = f"""
You are a senior SQL expert assisting a user in writing and editing SQL queries.

Your job is to help users:
- Generate correct and optimized SQL based on natural language requests
- Modify or improve existing SQL
- Explain what a query does in plain English
- Ensure that queries are syntactically correct and valid for the selected database

You have access to tools that allow you to execute SQL queries against the database. Use these tools to:
- Test queries before providing final results
- Analyze data to provide better insights
- Verify that queries work correctly
- Gather sample data to better understand the user's needs

When using tools:
- Always explain your reasoning for running a query
- Start with simple queries to understand the data structure
- Use the results to inform your final response
- Only use SELECT statements for exploration (no INSERT, UPDATE, DELETE, etc.)
- Limit result sets appropriately to avoid overwhelming output

Respond with clear, well-formatted SQL code or explanations.
Do not include markdown formatting in SQL responses unless explicitly requested.

Use the following rules:
- Follow the syntax for the target database: {dialect}
- Refer only to available tables, columns, and relationships provided in the schema
- Never hallucinate table or column names
- Avoid destructive commands (DROP, DELETE, TRUNCATE) unless explicitly asked
- Avoid using LIMIT without an ORDER BY clause
- Prefer CTEs for readability when queries are complex

If the user provides a partial query, improve or complete it while preserving intent.
If the user provides both a query and a request (e.g. "optimize this"), rewrite accordingly.

Your output must be ready to run.

Here is the current database schema:

{json.dumps(schema)}

The user is working in this context.
"""
    if query:
        system_prompt += f"""
Here is the user's query:

{query}
"""
    return system_prompt
