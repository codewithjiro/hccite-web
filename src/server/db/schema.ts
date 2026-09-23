import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  pgTableCreator,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const createTable = pgTableCreator((name) => `hccite_${name}`);

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resourceTypeEnum = pgEnum("hccite_resource_type", ["article", "book", "other"]);
export const providerEnum = pgEnum("hccite_provider", ["openalex", "crossref", "google_books", "manual"]);
export const readingStatusEnum = pgEnum("hccite_reading_status", ["unread", "reading", "read"]);
export const studyFileTypeEnum = pgEnum("hccite_study_file_type", ["pdf", "docx"]);
export const studyStatusEnum = pgEnum("hccite_study_status", ["uploaded", "processing", "ready", "failed"]);
export const integrityStatusEnum = pgEnum("hccite_integrity_status", ["no_known_issue", "review_required", "corrected", "retracted", "unknown"]);
export const updateTypeEnum = pgEnum("hccite_update_type", ["correction", "retraction", "expression_of_concern", "other"]);
export const citationStyleEnum = pgEnum("hccite_citation_style", ["apa", "mla", "chicago"]);
export const auditStatusEnum = pgEnum("hccite_audit_status", ["passed", "review_required", "failed"]);

export const userProfiles = createTable("user_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 200 }),
  ...timestamps(),
}, (table) => [uniqueIndex("hccite_user_profile_clerk_user_id_uq").on(table.clerkUserId)]);

export const resources = createTable("resource", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: resourceTypeEnum("type").notNull(),
  title: text("title").notNull(),
  authors: jsonb("authors").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  year: integer("year"),
  publicationDate: varchar("publication_date", { length: 32 }),
  doi: varchar("doi", { length: 512 }),
  isbn: varchar("isbn", { length: 20 }),
  publisher: text("publisher"),
  venue: text("venue"),
  source: providerEnum("source").notNull(),
  sourceIdentifier: varchar("source_identifier", { length: 512 }),
  url: text("url"),
  abstract: text("abstract"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  citationMetadata: jsonb("citation_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  ...timestamps(),
}, (table) => [
  uniqueIndex("hccite_resource_doi_normalized_uq").on(sql`lower(regexp_replace(regexp_replace(${table.doi}, '^doi:\\s*', '', 'i'), '^https?://(dx\\.)?doi\\.org/', '', 'i'))`).where(sql`${table.doi} is not null`),
  uniqueIndex("hccite_resource_isbn_normalized_uq").on(sql`regexp_replace(${table.isbn}, '[^0-9Xx]', '', 'g')`).where(sql`${table.isbn} is not null`),
  uniqueIndex("hccite_resource_provider_identifier_uq").on(table.source, table.sourceIdentifier).where(sql`${table.sourceIdentifier} is not null`),
  index("hccite_resource_title_year_idx").on(table.title, table.year),
  check("hccite_resource_year_valid_ck", sql`${table.year} is null or (${table.year} between 1000 and 3000)`),
]);

export const savedResources = createTable("saved_resource", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  readingStatus: readingStatusEnum("reading_status").notNull().default("unread"),
  notes: text("notes"),
  ...timestamps(),
}, (table) => [
  uniqueIndex("hccite_saved_resource_owner_resource_uq").on(table.userId, table.resourceId),
  index("hccite_saved_resource_owner_created_idx").on(table.userId, table.createdAt),
]);

export const collections = createTable("collection", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  ...timestamps(),
}, (table) => [index("hccite_collection_owner_name_idx").on(table.userId, table.name)]);

export const collectionResources = createTable("collection_resource", {
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "hccite_collection_resource_pk", columns: [table.collectionId, table.resourceId] }),
  index("hccite_collection_resource_resource_idx").on(table.resourceId),
]);

export const tags = createTable("tag", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("hccite_tag_owner_name_uq").on(table.userId, sql`lower(${table.name})`)]);

export const resourceTags = createTable("resource_tag", {
  savedResourceId: uuid("saved_resource_id").notNull().references(() => savedResources.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ name: "hccite_resource_tag_pk", columns: [table.savedResourceId, table.tagId] }),
  index("hccite_resource_tag_tag_idx").on(table.tagId),
]);

export const studies = createTable("study", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  originalFileName: varchar("original_file_name", { length: 512 }).notNull(),
  fileType: studyFileTypeEnum("file_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileStorageKey: varchar("file_storage_key", { length: 512 }).notNull(),
  status: studyStatusEnum("status").notNull().default("uploaded"),
  pageCount: integer("page_count"),
  processingError: text("processing_error"),
  ...timestamps(),
}, (table) => [
  index("hccite_study_owner_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("hccite_study_storage_key_uq").on(table.fileStorageKey),
  check("hccite_study_page_count_ck", sql`${table.pageCount} is null or ${table.pageCount} > 0`),
]);

export const studyAnalyses = createTable("study_analysis", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  researchProblem: text("research_problem"),
  objectives: jsonb("objectives").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  keywords: jsonb("keywords").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  methodology: text("methodology"),
  variablesOrConcepts: jsonb("variables_or_concepts").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  populationOrSample: text("population_or_sample"),
  majorFindings: jsonb("major_findings").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  conclusion: text("conclusion"),
  suggestedQueries: jsonb("suggested_queries").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  importantPageRanges: jsonb("important_page_ranges").$type<Array<{ label: string; startPage: number; endPage: number }>>().notNull().default(sql`'[]'::jsonb`),
  model: varchar("model", { length: 160 }),
  analysisVersion: integer("analysis_version").notNull().default(1),
  ...timestamps(),
}, (table) => [
  uniqueIndex("hccite_study_analysis_study_version_uq").on(table.studyId, table.analysisVersion),
  index("hccite_study_analysis_study_idx").on(table.studyId),
  check("hccite_study_analysis_version_ck", sql`${table.analysisVersion} > 0`),
]);

export const studySections = createTable("study_section", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 160 }).notNull(),
  startPage: integer("start_page").notNull(),
  endPage: integer("end_page").notNull(),
  normalizedTextReference: text("normalized_text_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("hccite_study_section_study_idx").on(table.studyId), check("hccite_study_section_pages_ck", sql`${table.startPage} > 0 and ${table.endPage} >= ${table.startPage}`)]);

export const studyRelatedSources = createTable("study_related_source", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  relevanceReason: text("relevance_reason"),
  relevanceScore: real("relevance_score"),
  selectedForRrl: boolean("selected_for_rrl").notNull().default(false),
  ...timestamps(),
}, (table) => [
  uniqueIndex("hccite_study_related_source_pair_uq").on(table.studyId, table.resourceId),
  index("hccite_study_related_source_study_idx").on(table.studyId),
  check("hccite_study_related_source_score_ck", sql`${table.relevanceScore} is null or (${table.relevanceScore} >= 0 and ${table.relevanceScore} <= 1)`),
]);

export const resourceIntegrityChecks = createTable("resource_integrity_check", {
  id: uuid("id").defaultRandom().primaryKey(),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  status: integrityStatusEnum("status").notNull().default("unknown"),
  doiVerified: boolean("doi_verified"),
  updateType: updateTypeEnum("update_type"),
  updateDoi: varchar("update_doi", { length: 512 }),
  updateLabel: text("update_label"),
  integritySource: providerEnum("integrity_source"),
  metadataComplete: boolean("metadata_complete"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  rawMetadataHash: varchar("raw_metadata_hash", { length: 128 }),
}, (table) => [index("hccite_integrity_resource_checked_idx").on(table.resourceId, table.checkedAt)]);

export const rrlDrafts = createTable("rrl_draft", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  citationStyle: citationStyleEnum("citation_style").notNull(),
  content: text("content").notNull(),
  contentHash: varchar("content_hash", { length: 128 }).notNull(),
  draftVersion: integer("draft_version").notNull().default(1),
  model: varchar("model", { length: 160 }),
  generationVersion: integer("generation_version").notNull().default(1),
  ...timestamps(),
}, (table) => [index("hccite_rrl_draft_study_updated_idx").on(table.studyId, table.updatedAt), check("hccite_rrl_draft_version_ck", sql`${table.draftVersion} > 0 and ${table.generationVersion} > 0`)]);

export const rrlDraftSources = createTable("rrl_draft_source", {
  draftId: uuid("draft_id").notNull().references(() => rrlDrafts.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  selectedAtGeneration: boolean("selected_at_generation").notNull().default(true),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ name: "hccite_rrl_draft_source_pk", columns: [table.draftId, table.resourceId] }), index("hccite_rrl_draft_source_resource_idx").on(table.resourceId)]);

export const rrlCitationLinks = createTable("rrl_citation_link", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftId: uuid("draft_id").notNull().references(() => rrlDrafts.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  citationKey: varchar("citation_key", { length: 160 }).notNull(),
  sectionKey: varchar("section_key", { length: 160 }),
  contextSnippet: text("context_snippet"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("hccite_rrl_citation_draft_key_uq").on(table.draftId, table.citationKey),
  index("hccite_rrl_citation_draft_idx").on(table.draftId),
  index("hccite_rrl_citation_resource_idx").on(table.resourceId),
]);

export const rrlAudits = createTable("rrl_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  draftId: uuid("draft_id").notNull().references(() => rrlDrafts.id, { onDelete: "cascade" }),
  draftVersion: integer("draft_version").notNull(),
  draftContentHash: varchar("draft_content_hash", { length: 128 }).notNull(),
  status: auditStatusEnum("status").notNull(),
  citationsTotal: integer("citations_total").notNull().default(0),
  citationsMapped: integer("citations_mapped").notNull().default(0),
  doisVerified: integer("dois_verified").notNull().default(0),
  retractedCount: integer("retracted_count").notNull().default(0),
  reviewRequiredCount: integer("review_required_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  unselectedReferenceCount: integer("unselected_reference_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("hccite_rrl_audit_draft_created_idx").on(table.draftId, table.createdAt),
  check("hccite_rrl_audit_version_ck", sql`${table.draftVersion} > 0`),
  check("hccite_rrl_audit_counts_ck", sql`${table.citationsTotal} >= 0 and ${table.citationsMapped} >= 0 and ${table.doisVerified} >= 0 and ${table.retractedCount} >= 0 and ${table.reviewRequiredCount} >= 0 and ${table.duplicateCount} >= 0 and ${table.unselectedReferenceCount} >= 0`),
]);
