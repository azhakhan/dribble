import { eq } from "drizzle-orm";
import { db } from "./db";
import { connections } from "./db/schema";
import { decrypt } from "./crypto";
import { createDriver, type ConnectionConfig, type DatabaseDriver, type DatabaseType } from "./drivers";

interface Entry {
  driver: DatabaseDriver;
  lastUsed: number;
}

const IDLE_EVICT_MS = 60_000;

const g = globalThis as unknown as {
  __dbide_conns?: Map<string, Entry>;
  __dbide_sweeper?: ReturnType<typeof setInterval>;
};

function registry(): Map<string, Entry> {
  if (!g.__dbide_conns) {
    g.__dbide_conns = new Map();
    g.__dbide_sweeper = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of g.__dbide_conns!) {
        if (now - entry.lastUsed > IDLE_EVICT_MS) {
          g.__dbide_conns!.delete(id);
          entry.driver.end().catch(() => {});
        }
      }
    }, 30_000);
    g.__dbide_sweeper.unref?.();
  }
  return g.__dbide_conns;
}

export async function loadConnectionConfig(id: string): Promise<ConnectionConfig> {
  const conn = await db();
  const [r] = await conn.select().from(connections).where(eq(connections.id, id));
  if (!r) throw new Error("Connection not found");
  return {
    id: r.id,
    name: r.name,
    type: r.type as DatabaseType,
    host: r.host,
    port: r.port,
    database: r.database,
    username: r.username,
    password: decrypt(r.passwordEnc),
    ssl: r.ssl,
  };
}

/** Get (or lazily open) a driver for a stored connection. */
export async function getDriver(connectionId: string): Promise<DatabaseDriver> {
  const reg = registry();
  const entry = reg.get(connectionId);
  if (entry) {
    entry.lastUsed = Date.now();
    return entry.driver;
  }
  const cfg = await loadConnectionConfig(connectionId);
  const driver = createDriver(cfg);
  reg.set(connectionId, { driver, lastUsed: Date.now() });
  return driver;
}

/**
 * Keep the given connections warm; everything else is left to idle out. The
 * client passes the connections its open tabs use, so connections opened just
 * to browse the schema tree get evicted ~60s after the last query.
 */
export function touch(ids: string[]): void {
  const now = Date.now();
  const keep = new Set(ids);
  for (const [id, entry] of registry()) {
    if (keep.has(id)) entry.lastUsed = now;
  }
}

/** Ids of connections with a live driver open right now. */
export function connectedIds(): string[] {
  return [...registry().keys()];
}

export async function disconnect(connectionId: string): Promise<void> {
  const reg = registry();
  const entry = reg.get(connectionId);
  if (entry) {
    reg.delete(connectionId);
    await entry.driver.end().catch(() => {});
  }
}

export async function disconnectAll(): Promise<void> {
  const reg = registry();
  const entries = [...reg.values()];
  reg.clear();
  await Promise.allSettled(entries.map((e) => e.driver.end()));
}
