import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { chats, chatDetailColumns, chatListColumns } from "@/lib/db/schema";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

const patchInput = z.object({
  name: z.string().nullish(),
  messages: z.array(z.unknown()).nullish(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const conn = await db();
    const [row] = await conn
      .select(chatDetailColumns)
      .from(chats)
      .where(and(eq(chats.id, id), eq(chats.userId, userId)));
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
    const set: Partial<typeof chats.$inferInsert> = { updatedAt: new Date() };
    if (body.name != null) set.name = body.name;
    if (body.messages != null) set.messages = body.messages as typeof chats.$inferInsert.messages;
    const [row] = await conn
      .update(chats)
      .set(set)
      .where(and(eq(chats.id, id), eq(chats.userId, userId)))
      .returning(chatListColumns);
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
    await conn.delete(chats).where(and(eq(chats.id, id), eq(chats.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
