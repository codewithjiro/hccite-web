import "server-only";
import { env, requireServerEnv } from "~/env";
import { geminiProfileJsonSchema, parseStudyProfile } from "./profile";

export class GeminiFailure extends Error {
  readonly kind: "quota" | "config" | "model" | "invalid" | "timeout" | "temporary" | "document" | "network";
  readonly retryAfterMs: number;
  constructor(kind: GeminiFailure["kind"], retryAfterMs = 0) { super(kind); this.kind = kind; this.retryAfterMs = retryAfterMs; }
}

export function retryDelay(attempt: number, retryAfterMs = 0) { return Math.min(15_000, Math.max(retryAfterMs, 1000 * 2 ** attempt)); }
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function failure(response: Response): GeminiFailure {
  const retry = response.headers.get("retry-after");
  const parsed = retry ? Number(retry) * 1000 || Date.parse(retry) - Date.now() : 0;
  if (response.status === 429) return new GeminiFailure("quota", Math.max(0, parsed));
  if (response.status === 401 || response.status === 403) return new GeminiFailure("config");
  if (response.status === 404) return new GeminiFailure("model");
  if (response.status >= 500) return new GeminiFailure("temporary");
  return new GeminiFailure("document");
}

export type GeminiInput = { fileType: "pdf"; bytes: Uint8Array } | { fileType: "docx"; text: string };

async function uploadTemporaryPdf(bytes: Uint8Array, key: string, fetcher: typeof fetch, delay: (ms: number) => Promise<void>) {
  const start = await fetcher("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST", headers: { "x-goog-api-key": key, "x-goog-upload-protocol": "resumable", "x-goog-upload-command": "start", "x-goog-upload-header-content-length": String(bytes.length), "x-goog-upload-header-content-type": "application/pdf", "content-type": "application/json" },
    body: JSON.stringify({ file: { display_name: "HCCite temporary study PDF" } }), signal: AbortSignal.timeout(30_000),
  });
  if (!start.ok) throw failure(start);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl || new URL(uploadUrl).hostname !== "generativelanguage.googleapis.com") throw new GeminiFailure("document");
  const uploaded = await fetcher(uploadUrl, { method: "POST", headers: { "x-goog-upload-offset": "0", "x-goog-upload-command": "upload, finalize", "content-type": "application/pdf" }, body: Buffer.from(bytes), signal: AbortSignal.timeout(90_000) });
  if (!uploaded.ok) throw failure(uploaded);
  const file = (await uploaded.json() as { file?: { name?: string; uri?: string; state?: string } }).file;
  if (!file?.name?.startsWith("files/") || !file.uri) throw new GeminiFailure("document");
  try {
    for (let i = 0; i < 12; i++) {
      const status = await fetcher(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
      if (!status.ok) throw failure(status);
      const state = (await status.json() as { state?: string }).state;
      if (state === "ACTIVE") return file;
      if (state === "FAILED") throw new GeminiFailure("document");
      await delay(5000);
    }
    throw new GeminiFailure("timeout");
  } catch (error) {
    await deleteTemporaryPdf(file.name, key, fetcher);
    throw error;
  }
}

async function deleteTemporaryPdf(name: string, key: string, fetcher: typeof fetch) {
  try { await fetcher(`https://generativelanguage.googleapis.com/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) }); }
  catch { /* Gemini files expire automatically; a cleanup failure cannot alter the Study. */ }
}

export async function analyzeWithGemini(input: GeminiInput, options: { fetcher?: typeof fetch; delay?: (ms: number) => Promise<void>; maxAttempts?: number } = {}) {
  const key = requireServerEnv("GEMINI_API_KEY");
  const fetcher = options.fetcher ?? fetch;
  const delay = options.delay ?? pause;
  const prompt = "Analyze this non-confidential research study. Return only grounded fields. Use null or empty arrays for unsupported facts. Include title, concise summary, problem, objectives, keywords, methodology, concepts, optional population/findings/conclusion, and suggested literature search queries. For PDF page ranges, include only pages explicitly and reliably identified; otherwise return an empty array. Do not invent citations or page numbers.";
  const temporary = input.fileType === "pdf" && input.bytes.length > 8_000_000 ? await uploadTemporaryPdf(input.bytes, key, fetcher, delay) : null;
  const inputParts = input.fileType === "pdf"
    ? [{ type: "document", ...(temporary ? { uri: temporary.uri } : { data: Buffer.from(input.bytes).toString("base64") }), mime_type: "application/pdf" }, { type: "text", text: prompt }]
    : [{ type: "text", text: `${prompt}\nDOCX has no reliable page numbers; importantPageRanges must be empty.\n\n${input.text}` }];
  const body = JSON.stringify({ model: env.GEMINI_MODEL, input: inputParts, response_format: { type: "text", mime_type: "application/json", schema: geminiProfileJsonSchema } });
  let last: GeminiFailure = new GeminiFailure("temporary");
  try { for (let attempt = 0; attempt < (options.maxAttempts ?? 3); attempt++) {
    try {
      const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body,
        signal: AbortSignal.timeout(90_000), cache: "no-store",
      });
      if (!response.ok) throw failure(response);
      const raw: unknown = await response.json();
      const envelope = raw as { output_text?: unknown; steps?: Array<{ content?: Array<{ text?: unknown }> }> };
      const output = envelope.output_text ?? envelope.steps?.at(-1)?.content?.find((part) => typeof part.text === "string")?.text;
      if (typeof output !== "string" || output.length > 300_000) throw new GeminiFailure("invalid");
      try { return parseStudyProfile(output, input.fileType); }
      catch { throw new GeminiFailure("invalid"); }
    } catch (error) {
      last = error instanceof GeminiFailure ? error : new GeminiFailure(error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network");
      if (!["quota", "temporary"].includes(last.kind) || last.retryAfterMs > 15_000 || attempt + 1 >= (options.maxAttempts ?? 3)) break;
      await delay(retryDelay(attempt, last.retryAfterMs));
    }
  }
  throw last;
  } finally { if (temporary?.name) await deleteTemporaryPdf(temporary.name, key, fetcher); }
}

export function safeGeminiError(error: unknown) {
  if (!(error instanceof GeminiFailure)) return "Study processing failed. Please retry later.";
  return ({ quota: "Gemini free-tier limit reached. Please retry later.", config: "Gemini is not configured for analysis.", model: "The configured Gemini model is unavailable.", invalid: "The AI analysis was invalid. Please retry.", timeout: "Gemini timed out. Please retry.", temporary: "Gemini is temporarily unavailable. Please retry.", document: "The document could not be analyzed. Check the file and retry.", network: "Could not reach Gemini. Please retry." })[error.kind];
}
