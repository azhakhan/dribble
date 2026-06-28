# Dribble

**An AI-powered, open-source SQL IDE for your databases.**

![Dribble](./Screenshot.png)

Dribble is a web-based SQL IDE with a built-in AI data analyst. Connect to a
Postgres database, browse its schema, run queries in a notebook, explore tables
with sort/filter/pagination, and ask an AI agent questions about your data — all
in one tabbed workspace that remembers where you left off.

---

## Features

- **AI data analyst** — chat with an agent (Claude Opus 4.8) that inspects your
  schema, writes and runs read-only SQL, iterates on errors, and renders the
  final result set as a table.
- **SQL notebooks** — write and execute queries in a Monaco editor with syntax
  highlighting. Run with `Cmd/Ctrl + Enter`. Notebooks and their results are
  saved.
- **Schema browser** — navigate schemas and tables from a collapsible sidebar
  tree.
- **Table explorer** — browse table data with server-side pagination, column
  sorting, and a raw `WHERE`-clause filter.
- **Fast results grid** — large result sets render in a virtualized data grid.
- **Persistent workspace** — open tabs, layout/panel sizes, the expanded tree,
  and cached query/chat results survive reloads (and follow you across browsers,
  since state is stored server-side).
- **Smart connection lifecycle** — database drivers are kept warm while in use
  and idle out when not, with the sidebar reflecting live connection status.
- **Secure by default** — the whole app sits behind a password login, and stored
  database credentials are encrypted at rest.
- **Pluggable drivers** — Postgres ships today; the driver registry is built to
  add more engines (MySQL, Snowflake, …).

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Monaco Editor ·
glide-data-grid · Zustand · Vercel AI SDK (`@ai-sdk/anthropic`) · Postgres (`pg`)

## Getting started

### Prerequisites

- Node.js 20+
- A Postgres database for storing app metadata (connections, notebooks, chat
  history). Any Postgres works — local, Neon, Supabase, Vercel Postgres, etc.
- An [Anthropic API key](https://console.anthropic.com/) for the AI agent.

### Install

```bash
git clone <your-repo-url> dribble
cd dribble
npm install
```

### Configure

Copy the example env file and fill in the values:

```bash
cp .env.example .env.local
```

```bash
# Metadata storage (connections, notebooks, chat history).
# Any Postgres works — Vercel Postgres / Neon / Supabase / local.
DATABASE_URL=postgres://user:pass@host:5432/dbide

# Password that protects the whole app (login screen).
APP_PASSWORD=change-me

# Secret used to sign the session cookie and encrypt stored DB credentials.
# Generate with: openssl rand -hex 32
APP_SECRET=

# Powers the AI chat agent (claude-opus-4-8).
ANTHROPIC_API_KEY=
```

The required metadata tables are created automatically on first run.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in with `APP_PASSWORD`,
add a database connection, and start querying.

To build and run a production server:

```bash
npm run build
npm start
```

## A note on AI-generated code

This project was written largely with the help of AI coding tools (Claude Code).
All code has been reviewed before being committed, but you should review it
yourself before relying on it in production.

## License

Released under the [MIT License](./LICENSE).
