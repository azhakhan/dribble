import { NextResponse } from "next/server";
import { touchAll } from "@/lib/connections";

export async function POST() {
  touchAll();
  return NextResponse.json({ ok: true });
}
