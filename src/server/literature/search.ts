import "server-only";
import { lookupCrossrefDoi } from "~/server/discovery/providers/crossref";
import { searchGoogleBooks } from "~/server/discovery/providers/google-books";
import { searchOpenAlex } from "~/server/discovery/providers/openalex";
import { ProviderError } from "~/server/discovery/providers/shared";
import { mergeNormalizedResources, type NormalizedResource } from "~/server/discovery/normalization";
import { dedupeLiteratureResults, isBookRelevant, literatureQuerySchema } from "./core";

export type LiteratureWarning = { provider: "openalex" | "crossref" | "google_books"; code: string; message: string; retryable: boolean };
const warning = (provider: LiteratureWarning["provider"], error: unknown): LiteratureWarning => error instanceof ProviderError
  ? error.toJSON() : { provider, code: "unknown", message: `${provider} could not be reached.`, retryable: true };

export async function searchLiterature(input: unknown, dependencies = { openAlex: searchOpenAlex, googleBooks: searchGoogleBooks, crossref: lookupCrossrefDoi }) {
  const query = literatureQuerySchema.parse(input);
  const warnings: LiteratureWarning[] = [];
  const scholarly = await dependencies.openAlex(query, 1).then((r) => { warnings.push(...(r.warnings ?? [])); return r.items; }).catch((e) => { warnings.push(warning("openalex", e)); return [] as NormalizedResource[]; });
  const books = isBookRelevant(query)
    ? await dependencies.googleBooks(query, 0).then((r) => r.items).catch((e) => { warnings.push(warning("google_books", e)); return [] as NormalizedResource[]; })
    : [];
  const enriched = await Promise.all(scholarly.map(async (resource, index) => {
    if (!resource.doi || index >= 8) return resource;
    try { return mergeNormalizedResources(resource, (await dependencies.crossref(resource.doi)).resource); }
    catch (error) { warnings.push(warning("crossref", error)); return resource; }
  }));
  return { query, items: dedupeLiteratureResults([...enriched, ...books]), warnings: [...new Map(warnings.map((w) => [`${w.provider}:${w.code}`, w])).values()], booksSearched: isBookRelevant(query) };
}
