ALTER TABLE "players" ADD COLUMN "sync_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "next_sync_at" integer;