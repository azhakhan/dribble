import { NextResponse } from "next/server";
import { connectedIds } from "@/lib/connections";

// Which stored connections currently have a live driver open on the server.
export async function GET() {
  return NextResponse.json({ connected: connectedIds() });
}
