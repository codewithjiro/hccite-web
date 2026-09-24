import "server-only";

import { env, requireServerEnv } from "~/env";
import { GeminiFailure, retryDelay } from "~/server/studies/gemini";
import { parseRrlDocument, type RrlDocument } from "./core";

export type RrlGeminiSource = {
  citationKey: string; title: string; authors: string[]; year: number | null; type: string;
  venue: string | null; publisher: string | null; doi: string | null; isbn: string | null;
  abstract: string | null; contextAvailability: "abstract_available" | "title_only";
  integrity: { status: string; warning: string | null };
};
export type RrlGeminiInput = { profile: Record<string, unknown>; citationStyle: "apa" | "mla" | "chicago"; sources: RrlGeminiSource[] };
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const rrlGeminiJsonSchema = {
  type: "object", properties: {
    title: { type: "string" }, limitations: { type: "array", items: { type: "string" } },
    sections: { type: "array", items: { type: "object", properties: {
      key: { type: "string" }, heading: { type: "string" }, text: { type: "string" }, citationKeys: { type: "array", items: { type: "string" } },
    }, required: ["key", "heading", "text", "citationKeys"] } },
  }, required: ["title", "sections", "limitations"],
};

function toFailure(response: Response) {
  const retry = response.headers.get("retry-after");
  const retryAfterMs = retry ? Math.max(0, Number(retry) * 1000 || Date.parse(retry) - Date.now()) : 0;
  if (response.status === 429) return new GeminiFailure("quota", retryAfterMs);
  if (response.status === 401 || response.status === 403) return new GeminiFailure("config");
  if (response.status === 404) return new GeminiFailure("model");
  return new GeminiFailure(response.status >= 500 ? "temporary" : "invalid");
}

/** Gemini sees this minimum, server-resolved payload only: saved profile + immutable source snapshot. */
export async function generateRrlWithGemini(input: RrlGeminiInput, options: { fetcher?: typeof fetch; wait?: (ms: number) => Promise<void>; maxAttempts?: number } = {}): Promise<RrlDocument> {
  const key = requireServerEnv("GEMINI_API_KEY"), fetcher = options.fetcher ?? fetch, wait = options.wait ?? delay, attempts = options.maxAttempts ?? 3;
  const allowedKeys = input.sources.map((source) => source.citationKey);
  const prompt = [
    "Create a conservative, source-grounded Review of Related Literature as JSON matching the response schema.",
    "Organize synthesis by cross-source themes, never a source-by-source list. Use only the supplied sources and only exact bracketed citations such as [HCCITE:S1].",
    "Never introduce sources, identifiers, DOI strings, reference entries, findings, methods, or results not supported by supplied metadata/abstracts.",
    "For title_only sources, state only title/bibliographic-level relevance and add a limitation; do not infer findings or methods.",
    "Every citation token appearing in section text must occur exactly in that section's citationKeys array. Cite only when supported. Do not generate a bibliography; HCCite formats it separately.",
    `Requested citation style for later trusted display: ${input.citationStyle}.`,
    `Study Profile:\n${JSON.stringify(input.profile)}`,
    `Allowed source snapshot:\n${JSON.stringify(input.sources)}`,
  ].join("\n\n");
  const body = JSON.stringify({ model: env.GEMINI_MODEL, input: [{ type: "text", text: prompt }], response_format: { type: "text", mime_type: "application/json", schema: rrlGeminiJsonSchema }, store: false });
  let last = new GeminiFailure("temporary");
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body, signal: AbortSignal.timeout(90_000), cache: "no-store" });
      if (!response.ok) throw toFailure(response);
      const envelope = await response.json() as { output_text?: unknown; steps?: Array<{ content?: Array<{ text?: unknown }> }> };
      const output = envelope.output_text ?? envelope.steps?.at(-1)?.content?.find((part) => typeof part.text === "string")?.text;
      if (typeof output !== "string" || output.length > 400_000) throw new GeminiFailure("invalid");
      try { return parseRrlDocument(output, allowedKeys); }
      catch { throw new GeminiFailure("invalid"); }
    } catch (error) {
      last = error instanceof GeminiFailure ? error : new GeminiFailure(error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network");
      if (!(["quota", "temporary", "invalid"].includes(last.kind)) || attempt + 1 >= attempts || last.retryAfterMs > 15_000) break;
      await wait(retryDelay(attempt, last.retryAfterMs));
    }
  }
  throw last;
}

export function safeRrlGeminiError(error: unknown) {
  if (!(error instanceof GeminiFailure)) return "RRL generation failed. Please retry.";
  return ({ quota: "Gemini is rate-limited. HCCite retried safely; please try again later.", config: "Gemini is not configured for RRL generation.", model: "The configured Gemini model is unavailable.", invalid: "Gemini returned an invalid or unmapped RRL. Nothing was saved; please retry.", timeout: "Gemini timed out. Nothing was saved; please retry.", temporary: "Gemini is temporarily unavailable. Nothing was saved; please retry.", document: "RRL generation could not be completed. Please retry.", network: "Could not reach Gemini. Nothing was saved; please retry." })[error.kind];
}
