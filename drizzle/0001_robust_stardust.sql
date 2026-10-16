ALTER TABLE "match_players" ALTER COLUMN "account_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "mmr_snapshots" ALTER COLUMN "account_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "account_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sync_logs" ALTER COLUMN "account_id" SET DATA TYPE bigint;