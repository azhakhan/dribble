import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { disconnect } from "@/lib/connections";
import { jsonError } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await disconnect(id);
    const conn = await db();
    await conn.delete(connections).where(eq(connections.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
