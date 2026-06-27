import { NextRequest, NextResponse } from "next/server";
import { meta } from "@/lib/metadb";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    const pool = await meta();
    const res = await pool.query(
      `SELECT id, connection_id, name, created_at, updated_at FROM dbide_chats ORDER BY updated_at DESC`
    );
    return NextResponse.json(res.rows);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { connectionId, name } = await req.json();
    const pool = await meta();
    const res = await pool.query(
      `INSERT INTO dbide_chats (connection_id, name) VALUES ($1, $2) RETURNING *`,
      [connectionId ?? null, name || "New chat"]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
