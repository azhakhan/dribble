import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { UIMessage } from "ai";
import type { Cell, CellResults } from "@/lib/types";
import type { Layout, Tab, TreeState } from "@/lib/store";

// Metadata DB (app-owned) schema. Mirrors the DDL that lib/metadb.ts used to
// apply by hand. JSONB columns are strongly typed via .$type<>() so reads come
// back typed instead of `any`. Table/column names keep the historical `dbide_`
// prefix and snake_case so existing data and migrations line up.

// App users. In local mode (no Google OAuth configured) everything is owned by a
// single sentinel user seeded by the migration; in hosted mode one row per
// Google account, upserted by email on sign-in. See lib/auth.ts.
export const users = pgTable("dbide_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connections = pgTable("dbide_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("postgres"),
  host: text("host").notNull(),
  port: integer("port").notNull().default(5432),
  database: text("database").notNull(),
  username: text("username").notNull(),
  passwordEnc: text("password_enc").notNull(),
  ssl: boolean("ssl").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notebooks = pgTable("dbide_notebooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled query"),
  cells: jsonb("cells").$type<Cell[]>().notNull().default([]),
  results: jsonb("results").$type<CellResults>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chats = pgTable("dbide_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("New chat"),
  messages: jsonb("messages").$type<UIMessage[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-user workspace: one row per user holding open tabs + saved layout.
export const workspace = pgTable("dbide_workspace", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tabs: jsonb("tabs").$type<Tab[]>().notNull().default([]),
  activeTabId: text("active_tab_id"),
  layout: jsonb("layout").$type<Partial<Layout>>().notNull().default({}),
  tree: jsonb("tree").$type<Partial<TreeState>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Inferred row types — use these instead of hand-written interfaces.
export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Notebook = typeof notebooks.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Workspace = typeof workspace.$inferSelect;

// Zod is the single source of truth for input validation, derived from the
// tables above. Refine where the API contract differs from raw column shapes.
export const connectionInsertSchema = createInsertSchema(connections, {
  name: (s) => s.min(1),
  host: (s) => s.min(1),
  database: (s) => s.min(1),
  username: (s) => s.min(1),
}).omit({ id: true, userId: true, passwordEnc: true, createdAt: true });

/** POST /api/connections body: like an insert but with a plaintext `password`. */
export const connectionInput = connectionInsertSchema.extend({
  type: z.literal("postgres"),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  password: z.string(),
  ssl: z.boolean().default(false),
});

export const connectionSelectSchema = createSelectSchema(connections);

// Column projections that reproduce the JSON API shape the client reads
// (snake_case keys; connections never expose the encrypted password).
export const connectionPublicColumns = {
  id: connections.id,
  name: connections.name,
  type: connections.type,
  host: connections.host,
  port: connections.port,
  database: connections.database,
  username: connections.username,
  ssl: connections.ssl,
  created_at: connections.createdAt,
};

export const notebookListColumns = {
  id: notebooks.id,
  connection_id: notebooks.connectionId,
  name: notebooks.name,
  created_at: notebooks.createdAt,
  updated_at: notebooks.updatedAt,
};

export const notebookDetailColumns = {
  ...notebookListColumns,
  cells: notebooks.cells,
  results: notebooks.results,
};

export const chatListColumns = {
  id: chats.id,
  connection_id: chats.connectionId,
  name: chats.name,
  created_at: chats.createdAt,
  updated_at: chats.updatedAt,
};

export const chatDetailColumns = {
  ...chatListColumns,
  messages: chats.messages,
};

export const workspacePublicColumns = {
  tabs: workspace.tabs,
  active_tab_id: workspace.activeTabId,
  layout: workspace.layout,
  tree: workspace.tree,
};
