import "server-only";

import { createHash } from "node:crypto";
import { normalizeDoi } from "~/server/discovery/normalization";

export type IntegrityStatus = "no_known_issue" | "review_required" | "corrected" | "retracted" | "unknown";
export type IntegrityUpdateType = "correction" | "retraction" | "expression_of_concern" | "other";
export type CrossrefIntegrityMetadata = {
  doi: string; type: string | null; title: string | null; authorCount: number; publicationDate: string | null;
  venue: string | null; publisher: string | null; updatePolicy: string | null;
  updateTo: Array<{ doi: string | null; type: string | null; label: string | null; source: string | null; updatedAt: string | null }>;
  relation: Array<{ type: string; identifiers: string[] }>;
  createdAt: string | null; depositedAt: string | null; indexedAt: string | null;
};
export type IntegrityAssessment = {
  status: IntegrityStatus; doiVerified: boolean; updateType: IntegrityUpdateType | null; updateDoi: string | null;
  updateLabel: string | null; integritySource: "crossref"; metadataComplete: boolean; rawMetadataHash: string;
};

/** Stable JSON keeps hashes reproducible across provider property ordering. */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}
export function hashIntegrityMetadata(metadata: CrossrefIntegrityMetadata): string {
  return createHash("sha256").update(stableJson(metadata)).digest("hex");
}

function normalizedType(value: string | null) { return value?.trim().toLowerCase().replace(/[ _]+/g, "-") ?? null; }
function updateKind(value: string | null): IntegrityUpdateType | null {
  const type = normalizedType(value);
  if (type === "retraction" || type === "retracted" || type === "withdrawal" || type === "withdrawn") return "retraction";
  if (type === "correction" || type === "corrected" || type === "erratum" || type === "corrigendum") return "correction";
  if (type === "expression-of-concern" || type === "expression-of-concern-notice") return "expression_of_concern";
  return type ? "other" : null;
}

/**
 * Crossref's `update-to` describes an update notice pointing to the original DOI.
 * `relation` is general relationship metadata, not a clean signal by itself: only
 * named update-like relation keys are considered, and unknown update-like keys stay review-required.
 */
export function assessCrossrefIntegrity(requestedDoi: string, metadata: CrossrefIntegrityMetadata): IntegrityAssessment {
  const matching = normalizeDoi(metadata.doi) === normalizeDoi(requestedDoi);
  const metadataComplete = Boolean(metadata.title && metadata.authorCount > 0 && metadata.publicationDate && (metadata.venue || metadata.publisher));
  const hash = hashIntegrityMetadata(metadata);
  if (!matching) return { status: "unknown", doiVerified: false, updateType: null, updateDoi: null, updateLabel: "Crossref returned a different DOI.", integritySource: "crossref", metadataComplete: false, rawMetadataHash: hash };
  const evidence = metadata.updateTo.map((item) => ({ ...item, kind: updateKind(item.type) }));
  for (const relation of metadata.relation) {
    if (/retract/i.test(relation.type)) evidence.push({ doi: relation.identifiers[0] ?? null, type: relation.type, label: "Crossref retraction relationship", source: "publisher", updatedAt: null, kind: "retraction" });
    else if (/(correct|errat|corrigend)/i.test(relation.type)) evidence.push({ doi: relation.identifiers[0] ?? null, type: relation.type, label: "Crossref correction relationship", source: "publisher", updatedAt: null, kind: "correction" });
    else if (/(concern|update)/i.test(relation.type)) evidence.push({ doi: relation.identifiers[0] ?? null, type: relation.type, label: "Crossref update relationship requiring review", source: "publisher", updatedAt: null, kind: "other" });
  }
  const first = (kind: IntegrityUpdateType) => evidence.find((item) => item.kind === kind);
  const choose = (status: IntegrityStatus, kind: IntegrityUpdateType, item: typeof evidence[number]) => ({ status, doiVerified: true, updateType: kind, updateDoi: item.doi, updateLabel: `${item.label ?? item.type ?? "Crossref update metadata"}${item.source === "retraction-watch" ? " (Retraction Watch data surfaced through Crossref)" : ""}`, integritySource: "crossref" as const, metadataComplete, rawMetadataHash: hash });
  const retraction = first("retraction"); if (retraction) return choose("retracted", "retraction", retraction);
  const correction = first("correction"); if (correction) return choose("corrected", "correction", correction);
  const review = first("expression_of_concern") ?? first("other"); if (review) return choose("review_required", review.kind ?? "other", review);
  // A malformed/unknown update record is evidence needing review, never a clean result.
  if (metadata.updateTo.length > 0) return { status: "review_required", doiVerified: true, updateType: "other", updateDoi: null, updateLabel: "Unrecognized Crossref update metadata requires review.", integritySource: "crossref", metadataComplete, rawMetadataHash: hash };
  if (!metadataComplete) return { status: "unknown", doiVerified: true, updateType: null, updateDoi: null, updateLabel: "Crossref metadata is insufficient for a complete integrity check.", integritySource: "crossref", metadataComplete, rawMetadataHash: hash };
  return { status: "no_known_issue", doiVerified: true, updateType: null, updateDoi: null, updateLabel: null, integritySource: "crossref", metadataComplete, rawMetadataHash: hash };
}

export function isIntegrityCheckFresh(checkedAt: Date, ttlHours: number, now = new Date()): boolean {
  return Number.isFinite(ttlHours) && ttlHours > 0 && now.getTime() - checkedAt.getTime() < ttlHours * 60 * 60 * 1000;
}
