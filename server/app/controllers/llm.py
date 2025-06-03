from app.schemas.llm import LLMName, ChatLLMRequest
from app.models import LLM, Source
from openai import OpenAI
from app.core.encryption import decrypt_password
from app.controllers.sources import get_source_schema
import json


async def chat_llm(llm: LLM, source: Source, request: ChatLLMRequest):
    schema = await get_source_schema(str(source.id))
    system_prompt = compose_system_prompt(schema, dialect=source.dbtype, query=request.query)
    # get llm connection
    if llm.name == LLMName.openai:
        client = OpenAI(api_key=decrypt_password(llm.api_key))
        response = client.chat.completions.create(
            model=llm.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            temperature=1,
            max_tokens=2048,
            top_p=1,
        )
        print(response)
        content = response.choices[0].message.content
    else:
        raise ValueError(f"Unsupported LLM: {llm.name}")

    return {"response": content}


def compose_system_prompt(schema: dict, dialect: str, query: str | None = None):
    system_prompt = f"""
You are a senior SQL expert assisting a user in writing and editing SQL queries.

Your job is to help users:
- Generate correct and optimized SQL based on natural language requests
- Modify or improve existing SQL
- Explain what a query does in plain English
- Ensure that queries are syntactically correct and valid for the selected database

Respond only with SQL code (or explanation if explicitly requested).
Do not include markdown formatting, comments, or explanations unless asked.

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
