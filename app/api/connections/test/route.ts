import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { createDriver } from "@/lib/drivers";
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let driver;
  try {
    const body = await req.json();
    let password = body.password;
    // Editing an existing connection with the password left blank: test with
    // the stored credentials instead.
    if (!password && typeof body.id === "string") {
      const userId = await getCurrentUserId();
      const conn = await db();
      const [row] = await conn
        .select({ passwordEnc: connections.passwordEnc })
        .from(connections)
        .where(and(eq(connections.id, body.id), eq(connections.userId, userId)));
      if (row) password = decrypt(row.passwordEnc);
    }
    driver = createDriver({ ...body, id: "test", password, port: Number(body.port) || 5432 });
    await driver.runQuery("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  } finally {
    driver?.end().catch(() => {});
  }
}
