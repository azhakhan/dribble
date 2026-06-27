import { NextRequest, NextResponse } from "next/server";
import { meta } from "@/lib/metadb";
import { disconnect } from "@/lib/connections";
import { jsonError } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await disconnect(id);
    const pool = await meta();
    await pool.query(`DELETE FROM dbide_connections WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
