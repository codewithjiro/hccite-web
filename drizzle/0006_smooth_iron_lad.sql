ALTER TYPE "public"."hccite_audit_status" ADD VALUE 'stale';--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" DROP CONSTRAINT "hccite_rrl_audit_counts_ck";--> statement-breakpoint
DROP INDEX "hccite_rrl_citation_draft_key_uq";--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD COLUMN "source_state_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD COLUMN "selected_source_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD COLUMN "mapped_source_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD COLUMN "citation_occurrence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD COLUMN "issues" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_citation_link" ADD COLUMN "occurrence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_citation_link" ADD COLUMN "heading" varchar(240);--> statement-breakpoint
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY draft_id ORDER BY created_at, id) AS occurrence FROM "hccite_rrl_citation_link") UPDATE "hccite_rrl_citation_link" AS link SET occurrence = numbered.occurrence FROM numbered WHERE link.id = numbered.id;--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_rrl_citation_draft_occurrence_uq" ON "hccite_rrl_citation_link" USING btree ("draft_id","occurrence");--> statement-breakpoint
ALTER TABLE "hccite_rrl_audit" ADD CONSTRAINT "hccite_rrl_audit_counts_ck" CHECK ("hccite_rrl_audit"."selected_source_count" >= 0 and "hccite_rrl_audit"."mapped_source_count" >= 0 and "hccite_rrl_audit"."citation_occurrence_count" >= 0 and "hccite_rrl_audit"."citations_total" >= 0 and "hccite_rrl_audit"."citations_mapped" >= 0 and "hccite_rrl_audit"."dois_verified" >= 0 and "hccite_rrl_audit"."retracted_count" >= 0 and "hccite_rrl_audit"."review_required_count" >= 0 and "hccite_rrl_audit"."duplicate_count" >= 0 and "hccite_rrl_audit"."unselected_reference_count" >= 0);
