import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { meta } from "@/lib/metadb";
import { encrypt } from "@/lib/crypto";
import { jsonError } from "@/lib/api";

const ConnectionInput = z.object({
  name: z.string().min(1),
  type: z.literal("postgres"),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().default(false),
});

export async function GET() {
  try {
    const pool = await meta();
    const res = await pool.query(
      `SELECT id, name, type, host, port, database, username, ssl, created_at
       FROM dbide_connections ORDER BY created_at`
    );
    return NextResponse.json(res.rows);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = ConnectionInput.parse(await req.json());
    const pool = await meta();
    const res = await pool.query(
      `INSERT INTO dbide_connections (name, type, host, port, database, username, password_enc, ssl)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, type, host, port, database, username, ssl, created_at`,
      [input.name, input.type, input.host, input.port, input.database, input.username, encrypt(input.password), input.ssl]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err) {
    return jsonError(err, err instanceof z.ZodError ? 400 : 500);
  }
}
