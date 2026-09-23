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
    await client`delete from public.hccite_resource where source_identifier like ${fixtureToken + "%"}`;

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
    await collectionsRepo.addResourceToCollection(collectionA.id, resource.id);
    const savedA = await resourcesRepo.saveResource({ resourceId: resource.id });
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
    assert.equal((await studiesRepo.getStudyAnalysis(studyA.id)).length, 1);
    assert.equal((await studiesRepo.listStudyRelatedSources(studyA.id)).length, 1);
    assert.equal((await rrlRepo.getRrlDraft(draftA.id)).draft.content, "Synthetic draft [synthetic-key].");
    assert.equal((await db.select().from((await import("../src/server/db/schema.ts")).rrlDrafts).where(sql`id = ${draftA.id}`)).length, 1);

    // Test database-enforced uniqueness using additional isolated synthetic rows.
    await expectConstraint(() => client`insert into public.hccite_user_profile (clerk_user_id) values (${userA})`);
    await expectConstraint(() => client`insert into public.hccite_saved_resource (user_id, resource_id) values (${profileA}, ${resource.id})`);
    await expectConstraint(() => client`insert into public.hccite_collection_resource (collection_id, resource_id) values (${collectionA.id}, ${resource.id})`);
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

    // Parent deletion cascades through user-owned rows and nested data without deleting shared Resource metadata.
    setTestIdentity(userB);
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
    await client`delete from public.hccite_resource where source_identifier like ${fixtureToken + "%"} or doi = '10.5555/hccite-phase03.synthetic'`;
    await client.end();
    await closeDb();
  }
});
