import { NextRequest, NextResponse } from "next/server";
import { meta } from "@/lib/metadb";
import { jsonError } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pool = await meta();
    const res = await pool.query(`SELECT * FROM dbide_notebooks WHERE id = $1`, [id]);
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const pool = await meta();
    const res = await pool.query(
      `UPDATE dbide_notebooks SET
         name = COALESCE($2, name),
         cells = COALESCE($3, cells),
         connection_id = COALESCE($4, connection_id),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, body.name ?? null, body.cells ? JSON.stringify(body.cells) : null, body.connectionId ?? null]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pool = await meta();
    await pool.query(`DELETE FROM dbide_notebooks WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
