import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { workspace, workspacePublicColumns } from "@/lib/db/schema";
import { jsonError } from "@/lib/api";

const WORKSPACE_ID = 1;

const patchInput = z.object({
  tabs: z.array(z.unknown()).nullish(),
  activeTabId: z.string().nullish(),
  layout: z.record(z.string(), z.unknown()).nullish(),
  tree: z.record(z.string(), z.unknown()).nullish(),
});

// Single-user workspace state: open tabs, active tab, and saved layout sizes.
export async function GET() {
  try {
    const conn = await db();
    const [row] = await conn.select(workspacePublicColumns).from(workspace).where(eq(workspace.id, WORKSPACE_ID));
    return NextResponse.json(row ?? { tabs: [], active_tab_id: null, layout: {}, tree: {} });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = patchInput.parse(await req.json());
    const conn = await db();
    // The client always sends the full snapshot, so we set all columns.
    const values = {
      id: WORKSPACE_ID,
      tabs: (body.tabs ?? []) as typeof workspace.$inferInsert.tabs,
      activeTabId: body.activeTabId ?? null,
      layout: (body.layout ?? {}) as typeof workspace.$inferInsert.layout,
      tree: (body.tree ?? {}) as typeof workspace.$inferInsert.tree,
      updatedAt: new Date(),
    };
    const [row] = await conn
      .insert(workspace)
      .values(values)
      .onConflictDoUpdate({
        target: workspace.id,
        set: {
          tabs: values.tabs,
          activeTabId: values.activeTabId,
          layout: values.layout,
          tree: values.tree,
          updatedAt: values.updatedAt,
        },
      })
      .returning(workspacePublicColumns);
    return NextResponse.json(row);
  } catch (err) {
    return jsonError(err, err instanceof z.ZodError ? 400 : 500);
  }
}
