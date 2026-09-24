import "server-only";
import { env, requireServerEnv } from "~/env";
import type { NormalizedResource } from "~/server/discovery/normalization";
import { GeminiFailure } from "~/server/studies/gemini";
import type { StudyProfile } from "~/server/studies/profile";
import { contextCompleteness, relevanceSchema } from "./core";

export async function explainRelevance(profile: StudyProfile, resource: NormalizedResource, options: { fetcher?: typeof fetch } = {}) {
  const key = requireServerEnv("GEMINI_API_KEY"), fetcher = options.fetcher ?? fetch;
  const completeness = contextCompleteness(resource);
  const prompt = `Explain retrieval relevance only. Never state findings, conclusions, quality, reliability, or integrity unless explicitly present in supplied context. ${completeness === "title_only" || completeness === "doi_metadata_only" ? "Context is limited: explicitly say the source may be relevant and that HCCite lacks enough source content to confirm findings." : "Ground the explanation only in the supplied abstract/description."}`;
  const data = { study: { researchProblem: profile.researchProblem, objectives: profile.objectives.slice(0, 5), keywords: profile.keywords.slice(0, 10), concepts: profile.variablesOrConcepts.slice(0, 10), methodology: profile.methodology }, source: { title: resource.title, authors: resource.authors.slice(0, 10), year: resource.year, venue: resource.venue, publisher: resource.publisher, context: resource.abstract, completeness } };
  let response: Response;
  try { response = await fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: JSON.stringify({ model: env.GEMINI_MODEL, input: [{ type: "text", text: `${prompt}\n\n${JSON.stringify(data)}` }], response_format: { type: "text", mime_type: "application/json", schema: { type: "object", properties: { reason: { type: "string" }, score: { type: "number", minimum: 0, maximum: 1 } }, required: ["reason", "score"], additionalProperties: false } }, store: false }), signal: AbortSignal.timeout(45_000), cache: "no-store" }); }
  catch { throw new GeminiFailure("network"); }
  if (!response.ok) throw new GeminiFailure(response.status === 429 ? "quota" : response.status === 401 || response.status === 403 ? "config" : "temporary");
  const raw = await response.json() as { output_text?: unknown; steps?: Array<{ content?: Array<{ text?: unknown }> }> };
  const text = raw.output_text ?? raw.steps?.at(-1)?.content?.find((part) => typeof part.text === "string")?.text;
  if (typeof text !== "string" || text.length > 10_000) throw new GeminiFailure("invalid");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new GeminiFailure("invalid"); }
  const result = relevanceSchema.safeParse(parsed);
  if (!result.success) throw new GeminiFailure("invalid");
  if ((completeness === "title_only" || completeness === "doi_metadata_only") && !/\b(may|might|potential|limited|not enough|cannot confirm)\b/i.test(result.data.reason)) throw new GeminiFailure("invalid");
  return { ...result.data, completeness };
}
