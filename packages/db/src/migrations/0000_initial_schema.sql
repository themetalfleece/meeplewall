CREATE TYPE "public"."collection_source" AS ENUM('geekdo', 'xmlapi2');--> statement-breakpoint
CREATE TYPE "public"."collection_sync_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."image_job_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."image_kind" AS ENUM('cover', 'thumb');--> statement-breakpoint
CREATE TYPE "public"."refresh_source" AS ENUM('cron', 'user', 'api');--> statement-breakpoint
CREATE TYPE "public"."refresh_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "bgg_games" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"description" text,
	"min_players" integer,
	"max_players" integer,
	"min_play_time" integer,
	"max_play_time" integer,
	"weight" double precision,
	"average_rating" double precision,
	"rating_count" integer,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mechanics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publisher" text,
	"image_url_raw" text,
	"thumb_url_raw" text,
	"box_width_mm" double precision,
	"box_depth_mm" double precision,
	"box_height_mm" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bgg_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bgg_username" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"bgg_game_id" integer NOT NULL,
	"owned" boolean DEFAULT false NOT NULL,
	"want_to_play" boolean DEFAULT false NOT NULL,
	"user_rating" double precision,
	"sort_index" integer NOT NULL,
	CONSTRAINT "collection_items_collection_id_bgg_game_id_pk" PRIMARY KEY("collection_id","bgg_game_id")
);
--> statement-breakpoint
CREATE TABLE "collection_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "collection_sync_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bgg_game_id" integer NOT NULL,
	"kind" "image_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"side_color" text,
	"edge_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_assets_game_kind_unique" UNIQUE("bgg_game_id","kind")
);
--> statement-breakpoint
CREATE TABLE "image_jobs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "image_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bgg_game_id" integer NOT NULL,
	"kind" "image_kind" NOT NULL,
	"status" "image_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refresh_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "refresh_source" NOT NULL,
	"duration_ms" integer,
	"status" "refresh_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source" "collection_source" NOT NULL,
	"item_count" integer NOT NULL,
	CONSTRAINT "user_collections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_user_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."user_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_bgg_game_id_bgg_games_id_fk" FOREIGN KEY ("bgg_game_id") REFERENCES "public"."bgg_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_syncs" ADD CONSTRAINT "collection_syncs_user_id_bgg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bgg_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_bgg_game_id_bgg_games_id_fk" FOREIGN KEY ("bgg_game_id") REFERENCES "public"."bgg_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_jobs" ADD CONSTRAINT "image_jobs_bgg_game_id_bgg_games_id_fk" FOREIGN KEY ("bgg_game_id") REFERENCES "public"."bgg_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_log" ADD CONSTRAINT "refresh_log_user_id_bgg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bgg_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_collections" ADD CONSTRAINT "user_collections_user_id_bgg_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bgg_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bgg_users_bgg_username_unique" ON "bgg_users" USING btree (lower("bgg_username"));--> statement-breakpoint
CREATE INDEX "collection_items_bgg_game_id_index" ON "collection_items" USING btree ("bgg_game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_syncs_running_unique" ON "collection_syncs" USING btree ("user_id") WHERE "collection_syncs"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX "image_jobs_open_unique" ON "image_jobs" USING btree ("bgg_game_id","kind") WHERE "image_jobs"."status" in ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "image_jobs_claim_index" ON "image_jobs" USING btree ("status","created_at");