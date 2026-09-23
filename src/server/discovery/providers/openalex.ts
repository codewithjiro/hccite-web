import "server-only";

import { z } from "zod";
import { env } from "~/env";
import { normalizeDoi, normalizedResourceSchema, safelyRenderUrl, type NormalizedResource } from "~/server/discovery/normalization";
import { openAlexWorkIdSchema } from "~/server/discovery/locator";
import { ProviderError, providerJson } from "./shared";

const openAlexWorkSchema = z.object({
  id: z.string().min(1).max(512), display_name: z.string().min(1).max(10_000),
  authorships: z.array(z.object({ author: z.object({ display_name: z.string().max(500).nullable().optional() }).passthrough() }).passthrough()).max(500).optional().default([]),
  publication_year: z.number().int().nullable().optional(), publication_date: z.string().nullable().optional(),
  doi: z.string().max(512).nullable().optional(), type: z.string().max(100).nullable().optional(),
  primary_location: z.object({ source: z.object({ display_name: z.string().nullable().optional() }).passthrough().nullable().optional(), landing_page_url: z.string().nullable().optional() }).passthrough().nullable().optional(),
  abstract_inverted_index: z.record(z.string(), z.array(z.number().int())).nullable().optional(),
  open_access: z.object({ is_oa: z.boolean(), oa_url: z.string().nullable().optional(), any_repository_has_fulltext: z.boolean().optional() }).passthrough().nullable().optional(),
}).passthrough();
const responseSchema = z.object({ meta: z.object({ count: z.number().int().nonnegative(), page: z.number().int().optional(), per_page: z.number().int().optional() }).passthrough(), results: z.array(openAlexWorkSchema) }).passthrough();

function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words.push([position, word]);
  words.sort((a, b) => a[0] - b[0]);
  return words.map(([, word]) => word).join(" ").trim() || null;
}

function mapWork(work: z.infer<typeof openAlexWorkSchema>, retrievedAt: Date): NormalizedResource {
  const id = openAlexWorkIdSchema.safeParse(work.id.replace(/^https:\/\/openalex\.org\//i, "")).data ?? null;
  const url = safelyRenderUrl(work.primary_location?.landing_page_url) ?? safelyRenderUrl(work.doi) ?? safelyRenderUrl(work.id);
  return normalizedResourceSchema.parse({
    type: work.type === "book" ? "book" : "article", title: work.display_name,
    authors: work.authorships.map((entry) => entry.author.display_name).filter((name): name is string => !!name?.trim()),
    year: work.publication_year ?? null, publicationDate: work.publication_date ?? null, doi: normalizeDoi(work.doi), isbn: null,
    publisher: null, venue: work.primary_location?.source?.display_name ?? null,
    source: "openalex", sourceIdentifier: id, url, abstract: reconstructAbstract(work.abstract_inverted_index), retrievedAt,
    citationMetadata: { provider: "openalex", openAlexId: id, openAccess: work.open_access ? { isOpenAccess: work.open_access.is_oa, url: safelyRenderUrl(work.open_access.oa_url), repositoryHasFullText: work.open_access.any_repository_has_fulltext ?? null } : null },
  });
}

export async function getOpenAlexWorkById(input: string, options: { fetcher?: typeof fetch; apiKey?: string } = {}) {
  const parsedId = openAlexWorkIdSchema.safeParse(input);
  if (!parsedId.success) throw new ProviderError("openalex", "invalid_input", "Enter a valid OpenAlex work ID.");
  const apiKey = options.apiKey ?? env.OPENALEX_API_KEY;
  if (!apiKey) throw new ProviderError("openalex", "missing_credentials", "OpenAlex API key is not configured.");
  const url = new URL(`https://api.openalex.org/works/${parsedId.data}`);
  url.searchParams.set("api_key", apiKey);
  const payload = await providerJson<unknown>("openalex", url, undefined, options.fetcher);
  const work = openAlexWorkSchema.safeParse(payload);
  if (!work.success) throw new ProviderError("openalex", "malformed_response", "OpenAlex response did not match the expected work format.");
  let resource: NormalizedResource;
  try { resource = mapWork(work.data, new Date()); }
  catch { throw new ProviderError("openalex", "malformed_response", "OpenAlex work has unusable metadata."); }
  if (resource.sourceIdentifier !== parsedId.data) throw new ProviderError("openalex", "malformed_response", "OpenAlex returned a different work ID.");
  return resource;
}

export async function searchOpenAlex(query: string, page: number, options: { fetcher?: typeof fetch; apiKey?: string; yearFrom?: number; openAccess?: boolean } = {}) {
  const apiKey = options.apiKey ?? env.OPENALEX_API_KEY;
  if (!apiKey) throw new ProviderError("openalex", "missing_credentials", "OpenAlex API key is not configured.");
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("search", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "20");
  const filters = [options.yearFrom ? `from_publication_date:${options.yearFrom}-01-01` : null, options.openAccess === undefined ? null : `is_oa:${options.openAccess}`].filter(Boolean);
  if (filters.length) url.searchParams.set("filter", filters.join(","));
  url.searchParams.set("select", "id,display_name,authorships,publication_year,publication_date,doi,type,primary_location,abstract_inverted_index,open_access");
  const payload = await providerJson<unknown>("openalex", url, undefined, options.fetcher);
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new ProviderError("openalex", "malformed_response", "OpenAlex response did not match the expected works format.");
  const retrievedAt = new Date();
  return { items: parsed.data.results.map((work) => mapWork(work, retrievedAt)), page, total: parsed.data.meta.count, hasMore: page * (parsed.data.meta.per_page ?? 20) < parsed.data.meta.count };
}
