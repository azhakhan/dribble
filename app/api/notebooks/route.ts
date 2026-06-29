import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { notebooks, notebookListColumns, notebookDetailColumns } from "@/lib/db/schema";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

const createInput = z.object({
  connectionId: z.string().nullish(),
  name: z.string().nullish(),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const conn = await db();
    const rows = await conn
      .select(notebookListColumns)
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(desc(notebooks.updatedAt));
    return NextResponse.json(rows);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { connectionId, name } = createInput.parse(await req.json());
    const conn = await db();
    const [row] = await conn
      .insert(notebooks)
      .values({
        userId,
        connectionId: connectionId ?? null,
        name: name || "Untitled query",
        cells: [{ id: crypto.randomUUID(), sql: "" }],
      })
      .returning(notebookDetailColumns);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return jsonError(err, err instanceof z.ZodError ? 400 : 500);
  }
}
