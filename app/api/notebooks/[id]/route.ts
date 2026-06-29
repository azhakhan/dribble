import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { notebooks, notebookDetailColumns } from "@/lib/db/schema";
import { CellSchema } from "@/lib/types";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

const patchInput = z.object({
  name: z.string().nullish(),
  cells: z.array(CellSchema).nullish(),
  connectionId: z.string().nullish(),
  results: z.record(z.string(), z.unknown()).nullish(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const conn = await db();
    const [row] = await conn
      .select(notebookDetailColumns)
      .from(notebooks)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const body = patchInput.parse(await req.json());
    const conn = await db();
    // Only set the fields actually provided (COALESCE-style partial update).
    const set: Partial<typeof notebooks.$inferInsert> = { updatedAt: new Date() };
    if (body.name != null) set.name = body.name;
    if (body.cells != null) set.cells = body.cells;
    if (body.connectionId != null) set.connectionId = body.connectionId;
    if (body.results != null) set.results = body.results as typeof notebooks.$inferInsert.results;
    const [row] = await conn
      .update(notebooks)
      .set(set)
      .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
      .returning(notebookDetailColumns);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    return jsonError(err, err instanceof z.ZodError ? 400 : 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const conn = await db();
    await conn.delete(notebooks).where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
