import { z } from "zod";

export const citationKeySchema = z.string().regex(/^HCCITE:S[1-9]\d*$/, "Citation keys must use HCCITE:S<number>.");
export const citationToken = (key: string) => `[${key}]`;
export const citationTokenPattern = /\[?(HCCITE:S\d+)\]?/g;

export type CitationOccurrence = {
  citationKey: string;
  occurrence: number;
  index: number;
  sectionKey: string | null;
  heading: string | null;
  contextSnippet: string;
};

export type CitationParseResult = {
  occurrences: CitationOccurrence[];
  malformedTokens: Array<{ value: string; index: number; message: string }>;
  manualReferenceSignals: Array<{ value: string; index: number; message: string }>;
};

const markdownHeading = /^(#{1,6})\s+(.+?)\s*$/gm;
const bracketedHccite = /\[([^\]\n]*HCCITE[^\]\n]*)\]/gi;
const hcciteLike = /\bHCCITE\s*:\s*S[^\s\],.)]*/gi;
const rawDoi = /\b(?:doi:\s*)?10\.\d{4,9}\/[\w.()/:;-]+|https?:\/\/(?:dx\.)?doi\.org\/[^\s)\]]+/gi;
const authorYear = /\([A-Z][A-Za-z'’-]{1,}(?:\s+(?:et al\.|&\s+[A-Z][A-Za-z'’-]+))?,\s*(?:19|20)\d{2}[a-z]?\)/g;

function headingAt(content: string, index: number) {
  let current: { sectionKey: string | null; heading: string | null } = { sectionKey: null, heading: null };
  for (const match of content.matchAll(markdownHeading)) {
    if ((match.index ?? 0) > index) break;
    const heading = match[2]?.trim() ?? null;
    current = {
      heading,
      sectionKey: heading ? heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160) || null : null,
    };
  }
  return current;
}

function snippetAt(content: string, index: number) {
  const start = Math.max(0, content.lastIndexOf("\n", Math.max(0, index - 240)) + 1);
  const end = content.indexOf("\n", index + 240);
  return content.slice(start, end === -1 ? Math.min(content.length, index + 240) : end).trim().slice(0, 10000);
}

/**
 * Parses only bracketed `[HCCITE:S<number>]` tokens.  It intentionally also
 * reports HCCite-like text and common manual reference signals so an editable
 * draft cannot acquire an untraceable reference and still pass an audit.
 */
export function parseCitationTokens(content: string): CitationParseResult {
  const occurrences: CitationOccurrence[] = [];
  const malformedTokens: CitationParseResult["malformedTokens"] = [];
  const manualReferenceSignals: CitationParseResult["manualReferenceSignals"] = [];
  const claimedRanges: Array<[number, number]> = [];
  let occurrence = 0;

  for (const match of content.matchAll(/\[HCCITE:S([1-9]\d*)\]/g)) {
    const index = match.index ?? 0;
    occurrence += 1;
    const location = headingAt(content, index);
    occurrences.push({ citationKey: `HCCITE:S${match[1]}`, occurrence, index, ...location, contextSnippet: snippetAt(content, index) });
    claimedRanges.push([index, index + match[0].length]);
  }
  const overlapsValid = (index: number, length: number) => claimedRanges.some(([start, end]) => index < end && index + length > start);
  for (const match of content.matchAll(bracketedHccite)) {
    const value = match[0]; const index = match.index ?? 0;
    if (!/^\[HCCITE:S[1-9]\d*\]$/.test(value)) malformedTokens.push({ value, index, message: `Malformed HCCite citation token ${value}. Use [HCCITE:S<number>].` });
  }
  for (const match of content.matchAll(hcciteLike)) {
    const value = match[0]; const index = match.index ?? 0;
    if (!overlapsValid(index, value.length)) malformedTokens.push({ value, index, message: `Malformed HCCite citation token ${value}. Use [HCCITE:S<number>].` });
  }
  for (const match of content.matchAll(rawDoi)) {
    manualReferenceSignals.push({ value: match[0], index: match.index ?? 0, message: `Manual DOI/reference text ${match[0]} could not be traced to a HCCite source.` });
  }
  for (const match of content.matchAll(authorYear)) {
    manualReferenceSignals.push({ value: match[0], index: match.index ?? 0, message: `Manual author-year citation ${match[0]} could not be traced to a HCCite source.` });
  }
  for (const match of content.matchAll(/^#{0,3}\s*(references|bibliography|works cited)\s*:?.*$/gim)) {
    manualReferenceSignals.push({ value: match[0], index: match.index ?? 0, message: "Manual bibliography/reference section could not be traced to HCCite sources." });
  }
  return { occurrences, malformedTokens, manualReferenceSignals };
}

const sectionSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  heading: z.string().trim().min(1).max(240),
  text: z.string().trim().min(1).max(30000),
  citationKeys: z.array(citationKeySchema).max(100),
}).strict();

export const rrlDocumentSchema = z.object({
  title: z.string().trim().min(1).max(500),
  sections: z.array(sectionSchema).min(1).max(20),
  limitations: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
}).strict();
export type RrlDocument = z.infer<typeof rrlDocumentSchema>;

export function renderRrlDocument(document: RrlDocument) {
  return `# ${document.title}\n\n${document.sections.map((section) => `## ${section.heading}\n\n${section.text}`).join("\n\n")}\n${document.limitations.length ? `\n\n## Source limitations\n\n${document.limitations.map((item) => `- ${item}`).join("\n")}` : ""}`;
}

/** Rejects every HCCite-like identifier that is not in the immutable snapshot. */
export function validateCitationAllowList(document: RrlDocument, allowedKeys: Iterable<string>) {
  const allowed = new Set(allowedKeys);
  const used = new Set<string>();
  for (const section of document.sections) {
    if (/\b(?:doi:\s*)?10\.\d{4,9}\/\S+|https?:\/\/(?:dx\.)?doi\.org\//i.test(section.text)) {
      throw new Error("Generated RRL included a raw DOI/reference string instead of an HCCite citation key.");
    }
    const fromText = [...section.text.matchAll(citationTokenPattern)].map((match) => match[1]!);
    const declared = section.citationKeys;
    for (const key of [...fromText, ...declared]) {
      if (!allowed.has(key)) throw new Error(`Generated RRL referenced an unmapped citation key: ${key}.`);
      used.add(key);
    }
    if (new Set(fromText).size !== new Set(declared).size || fromText.some((key) => !declared.includes(key))) {
      throw new Error(`Generated RRL citation list does not match the citation tokens in section ${section.key}.`);
    }
  }
  return [...used];
}

export function parseRrlDocument(raw: string, allowedKeys: Iterable<string>) {
  const document = rrlDocumentSchema.parse(JSON.parse(raw) as unknown);
  const keys = document.sections.map((section) => section.key);
  if (new Set(keys).size !== keys.length) throw new Error("Generated RRL contained duplicate section identifiers.");
  validateCitationAllowList(document, allowedKeys);
  return document;
}

export function extractCitationKeys(content: string) {
  return [...new Set(parseCitationTokens(content).occurrences.map((occurrence) => occurrence.citationKey))];
}
