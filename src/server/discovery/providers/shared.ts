import "server-only";

export type ProviderName = "openalex" | "crossref" | "google_books";
export type ProviderErrorCode = "invalid_input" | "missing_credentials" | "invalid_credentials" | "rate_limited" | "quota_exhausted" | "provider_outage" | "timeout" | "network_error" | "malformed_response" | "not_found" | "unknown";
export class ProviderError extends Error {
  readonly provider: ProviderName;
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  constructor(provider: ProviderName, code: ProviderErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
  }
  toJSON() { return { provider: this.provider, code: this.code, message: this.message, retryable: this.retryable }; }
}

export async function providerJson<T>(provider: ProviderName, url: URL, headers?: HeadersInit, fetcher: typeof fetch = fetch): Promise<T> {
  let response: Response;
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      response = await fetcher(url, { headers, signal: controller.signal, cache: "no-store" });
    } catch (error) {
      clearTimeout(timeout);
      const timedOut = error instanceof Error && error.name === "AbortError";
      if (attempt === 0 && !timedOut) continue;
      throw new ProviderError(provider, timedOut ? "timeout" : "network_error", timedOut ? `${provider} request timed out.` : `${provider} could not be reached.`, true);
    }
    clearTimeout(timeout);
    if (response.status === 429) {
      const body = await response.clone().text().catch(() => "");
      const exhausted = response.headers.get("x-ratelimit-remaining") === "0" || /daily budget|credits? (?:are )?exhausted|quota/i.test(body);
      const quota = provider === "openalex" && exhausted;
      throw new ProviderError(provider, quota ? "quota_exhausted" : "rate_limited", quota ? "OpenAlex free API quota is exhausted or rate limited. Try again after the reset." : `${provider} is rate limiting requests. Try again shortly.`, false);
    }
    if (response.status >= 500 && attempt === 0) continue;
    if (!response.ok) {
      if (response.status === 404) throw new ProviderError(provider, "not_found", `${provider} did not find a matching record.`);
      if (provider === "openalex" && (response.status === 401 || response.status === 403)) {
        throw new ProviderError("openalex", "invalid_credentials", "OpenAlex rejected its API key. Check OPENALEX_API_KEY in the server environment.");
      }
      if (provider === "google_books" && response.status === 403) {
        const body = await response.clone().text().catch(() => "");
        if (/quotaExceeded/i.test(body)) throw new ProviderError(provider, "quota_exhausted", "Google Books API quota is exhausted. Try again after the quota reset.");
        if (/rateLimitExceeded|userRateLimitExceeded/i.test(body)) throw new ProviderError(provider, "rate_limited", "Google Books is rate limiting requests. Try again shortly.");
      }
      throw new ProviderError(provider, response.status >= 500 ? "provider_outage" : "unknown", `${provider} returned HTTP ${response.status}.`, response.status >= 500);
    }
    try { return await response.json() as T; }
    catch { throw new ProviderError(provider, "malformed_response", `${provider} returned invalid JSON.`); }
  }
}

export function getErrorResponse(error: unknown) {
  if (error instanceof ProviderError) return { error: error.toJSON() };
  return { error: { provider: null, code: "unknown" as const, message: "Discovery could not be completed.", retryable: true } };
}
