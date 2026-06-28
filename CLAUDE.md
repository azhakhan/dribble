@AGENTS.md

# Dribble — project guide

An AI-powered, web-based SQL IDE. Next.js (App Router) frontend + API routes,
talking to user-configured Postgres databases, with an AI data-analyst agent.

## Commands

- `npm run dev` — dev server on http://localhost:3000 (webpack)
- `npm run dev3001` — dev server on port 3001
- `npm run build` — production build
- `npm start` — run the production build
- `npm run lint` — ESLint

## Environment

Copy `.env.example` to `.env.local`. Required vars:

- `DATABASE_URL` — Postgres for app metadata (connections, notebooks, chats,
  workspace state). Schema is created/migrated automatically by `lib/metadb.ts`.
- `APP_PASSWORD` — gates the login screen.
- `APP_SECRET` — signs the session cookie and encrypts stored DB credentials.
- `ANTHROPIC_API_KEY` — powers the AI agent (`claude-opus-4-8`).

## Architecture

- `app/page.tsx` — the IDE shell: sidebar + resizable panels + tabbed workspace.
- `app/api/` — route handlers:
  - `auth/` — password login/logout, cookie sessions.
  - `connections/` — CRUD + test for user database connections.
  - `db/[id]/` — per-connection schema/table/query endpoints; `db/status`,
    `db/heartbeat`, `db/disconnect` manage the connection lifecycle.
  - `notebooks/`, `chats/`, `workspace/` — persisted user state.
  - `chat/` — the AI agent: streams via the Vercel AI SDK with schema-aware
    tools (`list_schemas`, `list_tables`, `describe_table`, `run_query`).
- `lib/drivers/` — database driver abstraction. `index.ts` is a registry keyed
  by `DatabaseType`; only `postgres` is implemented. Add new engines here.
- `lib/connections.ts` — resolves and caches live drivers per connection,
  keeping them warm vs. idling them out.
- `lib/metadb.ts` — metadata Postgres pool + schema bootstrap.
- `lib/crypto.ts` — encrypt/decrypt stored DB credentials with `APP_SECRET`.
- `lib/store.ts` — Zustand store for client-side workspace state.
- `components/` — UI: `Sidebar`, `Tabs`, `TableTab`, `NotebookTab`, `ChatTab`,
  `SqlEditor` (Monaco), `ResultsGrid` (glide-data-grid), `PaginationBar`, etc.
- `docs/` — design notes on workspace persistence and connection lifecycle.

## Conventions

- Metadata tables are prefixed `dbide_` (the package name is `dbide`).
- The AI agent runs read-only SQL by default; results shown to it are row-capped.
- New database engines: implement the driver interface in `lib/drivers/types.ts`
  and register it in `lib/drivers/index.ts`.
