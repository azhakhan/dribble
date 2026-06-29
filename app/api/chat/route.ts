import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDriver } from "@/lib/connections";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

export const maxDuration = 300;

const MODEL = "claude-opus-4-8";
const MAX_TOOL_ROWS = 100;

const SYSTEM = `You are a data analyst agent inside a database IDE, connected to a live PostgreSQL database.

Workflow:
1. Use list_schemas / list_tables / describe_table to understand the database structure. Never guess table or column names.
2. Write and execute SQL with run_query. Inspect the results. If a query fails or returns something unexpected, fix it and retry.
3. Iterate until you can answer the user's question, then give a concise answer in plain text.

Rules:
- Only run read-only queries (SELECT, WITH ... SELECT, EXPLAIN) unless the user explicitly asks you to modify data.
- Finish with a final run_query call that produces the result set best answering the user's question — the IDE renders the last query's results as a table below the chat. Then summarize the findings briefly.
- Query results shown to you are capped at ${MAX_TOOL_ROWS} rows; use aggregation/LIMIT instead of selecting everything.
- Keep prose short; the data table speaks for itself.`;

export async function POST(req: Request) {
  try {
    const { messages, connectionId, chatId }: { messages: UIMessage[]; connectionId: string; chatId?: string } =
      await req.json();
    if (!connectionId) return jsonError(new Error("connectionId required"), 400);

    const userId = await getCurrentUserId();
    const driver = await getDriver(connectionId, userId);

    const result = streamText({
      model: anthropic(MODEL),
      system: SYSTEM,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(20),
      tools: {
        list_schemas: tool({
          description: "List all schemas in the connected database.",
          inputSchema: z.object({}),
          execute: async () => ({ schemas: await driver.listSchemas() }),
        }),
        list_tables: tool({
          description: "List tables and views in a schema.",
          inputSchema: z.object({ schema: z.string() }),
          execute: async ({ schema }) => ({ tables: await driver.listTables(schema) }),
        }),
        describe_table: tool({
          description: "Get the columns and data types of a table.",
          inputSchema: z.object({ schema: z.string(), table: z.string() }),
          execute: async ({ schema, table }) => ({ columns: await driver.listColumns(schema, table) }),
        }),
        run_query: tool({
          description:
            "Execute a SQL query against the connected database and return the results. " +
            "The results of your LAST run_query call are rendered as a data table for the user.",
          inputSchema: z.object({ sql: z.string().describe("The SQL query to execute") }),
          execute: async ({ sql }) => {
            try {
              return await driver.runQuery(sql, MAX_TOOL_ROWS);
            } catch (err) {
              return { error: err instanceof Error ? err.message : String(err) };
            }
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ messages: finalMessages }) => {
        if (!chatId) return;
        try {
          const conn = await db();
          await conn
            .update(chats)
            .set({ messages: finalMessages, updatedAt: new Date() })
            .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
        } catch (err) {
          console.error("Failed to persist chat", err);
        }
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
