CREATE TABLE "heroes" (
	"hero_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"localized_name" text NOT NULL,
	"img" text NOT NULL,
	"primary_attr" text NOT NULL,
	"roles" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" bigint NOT NULL,
	"account_id" integer NOT NULL,
	"hero_id" integer NOT NULL,
	"is_radiant" boolean NOT NULL,
	"player_slot" integer NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"assists" integer NOT NULL,
	"gpm" integer NOT NULL,
	"xpm" integer NOT NULL,
	"last_hits" integer NOT NULL,
	"hero_damage" integer NOT NULL,
	"hero_healing" integer NOT NULL,
	"mmr_before" integer,
	"mmr_after" integer,
	"mmr_delta" integer,
	"mmr_source" text,
	CONSTRAINT "match_players_match_id_account_id_pk" PRIMARY KEY("match_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"match_id" bigint PRIMARY KEY NOT NULL,
	"start_time" integer NOT NULL,
	"duration" integer NOT NULL,
	"radiant_win" boolean NOT NULL,
	"game_mode" integer NOT NULL,
	"lobby_type" integer NOT NULL,
	"average_rank" integer,
	"radiant_score" integer,
	"dire_score" integer
);
--> statement-breakpoint
CREATE TABLE "mmr_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"recorded_at" integer NOT NULL,
	"rank_tier" integer,
	"leaderboard_rank" integer,
	"computed_mmr" double precision,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"account_id" integer PRIMARY KEY NOT NULL,
	"steam_id64" text NOT NULL,
	"personaname" text,
	"avatar" text,
	"rank_tier" integer,
	"leaderboard_rank" integer,
	"computed_mmr" double precision,
	"tracking_enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" integer
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"scope" text NOT NULL,
	"started_at" integer NOT NULL,
	"finished_at" integer,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("match_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mmr_snapshots" ADD CONSTRAINT "mmr_snapshots_account_id_players_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."players"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_account_id_hero_id_idx" ON "match_players" USING btree ("account_id","hero_id");--> statement-breakpoint
CREATE INDEX "matches_start_time_idx" ON "matches" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "mmr_snapshots_account_id_recorded_at_idx" ON "mmr_snapshots" USING btree ("account_id","recorded_at");