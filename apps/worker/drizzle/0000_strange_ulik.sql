CREATE TABLE IF NOT EXISTS "feed_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed" varchar(16) NOT NULL,
	"rank" integer NOT NULL,
	"market_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"artifact_type" varchar(32) NOT NULL,
	"model" varchar(64) NOT NULL,
	"input_hash" varchar(128) NOT NULL,
	"prompt_hash" varchar(128) NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) NOT NULL,
	"source_market_id" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"title_raw" text NOT NULL,
	"headline" text,
	"category" varchar(128),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"market_type" varchar(16) NOT NULL,
	"outcomes" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"resolves_at" timestamp with time zone,
	"source_url" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"ts_bucket" integer NOT NULL,
	"p" double precision NOT NULL,
	"p_json" jsonb,
	"volume_24h" double precision,
	"liquidity" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_state" (
	"market_id" uuid PRIMARY KEY NOT NULL,
	"p" double precision NOT NULL,
	"p_json" jsonb,
	"top_outcome_prob" double precision,
	"volume_24h" double precision,
	"liquidity" double precision,
	"best_bid" double precision,
	"best_ask" double precision,
	"spread" double precision,
	"trust_tier" varchar(16) DEFAULT 'low' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "llm_artifact" ADD CONSTRAINT "llm_artifact_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "market_snapshot" ADD CONSTRAINT "market_snapshot_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "market_state" ADD CONSTRAINT "market_state_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feed_item_feed_rank_idx" ON "feed_item" USING btree ("feed","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_item_feed_computed_idx" ON "feed_item" USING btree ("feed","computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_artifact_market_idx" ON "llm_artifact" USING btree ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "llm_artifact_cache_idx" ON "llm_artifact" USING btree ("market_id","artifact_type","input_hash","prompt_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "market_source_id_idx" ON "market" USING btree ("source","source_market_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_status_idx" ON "market" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_resolves_at_idx" ON "market" USING btree ("resolves_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_slug_idx" ON "market" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "snapshot_market_ts_idx" ON "market_snapshot" USING btree ("market_id","ts_bucket");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_market_id_idx" ON "market_snapshot" USING btree ("market_id");