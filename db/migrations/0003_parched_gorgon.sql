CREATE TYPE "public"."aversion_level" AS ENUM('LOW', 'MID', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."brand_term_type" AS ENUM('OWNED', 'COMPETITOR');--> statement-breakpoint
CREATE TYPE "public"."exposure_level" AS ENUM('HIGH', 'MID', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."ig_count_status" AS ENUM('VERIFIED', 'ESTIMATED');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('A', 'B', 'C', 'D', 'X');--> statement-breakpoint
CREATE TYPE "public"."script_type" AS ENUM('KANJI', 'KATAKANA', 'HIRAGANA', 'MIXED', 'ROMAN', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."trend_term_status" AS ENUM('ACTIVE', 'DEPRECATED');--> statement-breakpoint
CREATE TYPE "public"."trend_verification_status" AS ENUM('PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."usage_context" AS ENUM('TITLE', 'TAG', 'BODY', 'AD');--> statement-breakpoint
CREATE TYPE "public"."yakkihou_risk" AS ENUM('SAFE', 'CAUTION', 'PROHIBITED');--> statement-breakpoint
CREATE TABLE "brand_term_conventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar(64) NOT NULL,
	"brand_type" "brand_term_type" NOT NULL,
	"category_hint" varchar(64),
	"style_note" text,
	"adopted_terms" jsonb,
	"avoid_terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jp_matched_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kr_term_id" uuid NOT NULL,
	"lang_code" varchar(8) DEFAULT 'ja' NOT NULL,
	"jp_term" varchar(128) NOT NULL,
	"jp_reading" varchar(128),
	"literal_baseline" varchar(128),
	"script_type" "script_type",
	"match_type" "match_type",
	"priority_rank" integer DEFAULT 9 NOT NULL,
	"usage_context" "usage_context",
	"ig_hashtag_count" integer,
	"ig_count_status" "ig_count_status" DEFAULT 'ESTIMATED' NOT NULL,
	"exposure_level" "exposure_level",
	"aversion_level" "aversion_level",
	"jp_search_volume" integer,
	"platform" varchar(32),
	"confidence_score" integer,
	"yakkihou_risk" "yakkihou_risk",
	"yakkihou_note" text,
	"nuance_note" text,
	"brand_adoption" jsonb,
	"related_keywords" jsonb,
	"source" varchar(16) DEFAULT 'SEED' NOT NULL,
	"verification_status" "trend_verification_status" DEFAULT 'PENDING' NOT NULL,
	"verified_by" varchar(128),
	"verified_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kr_trend_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kr_term" varchar(128) NOT NULL,
	"category" varchar(64),
	"sub_category" varchar(64),
	"synonym_group" varchar(128),
	"trend_score" integer,
	"source_channel" varchar(64),
	"status" "trend_term_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jp_matched_terms" ADD CONSTRAINT "jp_matched_terms_kr_term_id_kr_trend_terms_id_fk" FOREIGN KEY ("kr_term_id") REFERENCES "public"."kr_trend_terms"("id") ON DELETE cascade ON UPDATE no action;