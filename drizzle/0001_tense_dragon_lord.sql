DROP INDEX "hccite_collection_resource_pair_uq";--> statement-breakpoint
DROP INDEX "hccite_resource_tag_pair_uq";--> statement-breakpoint
DROP INDEX "hccite_rrl_draft_source_pair_uq";--> statement-breakpoint
ALTER TABLE "hccite_collection_resource" ADD CONSTRAINT "hccite_collection_resource_pk" PRIMARY KEY("collection_id","resource_id");--> statement-breakpoint
ALTER TABLE "hccite_resource_tag" ADD CONSTRAINT "hccite_resource_tag_pk" PRIMARY KEY("saved_resource_id","tag_id");--> statement-breakpoint
ALTER TABLE "hccite_rrl_draft_source" ADD CONSTRAINT "hccite_rrl_draft_source_pk" PRIMARY KEY("draft_id","resource_id");