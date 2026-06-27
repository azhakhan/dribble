import { createHash } from "crypto";
import { Pool } from "pg";

// App metadata database (connections, notebooks, chats).
// Reuse across hot reloads / lambda invocations via globalThis.
const g = globalThis as unknown as {
  __dbide_meta?: Pool;
  __dbide_schema_ready?: Promise<void>;
  // Hash of the SCHEMA_SQL that was last applied. When the schema changes,
  // this differs from the cached value so the DDL re-runs (it's idempotent),
  // instead of silently waiting for a full process restart.
  __dbide_schema_hash?: string;
};

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
-- Cached page of results per notebook cell: { [cellId]: { result, sql, page, limit, totalCount, ranAt } }
ALTER TABLE dbide_notebooks ADD COLUMN IF NOT EXISTS results jsonb NOT NULL DEFAULT '{}';
-- Single-user workspace: which tabs are open + all saved layout sizes. One row (id = 1).
CREATE TABLE IF NOT EXISTS dbide_workspace (
  id int PRIMARY KEY DEFAULT 1,
  tabs jsonb NOT NULL DEFAULT '[]',
  active_tab_id text,
  layout jsonb NOT NULL DEFAULT '{}',
  tree jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dbide_workspace_singleton CHECK (id = 1)
);
-- Expanded/collapsed state of the sidebar tree (connections, schemas, sections).
ALTER TABLE dbide_workspace ADD COLUMN IF NOT EXISTS tree jsonb NOT NULL DEFAULT '{}';
INSERT INTO dbide_workspace (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
`;

export function ensureSchema(): Promise<void> {
  const hash = createHash("sha1").update(SCHEMA_SQL).digest("hex");
  if (!g.__dbide_schema_ready || g.__dbide_schema_hash !== hash) {
    g.__dbide_schema_hash = hash;
    g.__dbide_schema_ready = metaPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        g.__dbide_schema_ready = undefined;
        g.__dbide_schema_hash = undefined;
        throw err;
      });
  }
  return g.__dbide_schema_ready;
}

export async function meta() {
  await ensureSchema();
  return metaPool();
}
