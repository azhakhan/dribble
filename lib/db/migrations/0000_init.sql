-- Baseline migration. Made idempotent (IF NOT EXISTS + guarded constraints) so
-- it adopts databases that already have the dbide_* tables from the previous
-- hand-applied DDL, as well as creating them fresh. Later migrations are plain.
CREATE TABLE IF NOT EXISTS "dbide_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid,
	"name" text DEFAULT 'New chat' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dbide_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'postgres' NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 5432 NOT NULL,
	"database" text NOT NULL,
	"username" text NOT NULL,
	"password_enc" text NOT NULL,
	"ssl" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dbide_notebooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid,
	"name" text DEFAULT 'Untitled query' NOT NULL,
	"cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dbide_workspace" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"tabs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_tab_id" text,
	"layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tree" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dbide_workspace_singleton" CHECK ("dbide_workspace"."id" = 1)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "dbide_chats" ADD CONSTRAINT "dbide_chats_connection_id_dbide_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."dbide_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "dbide_notebooks" ADD CONSTRAINT "dbide_notebooks_connection_id_dbide_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."dbide_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
