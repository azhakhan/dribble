import { NextResponse } from "next/server";
import { disconnectAll } from "@/lib/connections";

// Called via navigator.sendBeacon when the page closes.
export async function POST() {
  await disconnectAll();
  return NextResponse.json({ ok: true });
}
