CREATE TYPE "public"."product_category" AS ENUM('cosmetic', 'quasi_drug', 'health_food', 'functional_food', 'general_food', 'medical_device', 'general');--> statement-breakpoint
CREATE TYPE "public"."target_market" AS ENUM('jp', 'kr', 'global');--> statement-breakpoint
CREATE TYPE "public"."yakkihou_level" AS ENUM('SAFE', 'WARN', 'NG');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"name_ja" varchar(128),
	"logo_url" text,
	"default_market" "target_market" DEFAULT 'jp' NOT NULL,
	"default_tone" text,
	"brand_guide_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"name_ja" varchar(256),
	"category" "product_category" NOT NULL,
	"target_market" "target_market" DEFAULT 'jp' NOT NULL,
	"qoo10_url" text,
	"qoo10_data" jsonb,
	"approved_claims" jsonb,
	"key_ingredients" jsonb,
	"target_audience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid,
	"file_name" varchar(256) NOT NULL,
	"storage_url" text NOT NULL,
	"parsed_text" text,
	"structured" jsonb,
	"pages" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid,
	"campaign_name" varchar(256) NOT NULL,
	"target_market" "target_market" DEFAULT 'jp' NOT NULL,
	"category" "product_category" NOT NULL,
	"content" jsonb NOT NULL,
	"yakkihou_summary" jsonb,
	"created_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yakkihou_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"field_path" text NOT NULL,
	"text" text NOT NULL,
	"start_index" integer NOT NULL,
	"end_index" integer NOT NULL,
	"level" "yakkihou_level" NOT NULL,
	"rule" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"suggestions" jsonb,
	"category" "product_category" NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_sheets" ADD CONSTRAINT "reference_sheets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_sheets" ADD CONSTRAINT "reference_sheets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yakkihou_findings" ADD CONSTRAINT "yakkihou_findings_sheet_id_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."sheets"("id") ON DELETE cascade ON UPDATE no action;