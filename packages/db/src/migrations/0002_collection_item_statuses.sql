ALTER TABLE "collection_items" ADD COLUMN "previously_owned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "for_trade" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "want_in_trade" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "want_to_buy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "wishlist" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "wishlist_priority" smallint;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "preordered" boolean DEFAULT false NOT NULL;