ALTER TABLE "hccite_rrl_draft_source" ADD COLUMN "citation_key" varchar(160);--> statement-breakpoint
WITH numbered AS (SELECT draft_id, resource_id, 'HCCITE:S' || row_number() OVER (PARTITION BY draft_id ORDER BY resource_id) AS citation_key FROM "hccite_rrl_draft_source") UPDATE "hccite_rrl_draft_source" AS source SET "citation_key" = numbered.citation_key FROM numbered WHERE source.draft_id = numbered.draft_id AND source.resource_id = numbered.resource_id;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft_source" ALTER COLUMN "citation_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft_source" ADD COLUMN "source_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft" ADD COLUMN "model_version" varchar(160);--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft" ADD COLUMN "generation_request_id" uuid;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft" ADD COLUMN "structured_content" jsonb;--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft" ADD COLUMN "integrity_context" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_rrl_draft_study_request_uq" ON "hccite_rrl_draft" USING btree ("study_id","generation_request_id") WHERE "hccite_rrl_draft"."generation_request_id" is not null;
