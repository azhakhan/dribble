import { Pool } from "pg";

// App metadata database (connections, notebooks, chats).
// Reuse across hot reloads / lambda invocations via globalThis.
const g = globalThis as unknown as { __dbide_meta?: Pool; __dbide_schema_ready?: Promise<void> };

export function metaPool(): Pool {
  if (!g.__dbide_meta) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL env var is not set");
    g.__dbide_meta = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: true,
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    });
  }
  return g.__dbide_meta;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS dbide_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'postgres',
  host text NOT NULL,
  port int NOT NULL DEFAULT 5432,
  database text NOT NULL,
  username text NOT NULL,
  password_enc text NOT NULL,
  ssl boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dbide_notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES dbide_connections(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled query',
  cells jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dbide_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES dbide_connections(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'New chat',
  messages jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

export function ensureSchema(): Promise<void> {
  if (!g.__dbide_schema_ready) {
    g.__dbide_schema_ready = metaPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        g.__dbide_schema_ready = undefined;
        throw err;
      });
  }
  return g.__dbide_schema_ready;
}

export async function meta() {
  await ensureSchema();
  return metaPool();
}
