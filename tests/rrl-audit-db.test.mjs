import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { setTestIdentity } from "./db-test-auth.mjs";
import { closeDb } from "../src/server/db/index.ts";
import * as resourcesRepo from "../src/server/repositories/resources.ts";
import * as studiesRepo from "../src/server/repositories/studies.ts";
import * as rrlRepo from "../src/server/repositories/rrl.ts";
import { recordLatestIntegrityCheck } from "../src/server/repositories/integrity.ts";
import { POST } from "../src/app/api/studies/[studyId]/rrl/route.ts";

const fixtureToken = `hccite-phase11-audit-${process.pid}-${Date.now()}`;
const userA = `${fixtureToken}-user-a`;
const userB = `${fixtureToken}-user-b`;
const unknownId = "00000000-0000-4000-8000-000000000099";
const client = postgres(process.env.DATABASE_URL, { max: 1 });

function request(action) {
  return new Request("http://localhost/api/studies/test/rrl", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action),
  });
}

async function post(studyId, action) {
  const response = await POST(request(action), { params: Promise.resolve({ studyId }) });
  return { status: response.status, body: await response.json() };
}

async function expectNotFound(operation) {
  await assert.rejects(operation, /NEXT_NOT_FOUND/);
}

test("Phase 11 persists traceable audits and enforces cross-user audit, citation, and export gates", async () => {
  let resourceId = null;
  try {
    setTestIdentity(userA);
    const studyA = await studiesRepo.createStudy({
      title: "Phase 11 owner A", originalFileName: "phase11-a.pdf", fileType: "pdf",
      fileUrl: "https://example.invalid/phase11-a.pdf", fileStorageKey: `${fixtureToken}-a`,
    });
    const resource = await resourcesRepo.createResource({
      type: "article", title: "Canonical Phase 11 Resource", authors: ["Ada Trace", "Bea Citation"], year: 2024,
      doi: `10.5555/${fixtureToken}`, publisher: "HCCite Press", venue: "Traceability Quarterly", source: "manual",
      sourceIdentifier: `${fixtureToken}-resource`, url: "https://example.invalid/phase11-resource", abstract: "Exact persisted resource context for the citation detail.",
    });
    resourceId = resource.id;
    await recordLatestIntegrityCheck({ resourceId: resource.id, status: "no_known_issue", doiVerified: true, integritySource: "crossref", metadataComplete: true, checkedAt: new Date() });
    await studiesRepo.addStudyRelatedSource(studyA.id, { resourceId: resource.id, relevanceReason: "Directly supports the synthetic Phase 11 claim.", relevanceScore: 0.91, selectedForRrl: true });
    const draftA = await rrlRepo.createRrlDraft({
      studyId: studyA.id, citationStyle: "apa", selectedResourceIds: [resource.id],
      content: "# Evidence\n\nThe persisted canonical evidence supports this claim [HCCITE:S1].",
    });

    // A runs a clean audit and the final endpoint returns the exact persisted draft.
    let result = await post(studyA.id, { action: "audit", draftId: draftA.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.audit.status, "passed");
    result = await post(studyA.id, { action: "export", draftId: draftA.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.export.draftId, draftA.id);
    assert.equal(result.body.export.content, draftA.content);

    // The clickable citation resolves only through this draft's snapshot to the canonical Resource.
    result = await post(studyA.id, { action: "citationDetail", draftId: draftA.id, citationKey: "HCCITE:S1" });
    assert.equal(result.status, 200);
    assert.equal(result.body.detail.resource.id, resource.id);
    assert.equal(result.body.detail.resource.title, resource.title);
    assert.deepEqual(result.body.detail.resource.authors, resource.authors);
    assert.equal(result.body.detail.resource.year, resource.year);
    assert.equal(result.body.detail.resource.doi, resource.doi);
    assert.equal(result.body.detail.resource.source, resource.source);
    assert.equal(result.body.detail.resource.abstract, resource.abstract);
    assert.equal(result.body.detail.sourceSnapshot.resourceId, resource.id);
    assert.equal(result.body.detail.relevanceReason, "Directly supports the synthetic Phase 11 claim.");
    assert.equal(result.body.detail.integrity.status, "no_known_issue");
    assert.equal(result.body.detail.bibliography.ok, true);
    const ownedWorkspace = await rrlRepo.getRrlDraft(draftA.id);
    assert.equal(ownedWorkspace.citationLinks.length, 1);
    assert.equal(ownedWorkspace.citationLinks[0].link.resourceId, resource.id);
    assert.equal(ownedWorkspace.citationLinks[0].link.sectionKey, "evidence");
    assert.match(ownedWorkspace.citationLinks[0].link.contextSnippet, /persisted canonical evidence/);

    // A distinct user's passing audit cannot be read, rerun, used for export, or used as a guessed ID by A.
    setTestIdentity(userB);
    const studyB = await studiesRepo.createStudy({
      title: "Phase 11 owner B", originalFileName: "phase11-b.pdf", fileType: "pdf",
      fileUrl: "https://example.invalid/phase11-b.pdf", fileStorageKey: `${fixtureToken}-b`,
    });
    await studiesRepo.addStudyRelatedSource(studyB.id, { resourceId: resource.id, relevanceReason: "B owns this association.", relevanceScore: 0.8, selectedForRrl: true });
    const draftB = await rrlRepo.createRrlDraft({ studyId: studyB.id, citationStyle: "apa", selectedResourceIds: [resource.id], content: "# B evidence\n\nB's claim is supported [HCCITE:S1]." });
    result = await post(studyB.id, { action: "audit", draftId: draftB.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.audit.status, "passed");
    const auditBId = result.body.audit.id;

    setTestIdentity(userA);
    for (const action of [
      { action: "getDraft", draftId: draftB.id },
      { action: "audit", draftId: draftB.id },
      { action: "citationDetail", draftId: draftB.id, citationKey: "HCCITE:S1" },
      { action: "export", draftId: draftB.id },
    ]) {
      result = await post(studyB.id, action);
      assert.equal(result.status, 404);
      assert.equal(result.body.error, "Study or RRL draft not found.");
    }
    await expectNotFound(() => rrlRepo.getRrlDraft(draftB.id));
    await expectNotFound(() => rrlRepo.runRrlAudit(draftB.id));
    await expectNotFound(() => rrlRepo.getRrlCitationDetail(draftB.id, "HCCITE:S1"));
    await expectNotFound(() => rrlRepo.getFinalRrlExport(draftB.id));
    await expectNotFound(() => rrlRepo.getRrlDraft(unknownId));
    await expectNotFound(() => rrlRepo.runRrlAudit(unknownId));
    await expectNotFound(() => rrlRepo.getRrlCitationDetail(draftA.id, "HCCITE:S99"));
    await expectNotFound(() => rrlRepo.runRrlAudit(auditBId));

    // Saving an edit creates a persisted new version/hash. The old passing audit cannot unlock it.
    result = await post(studyA.id, { action: "saveEdit", draftId: draftA.id, content: "# Evidence\n\nThe revised persisted claim is supported [HCCITE:S1]." });
    assert.equal(result.status, 200);
    const editedDraft = result.body.draft.draft;
    assert.equal(editedDraft.draftVersion, draftA.draftVersion + 1);
    assert.notEqual(editedDraft.contentHash, draftA.contentHash);
    result = await post(studyA.id, { action: "export", draftId: editedDraft.id });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /current passing Bibliography Audit/);

    result = await post(studyA.id, { action: "audit", draftId: editedDraft.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.audit.status, "passed");
    result = await post(studyA.id, { action: "export", draftId: editedDraft.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.export.draftContentHash, editedDraft.contentHash);

    // The export endpoint reloads the database row and recomputes its hash; it cannot accept browser content.
    await client`update public.hccite_rrl_draft set content = ${"# Evidence\n\nA persisted un-audited database change [HCCITE:S1]."} where id = ${editedDraft.id}`;
    result = await post(studyA.id, { action: "export", draftId: editedDraft.id });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /current passing Bibliography Audit/);

    // Re-auditing an exact clean persisted version reopens export; unknown/manual citations fail closed.
    result = await post(studyA.id, { action: "saveEdit", draftId: editedDraft.id, content: "# Evidence\n\nThe re-audited claim is supported [HCCITE:S1]." });
    assert.equal(result.status, 200);
    const reauditedDraft = result.body.draft.draft;
    result = await post(studyA.id, { action: "audit", draftId: reauditedDraft.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.audit.status, "passed");
    result = await post(studyA.id, { action: "export", draftId: reauditedDraft.id });
    assert.equal(result.status, 200);

    result = await post(studyA.id, { action: "saveEdit", draftId: reauditedDraft.id, content: "# Evidence\n\nAn invented source is asserted [HCCITE:S99]." });
    assert.equal(result.status, 200);
    const untraceableDraft = result.body.draft.draft;
    result = await post(studyA.id, { action: "audit", draftId: untraceableDraft.id });
    assert.equal(result.status, 200);
    assert.equal(result.body.audit.status, "failed");
    assert.ok(result.body.evaluation.issues.some((issue) => issue.code === "unknown_citation_key"));
    result = await post(studyA.id, { action: "export", draftId: untraceableDraft.id });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /current passing Bibliography Audit/);
  } finally {
    await client`delete from public.hccite_user_profile where clerk_user_id in (${userA}, ${userB})`;
    if (resourceId) await client`delete from public.hccite_resource where id = ${resourceId}`;
    await client.end();
    await closeDb();
  }
});
