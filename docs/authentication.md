# Authentication & users

How Dribble decides who you are. The design goal: **zero friction when running
locally, real multi-user auth when deployed** — with the same code path for both,
so business logic never branches on "which mode are we in".

## Two modes, chosen by configuration

There is no `AUTH_MODE` flag. The mode is derived from whether Google OAuth is
configured:

| Configuration | Mode | Behavior |
|---|---|---|
| `AUTH_GOOGLE_ID` **unset** | **Local** | No login screen. Every request is attributed to a single built-in *sentinel* user. |
| `AUTH_GOOGLE_ID` **set** | **Hosted** | "Sign in with Google" is required; each person's data is private to them. |

Run it on your laptop with nothing configured and it just works, no password.
Set two env vars on Vercel and it becomes a private, multi-user app.

## The spine: always resolve a user

Every API route calls `getCurrentUserId()` (`lib/auth.ts`) and scopes its queries
by the returned id. That function is the *only* place the two modes diverge:

- **Local** → returns the fixed sentinel id
  `00000000-0000-0000-0000-000000000000` (seeded by migration `0001`).
- **Hosted** → returns the signed-in user's id from the Auth.js session, or
  throws `401` if there is none.

Because `userId` is always populated, the data layer is identical in both modes —
`WHERE user_id = $current`. There is no per-mode branching in the routes.

## What's private to a user

`connections`, `notebooks`, `chats`, and the `workspace` row are all owned via a
`user_id` foreign key (`lib/db/schema.ts`). A connection id alone cannot reach
another user's database: `getDriver()` re-checks ownership on every call,
including cache hits (`lib/connections.ts`).

Connections are **private per user** by design — there is no sharing. (A shared/
team model would be a separate, larger feature.)

## Hosted mode internals (Auth.js v5)

Library: [Auth.js / NextAuth v5](https://authjs.dev), Google provider only, **JWT
session strategy** (no database adapter). Two files, split so the Edge runtime
never imports `pg`:

- **`auth.config.ts`** — Edge-safe config: the Google provider plus pure,
  DB-free callbacks (allowlist check, session shaping). Imported by `proxy.ts`.
- **`lib/auth.ts`** — full config used by Node route handlers. Adds the `jwt`
  callback that upserts the signed-in account into `dbide_users` and stamps the
  internal id onto the token, then re-exports `handlers`, `auth`, `signIn`,
  `signOut`, plus `getCurrentUserId()`.

Request gating lives in **`proxy.ts`** (Next 16's renamed middleware): in local
mode it passes everything through; in hosted mode it redirects unauthenticated
page requests to `/login` and returns `401` for `/api/*`. Static assets and the
auth endpoints are always public.

### Restricting who can sign in

With Google configured but **no allowlist**, any Google account is accepted — fine
for a throwaway deploy, not for a public URL. Restrict with either or both:

- `AUTH_ALLOWED_EMAILS` — comma-separated exact addresses.
- `AUTH_ALLOWED_DOMAIN` — comma-separated domains (e.g. `example.com`).

Enforced in the `signIn` callback (`auth.config.ts`). Rejected accounts are sent
to `/login?error=AccessDenied`, which renders a styled message rather than Auth.js's
default error page (`pages.error` points back at `/login`).

## Secrets & Google setup

- `APP_SECRET` is required regardless of mode — it encrypts stored DB credentials
  (`lib/crypto.ts`) **and** signs the auth session (unless a dedicated
  `AUTH_SECRET` is set).
- Google OAuth client (type **Web application**) needs the redirect URI
  `<origin>/api/auth/callback/google` registered exactly, e.g.
  `http://localhost:3001/api/auth/callback/google`. Set `AUTH_URL` to pin the
  origin behind a proxy or on a non-default port.

See `.env.example` for the full annotated list.

## Migrating existing data

Migration `lib/db/migrations/0001_*.sql` seeds the sentinel user, adds the
`user_id` columns as nullable, backfills every pre-existing row to the sentinel,
*then* enforces `NOT NULL` + foreign keys, and finally re-keys `dbide_workspace`
from its old singleton `id` to `user_id`. So upgrading an existing single-user
install keeps all data, now owned by the local user.
