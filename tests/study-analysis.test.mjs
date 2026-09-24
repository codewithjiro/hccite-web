import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

process.env.GEMINI_API_KEY = "synthetic-test-key";
const { studyProfileSchema, parseStudyProfile } = await import("../src/server/studies/profile.ts");
const { extractDocx } = await import("../src/server/studies/docx.ts");
const { analyzeWithGemini, GeminiFailure, retryDelay } = await import("../src/server/studies/gemini.ts");

const profile = { title: "Synthetic study", summary: "A small generated study.", researchProblem: null, objectives: [], keywords: ["demo"], methodology: null, variablesOrConcepts: [], suggestedQueries: ["demo study"] };

test("profile validation rejects missing, oversized, malformed arrays and bad page ranges", () => {
  assert.deepEqual(studyProfileSchema.parse(profile), profile);
  assert.equal(studyProfileSchema.safeParse({ ...profile, summary: undefined }).success, false);
  assert.equal(studyProfileSchema.safeParse({ ...profile, objectives: "wrong" }).success, false);
  assert.equal(studyProfileSchema.safeParse({ ...profile, summary: "x".repeat(100001) }).success, false);
  assert.equal(studyProfileSchema.safeParse({ ...profile, importantPageRanges: [{ label: "A", startPage: 2, endPage: 1 }] }).success, false);
  assert.equal(studyProfileSchema.safeParse({ ...profile, unknown: true }).success, false);
  assert.deepEqual(parseStudyProfile(JSON.stringify(profile), "docx"), profile);
  assert.throws(() => parseStudyProfile(JSON.stringify({ ...profile, importantPageRanges: [{ label: "A", startPage: 1, endPage: 1 }] }), "docx"));
});

async function docxXml(document = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methodology</w:t></w:r></w:p><w:p><w:r><w:t>Synthetic sample</w:t></w:r></w:p>') {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${document}</w:body></w:document>`);
  return new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }));
}

test("DOCX extraction preserves heading and paragraph order without page numbers", async () => {
  const result = await extractDocx(await docxXml());
  assert.deepEqual(result.paragraphs.map((p) => p.text), ["Methodology", "Synthetic sample"]);
  assert.equal(result.paragraphs[0].headingLevel, 1);
  assert.equal(result.sections[0].startPage, null);
  assert.match(result.sections[0].normalizedTextReference, /Paragraph 2: Synthetic sample/);
  await assert.rejects(extractDocx(new Uint8Array([1, 2, 3])));
  await assert.rejects(extractDocx(await docxXml("")));
  const zip = new JSZip(); zip.file("other.txt", "not DOCX");
  await assert.rejects(extractDocx(new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }))));
});

test("Gemini validates output, retries 429 with Retry-After, and bounds failures", async () => {
  const waits = []; let calls = 0;
  const requestBodies = [];
  const fetcher = async (_url, options) => { requestBodies.push(JSON.parse(options.body)); return ++calls === 1 ? new Response("", { status: 429, headers: { "Retry-After": "2" } }) : Response.json({ output_text: JSON.stringify(profile) }); };
  assert.deepEqual(await analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher, delay: async (ms) => waits.push(ms) }), profile);
  assert.deepEqual(waits, [2000]);
  assert.equal(requestBodies.every((body) => body.store === false), true);
  assert.equal(retryDelay(1), 2000);
  await assert.rejects(analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher: async () => Response.json({ output_text: "not json" }) }), (e) => e instanceof GeminiFailure && e.kind === "invalid");
  let repeated = 0;
  await assert.rejects(analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher: async () => { repeated++; return new Response("", { status: 429 }); }, delay: async () => {} }), (e) => e.kind === "quota");
  assert.equal(repeated, 3);
  await assert.rejects(analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher: async () => Response.json({ output_text: JSON.stringify({ ...profile, summary: "" }) }) }), (e) => e.kind === "invalid");
  let temporaryCalls = 0;
  assert.deepEqual(await analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher: async () => ++temporaryCalls === 1 ? new Response("", { status: 503 }) : Response.json({ output_text: JSON.stringify(profile) }), delay: async () => {} }), profile);
  assert.equal(temporaryCalls, 2);
  await assert.rejects(analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher: async () => { throw new Error("network"); } }), (e) => e.kind === "network");
  await assert.rejects(analyzeWithGemini({ fileType: "docx", text: "demo" }, { fetcher: async () => { throw new DOMException("timed out", "TimeoutError"); } }), (e) => e.kind === "timeout");
});

test("PDF targeted fallback prompt uses semantic sections rather than fixed page chunks", async () => {
  let body;
  await analyzeWithGemini({ fileType: "pdf", bytes: new TextEncoder().encode("%PDF-1.4 demo"), targetedSections: ["Abstract", "Methodology", "Conclusion"] }, {
    fetcher: async (_url, options) => { body = JSON.parse(options.body); return Response.json({ output_text: JSON.stringify(profile) }); },
  });
  const prompt = body.input.find((part) => part.type === "text").text;
  assert.match(prompt, /Abstract, Methodology, Conclusion/);
  assert.match(prompt, /never arbitrary fixed-page chunks/);
  assert.equal(body.store, false);
});

test("large PDF uses a temporary Gemini file and deletes it after validation", async () => {
  const operations = [];
  const fetcher = async (url, options) => {
    const target = String(url);
    operations.push(`${options.method ?? "GET"} ${target.includes("/interactions") ? "analyze" : target.includes("/upload/") ? "start" : target.includes("upload-session") ? "upload" : "file"}`);
    if (target.includes("/upload/")) return new Response("", { status: 200, headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/upload-session" } });
    if (target.includes("upload-session")) return Response.json({ file: { name: "files/synthetic", uri: "gemini://synthetic" } });
    if (target.includes("/interactions")) return Response.json({ steps: [{ content: [{ text: JSON.stringify(profile) }] }] });
    if (options.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({ state: "ACTIVE" });
  };
  assert.deepEqual(await analyzeWithGemini({ fileType: "pdf", bytes: new Uint8Array(8_000_001) }, { fetcher, delay: async () => {} }), profile);
  assert.deepEqual(operations, ["POST start", "POST upload", "GET file", "POST analyze", "DELETE file"]);
});
