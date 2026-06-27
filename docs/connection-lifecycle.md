# Database connection lifecycle

How Dribble opens, keeps, and closes the live drivers it uses to talk to your
databases. The goal: keep the connections you're actually working with warm,
while not holding connections that were opened only to browse the schema tree.

## The registry

`lib/connections.ts` keeps an in-memory `Map<connectionId, { driver, lastUsed }>`
on `globalThis` (survives hot-reload). A driver is a pooled connection to one
stored database.

- **Open (lazy):** `getDriver(id)` returns the existing driver or creates one,
  and stamps `lastUsed = now` on every call. Anything that touches a database —
  expanding a connection/schema in the sidebar, loading table data, running a
  query, a chat tool call — goes through `getDriver`, so just using a connection
  keeps it fresh.
- **Sweep (evict idle):** a 30 s interval evicts any driver whose `lastUsed` is
  older than `IDLE_EVICT_MS` (60 s) and calls `driver.end()`.
- **Status:** `connectedIds()` returns the live registry keys.

## Keeping connections warm: the heartbeat

While the page is open, the client sends a heartbeat every 25 s:

```
POST /api/db/heartbeat   body: { active: [connectionId, ...] }
```

`active` is the set of connections used by the **currently open tabs**
(`app/page.tsx` derives it from `tabs`). The server (`touch(ids)`) refreshes
`lastUsed` for **only those** connections.

This is the key design point. A connection opened just to expand a schema tree
has no open tab, so it is **not** in `active`, so the heartbeat doesn't refresh
it — and it idles out ~60–90 s after your last query against it (idle timeout +
sweep interval). Live drivers stay bounded to roughly the distinct connections
among your open tabs.

> Earlier this used `touchAll()`, which refreshed *every* driver on each
> heartbeat — so nothing ever idled out while the page was open and
> browse-only connections leaked. `touch(active)` fixes that.

## Closing connections

A driver is closed (`driver.end()`) when:

1. **It goes idle** — no open tab uses it and nothing queried it for 60 s
   (the sweep above). This is the common case.
2. **The page closes** — `pagehide` (when not entering the bfcache) fires
   `navigator.sendBeacon('/api/db/disconnect')` → `disconnectAll()`.
3. **The connection is deleted** — `DELETE /api/connections/[id]` calls
   `disconnect(id)` before removing the row.

## Reflecting status in the UI

The sidebar's database icon color reflects **real** connection status, separate
from whether the tree node is expanded (that's the chevron).

`connectedIds` in `app/page.tsx` is the union of:

1. `GET /api/db/status` (the server registry), polled every 8 s and on tab
   changes, and
2. the connections of any open **table** tab — added client-side so a
   just-opened or restored table tab shows connected instantly, before the poll.

### On reload

- If the **server process is still running**, `/api/db/status` returns whatever
  drivers are still alive; restored table tabs light up immediately (their data
  fetch reconnects), and restored expanded sidebar connections auto-fetch
  schemas (reconnecting) and turn green within ~8 s.
- After a **fresh server start** the registry is empty, so everything starts
  grey until a tab or tree expansion reconnects it. Nothing shows "connected"
  without an actual live driver.

## Tuning

- `IDLE_EVICT_MS` (`lib/connections.ts`) — how long an unused driver lingers
  (default 60 s).
- Heartbeat interval (`app/page.tsx`, 25 s) — must be comfortably below
  `IDLE_EVICT_MS` so in-use connections never get swept.
- Status poll interval (`app/page.tsx`, 8 s) — how quickly the sidebar dot
  catches up to server-side eviction.
- To be more aggressive (keep only the **active** tab's connection warm, closing
  background tabs' connections too), narrow `activeConnIds` to the active tab.
