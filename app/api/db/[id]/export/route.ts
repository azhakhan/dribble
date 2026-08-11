import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/connections";
import { jsonError } from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";
import { csvRow } from "@/lib/csv";

/** Strips anything that would break a Content-Disposition filename. */
function safeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_");
}

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
    // Opening the stream runs the DECLARE, so an invalid WHERE clause surfaces
    // here as a 400 rather than as a truncated download.
    const stream = await driver.openTableStream({
      schema,
      table,
      sortColumn: q.get("sortColumn") || undefined,
      sortDir: q.get("sortDir") === "desc" ? "desc" : q.get("sortDir") === "asc" ? "asc" : undefined,
      where: q.get("where") || undefined,
      columns: q.getAll("col"),
    });

    const encoder = new TextEncoder();
    const batches = stream.batches();
    let headerSent = false;
    // `pull` (rather than `start`) keeps the DB read paced by the download.
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!headerSent) {
          headerSent = true;
          controller.enqueue(encoder.encode(csvRow(stream.columns.map((c) => c.name))));
          return;
        }
        const { value, done } = await batches.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value.map(csvRow).join("")));
      },
      async cancel() {
        await batches.return(undefined);
        await stream.close();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename(`${schema}.${table}`)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
