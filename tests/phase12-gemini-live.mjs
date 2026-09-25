/** Controlled live Gemini smoke check using synthetic, non-confidential text only. */
import assert from "node:assert/strict";
import { analyzeWithGemini, GeminiFailure } from "../src/server/studies/gemini.ts";
import { generateRrlWithGemini } from "../src/server/rrl/gemini.ts";

if (process.env.RUN_PHASE12_GEMINI_LIVE !== "1") {
  throw new Error("Set RUN_PHASE12_GEMINI_LIVE=1 to run controlled live verification.");
}

let lastStatus = null;
const observedFetch = async (...args) => {
  const response = await fetch(...args);
  lastStatus = response.status;
  return response;
};

try {
const study = await analyzeWithGemini({
  fileType: "docx",
  text: [
    "Title: Synthetic Classroom Reading Study",
    "Abstract",
    "This synthetic school-project study explores whether weekly guided reading sessions improve reading confidence among Grade 8 students.",
    "Objectives",
    "Describe student confidence before and after four guided reading sessions.",
    "Methodology",
    "A non-confidential synthetic descriptive pretest-posttest exercise with 20 fictional students.",
    "Conclusion",
    "The exercise is illustrative only and contains no real participant data.",
  ].join("\n\n"),
}, { maxAttempts: 1, fetcher: observedFetch });

assert.ok(study.summary);
assert.ok(study.suggestedQueries.length);
console.log(JSON.stringify({ studyProfile: "PASS", suggestedQueries: study.suggestedQueries.length }));

const rrl = await generateRrlWithGemini({
  profile: study,
  citationStyle: "apa",
  sources: [{
    citationKey: "HCCITE:S1",
    title: "Guided reading and student confidence: a synthetic source",
    authors: ["Synthetic Author"],
    year: 2025,
    type: "article",
    venue: "Synthetic Education Journal",
    publisher: null,
    doi: null,
    isbn: null,
    abstract: "A synthetic abstract reports an association between guided reading practice and learner confidence. No real participants or findings are represented.",
    contextAvailability: "abstract_available",
    integrity: { status: "unknown", warning: "Synthetic live-smoke metadata has no DOI." },
  }],
}, { maxAttempts: 3, fetcher: observedFetch });

assert.ok(rrl.sections.length);
assert.ok(rrl.sections.some((section) => section.text.includes("[HCCITE:S1]")));
console.log(JSON.stringify({ rrlGeneration: "PASS", sections: rrl.sections.length, citationAllowList: "PASS" }));
} catch (error) {
  if (error instanceof GeminiFailure) console.error(JSON.stringify({ gemini: "BLOCKED", reason: error.kind, httpStatus: lastStatus }));
  throw error;
}
