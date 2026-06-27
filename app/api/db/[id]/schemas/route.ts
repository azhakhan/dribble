import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/connections";
import { jsonError } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const driver = await getDriver(id);
    return NextResponse.json(await driver.listSchemas());
  } catch (err) {
    return jsonError(err);
  }
}
