import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/connections";
import { jsonError } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const schema = req.nextUrl.searchParams.get("schema");
    if (!schema) return NextResponse.json({ error: "schema param required" }, { status: 400 });
    const driver = await getDriver(id);
    return NextResponse.json(await driver.listTables(schema));
  } catch (err) {
    return jsonError(err);
  }
}
