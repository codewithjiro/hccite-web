import assert from "node:assert/strict";
import test from "node:test";

const { parseCitationTokens } = await import("../src/server/rrl/core.ts");
const { contentHash, evaluateRrlAudit } = await import("../src/server/rrl/audit.ts");

const resource = (overrides = {}) => ({ id: "00000000-0000-4000-8000-000000000001", title: "Traceable source", authors: ["Ada Author"], year: 2024, type: "article", publicationDate: null, doi: "10.5555/traceable", isbn: null, publisher: null, venue: "Research Journal", url: "https://example.test/source", ...overrides });
const source = (overrides = {}) => ({ citationKey: "HCCITE:S1", resourceId: "00000000-0000-4000-8000-000000000001", sourceSnapshot: { resourceId: "00000000-0000-4000-8000-000000000001" }, resource: resource(), integrity: { status: "no_known_issue", doiVerified: true, checkedAt: new Date("2026-01-01T00:00:00Z"), updateLabel: null }, ...overrides });
const audit = (content, sources = [source()], storedContentHash = contentHash(content)) => evaluateRrlAudit({ content, storedContentHash, citationStyle: "apa", sources });

test("citation parser preserves valid and repeated bracketed HCCite tokens with section context", () => {
  const parsed = parseCitationTokens("# RRL\n\n## Theme One\n\nEvidence [HCCITE:S1], again [HCCITE:S1], then [HCCITE:S2].");
  assert.deepEqual(parsed.occurrences.map((item) => item.citationKey), ["HCCITE:S1", "HCCITE:S1", "HCCITE:S2"]);
  assert.equal(parsed.occurrences[1].occurrence, 2);
  assert.equal(parsed.occurrences[0].sectionKey, "theme-one");
});

test("parser and audit fail closed for malformed, invented, and manual references", () => {
  const malformed = parseCitationTokens("Bad [HCCITE:S0], bare HCCITE:S1, and [HCCITE:S1");
  assert.ok(malformed.malformedTokens.length >= 2);
  const unknown = audit("Claim [HCCITE:S99].");
  assert.equal(unknown.status, "failed");
  assert.ok(unknown.issues.some((issue) => issue.code === "unknown_citation_key"));
  const manual = audit("A manual DOI 10.5555/untrusted and (Smith, 2020) [HCCITE:S1].");
  assert.equal(manual.status, "failed");
  assert.ok(manual.issues.some((issue) => issue.code === "manual_reference"));
});

test("a valid cited subset passes and reports selected, mapped, and occurrence counts separately", () => {
  const sources = [source(), source({ citationKey: "HCCITE:S2", resourceId: "00000000-0000-4000-8000-000000000002", sourceSnapshot: { resourceId: "00000000-0000-4000-8000-000000000002" }, resource: resource({ id: "00000000-0000-4000-8000-000000000002", title: "Unused source", doi: "10.5555/unused" }) }), source({ citationKey: "HCCITE:S3", resourceId: "00000000-0000-4000-8000-000000000003", sourceSnapshot: { resourceId: "00000000-0000-4000-8000-000000000003" }, resource: resource({ id: "00000000-0000-4000-8000-000000000003", title: "Unused source 2", doi: "10.5555/unused2" }) })];
  const result = audit("Claim [HCCITE:S1]. Repeat [HCCITE:S1].", sources);
  assert.equal(result.status, "passed");
  assert.equal(result.selectedSourceCount, 3);
  assert.equal(result.mappedSourceCount, 1);
  assert.equal(result.citationOccurrenceCount, 2);
});

test("snapshot mismatch, missing metadata, integrity evidence, and stale hashes are actionable", () => {
  const mismatch = audit("Claim [HCCITE:S1].", [source({ resource: resource({ id: "00000000-0000-4000-8000-000000000099" }) })]);
  assert.equal(mismatch.status, "failed");
  assert.ok(mismatch.issues.some((issue) => issue.code === "source_snapshot_mismatch"));
  const missing = audit("Claim [HCCITE:S1].", [source({ resource: resource({ year: null }) })]);
  assert.equal(missing.status, "review_required");
  assert.ok(missing.issues.some((issue) => issue.code === "missing_metadata"));
  const retracted = audit("Claim [HCCITE:S1].", [source({ integrity: { status: "retracted", doiVerified: true, checkedAt: new Date(), updateLabel: "Retraction notice" } })]);
  assert.equal(retracted.status, "failed");
  assert.ok(retracted.issues.some((issue) => issue.code === "integrity_retracted"));
  const unknownIntegrity = audit("Claim [HCCITE:S1].", [source({ integrity: { status: "unknown", doiVerified: null, checkedAt: new Date(), updateLabel: null } })]);
  assert.equal(unknownIntegrity.status, "review_required");
  const stale = audit("Claim [HCCITE:S1].", [source()], "0".repeat(64));
  assert.equal(stale.status, "failed");
  assert.ok(stale.issues.some((issue) => issue.code === "content_hash_mismatch"));
});

test("server-side repository owns audit, detail, and final export gates", async () => {
  const repository = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/server/repositories/rrl.ts", import.meta.url), "utf8"));
  assert.match(repository, /findOwnedDraft\(id, profile\.id\)/);
  assert.match(repository, /hashForContent\(data\.draft\.content\)/);
  assert.match(repository, /latestAudit\?\.status !== "passed"/);
  assert.match(repository, /getFinalRrlExport/);
});
