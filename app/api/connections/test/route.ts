import { NextRequest, NextResponse } from "next/server";
import { createDriver } from "@/lib/drivers";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  let driver;
  try {
    const body = await req.json();
    driver = createDriver({ id: "test", ...body, port: Number(body.port) || 5432 });
    await driver.runQuery("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  } finally {
    driver?.end().catch(() => {});
  }
}
