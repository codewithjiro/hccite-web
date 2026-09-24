import { z } from "zod";

export const citationKeySchema = z.string().regex(/^HCCITE:S[1-9]\d*$/, "Citation keys must use HCCITE:S<number>.");
export const citationToken = (key: string) => `[${key}]`;
export const citationTokenPattern = /\[?(HCCITE:S\d+)\]?/g;

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
  return [...new Set([...content.matchAll(citationTokenPattern)].map((match) => match[1]!))];
}
