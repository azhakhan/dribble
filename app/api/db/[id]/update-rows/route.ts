import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDriver } from "@/lib/connections";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";

const value = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const body = z.object({
  schema: z.string().min(1),
  table: z.string().min(1),
  /** Groups the per-row log entries of this save; generated server-side if absent. */
  sessionId: z.string().uuid().optional(),
  rows: z
    .array(
      z.object({
        pk: z.record(z.string(), value),
        set: z.record(z.string(), value),
      }),
    )
    .min(1)
    .max(1000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
    }
    const { schema, table, rows } = parsed.data;
    const sessionId = parsed.data.sessionId ?? randomUUID();

    const driver = await getDriver(id, userId);
    const conn = await db();
    const [c] = await conn
      .select({ database: connections.database })
      .from(connections)
      .where(and(eq(connections.id, id), eq(connections.userId, userId)));

    const log = (sql: string, outcome: "success" | "error", message?: string, details?: Record<string, unknown>) =>
      logAction({
        userId,
        connectionId: id,
        kind: "update_rows",
        sessionId,
        database: c?.database,
        schema,
        table,
        sql,
        outcome,
        message,
        details,
      });

    try {
      const result = await driver.updateRows(schema, table, rows);
      // One log entry per row update, so any single change (or the whole
      // session, via session_id) can be reverted later from details.old.
      for (const row of result.rows) {
        log(
          row.sql || `UPDATE "${schema}"."${table}"`,
          row.ok ? "success" : "error",
          row.error,
          { pk: row.pk, set: row.set, old: row.old ?? null },
        );
      }
      return NextResponse.json({ updated: result.updated, failed: result.failed });
    } catch (err) {
      log(
        `UPDATE "${schema}"."${table}"`,
        "error",
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  } catch (err) {
    return jsonError(err, 400);
  }
}
