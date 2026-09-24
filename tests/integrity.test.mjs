import assert from "node:assert/strict";
import test from "node:test";

process.env.CROSSREF_MAILTO = "fixture@example.org";
const { assessCrossrefIntegrity, hashIntegrityMetadata, isIntegrityCheckFresh } = await import("../src/server/integrity/core.ts");
const { ensureResourceIntegrity } = await import("../src/server/integrity/service.ts");

const meta = (overrides = {}) => ({ doi: "10.5555/example", type: "journal-article", title: "Fixture article", authorCount: 1, publicationDate: "2024-01-02", venue: "Fixture Journal", publisher: "Fixture Publisher", updatePolicy: null, updateTo: [], relation: [], createdAt: "2024-01-02T00:00:00Z", depositedAt: "2024-01-02T00:00:00Z", indexedAt: "2024-01-02T00:00:00Z", ...overrides });

test("clean, corrected, retracted, review, missing fields and wrong DOI classify separately", () => {
  const clean = assessCrossrefIntegrity("10.5555/example", meta());
  assert.equal(clean.status, "no_known_issue"); assert.equal(clean.doiVerified, true); assert.equal(clean.metadataComplete, true); assert.match(clean.rawMetadataHash, /^[a-f0-9]{64}$/);
  const corrected = assessCrossrefIntegrity("10.5555/example", meta({ updateTo: [{ doi: "10.5555/correction", type: "correction", label: "Correction", source: "publisher", updatedAt: null }] }));
  assert.deepEqual([corrected.status, corrected.updateType, corrected.updateDoi], ["corrected", "correction", "10.5555/correction"]);
  const retracted = assessCrossrefIntegrity("10.5555/example", meta({ updateTo: [{ doi: "10.5555/correction", type: "correction", label: "Correction", source: "publisher", updatedAt: null }, { doi: "10.5555/retraction", type: "retraction", label: "Retraction", source: "retraction-watch", updatedAt: null }] }));
  assert.deepEqual([retracted.status, retracted.doiVerified, retracted.updateType], ["retracted", true, "retraction"]);
  const review = assessCrossrefIntegrity("10.5555/example", meta({ updateTo: [{ doi: "10.5555/concern", type: "expression-of-concern", label: "Expression of concern", source: "publisher", updatedAt: null }] }));
  assert.deepEqual([review.status, review.updateType], ["review_required", "expression_of_concern"]);
  assert.equal(assessCrossrefIntegrity("10.5555/example", meta({ authorCount: 0 })).status, "unknown");
  assert.equal(assessCrossrefIntegrity("10.5555/example", meta({ doi: "10.5555/other" })).status, "unknown");
});

test("unknown/malformed update metadata is conservative and multiple evidence uses deterministic precedence", () => {
  assert.equal(assessCrossrefIntegrity("10.5555/example", meta({ updateTo: [{ doi: null, type: "brand-new-update", label: null, source: null, updatedAt: null }] })).status, "review_required");
  assert.equal(assessCrossrefIntegrity("10.5555/example", meta({ updateTo: [{ doi: null, type: null, label: null, source: null, updatedAt: null }] })).status, "review_required");
  assert.equal(assessCrossrefIntegrity("10.5555/example", meta({ relation: [{ type: "is-retracted-by", identifiers: ["10.5555/retraction"] }, { type: "is-corrected-by", identifiers: ["10.5555/correction"] }] })).status, "retracted");
});

test("metadata hashes are stable and change only for relevant metadata changes", () => {
  const first = meta(); const reordered = { indexedAt: first.indexedAt, updateTo: first.updateTo, title: first.title, doi: first.doi, type: first.type, authorCount: first.authorCount, publicationDate: first.publicationDate, venue: first.venue, publisher: first.publisher, updatePolicy: first.updatePolicy, relation: first.relation, createdAt: first.createdAt, depositedAt: first.depositedAt };
  assert.equal(hashIntegrityMetadata(first), hashIntegrityMetadata(reordered));
  assert.notEqual(hashIntegrityMetadata(first), hashIntegrityMetadata(meta({ updateTo: [{ doi: "10.5555/retraction", type: "retraction", label: "Retraction", source: "publisher", updatedAt: null }] })));
  assert.equal(hashIntegrityMetadata(first).includes("fixture@example.org"), false);
});

test("TTL is strict at the boundary and never treats invalid TTL as fresh", () => {
  const now = new Date("2026-01-02T00:00:00Z"), checked = new Date("2026-01-01T00:00:00Z");
  assert.equal(isIntegrityCheckFresh(checked, 24, new Date("2026-01-01T23:59:59.999Z")), true);
  assert.equal(isIntegrityCheckFresh(checked, 24, now), false);
  assert.equal(isIntegrityCheckFresh(checked, -1, now), false);
});

test("service reuses fresh checks, refreshes stale checks, and preserves adverse evidence on outage", async () => {
  const now = new Date("2026-01-02T00:00:00Z");
  const resource = { id: "00000000-0000-4000-8000-000000000009", doi: "10.5555/example" };
  const cleanCheck = { id: "00000000-0000-4000-8000-000000000010", resourceId: resource.id, status: "no_known_issue", doiVerified: true, updateType: null, updateDoi: null, updateLabel: null, integritySource: "crossref", metadataComplete: true, checkedAt: new Date("2026-01-01T12:01:00Z"), rawMetadataHash: "hash" };
  let lookupCalls = 0; let writes = 0;
  const deps = { getResource: async () => resource, getLatest: async () => cleanCheck, recordLatest: async (input) => { writes++; return { ...cleanCheck, ...input }; }, now: () => now, ttlHours: 24, lookup: async () => { lookupCalls++; return { integrityMetadata: meta() }; } };
  const fresh = await ensureResourceIntegrity(resource.id, {}, deps);
  assert.equal(fresh.reused, true); assert.equal(lookupCalls, 0); assert.equal(writes, 0);
  deps.getLatest = async () => ({ ...cleanCheck, checkedAt: new Date("2025-12-31T00:00:00Z") });
  const stale = await ensureResourceIntegrity(resource.id, {}, deps);
  assert.equal(stale.check.status, "no_known_issue"); assert.equal(lookupCalls, 1); assert.equal(writes, 1);
  const adverse = { ...cleanCheck, status: "retracted", updateType: "retraction", updateLabel: "Retraction", checkedAt: new Date("2025-12-31T00:00:00Z") };
  deps.getLatest = async () => adverse; deps.lookup = async () => { throw new Error("network unavailable"); };
  const outage = await ensureResourceIntegrity(resource.id, {}, deps);
  assert.equal(outage.check.status, "retracted"); assert.equal(outage.stale, true); assert.match(outage.refreshError, /could not be completed/);
});

test("service does not call Crossref for missing DOI and persists unknown", async () => {
  const resource = { id: "00000000-0000-4000-8000-000000000011", doi: null }; let calls = 0; let write;
  const result = await ensureResourceIntegrity(resource.id, {}, { getResource: async () => resource, getLatest: async () => null, recordLatest: async (input) => { write = input; return input; }, lookup: async () => { calls++; throw new Error("must not run"); }, now: () => new Date("2026-01-02T00:00:00Z"), ttlHours: 24 });
  assert.equal(calls, 0); assert.equal(result.check.status, "unknown"); assert.match(write.updateLabel, /No DOI/);
});
