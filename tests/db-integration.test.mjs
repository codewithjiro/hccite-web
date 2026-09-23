import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { setTestIdentity } from "./db-test-auth.mjs";
import { getDb, closeDb } from "../src/server/db/index.ts";
import { sql } from "drizzle-orm";
import * as collectionsRepo from "../src/server/repositories/collections.ts";
import * as resourcesRepo from "../src/server/repositories/resources.ts";
import * as studiesRepo from "../src/server/repositories/studies.ts";
import * as rrlRepo from "../src/server/repositories/rrl.ts";
import { saveDiscoveredResource } from "../src/server/discovery/save.ts";

const userA = "hccite-phase03-synthetic-user-a";
const userB = "hccite-phase03-synthetic-user-b";
const userC = "hccite-phase03-synthetic-cascade-user";
const fixtureToken = "hccite-phase03-verification-20260923";
const db = getDb();
const client = postgres(process.env.DATABASE_URL, { max: 1 });

const expectConstraint = async (operation, code = "23505") => {
  await assert.rejects(operation, (error) => error?.code === code, `expected PostgreSQL ${code} constraint violation`);
};

test("Phase 03 repository ownership, constraints, cascades, and live schema", async () => {
  try {
    // Always start from a clean, clearly synthetic namespace in case a previous run was interrupted.
    await client`delete from public.hccite_user_profile where clerk_user_id in (${userA}, ${userB}, ${userC})`;
    await client`delete from public.hccite_resource where source_identifier like ${fixtureToken + "%"} or doi in ('10.5555/hccite-phase04.shared', '10.5555/hccite-phase04.poison') or source_identifier = 'W-hccite-phase04-ambiguous'`;

    setTestIdentity(userA);
    const collectionA = await collectionsRepo.createCollection({ name: "Synthetic A collection", description: "Phase 03 test fixture" });
    const studyA = await studiesRepo.createStudy({
      title: "Synthetic A study", originalFileName: "synthetic-a.pdf", fileType: "pdf",
      fileUrl: "https://example.invalid/hccite-phase03/synthetic-a.pdf", fileStorageKey: `${fixtureToken}-a-study-file`, pageCount: 4,
    });
    const resource = await resourcesRepo.createResource({
      type: "article", title: "Synthetic shared canonical resource", authors: ["Synthetic Author"], year: 2024,
      doi: "10.5555/hccite-phase03.synthetic", source: "manual", sourceIdentifier: `${fixtureToken}-shared-resource`,
      url: "https://example.invalid/synthetic-resource", abstract: "Synthetic fixture only.",
    });
    const discoveredOpenAlex = await resourcesRepo.upsertDiscoveryResource({
      type: "article", title: "Synthetic provider conflict paper", authors: ["Synthetic Researcher"], year: 2022, publicationDate: "2022-04-01",
      doi: "10.5555/hccite-phase04.shared", isbn: null, publisher: null, venue: "Synthetic Journal", source: "openalex",
      sourceIdentifier: `${fixtureToken}-openalex-shared`, url: "https://openalex.org/W-hccite-phase04-shared", abstract: null,
      retrievedAt: new Date("2026-09-23T00:00:00Z"), citationMetadata: { openAlexId: "W-hccite-phase04-shared" },
    });
    const discoveredCrossref = await resourcesRepo.upsertDiscoveryResource({
      type: "article", title: "Synthetic provider conflict paper", authors: ["Synthetic Researcher", "Synthetic Coauthor"], year: 2022, publicationDate: "2022-04-01",
      doi: "https://doi.org/10.5555/HCCITE-PHASE04.SHARED", isbn: null, publisher: "Synthetic Press", venue: "Synthetic Journal", source: "crossref",
      sourceIdentifier: "10.5555/hccite-phase04.shared", url: "https://doi.org/10.5555/hccite-phase04.shared", abstract: "Richer provider abstract.",
      retrievedAt: new Date("2026-09-23T00:01:00Z"), citationMetadata: { crossrefType: "journal-article" },
    });
    assert.equal(discoveredCrossref.reused, true, "equivalent normalized DOI forms must reuse one canonical Resource");
    assert.equal(discoveredCrossref.resource.id, discoveredOpenAlex.resource.id);
    assert.deepEqual(discoveredCrossref.resource.authors, ["Synthetic Researcher", "Synthetic Coauthor"]);
    assert.equal(discoveredCrossref.resource.publisher, "Synthetic Press");
    assert.equal(discoveredCrossref.resource.abstract, "Richer provider abstract.");
    assert.equal(discoveredCrossref.resource.source, "openalex", "the canonical record keeps its primary provenance");
    assert.equal(discoveredCrossref.resource.citationMetadata.provenance.length, 2);

    const bookInput = (isbn, suffix) => ({
      type: "book", title: "Synthetic equivalent ISBN identity test", authors: ["Synthetic Book Author"], year: 2021,
      publicationDate: "2021", doi: null, isbn, publisher: "Synthetic Press", venue: null,
      source: "google_books", sourceIdentifier: `${fixtureToken}-book-${suffix}`,
      url: "https://books.google.com/", abstract: null, retrievedAt: new Date(), citationMetadata: {},
    });
    const [book10, book13] = await Promise.all([
      resourcesRepo.upsertDiscoveryResource(bookInput("0306406152", "isbn10")),
      resourcesRepo.upsertDiscoveryResource(bookInput("9780306406157", "isbn13")),
    ]);
    assert.equal(book10.resource.id, book13.resource.id, "concurrent ISBN-10 and equivalent ISBN-13 saves must reuse one canonical Resource");
    assert.equal([book10.reused, book13.reused].filter(Boolean).length, 1);

    const trueMetadata = {
      ...bookInput(null, "unused"), type: "article", title: "Authoritative Crossref fixture", authors: ["Real Fixture Author"],
      year: 2023, doi: "10.5555/hccite-phase04.poison", isbn: null, source: "crossref",
      sourceIdentifier: "10.5555/hccite-phase04.poison", citationMetadata: { provider: "crossref" },
    };
    const saveDependencies = {
      openalex: async () => assert.fail("wrong provider"),
      crossref: async () => ({ resource: trueMetadata }),
      googleBooks: async () => assert.fail("wrong provider"),
      upsert: resourcesRepo.upsertDiscoveryResource,
      save: resourcesRepo.saveResource,
    };
    await assert.rejects(saveDiscoveredResource({ provider: "crossref", providerIdentifier: trueMetadata.doi, title: "FAKE TITLE", authors: ["Fake Author"] }, saveDependencies));
    assert.equal((await client`select count(*)::int as count from public.hccite_resource where doi = ${trueMetadata.doi}`)[0].count, 0);
    const savedFromProvider = await saveDiscoveredResource({ provider: "crossref", providerIdentifier: trueMetadata.doi }, saveDependencies);
    const [canonicalFromProvider] = await client`select title, authors from public.hccite_resource where id = ${savedFromProvider.resource.id}`;
    assert.equal(canonicalFromProvider.title, "Authoritative Crossref fixture");
    assert.deepEqual(canonicalFromProvider.authors, ["Real Fixture Author"]);

    for (const suffix of ["one", "two"]) await resourcesRepo.createResource({
      type: "article", title: "Synthetic ambiguous title fallback", authors: ["Synthetic Fallback Author"], year: 2020,
      source: "manual", sourceIdentifier: `${fixtureToken}-ambiguous-${suffix}`,
    });
    const ambiguousDiscovery = await resourcesRepo.upsertDiscoveryResource({
      type: "article", title: "Synthetic ambiguous title fallback", authors: ["Synthetic Fallback Author"], year: 2020,
      publicationDate: null, doi: null, isbn: null, publisher: null, venue: null, source: "openalex", sourceIdentifier: `${fixtureToken}-openalex-ambiguous`,
      url: "https://openalex.org/W-hccite-phase04-ambiguous", abstract: null, retrievedAt: new Date(), citationMetadata: {},
    });
    assert.equal(ambiguousDiscovery.reused, false);
    assert.equal(ambiguousDiscovery.ambiguous, true, "multiple exact title/year/author candidates must not be merged");
    const savedA = await resourcesRepo.saveResource({ resourceId: resource.id });
    await collectionsRepo.addResourceToCollection(collectionA.id, resource.id);
    assert.equal((await resourcesRepo.saveResource({ resourceId: resource.id })).id, savedA.id, "saving twice keeps one personal row");
    const tagForA = await collectionsRepo.createTag({ name: "Private phase 05 tag" });
    await collectionsRepo.attachTag(savedA.id, tagForA.id);
    await resourcesRepo.updateSavedResource(savedA.id, { notes: "Private phase 05 note", readingStatus: "reading" });
    assert.equal((await collectionsRepo.addResourceToCollection(collectionA.id, resource.id)).resourceId, resource.id, "membership add is idempotent");
    assert.equal((await collectionsRepo.createCollection({ name: "synthetic a COLLECTION" })).id, collectionA.id, "collection uniqueness ignores case per user");
    await studiesRepo.saveStudyAnalysis(studyA.id, { summary: "Synthetic analysis", analysisVersion: 1 });
    await studiesRepo.replaceStudySections(studyA.id, [{ label: "Synthetic section", startPage: 1, endPage: 2, normalizedTextReference: "synthetic" }]);
    await studiesRepo.addStudyRelatedSource(studyA.id, { resourceId: resource.id, relevanceReason: "Synthetic test", relevanceScore: 0.5, selectedForRrl: true });
    const [studyOwnerCheck] = await client`select s.user_id, u.id as profile_id, u.clerk_user_id from public.hccite_study s join public.hccite_user_profile u on u.id = s.user_id where s.id = ${studyA.id}`;
    assert.equal(studyOwnerCheck.user_id, studyOwnerCheck.profile_id, "synthetic study must resolve to its authenticated profile");
    assert.equal(studyOwnerCheck.clerk_user_id, userA, "test-only auth must resolve User A identity");
    const selectedRows = await client`select resource_id, selected_for_rrl from public.hccite_study_related_source where study_id = ${studyA.id}`;
    assert.equal(selectedRows.length, 1);
    assert.equal(selectedRows[0].selected_for_rrl, true);
    const draftA = await rrlRepo.createRrlDraft({ studyId: studyA.id, citationStyle: "apa", content: "Synthetic draft [synthetic-key].", selectedResourceIds: [resource.id] });
    const citationSourceRows = await client`select draft_id, resource_id, selected_at_generation from public.hccite_rrl_draft_source where draft_id = ${draftA.id}`;
    assert.equal(citationSourceRows.length, 1, "draft repository must persist its selected-source allow-list");
    assert.equal(citationSourceRows[0].resource_id, resource.id);
    assert.equal(citationSourceRows[0].selected_at_generation, true);
    await client`insert into public.hccite_rrl_citation_link (draft_id, resource_id, citation_key) values (${draftA.id}, ${resource.id}, 'synthetic-key')`;
    const profileA = studyOwnerCheck.profile_id;

    setTestIdentity(userB);
    const collectionB = await collectionsRepo.createCollection({ name: "Synthetic B collection" });
    const savedB = await resourcesRepo.saveResource({ resourceId: resource.id });
    const studyB = await studiesRepo.createStudy({
      title: "Synthetic B study", originalFileName: "synthetic-b.pdf", fileType: "pdf",
      fileUrl: "https://example.invalid/hccite-phase03/synthetic-b.pdf", fileStorageKey: `${fixtureToken}-b-study-file`,
    });
    setTestIdentity(userC);
    await collectionsRepo.createCollection({ name: "Synthetic C collection" });
    const profileC = (await client`select u.id from public.hccite_user_profile u where u.clerk_user_id = ${userC}`)[0]?.id;
    assert.ok(profileC, "synthetic User C profile must exist for owner-scoped tag uniqueness verification");
    setTestIdentity(userB);

    // The canonical Resource is shared; all user-owned links remain scoped to the current profile.
    assert.equal((await resourcesRepo.getResource(resource.id)).id, resource.id);
    assert.equal((await collectionsRepo.listCollections()).some((item) => item.id === collectionA.id), false);
    assert.equal((await collectionsRepo.listCollections()).some((item) => item.id === collectionB.id), true);
    assert.equal((await resourcesRepo.listSavedResources()).some((item) => item.saved.id === savedA.id), false);
    assert.equal((await collectionsRepo.listTags()).some((item) => item.id === tagForA.id), false);
    assert.equal((await collectionsRepo.listLibraryLinks()).tagLinks.some((item) => item.tagId === tagForA.id), false);
    assert.equal((await resourcesRepo.listSavedResources()).some((item) => item.saved.id === savedB.id), true);
    assert.equal((await studiesRepo.listStudies()).some((item) => item.id === studyA.id), false);
    assert.equal((await studiesRepo.listStudies()).some((item) => item.id === studyB.id), true);

    // Collection reads and every exposed mutation resolve ownership in the real repository.
    await assert.rejects(collectionsRepo.getCollection(collectionA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(collectionsRepo.updateCollection(collectionA.id, { name: "B attempted takeover" }), /NEXT_NOT_FOUND/);
    await assert.rejects(collectionsRepo.addResourceToCollection(collectionA.id, resource.id), /NEXT_NOT_FOUND/);
    await assert.rejects(collectionsRepo.removeResourceFromCollection(collectionA.id, resource.id), /NEXT_NOT_FOUND/);
    await assert.rejects(collectionsRepo.deleteCollection(collectionA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(resourcesRepo.updateSavedResource(savedA.id, { notes: "B attempted mutation" }), /NEXT_NOT_FOUND/);
    await assert.rejects(resourcesRepo.updateSavedResource(savedA.id, { readingStatus: "read" }), /NEXT_NOT_FOUND/);
    await assert.rejects(collectionsRepo.attachTag(savedA.id, tagForA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(collectionsRepo.removeTag(savedA.id, tagForA.id), /NEXT_NOT_FOUND/);
    assert.equal(await collectionsRepo.deleteTag(tagForA.id), false);
    await assert.rejects(resourcesRepo.removeSavedResource(savedA.id), /NEXT_NOT_FOUND/);

    // Study and nested analysis/sections/related-source operations resolve the parent owner.
    await assert.rejects(studiesRepo.getStudy(studyA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.updateStudyStatus(studyA.id, "failed", "B attempted mutation"), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.getStudyAnalysis(studyA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.saveStudyAnalysis(studyA.id, { summary: "B attempted nested mutation" }), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.replaceStudySections(studyA.id, [{ label: "B attempted section", startPage: 1, endPage: 1 }]), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.listStudyRelatedSources(studyA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.addStudyRelatedSource(studyA.id, { resourceId: resource.id }), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.setStudyRelatedSourceSelection(studyA.id, resource.id, false), /NEXT_NOT_FOUND/);
    await assert.rejects(studiesRepo.deleteStudy(studyA.id, async () => assert.fail("foreign study file deletion must not run")), /NEXT_NOT_FOUND/);

    // Draft reads and mutations resolve through the owning Study, including citation/audit writes.
    await assert.rejects(rrlRepo.getRrlDraft(draftA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(rrlRepo.updateRrlDraft(draftA.id, { content: "B attempted draft mutation" }), /NEXT_NOT_FOUND/);
    await assert.rejects(rrlRepo.addRrlCitationLink(draftA.id, { citationKey: "bad", resourceId: resource.id }), /NEXT_NOT_FOUND/);
    await assert.rejects(rrlRepo.removeRrlCitationLink(draftA.id, "synthetic-key"), /NEXT_NOT_FOUND/);
    await assert.rejects(rrlRepo.recordRrlAudit(draftA.id, {
      draftVersion: 1, draftContentHash: draftA.contentHash, status: "passed", citationsTotal: 1, citationsMapped: 1,
      doisVerified: 0, retractedCount: 0, reviewRequiredCount: 0, duplicateCount: 0, unselectedReferenceCount: 0,
    }), /NEXT_NOT_FOUND/);
    await assert.rejects(rrlRepo.deleteRrlDraft(draftA.id), /NEXT_NOT_FOUND/);
    await assert.rejects(rrlRepo.listRrlDraftsForStudy(studyA.id), /NEXT_NOT_FOUND/);

    setTestIdentity(userA);
    assert.equal((await collectionsRepo.getCollection(collectionA.id)).items.length, 1);
    assert.equal((await resourcesRepo.listSavedResources()).find((item) => item.saved.id === savedA.id).saved.notes, "Private phase 05 note");
    assert.equal((await resourcesRepo.listSavedResources()).find((item) => item.saved.id === savedA.id).saved.readingStatus, "reading");
    assert.equal((await studiesRepo.getStudyAnalysis(studyA.id)).length, 1);
    assert.equal((await studiesRepo.listStudyRelatedSources(studyA.id)).length, 1);
    assert.equal((await rrlRepo.getRrlDraft(draftA.id)).draft.content, "Synthetic draft [synthetic-key].");
    assert.equal((await db.select().from((await import("../src/server/db/schema.ts")).rrlDrafts).where(sql`id = ${draftA.id}`)).length, 1);

    // Test database-enforced uniqueness using additional isolated synthetic rows.
    await expectConstraint(() => client`insert into public.hccite_user_profile (clerk_user_id) values (${userA})`);
    await expectConstraint(() => client`insert into public.hccite_saved_resource (user_id, resource_id) values (${profileA}, ${resource.id})`);
    await expectConstraint(() => client`insert into public.hccite_collection_resource (collection_id, resource_id) values (${collectionA.id}, ${resource.id})`);
    await expectConstraint(() => client`insert into public.hccite_collection (user_id, name) values (${profileA}, 'SYNTHETIC A COLLECTION')`);
    await assert.rejects(resourcesRepo.updateSavedResource(savedA.id, { readingStatus: "invalid" }));
    await assert.rejects(resourcesRepo.removeSavedResource("not-a-uuid"));
    await assert.rejects(collectionsRepo.addResourceToCollection("not-a-uuid", resource.id));
    const tagA = (await client`insert into public.hccite_tag (user_id, name) values (${profileA}, 'Synthetic Unique Tag') returning id`)[0].id;
    await expectConstraint(() => client`insert into public.hccite_tag (user_id, name) values (${profileA}, 'synthetic unique tag')`);
    await client`insert into public.hccite_tag (user_id, name) values (${profileC}, 'Synthetic Unique Tag')`;
    await expectConstraint(() => client`insert into public.hccite_study_analysis (study_id, summary, analysis_version) values (${studyA.id}, 'Synthetic duplicate version', 1)`);
    await expectConstraint(() => client`insert into public.hccite_study_related_source (study_id, resource_id) values (${studyA.id}, ${resource.id})`);
    assert.equal((await client`select id from public.hccite_study where id = ${studyA.id}`).length, 1, "User A study must still exist before draft-scope constraint checks");
    const secondDraft = await client`insert into public.hccite_rrl_draft (study_id, citation_style, content, content_hash) values (${studyA.id}, 'apa', 'Synthetic second draft', 'synthetic-hash') returning id`;
    await client`insert into public.hccite_rrl_citation_link (draft_id, resource_id, citation_key) values (${draftA.id}, ${resource.id}, 'draft-scoped-key')`;
    await expectConstraint(() => client`insert into public.hccite_rrl_citation_link (draft_id, resource_id, citation_key) values (${draftA.id}, ${resource.id}, 'draft-scoped-key')`);
    await client`insert into public.hccite_rrl_citation_link (draft_id, resource_id, citation_key) values (${secondDraft[0].id}, ${resource.id}, 'draft-scoped-key')`;
    assert.ok(tagA);

    // Normalized identifiers are globally unique; fixture uses synthetic identifiers only.
    await expectConstraint(() => client`insert into public.hccite_resource (type, title, source, doi, source_identifier) values ('article', 'Synthetic duplicate DOI', 'manual', 'https://doi.org/10.5555/HCCITE-PHASE03.SYNTHETIC', ${fixtureToken + "-duplicate-doi"})`);
    await client`insert into public.hccite_resource (type, title, source, source_identifier) values ('article', 'Synthetic provider ID', 'manual', ${fixtureToken + "-provider-unique"})`;
    await expectConstraint(() => client`insert into public.hccite_resource (type, title, source, source_identifier) values ('article', 'Synthetic provider ID duplicate', 'manual', ${fixtureToken + "-provider-unique"})`);
    await expectConstraint(() => client`insert into public.hccite_resource (type, title, source, doi, source_identifier) values ('article', 'Synthetic duplicate DOI normalized', 'manual', 'doi:10.5555/hccite-phase03.synthetic', ${fixtureToken + "-duplicate-doi-2"})`);

    await resourcesRepo.removeSavedResource(savedA.id);
    assert.equal((await collectionsRepo.getCollection(collectionA.id)).items.length, 0);
    assert.equal((await client`select id from public.hccite_resource where id = ${resource.id}`).length, 1);
    setTestIdentity(userB);
    assert.equal((await resourcesRepo.listSavedResources()).some((row) => row.saved.id === savedB.id), true, "unsaving A preserves B's saved copy");

    // Parent deletion cascades through user-owned rows and nested data without deleting shared Resource metadata.
    await studiesRepo.saveStudyAnalysis(studyB.id, { summary: "Synthetic cascade analysis" });
    await studiesRepo.replaceStudySections(studyB.id, [{ label: "Synthetic cascade section", startPage: 1, endPage: 1 }]);
    await studiesRepo.addStudyRelatedSource(studyB.id, { resourceId: resource.id, selectedForRrl: true });
    await rrlRepo.createRrlDraft({ studyId: studyB.id, citationStyle: "mla", content: "Synthetic cascade draft", selectedResourceIds: [resource.id] });
    await client`delete from public.hccite_user_profile where clerk_user_id = ${userB}`;
    const cascadedStudyRows = await client`select
      (select count(*)::int from public.hccite_study where id = ${studyB.id}) as study,
      (select count(*)::int from public.hccite_study_analysis where study_id = ${studyB.id}) as analyses,
      (select count(*)::int from public.hccite_study_section where study_id = ${studyB.id}) as sections,
      (select count(*)::int from public.hccite_study_related_source where study_id = ${studyB.id}) as related,
      (select count(*)::int from public.hccite_rrl_draft where study_id = ${studyB.id}) as drafts,
      (select count(*)::int from public.hccite_resource where id = ${resource.id}) as shared_resource`;
    assert.deepEqual(Object.values(cascadedStudyRows[0]), [0, 0, 0, 0, 0, 1]);
    await client`delete from public.hccite_user_profile where clerk_user_id = ${userC}`;

    // Verify the complete application table inventory on the connected PostgreSQL database.
    const liveTables = await client`select table_name from information_schema.tables where table_schema = 'public' and table_name like 'hccite_%' order by table_name`;
    const expectedTables = [
      "hccite_collection", "hccite_collection_resource", "hccite_resource", "hccite_resource_integrity_check", "hccite_resource_tag",
      "hccite_rrl_audit", "hccite_rrl_citation_link", "hccite_rrl_draft", "hccite_rrl_draft_source", "hccite_saved_resource",
      "hccite_study", "hccite_study_analysis", "hccite_study_related_source", "hccite_study_section", "hccite_tag", "hccite_user_profile",
    ];
    assert.deepEqual(liveTables.map((row) => row.table_name), expectedTables);
  } finally {
    await client`delete from public.hccite_user_profile where clerk_user_id in (${userA}, ${userB}, ${userC})`;
    await client`delete from public.hccite_resource where source_identifier like ${fixtureToken + "%"} or doi in ('10.5555/hccite-phase03.synthetic', '10.5555/hccite-phase04.shared', '10.5555/hccite-phase04.poison') or source_identifier = 'W-hccite-phase04-ambiguous'`;
    await client.end();
    await closeDb();
  }
});
