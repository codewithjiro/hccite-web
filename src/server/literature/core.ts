import { z } from "zod";
import { isbn13FromIsbn10, mergeNormalizedResources, normalizeDoi, normalizeIsbn, type NormalizedResource } from "~/server/discovery/normalization";
import type { StudyProfile } from "~/server/studies/profile";

export const MAX_LITERATURE_QUERIES = 8;
export const literatureQuerySchema = z.string().trim().min(3, "Enter at least 3 meaningful characters.").max(300)
  .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), "Query contains unsupported control characters.")
  .transform((value) => value.replace(/\s+/g, " "));
export const literatureQueriesSchema = z.array(literatureQuerySchema).min(1).max(MAX_LITERATURE_QUERIES);
export const relevanceSchema = z.object({ reason: z.string().trim().min(1).max(2_000), score: z.number().min(0).max(1) }).strict();

function bounded(parts: Array<string | null | undefined>, max = 220) {
  return parts.filter((part): part is string => !!part?.trim()).join(" ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

export function deriveLiteratureQueries(profile: StudyProfile): string[] {
  const candidates = [
    ...profile.suggestedQueries,
    bounded(profile.keywords.slice(0, 5)),
    bounded(profile.variablesOrConcepts.slice(0, 4)),
    bounded([profile.researchProblem, ...profile.keywords.slice(0, 2)]),
    bounded([...profile.objectives.slice(0, 1), ...profile.variablesOrConcepts.slice(0, 2)]),
    bounded([...profile.keywords.slice(0, 3), profile.methodology]),
  ];
  const unique = new Map<string, string>();
  for (const candidate of candidates) {
    const parsed = literatureQuerySchema.safeParse(candidate);
    if (parsed.success) unique.set(parsed.data.toLowerCase(), parsed.data);
    if (unique.size === MAX_LITERATURE_QUERIES) break;
  }
  return [...unique.values()];
}

export function isBookRelevant(query: string): boolean {
  return /\b(book|books|textbook|handbook|manual|monograph|history|theory|framework|literature|philosophy|education)\b/i.test(query);
}

function identity(resource: NormalizedResource): string {
  const doi = normalizeDoi(resource.doi);
  if (doi) return `doi:${doi}`;
  const isbn = normalizeIsbn(resource.isbn);
  if (isbn) return `isbn:${isbn.length === 10 ? isbn13FromIsbn10(isbn) ?? isbn : isbn}`;
  return `provider:${resource.source}:${resource.sourceIdentifier ?? crypto.randomUUID()}`;
}

export function dedupeLiteratureResults(items: NormalizedResource[]): NormalizedResource[] {
  const result = new Map<string, NormalizedResource>();
  for (const item of items) {
    const key = identity(item);
    const existing = result.get(key);
    result.set(key, existing ? mergeNormalizedResources(existing, item) : item);
  }
  return [...result.values()];
}

export function contextCompleteness(resource: NormalizedResource) {
  if (resource.abstract) return resource.type === "book" ? "book_description" as const : "title_and_abstract" as const;
  if (resource.doi && resource.source === "crossref") return "doi_metadata_only" as const;
  return "title_only" as const;
}
