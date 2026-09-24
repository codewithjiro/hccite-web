import assert from "node:assert/strict";
import test from "node:test";
import { STUDY_DOCX_MIME, validateStudyFile } from "../src/server/studies/file-validation.ts";

const maxBytes = 1024;
const bytes = (...items) => new Uint8Array(items);
function docxFixture() {
  const names = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"];
  const entries = names.map((name) => new TextEncoder().encode(name));
  const centralSize = entries.reduce((sum, name) => sum + 46 + name.length, 0);
  const out = new Uint8Array(centralSize + 22); const view = new DataView(out.buffer); let cursor = 0;
  for (const name of entries) { view.setUint32(cursor, 0x02014b50, true); view.setUint16(cursor + 28, name.length, true); out.set(name, cursor + 46); cursor += 46 + name.length; }
  view.setUint32(cursor, 0x06054b50, true); view.setUint16(cursor + 8, entries.length, true); view.setUint16(cursor + 10, entries.length, true); view.setUint32(cursor + 12, centralSize, true); view.setUint32(cursor + 16, 0, true); return out;
}

test("accepts genuine minimal PDF and OOXML/DOCX signatures", () => {
  assert.deepEqual(validateStudyFile({ name: "demo.pdf", mimeType: "application/pdf", bytes: bytes(37, 80, 68, 70, 45, 49), maxBytes }), { ok: true, fileType: "pdf" });
  assert.deepEqual(validateStudyFile({ name: "demo.docx", mimeType: STUDY_DOCX_MIME, bytes: docxFixture(), maxBytes }), { ok: true, fileType: "docx" });
});

test("rejects renamed files, MIME mismatches, ZIP lookalikes, unsupported and oversized files", () => {
  assert.equal(validateStudyFile({ name: "bad.pdf", mimeType: "application/pdf", bytes: bytes(1, 2), maxBytes }).ok, false);
  assert.equal(validateStudyFile({ name: "bad.pdf", mimeType: "text/plain", bytes: bytes(37, 80, 68, 70, 45), maxBytes }).ok, false);
  assert.equal(validateStudyFile({ name: "bad.docx", mimeType: STUDY_DOCX_MIME, bytes: bytes(80, 75, 3, 4), maxBytes }).ok, false);
  assert.equal(validateStudyFile({ name: "bad.docx", mimeType: "application/zip", bytes: docxFixture(), maxBytes }).ok, false);
  assert.equal(validateStudyFile({ name: "bad.txt", mimeType: "text/plain", bytes: bytes(1), maxBytes }).ok, false);
  assert.equal(validateStudyFile({ name: "large.pdf", mimeType: "application/pdf", bytes: new Uint8Array(maxBytes + 1), maxBytes }).ok, false);
  assert.equal(validateStudyFile({ name: "empty.pdf", mimeType: "application/pdf", bytes: bytes(), maxBytes }).ok, false);
});
