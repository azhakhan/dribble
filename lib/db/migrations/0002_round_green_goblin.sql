ALTER TABLE "logs" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "logs" ADD COLUMN "details" jsonb;