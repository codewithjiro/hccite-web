CREATE TYPE "public"."hccite_audit_status" AS ENUM('passed', 'review_required', 'failed');--> statement-breakpoint
CREATE TYPE "public"."hccite_citation_style" AS ENUM('apa', 'mla', 'chicago');--> statement-breakpoint
CREATE TYPE "public"."hccite_integrity_status" AS ENUM('no_known_issue', 'review_required', 'corrected', 'retracted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."hccite_provider" AS ENUM('openalex', 'crossref', 'google_books', 'manual');--> statement-breakpoint
CREATE TYPE "public"."hccite_reading_status" AS ENUM('unread', 'reading', 'read');--> statement-breakpoint
CREATE TYPE "public"."hccite_resource_type" AS ENUM('article', 'book', 'other');--> statement-breakpoint
CREATE TYPE "public"."hccite_study_file_type" AS ENUM('pdf', 'docx');--> statement-breakpoint
CREATE TYPE "public"."hccite_study_status" AS ENUM('uploaded', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."hccite_update_type" AS ENUM('correction', 'retraction', 'expression_of_concern', 'other');--> statement-breakpoint
CREATE TABLE "hccite_collection_resource" (
	"collection_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_resource_integrity_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"status" "hccite_integrity_status" DEFAULT 'unknown' NOT NULL,
	"doi_verified" boolean,
	"update_type" "hccite_update_type",
	"update_doi" varchar(512),
	"update_label" text,
	"integrity_source" "hccite_provider",
	"metadata_complete" boolean,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_metadata_hash" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "hccite_resource_tag" (
	"saved_resource_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "hccite_resource_type" NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"year" integer,
	"publication_date" varchar(32),
	"doi" varchar(512),
	"isbn" varchar(20),
	"publisher" text,
	"venue" text,
	"source" "hccite_provider" NOT NULL,
	"source_identifier" varchar(512),
	"url" text,
	"abstract" text,
	"retrieved_at" timestamp with time zone,
	"citation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_resource_year_valid_ck" CHECK ("hccite_resource"."year" is null or ("hccite_resource"."year" between 1000 and 3000))
);
--> statement-breakpoint
CREATE TABLE "hccite_rrl_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_version" integer NOT NULL,
	"draft_content_hash" varchar(128) NOT NULL,
	"status" "hccite_audit_status" NOT NULL,
	"citations_total" integer DEFAULT 0 NOT NULL,
	"citations_mapped" integer DEFAULT 0 NOT NULL,
	"dois_verified" integer DEFAULT 0 NOT NULL,
	"retracted_count" integer DEFAULT 0 NOT NULL,
	"review_required_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"unselected_reference_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_rrl_audit_version_ck" CHECK ("hccite_rrl_audit"."draft_version" > 0),
	CONSTRAINT "hccite_rrl_audit_counts_ck" CHECK ("hccite_rrl_audit"."citations_total" >= 0 and "hccite_rrl_audit"."citations_mapped" >= 0 and "hccite_rrl_audit"."dois_verified" >= 0 and "hccite_rrl_audit"."retracted_count" >= 0 and "hccite_rrl_audit"."review_required_count" >= 0 and "hccite_rrl_audit"."duplicate_count" >= 0 and "hccite_rrl_audit"."unselected_reference_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hccite_rrl_citation_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"citation_key" varchar(160) NOT NULL,
	"section_key" varchar(160),
	"context_snippet" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_rrl_draft_source" (
	"draft_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"selected_at_generation" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_rrl_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"citation_style" "hccite_citation_style" NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(128) NOT NULL,
	"draft_version" integer DEFAULT 1 NOT NULL,
	"model" varchar(160),
	"generation_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_rrl_draft_version_ck" CHECK ("hccite_rrl_draft"."draft_version" > 0 and "hccite_rrl_draft"."generation_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "hccite_saved_resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"reading_status" "hccite_reading_status" DEFAULT 'unread' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_study" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"original_file_name" varchar(512) NOT NULL,
	"file_type" "hccite_study_file_type" NOT NULL,
	"file_url" text NOT NULL,
	"file_storage_key" varchar(512) NOT NULL,
	"status" "hccite_study_status" DEFAULT 'uploaded' NOT NULL,
	"page_count" integer,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_study_page_count_ck" CHECK ("hccite_study"."page_count" is null or "hccite_study"."page_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "hccite_study_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"research_problem" text,
	"objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"methodology" text,
	"variables_or_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"population_or_sample" text,
	"major_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conclusion" text,
	"suggested_queries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"important_page_ranges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" varchar(160),
	"analysis_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_study_analysis_version_ck" CHECK ("hccite_study_analysis"."analysis_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "hccite_study_related_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"relevance_reason" text,
	"relevance_score" real,
	"selected_for_rrl" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_study_related_source_score_ck" CHECK ("hccite_study_related_source"."relevance_score" is null or ("hccite_study_related_source"."relevance_score" >= 0 and "hccite_study_related_source"."relevance_score" <= 1))
);
--> statement-breakpoint
CREATE TABLE "hccite_study_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"label" varchar(160) NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"normalized_text_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hccite_study_section_pages_ck" CHECK ("hccite_study_section"."start_page" > 0 and "hccite_study_section"."end_page" >= "hccite_study_section"."start_page")
);
--> statement-breakpoint
CREATE TABLE "hccite_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hccite_user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"display_name" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hccite_collection_resource" ADD CONSTRAINT "hccite_collection_resource_collection_id_hccite_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."hccite_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_collection_resource" ADD CONSTRAINT "hccite_collection_resource_resource_id_hccite_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hccite_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_collection" ADD CONSTRAINT "hccite_collection_user_id_hccite_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hccite_user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_resource_integrity_check" ADD CONSTRAINT "hccite_resource_integrity_check_resource_id_hccite_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hccite_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_resource_tag" ADD CONSTRAINT "hccite_resource_tag_saved_resource_id_hccite_saved_resource_id_fk" FOREIGN KEY ("saved_resource_id") REFERENCES "public"."hccite_saved_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_resource_tag" ADD CONSTRAINT "hccite_resource_tag_tag_id_hccite_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."hccite_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD CONSTRAINT "hccite_rrl_audit_draft_id_hccite_rrl_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."hccite_rrl_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_rrl_citation_link" ADD CONSTRAINT "hccite_rrl_citation_link_draft_id_hccite_rrl_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."hccite_rrl_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_rrl_citation_link" ADD CONSTRAINT "hccite_rrl_citation_link_resource_id_hccite_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hccite_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft_source" ADD CONSTRAINT "hccite_rrl_draft_source_draft_id_hccite_rrl_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."hccite_rrl_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft_source" ADD CONSTRAINT "hccite_rrl_draft_source_resource_id_hccite_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hccite_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft" ADD CONSTRAINT "hccite_rrl_draft_study_id_hccite_study_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."hccite_study"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_saved_resource" ADD CONSTRAINT "hccite_saved_resource_user_id_hccite_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hccite_user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_saved_resource" ADD CONSTRAINT "hccite_saved_resource_resource_id_hccite_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hccite_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_study" ADD CONSTRAINT "hccite_study_user_id_hccite_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hccite_user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_study_analysis" ADD CONSTRAINT "hccite_study_analysis_study_id_hccite_study_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."hccite_study"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_study_related_source" ADD CONSTRAINT "hccite_study_related_source_study_id_hccite_study_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."hccite_study"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_study_related_source" ADD CONSTRAINT "hccite_study_related_source_resource_id_hccite_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."hccite_resource"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_study_section" ADD CONSTRAINT "hccite_study_section_study_id_hccite_study_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."hccite_study"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hccite_tag" ADD CONSTRAINT "hccite_tag_user_id_hccite_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hccite_user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_collection_resource_pair_uq" ON "hccite_collection_resource" USING btree ("collection_id","resource_id");--> statement-breakpoint
CREATE INDEX "hccite_collection_resource_resource_idx" ON "hccite_collection_resource" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "hccite_collection_owner_name_idx" ON "hccite_collection" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "hccite_integrity_resource_checked_idx" ON "hccite_resource_integrity_check" USING btree ("resource_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_resource_tag_pair_uq" ON "hccite_resource_tag" USING btree ("saved_resource_id","tag_id");--> statement-breakpoint
CREATE INDEX "hccite_resource_tag_tag_idx" ON "hccite_resource_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_resource_doi_normalized_uq" ON "hccite_resource" USING btree (lower(regexp_replace("doi", '^https?://(dx\.)?doi\.org/', '', 'i'))) WHERE "hccite_resource"."doi" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_resource_isbn_normalized_uq" ON "hccite_resource" USING btree (regexp_replace("isbn", '[^0-9Xx]', '', 'g')) WHERE "hccite_resource"."isbn" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_resource_provider_identifier_uq" ON "hccite_resource" USING btree ("source","source_identifier") WHERE "hccite_resource"."source_identifier" is not null;--> statement-breakpoint
CREATE INDEX "hccite_resource_title_year_idx" ON "hccite_resource" USING btree ("title","year");--> statement-breakpoint
CREATE INDEX "hccite_rrl_audit_draft_created_idx" ON "hccite_rrl_audit" USING btree ("draft_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_rrl_citation_draft_key_uq" ON "hccite_rrl_citation_link" USING btree ("draft_id","citation_key");--> statement-breakpoint
CREATE INDEX "hccite_rrl_citation_draft_idx" ON "hccite_rrl_citation_link" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "hccite_rrl_citation_resource_idx" ON "hccite_rrl_citation_link" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_rrl_draft_source_pair_uq" ON "hccite_rrl_draft_source" USING btree ("draft_id","resource_id");--> statement-breakpoint
CREATE INDEX "hccite_rrl_draft_source_resource_idx" ON "hccite_rrl_draft_source" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "hccite_rrl_draft_study_updated_idx" ON "hccite_rrl_draft" USING btree ("study_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_saved_resource_owner_resource_uq" ON "hccite_saved_resource" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "hccite_saved_resource_owner_created_idx" ON "hccite_saved_resource" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "hccite_study_owner_created_idx" ON "hccite_study" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_study_storage_key_uq" ON "hccite_study" USING btree ("file_storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_study_analysis_study_version_uq" ON "hccite_study_analysis" USING btree ("study_id","analysis_version");--> statement-breakpoint
CREATE INDEX "hccite_study_analysis_study_idx" ON "hccite_study_analysis" USING btree ("study_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_study_related_source_pair_uq" ON "hccite_study_related_source" USING btree ("study_id","resource_id");--> statement-breakpoint
CREATE INDEX "hccite_study_related_source_study_idx" ON "hccite_study_related_source" USING btree ("study_id");--> statement-breakpoint
CREATE INDEX "hccite_study_section_study_idx" ON "hccite_study_section" USING btree ("study_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_tag_owner_name_uq" ON "hccite_tag" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_user_profile_clerk_user_id_uq" ON "hccite_user_profile" USING btree ("clerk_user_id");