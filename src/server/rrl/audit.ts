import { createHash } from "node:crypto";
import { generateCitation } from "~/server/citation";
import { parseCitationTokens, type CitationParseResult } from "./core";

export type AuditIssueSeverity = "blocking" | "review" | "info";
export type AuditIssueCode =
  | "content_hash_mismatch" | "unknown_citation_key" | "source_snapshot_mismatch"
  | "malformed_citation" | "manual_reference" | "duplicate_reference"
  | "missing_metadata" | "formatting_failure" | "doi_unverified"
  | "integrity_retracted" | "integrity_corrected" | "integrity_review_required" | "integrity_unknown";
export type AuditIssue = { code: AuditIssueCode; severity: AuditIssueSeverity; message: string; citationKey?: string; occurrence?: number; resourceId?: string; sectionKey?: string | null };
export type AuditStatus = "passed" | "review_required" | "failed";

export type AuditSource = {
  citationKey: string;
  resourceId: string;
  sourceSnapshot: Record<string, unknown>;
  resource: { id: string; title: string; authors: string[]; year: number | null; type: "article" | "book" | "other"; publicationDate: string | null; doi: string | null; isbn: string | null; publisher: string | null; venue: string | null; url: string | null } | null;
  integrity: { status: "no_known_issue" | "review_required" | "corrected" | "retracted" | "unknown"; doiVerified: boolean | null; checkedAt: Date | null; updateLabel: string | null } | null;
};

export type AuditEvaluation = {
  status: AuditStatus;
  issues: AuditIssue[];
  parsed: CitationParseResult;
  selectedSourceCount: number;
  mappedSourceCount: number;
  citationOccurrenceCount: number;
  citationsMapped: number;
  doisVerified: number;
  retractedCount: number;
  reviewRequiredCount: number;
  duplicateCount: number;
  unselectedReferenceCount: number;
  sourceStateHash: string;
};

export const contentHash = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
export const stateHash = (sources: AuditSource[], style: string) => createHash("sha256").update(JSON.stringify({ style, sources: sources.map((source) => ({ key: source.citationKey, resource: source.resource && { id: source.resource.id, title: source.resource.title, authors: source.resource.authors, year: source.resource.year, doi: source.resource.doi, isbn: source.resource.isbn, publisher: source.resource.publisher, venue: source.resource.venue, updated: source.resource }, integrity: source.integrity && { status: source.integrity.status, doiVerified: source.integrity.doiVerified, checkedAt: source.integrity.checkedAt?.toISOString(), updateLabel: source.integrity.updateLabel } })) })).digest("hex");

function identity(source: NonNullable<AuditSource["resource"]>) {
  if (source.doi) return `doi:${source.doi.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")}`;
  return `metadata:${source.title.trim().toLowerCase()}|${source.year ?? ""}|${source.authors[0]?.trim().toLowerCase() ?? ""}`;
}

/** Pure, fail-closed audit of persisted content plus the immutable draft snapshot. */
export function evaluateRrlAudit(input: { content: string; storedContentHash: string; citationStyle: "apa" | "mla" | "chicago"; sources: AuditSource[] }): AuditEvaluation {
  const parsed = parseCitationTokens(input.content);
  const sourceByKey = new Map(input.sources.map((source) => [source.citationKey, source]));
  const issues: AuditIssue[] = [];
  if (contentHash(input.content) !== input.storedContentHash) issues.push({ code: "content_hash_mismatch", severity: "blocking", message: "Stored draft hash does not match its persisted content. Save or regenerate the draft before auditing." });
  for (const token of parsed.malformedTokens) issues.push({ code: "malformed_citation", severity: "blocking", message: token.message });
  for (const signal of parsed.manualReferenceSignals) issues.push({ code: "manual_reference", severity: "blocking", message: signal.message });

  const usedKeys = new Set<string>();
  let citationsMapped = 0, doisVerified = 0, retractedCount = 0, reviewRequiredCount = 0;
  for (const occurrence of parsed.occurrences) {
    const source = sourceByKey.get(occurrence.citationKey);
    if (!source) {
      issues.push({ code: "unknown_citation_key", severity: "blocking", citationKey: occurrence.citationKey, occurrence: occurrence.occurrence, sectionKey: occurrence.sectionKey, message: `Unknown citation key [${occurrence.citationKey}]. It is outside this draft's immutable source snapshot.` });
      continue;
    }
    if (!source.resource || source.resource.id !== source.resourceId || String(source.sourceSnapshot.resourceId ?? source.resourceId) !== source.resourceId) {
      issues.push({ code: "source_snapshot_mismatch", severity: "blocking", citationKey: occurrence.citationKey, occurrence: occurrence.occurrence, resourceId: source.resourceId, message: `Citation [${occurrence.citationKey}] does not resolve to its expected canonical Resource in this draft's source snapshot.` });
      continue;
    }
    citationsMapped += 1; usedKeys.add(occurrence.citationKey);
  }
  const citedSources = [...usedKeys].map((key) => sourceByKey.get(key)!).filter((source) => source.resource);
  const duplicateIdentities = new Map<string, AuditSource>();
  for (const source of citedSources) {
    const resource = source.resource!;
    const same = duplicateIdentities.get(identity(resource));
    if (same && same.resourceId !== source.resourceId) issues.push({ code: "duplicate_reference", severity: "review", citationKey: source.citationKey, resourceId: source.resourceId, message: `Citation [${source.citationKey}] duplicates bibliographic identity already mapped by [${same.citationKey}]. Review duplicate reference records.` });
    else duplicateIdentities.set(identity(resource), source);
    const formatting = generateCitation(resource, input.citationStyle);
    if (!formatting.ok) issues.push({ code: formatting.code === "incomplete_metadata" ? "missing_metadata" : "formatting_failure", severity: "review", citationKey: source.citationKey, resourceId: source.resourceId, message: formatting.code === "incomplete_metadata" ? `Source [${source.citationKey}] is missing metadata required for ${input.citationStyle.toUpperCase()} formatting: ${(formatting.missing ?? []).join(", ")}.` : `Source [${source.citationKey}] could not be formatted by Citation.js/CSL.` });
    const integrity = source.integrity;
    if (resource.doi && integrity?.doiVerified) doisVerified += 1;
    if (resource.doi && integrity?.doiVerified !== true) issues.push({ code: "doi_unverified", severity: "review", citationKey: source.citationKey, resourceId: source.resourceId, message: `DOI for [${source.citationKey}] could not be verified.` });
    switch (integrity?.status ?? "unknown") {
      case "retracted": retractedCount += 1; issues.push({ code: "integrity_retracted", severity: "blocking", citationKey: source.citationKey, resourceId: source.resourceId, message: `Source [${source.citationKey}] is retracted${integrity?.updateLabel ? `: ${integrity.updateLabel}` : "."}` }); break;
      case "corrected": reviewRequiredCount += 1; issues.push({ code: "integrity_corrected", severity: "review", citationKey: source.citationKey, resourceId: source.resourceId, message: `Source [${source.citationKey}] has a correction/update${integrity?.updateLabel ? `: ${integrity.updateLabel}` : "."}` }); break;
      case "review_required": reviewRequiredCount += 1; issues.push({ code: "integrity_review_required", severity: "review", citationKey: source.citationKey, resourceId: source.resourceId, message: `Source [${source.citationKey}] requires integrity review${integrity?.updateLabel ? `: ${integrity.updateLabel}` : "."}` }); break;
      case "unknown": reviewRequiredCount += 1; issues.push({ code: "integrity_unknown", severity: "review", citationKey: source.citationKey, resourceId: source.resourceId, message: `Integrity status for [${source.citationKey}] is unknown; this is not a clean result.` }); break;
    }
  }
  const duplicateCount = issues.filter((issue) => issue.code === "duplicate_reference").length;
  const unselectedReferenceCount = issues.filter((issue) => issue.code === "unknown_citation_key" || issue.code === "source_snapshot_mismatch").length;
  const status: AuditStatus = issues.some((issue) => issue.severity === "blocking") ? "failed" : issues.some((issue) => issue.severity === "review") ? "review_required" : "passed";
  return { status, issues, parsed, selectedSourceCount: input.sources.length, mappedSourceCount: citedSources.length, citationOccurrenceCount: parsed.occurrences.length, citationsMapped, doisVerified, retractedCount, reviewRequiredCount, duplicateCount, unselectedReferenceCount, sourceStateHash: stateHash(input.sources, input.citationStyle) };
}
