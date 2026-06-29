import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/connections";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const q = req.nextUrl.searchParams;
    const schema = q.get("schema");
    const table = q.get("table");
    if (!schema || !table) {
      return NextResponse.json({ error: "schema and table params required" }, { status: 400 });
    }
    const driver = await getDriver(id, userId);
    const result = await driver.getTableData({
      schema,
      table,
      limit: Number(q.get("limit")) || 100,
      offset: Number(q.get("offset")) || 0,
      sortColumn: q.get("sortColumn") || undefined,
      sortDir: q.get("sortDir") === "desc" ? "desc" : q.get("sortDir") === "asc" ? "asc" : undefined,
      where: q.get("where") || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, 400);
  }
}
