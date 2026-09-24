import assert from "node:assert/strict";
import test from "node:test";

process.env.GEMINI_API_KEY = "synthetic-test-key";
const { parseRrlDocument, renderRrlDocument, validateCitationAllowList } = await import("../src/server/rrl/core.ts");
const { generateRrlWithGemini } = await import("../src/server/rrl/gemini.ts");

const source = (overrides = {}) => ({ citationKey: "HCCITE:S1", title: "Abstract-backed source", authors: ["A. Author"], year: 2024, type: "article", venue: "Journal", publisher: null, doi: "10.5555/example", isbn: null, abstract: "The supplied abstract supports a cautious synthesis.", contextAvailability: "abstract_available", integrity: { status: "no_known_issue", warning: null }, ...overrides });
const document = (overrides = {}) => ({ title: "Related Literature", sections: [{ key: "theme-one", heading: "Theme one", text: "The available abstract supports this cautious theme [HCCITE:S1].", citationKeys: ["HCCITE:S1"] }], limitations: [], ...overrides });

test("RRL output requires exact, allow-listed HCCite citation tokens", () => {
  const parsed = parseRrlDocument(JSON.stringify(document()), ["HCCITE:S1", "HCCITE:S2"]);
  assert.match(renderRrlDocument(parsed), /\[HCCITE:S1\]/);
  assert.throws(() => parseRrlDocument(JSON.stringify(document({ sections: [{ ...document().sections[0], text: "Invented [HCCITE:S3].", citationKeys: ["HCCITE:S3"] }] })), ["HCCITE:S1"]), /unmapped/);
  assert.throws(() => parseRrlDocument(JSON.stringify(document({ sections: [{ ...document().sections[0], text: "A raw DOI 10.5555/invented must not become a citation [HCCITE:S1]." }] })), ["HCCITE:S1"]), /raw DOI/);
  assert.throws(() => validateCitationAllowList({ ...document(), sections: [{ ...document().sections[0], citationKeys: [] }] }, ["HCCITE:S1"]), /does not match/);
});

test("Gemini retry is bounded and title-only constraints are sent without extra sources", async () => {
  let calls = 0; let prompt = "";
  const response = await generateRrlWithGemini({ profile: { summary: "Synthetic profile" }, citationStyle: "apa", sources: [source({ abstract: null, contextAvailability: "title_only" })] }, {
    fetcher: async (_url, init) => { calls++; prompt = String(init?.body); if (calls === 1) return new Response("", { status: 429 }); return Response.json({ output_text: JSON.stringify(document({ limitations: ["HCCITE:S1 has title-only context; detailed findings are not asserted."] })) }); },
    wait: async () => {}, maxAttempts: 2,
  });
  assert.equal(calls, 2);
  assert.equal(response.sections[0].citationKeys[0], "HCCITE:S1");
  assert.match(prompt, /title_only/);
  assert.equal(prompt.includes("HCCITE:S2"), false);
});

test("invalid output is never accepted after bounded retries", async () => {
  let calls = 0;
  await assert.rejects(generateRrlWithGemini({ profile: { summary: "Synthetic" }, citationStyle: "mla", sources: [source()] }, { fetcher: async () => { calls++; return Response.json({ output_text: JSON.stringify(document({ sections: [{ ...document().sections[0], text: "Bad [HCCITE:S9].", citationKeys: ["HCCITE:S9"] }] })) }); }, wait: async () => {}, maxAttempts: 2 }), /invalid|unmapped/);
  assert.equal(calls, 2);
});
