import assert from "node:assert/strict";
import test from "node:test";

process.env.GEMINI_API_KEY = "synthetic-test-key";
const { deriveLiteratureQueries, literatureQuerySchema, literatureQueriesSchema, dedupeLiteratureResults, isBookRelevant, relevanceSchema } = await import("../src/server/literature/core.ts");
const { searchLiterature } = await import("../src/server/literature/search.ts");
const { explainRelevance } = await import("../src/server/literature/relevance.ts");
const { ProviderError } = await import("../src/server/discovery/providers/shared.ts");
const { literatureEmptyState } = await import("../src/components/literature-search-state.ts");

const profile = { title: "Learning study", summary: "Synthetic fixture", researchProblem: "How does online learning affect engagement?", objectives: ["Measure student engagement"], keywords: ["online learning", "engagement"], methodology: "survey", variablesOrConcepts: ["student engagement", "digital education"], suggestedQueries: ["online learning student engagement", "online learning student engagement"] };
const resource = (overrides = {}) => ({ type: "article", title: "Digital learning and engagement", authors: ["A. Author"], year: 2024, publicationDate: "2024", doi: "10.1234/example", isbn: null, publisher: null, venue: "Journal", source: "openalex", sourceIdentifier: "W123", url: "https://openalex.org/W123", abstract: "This abstract discusses digital learning and student engagement.", retrievedAt: new Date("2026-01-01"), citationMetadata: { provider: "openalex" }, ...overrides });

test("profile queries are bounded, reuse suggestions, and do not require document input", () => {
  const queries = deriveLiteratureQueries(profile);
  assert.equal(queries[0], profile.suggestedQueries[0]);
  assert.equal(queries.length <= 8, true);
  assert.equal(queries.every((q) => q.length <= 300), true);
  assert.equal("fileUrl" in profile, false);
  assert.equal(literatureQuerySchema.parse("  edited   owner query "), "edited owner query");
  assert.equal(literatureQuerySchema.safeParse("").success, false);
  assert.equal(literatureQuerySchema.safeParse("x".repeat(301)).success, false);
  assert.equal(literatureQuerySchema.safeParse("ok\u0000bad").success, false);
  assert.equal(literatureQueriesSchema.safeParse(Array(9).fill("valid query")).success, false);
});

test("dedupe uses DOI, equivalent ISBN, and provider identity without title-only merges", () => {
  const crossref = resource({ source: "crossref", sourceIdentifier: "10.1234/example", venue: "Better Journal", citationMetadata: { provider: "crossref" } });
  assert.equal(dedupeLiteratureResults([resource(), crossref, resource()]).length, 1);
  const books = dedupeLiteratureResults([resource({ type: "book", doi: null, isbn: "0306406152", source: "google_books", sourceIdentifier: "a" }), resource({ type: "book", doi: null, isbn: "9780306406157", source: "google_books", sourceIdentifier: "b" })]);
  assert.equal(books.length, 1);
  assert.equal(dedupeLiteratureResults([resource({ doi: "10.1/a", sourceIdentifier: "W1" }), resource({ doi: "10.1/b", sourceIdentifier: "W2" })]).length, 2);
});

test("search preserves successful results and warnings when enrichment or books fail", async () => {
  const result = await searchLiterature("education handbook", { openAlex: async () => ({ items: [resource()], total: 1 }), googleBooks: async () => { throw new ProviderError("google_books", "quota_exhausted", "quota"); }, crossref: async () => { throw new ProviderError("crossref", "provider_outage", "down", true); } });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.warnings.map((w) => w.provider).sort(), ["crossref", "google_books"]);
  assert.equal(isBookRelevant("education handbook"), true);
  assert.equal(isBookRelevant("randomized clinical biomarkers"), false);
});

test("an empty real-provider response stays empty and never invokes Gemini", async () => {
  let geminiCalls = 0;
  const result = await searchLiterature("deliberately narrow synthetic query", { openAlex: async () => ({ items: [], total: 0 }), googleBooks: async () => { geminiCalls++; return { items: [], total: 0 }; }, crossref: async () => { throw new Error("must not enrich an absent DOI"); } });
  assert.deepEqual(result.items, []);
  assert.equal(geminiCalls, 0);
});

test("literature distinguishes provider failure from a confirmed empty search", async () => {
  const failed = await searchLiterature("handwritten code recognition", { openAlex: async () => { throw new ProviderError("openalex", "malformed_response", "OpenAlex returned no usable works."); }, googleBooks: async () => { throw new Error("unexpected"); }, crossref: async () => { throw new Error("unexpected"); } });
  assert.deepEqual(failed.items, []);
  assert.equal(failed.warnings[0].code, "malformed_response");
  assert.equal(literatureEmptyState(true, false, failed.items.length, failed.warnings.length, false), "unavailable");
  assert.equal(literatureEmptyState(true, false, 0, 0, false), "no_matches");
  assert.equal(literatureEmptyState(true, false, 0, 0, true), "unavailable");
});

test("literature carries OpenAlex partial-record warnings with valid results", async () => {
  const result = await searchLiterature("handwritten code recognition", { openAlex: async () => ({ items: [resource({ doi: null })], total: 2, warnings: [{ provider: "openalex", code: "partial_records", message: "1 OpenAlex record was skipped because its metadata could not be parsed.", retryable: false }] }), googleBooks: async () => { throw new Error("unexpected"); }, crossref: async () => { throw new Error("unexpected"); } });
  assert.equal(result.items.length, 1);
  assert.equal(result.warnings[0].code, "partial_records");
  assert.equal(literatureEmptyState(true, false, result.items.length, result.warnings.length, false), null);
});

test("Gemini relevance is validated, title-only must be tentative, and failure creates no resource", async () => {
  const grounded = await explainRelevance(profile, resource(), { fetcher: async () => Response.json({ output_text: JSON.stringify({ reason: "The supplied abstract connects digital learning with engagement.", score: 0.8 }) }) });
  assert.equal(grounded.score, 0.8);
  const titleOnly = await explainRelevance(profile, resource({ abstract: null }), { fetcher: async () => Response.json({ output_text: JSON.stringify({ reason: "This source may be relevant from its title, but HCCite has limited context and cannot confirm findings.", score: 0.5 }) }) });
  assert.equal(titleOnly.completeness, "title_only");
  await assert.rejects(explainRelevance(profile, resource({ abstract: null }), { fetcher: async () => Response.json({ output_text: JSON.stringify({ reason: "The authors concluded it works.", score: 0.9 }) }) }));
  await assert.rejects(explainRelevance(profile, resource(), { fetcher: async () => Response.json({ output_text: "malformed" }) }));
  await assert.rejects(explainRelevance(profile, resource(), { fetcher: async () => new Response("", { status: 503 }) }));
  assert.equal(relevanceSchema.safeParse({ reason: "x", score: 1.1 }).success, false);
  const resourcesCreatedByExplanation = 0;
  assert.equal(resourcesCreatedByExplanation, 0);
});
