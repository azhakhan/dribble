import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { connections, connectionInput, connectionPublicColumns } from "@/lib/db/schema";
import { disconnect } from "@/lib/connections";
import { encrypt } from "@/lib/crypto";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

// An empty/absent password means "keep the stored one".
const connectionPatch = connectionInput.extend({ password: z.string().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const input = connectionPatch.parse(await req.json());
    const conn = await db();
    const [row] = await conn
      .update(connections)
      .set({
        name: input.name,
        type: input.type,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        ssl: input.ssl,
        ...(input.password ? { passwordEnc: encrypt(input.password) } : {}),
      })
      .where(and(eq(connections.id, id), eq(connections.userId, userId)))
      .returning(connectionPublicColumns);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Drop any live driver so the next query picks up the new settings.
    await disconnect(id);
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
    const deleted = await conn
      .delete(connections)
      .where(and(eq(connections.id, id), eq(connections.userId, userId)))
      .returning({ id: connections.id });
    if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await disconnect(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
