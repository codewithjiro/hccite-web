import assert from "node:assert/strict";
import test from "node:test";
import { isbn10FromIsbn13, isbn13FromIsbn10, mergeNormalizedResources, normalizeDoi, normalizeIsbn, normalizedResourceSchema, conservativeTitleCandidates } from "../src/server/discovery/normalization.ts";
import { getOpenAlexWorkById, searchOpenAlex } from "../src/server/discovery/providers/openalex.ts";
import { lookupCrossrefDoi, lookupCrossrefIntegrityDoi, normalizeDoiInput, searchCrossrefTitle } from "../src/server/discovery/providers/crossref.ts";
import { getGoogleBookById, searchGoogleBooks } from "../src/server/discovery/providers/google-books.ts";
import { ProviderError } from "../src/server/discovery/providers/shared.ts";
import { discoverySaveLocatorSchema } from "../src/server/discovery/locator.ts";
import { saveDiscoveredResource } from "../src/server/discovery/save.ts";

test("normalizes equivalent DOI forms and rejects invalid identifiers", () => {
  const variants = ["10.5555/example", "doi:10.5555/example", "https://doi.org/10.5555/example", "HTTP://DX.DOI.ORG/10.5555/EXAMPLE"];
  assert.deepEqual(variants.map(normalizeDoi), ["10.5555/example", "10.5555/example", "10.5555/example", "10.5555/example"]);
  assert.equal(normalizeDoiInput("doi:10.5555/example"), "10.5555/example");
  assert.equal(normalizeDoi("not-a-doi"), null);
});

test("normalizes and validates ISBN-10 and ISBN-13 formatting and equivalence", () => {
  assert.equal(normalizeIsbn("0-306-40615-2"), "0306406152");
  assert.equal(normalizeIsbn("0 306 40615 2"), "0306406152");
  assert.equal(normalizeIsbn("978-0-306-40615-7"), "9780306406157");
  assert.equal(normalizeIsbn("978 0 306 40615 7"), "9780306406157");
  assert.equal(isbn13FromIsbn10("0-306-40615-2"), "9780306406157");
  assert.equal(isbn10FromIsbn13("9780306406157"), "0306406152");
  assert.equal(normalizeIsbn("9780306406158"), null);
  assert.equal(normalizeIsbn(null), null);
});

const resource = (overrides = {}) => normalizedResourceSchema.parse({
  type: "article", title: "A study of test systems", authors: ["Ada Lovelace"], year: 2021, publicationDate: "2021-05-01", doi: null, isbn: null,
  publisher: null, venue: "Example Journal", source: "openalex", sourceIdentifier: "W123", url: "https://openalex.org/W123", abstract: "A useful abstract.",
  retrievedAt: new Date("2026-09-23T00:00:00Z"), citationMetadata: {}, ...overrides,
});

test("normalizes missing provider metadata without fabricating values", () => {
  const missing = resource({ title: "Record without metadata", authors: [], year: null, publicationDate: null, doi: null, abstract: null, url: null });
  assert.equal(missing.doi, null); assert.equal(missing.authors.length, 0); assert.equal(missing.year, null); assert.equal(missing.abstract, null); assert.equal(missing.url, null);
});

test("merges providers field-wise, preserves richer Crossref metadata, and records disagreements", () => {
  const crossref = resource({ source: "crossref", sourceIdentifier: "10.5555/example", doi: "10.5555/example", authors: ["Ada Lovelace", "Grace Hopper"], year: 2020, publisher: "Publisher", citationMetadata: {} });
  const openalex = resource({ source: "openalex", sourceIdentifier: "W456", doi: "https://doi.org/10.5555/EXAMPLE", authors: ["Different Provider Author"], year: null, publisher: null, abstract: null });
  const merged = mergeNormalizedResources(crossref, openalex);
  assert.equal(merged.doi, "10.5555/example"); assert.deepEqual(merged.authors, ["Ada Lovelace", "Grace Hopper"]); assert.equal(merged.year, 2020); assert.equal(merged.publisher, "Publisher");
  assert.ok(merged.citationMetadata.providerDisagreements.some((item) => item.field === "authors"));
  assert.ok(Array.isArray(merged.citationMetadata.provenance));
});

test("title fallback is strict and leaves ambiguous matches unresolved", () => {
  const base = { title: "A study of test systems", authors: ["Ada Lovelace"], year: 2021 };
  assert.equal(conservativeTitleCandidates(base, [{ ...base, id: "1" }]).match?.id, "1");
  assert.equal(conservativeTitleCandidates(base, [{ ...base, title: "A study about test systems", id: "2" }]).match, null);
  assert.equal(conservativeTitleCandidates(base, [{ ...base, id: "3" }, { ...base, id: "4" }]).match, null);
  assert.equal(conservativeTitleCandidates(base, [{ ...base, id: "3" }, { ...base, id: "4" }]).ambiguous.length, 2);
  assert.equal(conservativeTitleCandidates({ ...base, doi: "10.5555/new" }, [{ ...base, doi: "10.5555/other", id: "5" }]).match, null);
});

test("OpenAlex validates work responses and reports 429 without retry", async () => {
  await assert.rejects(searchOpenAlex("x", 1, { apiKey: "", fetcher: async () => new Response("{}") }), (error) => error.code === "missing_credentials");
  let calls = 0;
  const fetcher = async () => { calls += 1; return new Response(JSON.stringify({ meta: { count: 1, page: 1, per_page: 20 }, results: [{ id: "https://openalex.org/W123", display_name: "A work", authorships: [], publication_year: null, publication_date: null, doi: null, type: "article", primary_location: null, abstract_inverted_index: null, open_access: { is_oa: false } }] }), { status: 200 }); };
  const result = await searchOpenAlex("a work", 1, { apiKey: "fixture-only", fetcher });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].citationMetadata.openAccess.isOpenAccess, false); assert.equal(calls, 1);
  await assert.rejects(searchOpenAlex("x", 1, { apiKey: "fixture-only", fetcher: async () => { calls += 1; return new Response('{"error":"daily budget exceeded"}', { status: 429 }); } }), (error) => error instanceof ProviderError && error.code === "quota_exhausted");
  assert.equal(calls, 2, "429 is not retried");
  await assert.rejects(searchOpenAlex("x", 1, { apiKey: "fixture-only", fetcher: async () => new Response("{}", { status: 200 }) }), (error) => error.code === "malformed_response");
});

test("Crossref normalizes DOI lookup, keeps verification unknown, and handles not found and malformed responses", async () => {
  let requested = "";
  const work = { DOI: "10.5555/EXAMPLE", title: ["Example article"], author: [{ given: "Ada", family: "Lovelace" }], publisher: "Example Press", "container-title": ["Example Journal"], published: { "date-parts": [[2021, 4, 9]] }, URL: "https://publisher.example/item" };
  const fetcher = async (input) => { requested = String(input); return new Response(JSON.stringify({ status: "ok", message: work }), { status: 200 }); };
  const result = await lookupCrossrefDoi("HTTP://DX.DOI.ORG/10.5555/EXAMPLE", { mailto: "test@example.org", fetcher });
  assert.equal(decodeURIComponent(requested).includes("10.5555/example"), true);
  assert.equal(result.resource.doi, "10.5555/example"); assert.equal(result.resource.publisher, "Example Press"); assert.equal(result.verification, "unknown");
  await assert.rejects(lookupCrossrefDoi("10.5555/missing", { mailto: "test@example.org", fetcher: async () => new Response("{}", { status: 404 }) }), (error) => error.code === "not_found");
  await assert.rejects(searchCrossrefTitle("x", { mailto: "test@example.org", fetcher: async () => new Response("{}", { status: 200 }) }), (error) => error.code === "malformed_response");
  await assert.rejects(lookupCrossrefDoi("10.5555/example", { mailto: "", fetcher }), (error) => error.code === "missing_credentials");
});

test("Crossref integrity lookup uses the documented updates filter so original DOI receives update evidence", async () => {
  const original = { DOI: "10.5555/original", title: ["Original article"], author: [{ name: "Fixture Author" }], publisher: "Fixture", "container-title": ["Fixture Journal"], published: { "date-parts": [[2024, 1, 1]] } };
  const notice = { DOI: "10.5555/retraction-notice", title: ["Retraction"], "update-to": [{ DOI: "10.5555/original", type: "retraction", label: "Retraction", source: "retraction-watch", updated: { "date-time": "2025-01-01T00:00:00Z" } }] };
  let updateRequest = false;
  const result = await lookupCrossrefIntegrityDoi("10.5555/original", { mailto: "fixture@example.org", fetcher: async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/works/10.5555%2Foriginal") || decodeURIComponent(url.pathname).endsWith("/works/10.5555/original")) return new Response(JSON.stringify({ message: original }));
    updateRequest = url.searchParams.get("filter") === "updates:10.5555/original";
    return new Response(JSON.stringify({ message: { items: [notice], "total-results": 1 } }));
  } });
  assert.equal(updateRequest, true);
  assert.deepEqual(result.integrityMetadata.updateTo, [{ doi: "10.5555/retraction-notice", type: "retraction", label: "Retraction", source: "retraction-watch", updatedAt: "2025-01-01T00:00:00Z" }]);
});

test("Google Books handles empty and sparse records, validates URLs, and surfaces configuration errors", async () => {
  const empty = await searchGoogleBooks("no matching title", 0, { apiKey: "fixture-only", fetcher: async () => new Response(JSON.stringify({ totalItems: 0, items: [] }), { status: 200 }) });
  assert.deepEqual(empty.items, []); assert.equal(empty.hasMore, false);
  const sparse = await searchGoogleBooks("a book", 0, { apiKey: "fixture-only", fetcher: async () => new Response(JSON.stringify({ totalItems: 1, items: [{ id: "book-1", volumeInfo: { title: "Sparse book", imageLinks: { thumbnail: "javascript:alert(1)" }, previewLink: "ftp://bad.example" } }] }), { status: 200 }) });
  assert.equal(sparse.items[0].authors.length, 0); assert.equal(sparse.items[0].isbn, null); assert.equal(sparse.items[0].abstract, null); assert.equal(sparse.items[0].citationMetadata.coverImageUrl, null); assert.equal(sparse.items[0].citationMetadata.previewUrl, null);
  await assert.rejects(searchGoogleBooks("book", 0, { apiKey: "", fetcher: async () => new Response("{}") }), (error) => error.code === "missing_credentials");
  await assert.rejects(searchGoogleBooks("book", 0, { apiKey: "fixture-only", fetcher: async () => new Response('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', { status: 403 }) }), (error) => error.code === "quota_exhausted");
  await assert.rejects(searchGoogleBooks("book", 0, { apiKey: "fixture-only", fetcher: async () => new Response("{}", { status: 503 }) }), (error) => error.code === "provider_outage");
});

test("discovery save accepts only strict, safe provider locators", () => {
  const valid = [
    { provider: "openalex", providerIdentifier: "W123" },
    { provider: "crossref", providerIdentifier: "10.5555/example" },
    { provider: "google_books", providerIdentifier: "book_123-A" },
  ];
  for (const locator of valid) assert.equal(discoverySaveLocatorSchema.safeParse(locator).success, true);
  for (const locator of [
    { ...valid[1], title: "FAKE TITLE", authors: ["Fake Author"] },
    { provider: "manual", providerIdentifier: "anything" },
    { provider: "openalex", providerIdentifier: "https://evil.example/W123" },
    { provider: "crossref", providerIdentifier: "not-a-doi" },
    { provider: "google_books", providerIdentifier: "../unsafe?key=x" },
  ]) assert.equal(discoverySaveLocatorSchema.safeParse(locator).success, false);
});

test("exact provider re-fetch validates identity and metadata without client bibliographic fields", async () => {
  const openAlexWork = { id: "https://openalex.org/W123", display_name: "True OpenAlex title", authorships: [], publication_year: 2022 };
  const openalexFetcher = async (input) => {
    assert.equal(new URL(input).origin, "https://api.openalex.org");
    assert.equal(new URL(input).pathname, "/works/W123");
    return new Response(JSON.stringify(openAlexWork));
  };
  const search = await searchOpenAlex("True", 1, { apiKey: "fixture", fetcher: async () => new Response(JSON.stringify({ meta: { count: 1 }, results: [openAlexWork] })) });
  const openalex = await getOpenAlexWorkById(search.items[0].sourceIdentifier, { apiKey: "fixture", fetcher: openalexFetcher });
  assert.equal(openalex.title, search.items[0].title);
  const crossref = await lookupCrossrefDoi("10.5555/example", { mailto: "fixture@example.org", fetcher: async (input) => {
    assert.equal(new URL(input).origin, "https://api.crossref.org");
    return new Response(JSON.stringify({ message: { DOI: "10.5555/EXAMPLE", title: ["True Crossref title"], author: [{ name: "True Author" }] } }));
  } });
  assert.equal(crossref.resource.title, "True Crossref title");
  const book = { id: "book_123-A", volumeInfo: { title: "True book title", authors: ["True Book Author"] } };
  const books = await searchGoogleBooks("True", 0, { apiKey: "fixture", fetcher: async () => new Response(JSON.stringify({ totalItems: 1, items: [book] })) });
  const googleBook = await getGoogleBookById(books.items[0].sourceIdentifier, { apiKey: "fixture", fetcher: async (input) => {
    assert.equal(new URL(input).origin, "https://www.googleapis.com");
    assert.equal(new URL(input).pathname, "/books/v1/volumes/book_123-A");
    return new Response(JSON.stringify(book));
  } });
  assert.equal(googleBook.title, books.items[0].title);
  for (const operation of [
    () => getOpenAlexWorkById("W123", { apiKey: "fixture", fetcher: async () => new Response("{}") }),
    () => getGoogleBookById("book_123-A", { apiKey: "fixture", fetcher: async () => new Response("{}") }),
    () => lookupCrossrefDoi("10.5555/example", { mailto: "fixture@example.org", fetcher: async () => new Response(JSON.stringify({ message: { DOI: "10.5555/other", title: ["Wrong"] } })) }),
  ]) await assert.rejects(operation, (error) => error.code === "malformed_response");
  await assert.rejects(getOpenAlexWorkById("W123", { apiKey: "", fetcher: openalexFetcher }), (error) => error.code === "missing_credentials");
  await assert.rejects(getGoogleBookById("book_123-A", { apiKey: "", fetcher: async () => new Response(JSON.stringify(book)) }), (error) => error.code === "missing_credentials");
  await assert.rejects(getOpenAlexWorkById("W123", { apiKey: "fixture", fetcher: async () => new Response("{}", { status: 503 }) }), (error) => error.code === "provider_outage");
});

test("save service persists only provider-refetched metadata and makes no writes on provider failure", async () => {
  const authoritative = resource({ source: "crossref", sourceIdentifier: "10.5555/example", doi: "10.5555/example", title: "True provider title", authors: ["True Author"] });
  const writes = [];
  const dependencies = {
    openalex: async () => assert.fail("wrong provider"),
    crossref: async () => ({ resource: authoritative }),
    googleBooks: async () => assert.fail("wrong provider"),
    upsert: async (value) => { writes.push(value); return { resource: { ...value, id: "canonical-id" }, reused: false, ambiguous: false }; },
    save: async (value) => { writes.push(value); return { id: "saved-id" }; },
  };
  await assert.rejects(saveDiscoveredResource({ provider: "crossref", providerIdentifier: "10.5555/example", title: "FAKE TITLE" }, dependencies));
  assert.equal(writes.length, 0);
  const saved = await saveDiscoveredResource({ provider: "crossref", providerIdentifier: "10.5555/example" }, dependencies);
  assert.equal(saved.saved, true);
  assert.equal(writes[0].title, "True provider title");
  assert.deepEqual(writes[0].authors, ["True Author"]);
  assert.deepEqual(writes[1], { resourceId: "canonical-id" });
  writes.length = 0;
  dependencies.crossref = async () => { throw new ProviderError("crossref", "provider_outage", "Unavailable", true); };
  await assert.rejects(saveDiscoveredResource({ provider: "crossref", providerIdentifier: "10.5555/example" }, dependencies), (error) => error.code === "provider_outage");
  assert.equal(writes.length, 0);
});
