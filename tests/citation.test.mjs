import assert from "node:assert/strict";
import test from "node:test";
import { generateCitation, resourceToCsl } from "../src/server/citation/index.ts";

const article = { type: "article", title: "A Study of Reliable Sources", authors: ["Ada Lovelace", "Grace Hopper"], year: 2024, publicationDate: null, doi: "10.1234/example", isbn: null, publisher: null, venue: "Journal of Research", url: null };
const book = { ...article, type: "book", title: "Research Methods", authors: ["Alex Morgan"], year: 2020, doi: null, isbn: "9780306406157", publisher: "Academic Press", venue: null };

test("CSL conversion uses present metadata only", () => {
  const csl = resourceToCsl(article);
  assert.equal(csl.type, "article-journal");
  assert.deepEqual(csl.author, [{ given: "Ada", family: "Lovelace" }, { given: "Grace", family: "Hopper" }]);
  assert.equal(csl.DOI, article.doi);
  const missing = resourceToCsl({ ...article, authors: [], year: null, doi: null });
  assert.equal(missing.author, undefined); assert.equal(missing.issued, undefined); assert.equal(missing.DOI, undefined);
});

for (const [kind, resource] of [["article", article], ["book", book]]) {
  for (const style of ["apa", "mla", "chicago"]) {
    test(`${kind} ${style} formatting is deterministic`, () => {
      const first = generateCitation(resource, style);
      assert.equal(first.ok, true, JSON.stringify(first));
      assert.equal(generateCitation(resource, style).text, first.text);
      assert.match(first.text, new RegExp(resource.title, "i"));
      assert.match(first.text, new RegExp(String(resource.year)));
      assert.match(first.text, /Lovelace|Hopper|Morgan/);
      if (resource.doi) assert.match(first.text, /10\.1234\/example/);
    });
  }
}

test("incomplete metadata and formatter failures are distinct", () => {
  const incomplete = generateCitation({ ...article, authors: [], year: null, doi: null }, "apa");
  assert.deepEqual(incomplete, { ok: false, style: "apa", code: "incomplete_metadata", missing: ["author", "publication year"] });
  assert.deepEqual(generateCitation(article, "invalid"), { ok: false, style: "apa", code: "invalid_style" });
  const failure = generateCitation(article, "apa", () => { throw new Error("formatter failed"); });
  assert.deepEqual(failure, { ok: false, style: "apa", code: "formatting_failure" });
});
