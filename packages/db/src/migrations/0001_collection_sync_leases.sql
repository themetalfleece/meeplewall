ALTER TABLE "collection_syncs" ADD COLUMN "source" "refresh_source" DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_syncs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_syncs" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "collection_syncs" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "collection_syncs_claim_index" ON "collection_syncs" USING btree ("started_at") WHERE "collection_syncs"."status" = 'running';