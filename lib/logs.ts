import { db } from "./db";
import { logs } from "./db/schema";

export interface LogEntry {
  userId: string;
  connectionId?: string | null;
  /** What was done — "update_rows" today; later "rename_table", "run_sql", "ai_run", ... */
  kind: string;
  /** Groups entries of one user action (one save click = one UPDATE per row). */
  sessionId?: string | null;
  database?: string | null;
  schema?: string | null;
  table?: string | null;
  sql: string;
  outcome: "success" | "error";
  message?: string | null;
  /** Kind-specific payload; for "update_rows": { pk, set, old } for revert. */
  details?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget audit insert. Logging must never fail the action it records,
 * so the insert's rejection is swallowed here (same precedent as the chat
 * persist catch in app/api/chat/route.ts).
 */
export function logAction(entry: LogEntry): void {
  db()
    .then((conn) => conn.insert(logs).values(entry))
    .catch(() => {});
}
