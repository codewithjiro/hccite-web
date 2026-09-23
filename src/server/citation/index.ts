import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cite, plugins, type CSL } from "@citation-js/core";
import "@citation-js/plugin-csl";
import { z } from "zod";
import type { NormalizedResource } from "~/server/discovery/normalization";

export const citationStyleSchema = z.enum(["apa", "mla", "chicago"]);
export type CitationStyle = z.infer<typeof citationStyleSchema>;
type CitationInput = Pick<NormalizedResource, "type" | "title" | "authors" | "year" | "publicationDate" | "doi" | "isbn" | "publisher" | "venue" | "url">;

let registered = false;
function registerStyles() {
  if (registered) return;
  const templates = (plugins.config.get("@csl") as unknown as { styles: { add: (key: string, value: string) => void } }).styles;
  templates.add("hccite-mla", readFileSync(join(process.cwd(), "src/server/citation/styles/mla.csl"), "utf8"));
  templates.add("hccite-chicago", readFileSync(join(process.cwd(), "src/server/citation/styles/chicago.csl"), "utf8"));
  registered = true;
}

function parseAuthor(name: string): CSL["author"] extends (infer T)[] | undefined ? T : never {
  const trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [family, ...given] = trimmed.split(",");
    return { family: family?.trim(), given: given.join(",").trim() };
  }
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return { literal: trimmed };
  return { given: words.slice(0, -1).join(" "), family: words.at(-1) };
}

/** Strict conversion of stored bibliographic fields; provenance and personal data never enter CSL. */
export function resourceToCsl(resource: CitationInput): CSL {
  const csl: CSL = { id: "hccite-resource", type: resource.type === "book" ? "book" : "article-journal", title: resource.title.trim() };
  if (resource.authors.length) csl.author = resource.authors.filter((name) => name.trim()).map(parseAuthor);
  if (resource.year) csl.issued = { "date-parts": [[resource.year]] };
  if (resource.type === "book") {
    if (resource.publisher) csl.publisher = resource.publisher;
    if (resource.isbn) csl.ISBN = resource.isbn;
  } else if (resource.venue) csl["container-title"] = resource.venue;
  if (resource.doi) csl.DOI = resource.doi;
  if (resource.url) csl.URL = resource.url;
  return csl;
}

export type CitationResult =
  | { ok: true; style: CitationStyle; text: string }
  | { ok: false; style: CitationStyle; code: "incomplete_metadata" | "formatting_failure" | "invalid_style"; missing?: string[] };

export function generateCitation(resource: CitationInput, requestedStyle: string, format = (csl: CSL, template: string) => new Cite([csl]).format("bibliography", { format: "text", template, lang: "en-US" })): CitationResult {
  const parsed = citationStyleSchema.safeParse(requestedStyle);
  if (!parsed.success) return { ok: false, style: "apa", code: "invalid_style" };
  const style = parsed.data;
  const missing = [!resource.title.trim() && "title", !resource.authors.some((name) => name.trim()) && "author", !resource.year && "publication year", resource.type === "book" ? !resource.publisher && "publisher" : !resource.venue && "journal"].filter((value): value is string => typeof value === "string");
  if (missing.length) return { ok: false, style, code: "incomplete_metadata", missing };
  try {
    registerStyles();
    const text = format(resourceToCsl(resource), style === "apa" ? "apa" : `hccite-${style}`).trim();
    if (!text) throw new Error("Empty bibliography");
    return { ok: true, style, text };
  } catch {
    return { ok: false, style, code: "formatting_failure" };
  }
}
