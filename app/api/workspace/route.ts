import { NextRequest, NextResponse } from "next/server";
import { meta } from "@/lib/metadb";
import { jsonError } from "@/lib/api";

// Single-user workspace state: open tabs, active tab, and saved layout sizes.
export async function GET() {
  try {
    const pool = await meta();
    const res = await pool.query(
      `SELECT tabs, active_tab_id, layout, tree FROM dbide_workspace WHERE id = 1`,
    );
    return NextResponse.json(res.rows[0] ?? { tabs: [], active_tab_id: null, layout: {}, tree: {} });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const pool = await meta();
    // The client always sends the full snapshot, so we set all three columns.
    const res = await pool.query(
      `INSERT INTO dbide_workspace (id, tabs, active_tab_id, layout, tree, updated_at)
       VALUES (1, $1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET
         tabs = $1,
         active_tab_id = $2,
         layout = $3,
         tree = $4,
         updated_at = now()
       RETURNING tabs, active_tab_id, layout, tree`,
      [
        JSON.stringify(body.tabs ?? []),
        body.activeTabId ?? null,
        JSON.stringify(body.layout ?? {}),
        JSON.stringify(body.tree ?? {}),
      ],
    );
    return NextResponse.json(res.rows[0]);
  } catch (err) {
    return jsonError(err);
  }
}
