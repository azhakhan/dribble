import { NextRequest, NextResponse } from "next/server";
import { touch } from "@/lib/connections";

// Keep alive only the connections the client's open tabs are using; the rest
// idle out so we don't hold connections opened just for schema browsing.
export async function POST(req: NextRequest) {
  const { active }: { active?: string[] } = await req.json().catch(() => ({}));
  touch(Array.isArray(active) ? active : []);
  return NextResponse.json({ ok: true });
}
