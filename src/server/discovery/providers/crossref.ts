import "server-only";

import { z } from "zod";
import { env } from "~/env";
import { normalizeDoi, normalizedResourceSchema, safelyRenderUrl, type NormalizedResource } from "~/server/discovery/normalization";
import { ProviderError, providerJson } from "./shared";

const workSchema = z.object({
  DOI: z.string().max(512).optional(), title: z.array(z.string().max(10_000)).max(20).optional(), author: z.array(z.object({ given: z.string().max(500).optional(), family: z.string().max(500).optional(), name: z.string().max(500).optional() }).passthrough()).max(500).optional(),
  publisher: z.string().max(10_000).optional(), "container-title": z.array(z.string().max(10_000)).max(20).optional(), published: z.object({ "date-parts": z.array(z.array(z.number().int()).max(3)).max(5) }).optional(),
  "published-print": z.object({ "date-parts": z.array(z.array(z.number().int())) }).optional(), "published-online": z.object({ "date-parts": z.array(z.array(z.number().int())) }).optional(),
  URL: z.string().optional(), abstract: z.string().optional(), ISBN: z.array(z.string()).optional(), type: z.string().optional(),
}).passthrough();
const itemEnvelope = z.object({ message: workSchema }).passthrough();
const searchEnvelope = z.object({ message: z.object({ items: z.array(workSchema), "total-results": z.number().int().nonnegative() }).passthrough() }).passthrough();

function dateValue(work: z.infer<typeof workSchema>): string | null {
  const parts = work.published?.["date-parts"]?.[0] ?? work["published-print"]?.["date-parts"]?.[0] ?? work["published-online"]?.["date-parts"]?.[0];
  return parts?.length ? parts.map((part) => String(part).padStart(2, "0")).join("-") : null;
}
function mapWork(work: z.infer<typeof workSchema>, retrievedAt: Date): NormalizedResource {
  const date = dateValue(work);
  const doi = normalizeDoi(work.DOI);
  return normalizedResourceSchema.parse({
    type: work.type === "book" || work.type === "monograph" ? "book" : "article", title: work.title?.find((title) => title.trim()) ?? "", authors: (work.author ?? []).map((author) => author.name ?? [author.given, author.family].filter(Boolean).join(" ")).filter(Boolean),
    year: date ? Number(date.slice(0, 4)) || null : null, publicationDate: date, doi, isbn: null,
    publisher: work.publisher ?? null, venue: work["container-title"]?.[0] ?? null, source: "crossref", sourceIdentifier: doi,
    url: safelyRenderUrl(work.URL) ?? (doi ? `https://doi.org/${doi}` : null), abstract: work.abstract?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null,
    retrievedAt, citationMetadata: { provider: "crossref", crossrefType: work.type ?? null, issn: null, referenceCount: null },
  });
}
function safeMap(work: z.infer<typeof workSchema>, retrievedAt: Date) { return mapWork(work, retrievedAt); }

export function normalizeDoiInput(input: string): string | null { return normalizeDoi(input); }

export async function lookupCrossrefDoi(input: string, options: { fetcher?: typeof fetch; mailto?: string } = {}) {
  const doi = normalizeDoiInput(input);
  if (!doi) throw new ProviderError("crossref", "invalid_input", "Enter a DOI such as 10.1234/example, doi:10.1234/example, or a DOI URL.");
  const mailto = options.mailto ?? env.CROSSREF_MAILTO;
  if (!mailto) throw new ProviderError("crossref", "missing_credentials", "Crossref contact email is not configured.");
  const url = new URL(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  url.searchParams.set("mailto", mailto);
  const payload = await providerJson<unknown>("crossref", url, { "User-Agent": `HCCite/0.1 (mailto:${mailto})` }, options.fetcher);
  const parsed = itemEnvelope.safeParse(payload);
  if (!parsed.success) throw new ProviderError("crossref", "malformed_response", "Crossref response did not match the expected work format.");
  if (normalizeDoi(parsed.data.message.DOI) !== doi) throw new ProviderError("crossref", "malformed_response", "Crossref returned a different DOI.");
  let resource: NormalizedResource;
  try { resource = safeMap(parsed.data.message, new Date()); }
  catch { throw new ProviderError("crossref", "malformed_response", "Crossref record is missing usable metadata."); }
  return { resource, doiFound: true, verification: "unknown" as const };
}

export async function searchCrossrefTitle(query: string, options: { fetcher?: typeof fetch; mailto?: string } = {}) {
  const mailto = options.mailto ?? env.CROSSREF_MAILTO;
  if (!mailto) throw new ProviderError("crossref", "missing_credentials", "Crossref contact email is not configured.");
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.title", query); url.searchParams.set("rows", "20"); url.searchParams.set("mailto", mailto);
  const payload = await providerJson<unknown>("crossref", url, { "User-Agent": `HCCite/0.1 (mailto:${mailto})` }, options.fetcher);
  const parsed = searchEnvelope.safeParse(payload);
  if (!parsed.success) throw new ProviderError("crossref", "malformed_response", "Crossref response did not match the expected search format.");
  const retrievedAt = new Date();
  return { items: parsed.data.message.items.map((item) => safeMap(item, retrievedAt)).filter((item) => !!item.title && !!item.doi), total: parsed.data.message["total-results"] };
}
