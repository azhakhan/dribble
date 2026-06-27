import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/connections";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sql, limit, offset, count } = await req.json();
    if (typeof sql !== "string" || !sql.trim()) {
      return NextResponse.json({ error: "sql required" }, { status: 400 });
    }
    const driver = await getDriver(id);
    if (typeof limit === "number") {
      return NextResponse.json(
        await driver.runPagedQuery(sql, {
          limit,
          offset: typeof offset === "number" ? offset : 0,
          withCount: !!count,
        }),
      );
    }
    return NextResponse.json(await driver.runQuery(sql));
  } catch (err) {
    return jsonError(err, 400);
  }
}
