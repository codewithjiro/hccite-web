import assert from "node:assert/strict";
import test from "node:test";
import { findSavedId } from "../src/lib/saved-indicator.ts";

const saved = [{ saved: { id: "owned-row" }, resource: { source: "openalex", sourceIdentifier: "W123", doi: "10.1234/shared", isbn: null, citationMetadata: { provenance: [{ provider: "crossref", providerIdentifier: "10.1234/shared" }] } } }];

test("saved indicator matches canonical DOI and provider provenance, never title", () => {
  assert.equal(findSavedId({ source: "crossref", sourceIdentifier: "10.1234/shared", doi: "10.1234/shared", isbn: null }, saved), "owned-row");
  assert.equal(findSavedId({ source: "crossref", sourceIdentifier: "10.1234/shared", doi: null, isbn: null }, saved), "owned-row");
  assert.equal(findSavedId({ source: "crossref", sourceIdentifier: "different", doi: null, isbn: null }, saved), undefined);
});

test("saved indicator treats equivalent ISBN-10 and ISBN-13 as one book", () => {
  const books = [{ saved: { id: "book-row" }, resource: { source: "google_books", sourceIdentifier: "a", doi: null, isbn: "9780306406157", citationMetadata: {} } }];
  assert.equal(findSavedId({ source: "google_books", sourceIdentifier: "b", doi: null, isbn: "0306406152" }, books), "book-row");
});
