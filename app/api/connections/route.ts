import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { connections, connectionInput, connectionPublicColumns } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    const conn = await db();
    const rows = await conn.select(connectionPublicColumns).from(connections).orderBy(connections.createdAt);
    return NextResponse.json(rows);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = connectionInput.parse(await req.json());
    const conn = await db();
    const [row] = await conn
      .insert(connections)
      .values({
        name: input.name,
        type: input.type,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        passwordEnc: encrypt(input.password),
        ssl: input.ssl,
      })
      .returning(connectionPublicColumns);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return jsonError(err, err instanceof z.ZodError ? 400 : 500);
  }
}
