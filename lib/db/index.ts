import path from "path";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";

// App metadata database (connections, notebooks, chats, workspace), managed with
// Drizzle. Reuse the pool + drizzle instance across hot reloads / lambda
// invocations via globalThis.
type DB = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as {
  __dbide_pool?: Pool;
  __dbide_db?: DB;
  __dbide_migrated?: Promise<void>;
};

function pool(): Pool {
  if (!g.__dbide_pool) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL env var is not set");
    g.__dbide_pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: true,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    });
  }
  return g.__dbide_pool;
}

function client(): DB {
  if (!g.__dbide_db) g.__dbide_db = drizzle(pool(), { schema });
  return g.__dbide_db;
}

// Apply pending migrations once per process. The migration runner is idempotent
// (it tracks applied migrations in a journal table), so this is safe to await on
// every request — it short-circuits after the first run.
function ensureMigrated(): Promise<void> {
  if (!g.__dbide_migrated) {
    g.__dbide_migrated = migrate(client(), {
      migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
    }).catch((err) => {
      g.__dbide_migrated = undefined;
      throw err;
    });
  }
  return g.__dbide_migrated;
}

/** Migrate-on-first-use, then return the Drizzle client. */
export async function db(): Promise<DB> {
  await ensureMigrated();
  return client();
}
