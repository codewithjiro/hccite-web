DROP INDEX "hccite_collection_owner_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "hccite_collection_owner_name_uq" ON "hccite_collection" USING btree ("user_id",lower("name"));