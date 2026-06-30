# Workspace state & persistence

Dribble persists your working session **server-side** so reloading the page —
even in another tab or browser — restores the same open tabs, layout, expanded
tree, and cached query results. Each user gets their own workspace row, keyed by
`user_id` (in local mode that's the single built-in user — see
[Authentication & users](./authentication.md)).

> Why server-side and not `localStorage`? `localStorage` is per-browser, and the
> requirement is cross-browser restore. Everything therefore goes in the one
> Postgres metadata DB — no Redis, no extra store.

## What is persisted

| State | Scope | Stored in |
|-------|-------|-----------|
| Open tabs + order + active tab | global | `workspace.tabs`, `.active_tab_id` |
| Sidebar width | global | `workspace.layout.sidebarWidth` |
| Table column widths | per table tab | `layout.columnWidths[tabId]` |
| Chat results split | per chat | `layout.chatSplit[chatId]` |
| Query cell result height | per notebook + cell | `layout.cellHeights[notebookId][cellId]` |
| Expanded connections / schemas | global | `workspace.tree` |
| Query result snapshots | per notebook cell | `notebooks.results` |
| Chat result snapshots | per chat | already in `chats.messages` (tool outputs) |

## Database schema

Defined in `lib/db/schema.ts` (Drizzle ORM). The `notebooks.results`
column caches a page of results per cell, and `workspace` holds one row
**per user**:

```sql
-- Cached page of results per notebook cell:
--   { [cellId]: { result, sql, page, limit, totalCount, ranAt } }
-- notebooks.results jsonb NOT NULL DEFAULT '{}'

-- Per-user workspace (one row per user, keyed by user_id).
CREATE TABLE workspace (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tabs jsonb NOT NULL DEFAULT '[]',
  active_tab_id text,
  layout jsonb NOT NULL DEFAULT '{}',   -- sizes (see table above)
  tree jsonb NOT NULL DEFAULT '{}',     -- { connections: string[], schemas: string[] }
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Migrations run on first use

Schema changes are Drizzle migrations under `lib/db/migrations/`. On the first
call to `db()` the migrator applies any pending migrations (idempotent — it
tracks what's been applied), so a fresh database is set up automatically and
upgrades happen on next boot. Generate a new migration with `npm run db:generate`
after editing `lib/db/schema.ts`.

## API

`app/api/workspace/route.ts`:

- `GET /api/workspace` → `{ tabs, active_tab_id, layout, tree }` (the current user's row).
- `PATCH /api/workspace` → upserts the **full** snapshot (`tabs`, `activeTabId`,
  `layout`, `tree`). The client always sends the complete state, so all columns
  are set unconditionally — no `COALESCE` games, and clearing the last tab
  correctly writes `active_tab_id = null`.

Result snapshots are written through the existing `PATCH /api/notebooks/[id]`,
which now also accepts a `results` field.

## Client store (`lib/store.ts`)

The zustand store owns `tabs`, `activeTabId`, `layout`, `tree`, and a `hydrated`
flag.

- `hydrate()` runs once on mount (from `app/page.tsx`), loading `/api/workspace`.
- Every mutator (open/close/move/rename tab, all the `set*` layout/tree actions)
  calls a **debounced `persist()`** (500 ms) that writes the whole snapshot back.
- `persist()` is **gated on `hydrated`** — so the empty initial state never
  overwrites saved data before the load completes.

Layout/tree setters are intentionally fine-grained (`setSidebarWidth`,
`setColumnWidths`, `setChatSplit`, `setCellHeight`, `setConnectionExpanded`,
`setSchemaExpanded`) so components subscribe narrowly and only the relevant
subtree re-renders during a drag.

### Resizing

`components/DragHandle.tsx` is a generic pointer-drag divider that reports the
cumulative pixel delta from drag start; each call site converts that delta to a
width / height / fraction and writes it to the store (which persists it):

- **Sidebar** — `app/page.tsx` renders a vertical handle between sidebar and
  editor (clamped 200–620 px).
- **Table columns** — `ResultsGrid` is controllable; `TableTab` passes
  `columnWidths` keyed by `tab.id` and persists changes.
- **Chat split** — `ChatTab` drags the boundary above the results panel,
  storing the message-log share as a fraction.
- **Cell result height** — `NotebookTab` gives each cell's result region its own
  handle (clamped 120–900 px).

### Tree state

`ConnectionNode` / `SchemaNode` read their expanded state from
`tree.connections` / `tree.schemas` instead of local component state. On reload,
an expanded node **auto-fetches** its children (schemas/tables) via an effect —
which also reconnects it server-side. So "which DBs were open" is restored for
free.

## Result snapshots & staleness

- **Queries** (`NotebookTab`): on a successful run, the current result page is
  written to `notebooks.results[cellId]` (kept in a ref so a single-cell
  run doesn't clobber the other cells' snapshots). On reopen, cells rehydrate
  from the snapshot. A badge shows `ran <age>`, turning amber **⚠ stale** when
  the cell's SQL changed since the run *or* the snapshot is over an hour old
  (`lib/time.ts`). Re-running refreshes it.
- **Chats** (`ChatTab`): results already live inside the persisted `messages`
  (tool outputs), so they restore automatically; a faint
  `snapshot · last run <age>` note is shown above the results.
- **Table tabs** are **not** snapshotted — they re-fetch fresh on open (and
  reopen automatically on reload), so table data is always live.

## Cleanup on connection delete

Deleting a connection calls `pruneConnection(connectionId)` (store), which drops
everything tied to it: its tree entries (connection id + `connId:schema` keys),
any open tabs using it (the underlying notebooks/chats are cascade-deleted in
the DB), and the orphaned `columnWidths` / `chatSplit` / `cellHeights` entries.

See [connection-lifecycle.md](./connection-lifecycle.md) for how the driver
itself is opened and closed.
