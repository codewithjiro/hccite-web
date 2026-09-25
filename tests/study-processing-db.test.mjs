import assert from "node:assert/strict";
import test from "node:test";
import { setTestIdentity } from "./db-test-auth.mjs";
import { getDb, closeDb } from "../src/server/db/index.ts";
import { eq } from "drizzle-orm";
import { studyAnalyses, studies } from "../src/server/db/schema.ts";
import * as repo from "../src/server/repositories/studies.ts";
import { processOwnedStudy } from "../src/server/studies/process.ts";
import { GeminiFailure } from "../src/server/studies/gemini.ts";

const token = `hccite-analysis-${process.pid}-${Date.now()}`;
const owner = `${token}-owner`;
const foreign = `${token}-foreign`;
const profile = { title: "Synthetic title", summary: "Synthetic summary", researchProblem: null, objectives: [], keywords: [], methodology: null, variablesOrConcepts: [], suggestedQueries: [] };

test("atomic claim, failure retry, version idempotency, and ownership", async () => {
  setTestIdentity(owner);
  const study = await repo.createStudy({ title: "Synthetic", originalFileName: "synthetic.docx", fileType: "docx", fileUrl: "https://ufs.sh/f/synthetic", fileStorageKey: token });
  try {
    const claims = await Promise.all([repo.claimStudyProcessing(study.id), repo.claimStudyProcessing(study.id)]);
    assert.deepEqual(claims.map((c) => c.kind).sort(), ["claimed", "processing"]);
    assert.equal((await repo.getStudy(study.id)).status, "processing");
    await getDb().update(studies).set({ updatedAt: new Date(Date.now() - 31 * 60_000) }).where(eq(studies.id, study.id));
    assert.equal((await repo.claimStudyProcessing(study.id)).kind, "claimed");
    await repo.failStudyProcessing(study.id, "Synthetic failure");
    assert.equal((await repo.getStudy(study.id)).fileStorageKey, token);
    assert.equal((await repo.claimStudyProcessing(study.id)).kind, "claimed");
    await repo.completeStudyProcessing(study.id, profile, "synthetic-model", [{ label: "Introduction", normalizedTextReference: "Heading 1", startPage: null, endPage: null }]);
    assert.equal((await repo.getStudy(study.id)).status, "ready");
    assert.equal((await repo.claimStudyProcessing(study.id)).kind, "ready");
    assert.equal((await getDb().select().from(studyAnalyses).where(eq(studyAnalyses.studyId, study.id))).length, 1);
    const owned = await repo.getOwnedStudyProfile(study.id);
    assert.equal(owned.profile.title, profile.title);
    assert.equal(owned.sections[0].startPage, null);
    setTestIdentity(foreign);
    await assert.rejects(repo.claimStudyProcessing(study.id), /NEXT_NOT_FOUND/);
    await assert.rejects(repo.getOwnedStudyProfile(study.id), /NEXT_NOT_FOUND/);
    await repo.failStudyProcessing(study.id, "foreign");
    setTestIdentity(owner);
    assert.equal((await repo.getStudy(study.id)).status, "ready");
  } finally {
    setTestIdentity(owner);
    await getDb().delete(studies).where(eq(studies.id, study.id));
    await closeDb();
  }
});

test("processing failure retains source, retry succeeds once, and ready skips Gemini", async () => {
  setTestIdentity(owner);
  const study = await repo.createStudy({ title: "Synthetic PDF", originalFileName: "synthetic.pdf", fileType: "pdf", fileUrl: "https://ufs.sh/f/synthetic", fileStorageKey: `${token}-flow` });
  const fetcher = async () => new Response(Buffer.from("%PDF-1.4\nsynthetic demo"), { status: 200 });
  try {
    const failure = await processOwnedStudy(study.id, { fetcher, analyze: async () => { throw new GeminiFailure("invalid"); } });
    assert.equal(failure.status, "failed");
    assert.equal((await repo.getStudy(study.id)).fileStorageKey, `${token}-flow`);
    const schemaFailure = await processOwnedStudy(study.id, { fetcher, analyze: async () => ({ ...profile, summary: "" }) });
    assert.equal(schemaFailure.status, "failed");
    assert.equal((await getDb().select().from(studyAnalyses).where(eq(studyAnalyses.studyId, study.id))).length, 0);
    let calls = 0;
    assert.equal((await processOwnedStudy(study.id, { fetcher, analyze: async () => { calls++; return profile; } })).status, "ready");
    assert.equal((await processOwnedStudy(study.id, { fetcher, analyze: async () => { calls++; return profile; } })).status, "ready");
    assert.equal(calls, 1);
    assert.equal((await getDb().select().from(studyAnalyses).where(eq(studyAnalyses.studyId, study.id))).length, 1);
  } finally {
    await getDb().delete(studies).where(eq(studies.id, study.id));
    await closeDb();
  }
});

test("invalid stored study files fail with a clear persisted validation error before Gemini runs", async () => {
  setTestIdentity(owner);
  const study = await repo.createStudy({ title: "Invalid signature", originalFileName: "synthetic.pdf", fileType: "pdf", fileUrl: "https://ufs.sh/f/invalid-signature", fileStorageKey: `${token}-invalid-signature` });
  try {
    const result = await processOwnedStudy(study.id, {
      fetcher: async () => new Response(Buffer.from("not a PDF")),
      analyze: async () => assert.fail("Gemini must not receive an invalid file"),
    });
    assert.equal(result.status, "failed");
    assert.match(result.error, /did not pass validation/);
    assert.doesNotMatch(result.error, /not a PDF|stack|Error:/i);
    assert.match((await repo.getStudy(study.id)).processingError, /did not pass validation/);
  } finally {
    await getDb().delete(studies).where(eq(studies.id, study.id));
    await closeDb();
  }
});

test("PDF invalid whole-document output retries with semantic sections", async () => {
  setTestIdentity(owner);
  const study = await repo.createStudy({ title: "Fallback PDF", originalFileName: "fallback.pdf", fileType: "pdf", fileUrl: "https://ufs.sh/f/fallback", fileStorageKey: `${token}-fallback` });
  const fetcher = async () => new Response(Buffer.from("%PDF-1.4\nsynthetic demo"), { status: 200 });
  const inputs = [];
  try {
    const result = await processOwnedStudy(study.id, { fetcher, analyze: async (input) => {
      inputs.push(input);
      if (inputs.length === 1) throw new GeminiFailure("invalid");
      return { ...profile, importantPageRanges: [{ label: "Methodology", startPage: 2, endPage: 2 }] };
    } });
    assert.equal(result.status, "ready");
    assert.equal(inputs.length, 2);
    assert.equal(inputs[1].fileType, "pdf");
    assert.ok(inputs[1].targetedSections.includes("Methodology"));
    const saved = await repo.getOwnedStudyProfile(study.id);
    assert.deepEqual(saved.profile.importantPageRanges, [{ label: "Methodology", startPage: 2, endPage: 2 }]);
    assert.equal(saved.sections[0].label, "Methodology");
  } finally {
    await getDb().delete(studies).where(eq(studies.id, study.id));
    await closeDb();
  }
});
