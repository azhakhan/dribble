CREATE TABLE "dbide_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dbide_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
-- Seed the sentinel "local" user. In local mode (no Google OAuth) every row is
-- owned by this user; it also adopts all pre-existing data on upgrade.
INSERT INTO "dbide_users" ("id", "email", "name")
VALUES ('00000000-0000-0000-0000-000000000000', 'local@localhost', 'Local')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "dbide_workspace" DROP CONSTRAINT "dbide_workspace_singleton";--> statement-breakpoint
-- Add ownership columns nullable, backfill to the sentinel user, then enforce.
ALTER TABLE "dbide_chats" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "dbide_connections" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "dbide_notebooks" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "dbide_workspace" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "dbide_chats" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "dbide_connections" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "dbide_notebooks" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "dbide_workspace" SET "user_id" = '00000000-0000-0000-0000-000000000000' WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "dbide_chats" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dbide_connections" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dbide_notebooks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
-- Swap the workspace PK from the old singleton id to user_id.
ALTER TABLE "dbide_workspace" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "dbide_workspace" ADD CONSTRAINT "dbide_workspace_user_id_pk" PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "dbide_chats" ADD CONSTRAINT "dbide_chats_user_id_dbide_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dbide_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dbide_connections" ADD CONSTRAINT "dbide_connections_user_id_dbide_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dbide_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dbide_notebooks" ADD CONSTRAINT "dbide_notebooks_user_id_dbide_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dbide_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dbide_workspace" ADD CONSTRAINT "dbide_workspace_user_id_dbide_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dbide_users"("id") ON DELETE cascade ON UPDATE no action;
