ALTER TABLE "hccite_study_section" DROP CONSTRAINT "hccite_study_section_pages_ck";--> statement-breakpoint
ALTER TABLE "hccite_study_section" ALTER COLUMN "start_page" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_study_section" ALTER COLUMN "end_page" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_study_analysis" ADD COLUMN "title" varchar(500);--> statement-breakpoint
ALTER TABLE "hccite_study_section" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hccite_study_section" ADD CONSTRAINT "hccite_study_section_pages_ck" CHECK (("hccite_study_section"."start_page" is null and "hccite_study_section"."end_page" is null) or ("hccite_study_section"."start_page" > 0 and "hccite_study_section"."end_page" >= "hccite_study_section"."start_page"));