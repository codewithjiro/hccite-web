import "server-only";

import { env } from "~/env";
import { requireServerEnv, ServerConfigurationError } from "~/server/env";
import { geminiProfileJsonSchema, parseStudyProfile } from "./profile";

export type GeminiFailureKind = "missing_config" | "invalid_key" | "config" | "quota" | "rate_limit" | "model" | "invalid" | "timeout" | "temporary" | "document" | "network";

export class GeminiFailure extends Error {
  readonly kind: GeminiFailureKind;
  readonly retryAfterMs: number;
  constructor(kind: GeminiFailureKind, retryAfterMs = 0) {
    super(kind);
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
    this.name = "GeminiFailure";
  }
}

export function retryDelay(attempt: number, retryAfterMs = 0) { return Math.min(15_000, Math.max(retryAfterMs, 1000 * 2 ** attempt)); }
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryAfterMilliseconds(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(value) - Date.now());
}

async function failure(response: Response): Promise<GeminiFailure> {
  let providerCode = "";
  try {
    const body = await response.clone().text();
    providerCode = body.slice(0, 8_000).toLowerCase();
  } catch { /* Keep classification based on the HTTP status when no body is available. */ }

  if (response.status === 429) {
    const quota = /resource_exhausted|quota|daily budget|free.?tier limit/.test(providerCode);
    return new GeminiFailure(quota ? "quota" : "rate_limit", retryAfterMilliseconds(response));
  }
  if (response.status === 401 || response.status === 403 || /api_key_invalid|api key not valid|invalid api key/.test(providerCode)) return new GeminiFailure("invalid_key");
  if (response.status === 404 || /model_not_found|model.{0,30}(not found|not supported)/.test(providerCode)) return new GeminiFailure("model");
  if (response.status >= 500) return new GeminiFailure("temporary");
  return new GeminiFailure("document");
}

function transportFailure(error: unknown) {
  if (error instanceof GeminiFailure) return error;
  return new GeminiFailure(error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "network");
}

async function providerFetch(fetcher: typeof fetch, input: RequestInfo | URL, init?: RequestInit) {
  try { return await fetcher(input, init); }
  catch (error) { throw transportFailure(error); }
}

async function providerJson(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; }
  catch { throw new GeminiFailure("invalid"); }
}

export const TARGET_STUDY_SECTIONS = ["Abstract", "Introduction", "Research Problem", "Objectives", "Methodology", "Results", "Discussion", "Conclusion"] as const;

export type GeminiInput =
  | { fileType: "pdf"; bytes: Uint8Array; targetedSections?: readonly string[] }
  | { fileType: "docx"; text: string };

async function uploadTemporaryPdf(bytes: Uint8Array, key: string, fetcher: typeof fetch, delay: (ms: number) => Promise<void>) {
  const start = await providerFetch(fetcher, "https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST", headers: { "x-goog-api-key": key, "x-goog-upload-protocol": "resumable", "x-goog-upload-command": "start", "x-goog-upload-header-content-length": String(bytes.length), "x-goog-upload-header-content-type": "application/pdf", "content-type": "application/json" },
    body: JSON.stringify({ file: { display_name: "HCCite temporary study PDF" } }), signal: AbortSignal.timeout(30_000),
  });
  if (!start.ok) throw await failure(start);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  try {
    if (!uploadUrl || new URL(uploadUrl).hostname !== "generativelanguage.googleapis.com") throw new GeminiFailure("document");
  } catch (error) {
    if (error instanceof GeminiFailure) throw error;
    throw new GeminiFailure("invalid");
  }
  const uploaded = await providerFetch(fetcher, uploadUrl, { method: "POST", headers: { "x-goog-api-key": key, "x-goog-upload-offset": "0", "x-goog-upload-command": "upload, finalize", "content-type": "application/pdf" }, body: Buffer.from(bytes), signal: AbortSignal.timeout(90_000) });
  if (!uploaded.ok) throw await failure(uploaded);
  const raw = await providerJson(uploaded) as { file?: { name?: string; uri?: string; state?: string } };
  const file = raw && typeof raw === "object" ? raw.file : undefined;
  if (!file || typeof file.name !== "string" || !file.name.startsWith("files/") || typeof file.uri !== "string" || !file.uri) throw new GeminiFailure("invalid");
  const readyFile = { name: file.name, uri: file.uri };
  try {
    for (let i = 0; i < 12; i++) {
      const status = await providerFetch(fetcher, `https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
      if (!status.ok) throw await failure(status);
      const current = await providerJson(status) as { state?: string };
      if (current && typeof current === "object" && current.state === "ACTIVE") return readyFile;
      if (current && typeof current === "object" && current.state === "FAILED") throw new GeminiFailure("document");
      await delay(5000);
    }
    throw new GeminiFailure("timeout");
  } catch (error) {
    await deleteTemporaryPdf(readyFile.name, key, fetcher);
    throw error;
  }
}

async function deleteTemporaryPdf(name: string, key: string, fetcher: typeof fetch) {
  try { await fetcher(`https://generativelanguage.googleapis.com/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) }); }
  catch { /* Gemini files expire automatically; a cleanup failure cannot alter the Study. */ }
}

export async function analyzeWithGemini(input: GeminiInput, options: { fetcher?: typeof fetch; delay?: (ms: number) => Promise<void>; maxAttempts?: number } = {}) {
  let key: string;
  try { key = requireServerEnv("GEMINI_API_KEY"); }
  catch (error) {
    if (error instanceof ServerConfigurationError) throw new GeminiFailure("missing_config");
    throw error;
  }

  const fetcher = options.fetcher ?? fetch;
  const delay = options.delay ?? pause;
  const sectionInstruction = input.fileType === "pdf" && input.targetedSections?.length
    ? ` Whole-document analysis did not produce a usable profile. Re-analyze by locating only these semantic sections (never arbitrary fixed-page chunks): ${input.targetedSections.join(", ")}. Synthesize the profile from sections actually present and leave unsupported fields empty.`
    : "";
  const prompt = `Analyze this non-confidential research study. Return only grounded fields. Use null or empty arrays for unsupported facts. Include title, concise summary, problem, objectives, keywords, methodology, concepts, optional population/findings/conclusion, and suggested literature search queries. For PDF page ranges, include only pages explicitly and reliably identified; otherwise return an empty array. Do not invent citations or page numbers.${sectionInstruction}`;
  let temporary: { name: string; uri: string } | null = null;
  try {
    if (input.fileType === "pdf" && input.bytes.length > 8_000_000) temporary = await uploadTemporaryPdf(input.bytes, key, fetcher, delay);
    const inputParts = input.fileType === "pdf"
      ? [{ type: "document", ...(temporary ? { uri: temporary.uri } : { data: Buffer.from(input.bytes).toString("base64") }), mime_type: "application/pdf" }, { type: "text", text: prompt }]
      : [{ type: "text", text: `${prompt}\nDOCX has no reliable page numbers; importantPageRanges must be empty.\n\n${input.text}` }];
    const body = JSON.stringify({ model: env.GEMINI_MODEL, input: inputParts, response_format: { type: "text", mime_type: "application/json", schema: geminiProfileJsonSchema }, store: false });
    let last: GeminiFailure = new GeminiFailure("temporary");
    for (let attempt = 0; attempt < (options.maxAttempts ?? 3); attempt++) {
      try {
        const response = await providerFetch(fetcher, "https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body,
          signal: AbortSignal.timeout(90_000), cache: "no-store",
        });
        if (!response.ok) throw await failure(response);
        const raw = await providerJson(response) as { output_text?: unknown; steps?: unknown } | null;
        const steps = Array.isArray(raw?.steps) ? raw.steps as Array<{ content?: unknown }> : [];
        const finalContent = Array.isArray(steps.at(-1)?.content) ? steps.at(-1)?.content as Array<{ text?: unknown }> : [];
        const output = raw?.output_text ?? finalContent.find((part) => typeof part?.text === "string")?.text;
        if (typeof output !== "string" || output.length > 300_000) throw new GeminiFailure("invalid");
        try { return parseStudyProfile(output, input.fileType); }
        catch { throw new GeminiFailure("invalid"); }
      } catch (error) {
        last = transportFailure(error);
        if (!(last.kind === "quota" || last.kind === "rate_limit" || last.kind === "temporary") || last.retryAfterMs > 15_000 || attempt + 1 >= (options.maxAttempts ?? 3)) break;
        await delay(retryDelay(attempt, last.retryAfterMs));
      }
    }
    throw last;
  } catch (error) {
    throw transportFailure(error);
  } finally {
    if (temporary?.name) await deleteTemporaryPdf(temporary.name, key, fetcher);
  }
}

export function safeGeminiError(error: unknown) {
  if (!(error instanceof GeminiFailure)) return "Study analysis failed because of a server error. Please retry later.";
  return ({
    missing_config: "Gemini analysis is not configured. Set GEMINI_API_KEY in .env.local for development or in Vercel project settings for deployments.",
    invalid_key: "Gemini rejected the API key. Check GEMINI_API_KEY in the server environment.",
    config: "Gemini is not configured for this feature. Check GEMINI_API_KEY in the server environment.",
    quota: "Gemini quota is exhausted. Wait for the quota window to reset, then retry.",
    rate_limit: "Gemini is rate limiting requests. Wait a moment, then retry.",
    model: "The configured Gemini model is unavailable. Check GEMINI_MODEL in the server environment.",
    invalid: "Gemini returned an unusable analysis. Please retry.",
    timeout: "Gemini took too long to respond. Please retry.",
    temporary: "Gemini is temporarily unavailable. Please retry later.",
    document: "Gemini could not process this document. Check the file and retry.",
    network: "Could not reach Gemini. Check the connection and retry.",
  })[error.kind];
}
