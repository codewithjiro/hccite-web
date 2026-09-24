import "server-only";

import { env } from "~/env";
import { normalizeDoi } from "~/server/discovery/normalization";
import { lookupCrossrefIntegrityDoi } from "~/server/discovery/providers/crossref";
import { ProviderError } from "~/server/discovery/providers/shared";
import { getResource } from "~/server/repositories/resources";
import { getLatestIntegrityCheck, recordLatestIntegrityCheck } from "~/server/repositories/integrity";
import { assessCrossrefIntegrity, isIntegrityCheckFresh, type IntegrityAssessment } from "./core";

type PersistedCheck = NonNullable<Awaited<ReturnType<typeof getLatestIntegrityCheck>>>;
export type IntegrityResult = { check: PersistedCheck | null; stale: boolean; refreshError: string | null; reused: boolean };
type CheckWrite = { resourceId: string; status: "no_known_issue" | "review_required" | "corrected" | "retracted" | "unknown"; doiVerified: boolean | null; updateType: "correction" | "retraction" | "expression_of_concern" | "other" | null; updateDoi: string | null; updateLabel: string | null; integritySource: "crossref" | null; metadataComplete: boolean | null; rawMetadataHash: string | null; checkedAt: Date };
export type IntegrityDependencies = {
  getResource: typeof getResource; getLatest: typeof getLatestIntegrityCheck; recordLatest: typeof recordLatestIntegrityCheck;
  lookup: typeof lookupCrossrefIntegrityDoi; now: () => Date; ttlHours: number;
};
const defaults: IntegrityDependencies = { getResource, getLatest: getLatestIntegrityCheck, recordLatest: recordLatestIntegrityCheck, lookup: lookupCrossrefIntegrityDoi, now: () => new Date(), ttlHours: env.INTEGRITY_CHECK_TTL_HOURS };

function unavailable(resourceId: string, reason: string, now: Date): CheckWrite {
  return { resourceId, status: "unknown", doiVerified: null, updateType: null, updateDoi: null, updateLabel: reason, integritySource: null, metadataComplete: null, checkedAt: now, rawMetadataHash: null };
}
function persist(resourceId: string, assessment: IntegrityAssessment, now: Date): CheckWrite {
  return { resourceId, ...assessment, checkedAt: now };
}

/** Server-only canonical-resource integrity check. Browser DOI/title values are never trusted. */
export async function ensureResourceIntegrity(resourceId: string, options: { force?: boolean } = {}, overrides: Partial<IntegrityDependencies> = {}): Promise<IntegrityResult> {
  const deps = { ...defaults, ...overrides }, now = deps.now();
  const resource = await deps.getResource(resourceId);
  if (!resource) return { check: null, stale: false, refreshError: "Resource not found.", reused: false };
  const previous = await deps.getLatest(resource.id);
  if (!options.force && previous && isIntegrityCheckFresh(previous.checkedAt, deps.ttlHours, now)) return { check: previous, stale: false, refreshError: null, reused: true };
  const doi = normalizeDoi(resource.doi);
  if (!doi) {
    const check = await deps.recordLatest(unavailable(resource.id, "No DOI is available for this source, so Crossref integrity metadata could not be checked.", now));
    return { check, stale: false, refreshError: null, reused: false };
  }
  try {
    const result = await deps.lookup(doi);
    const assessment = assessCrossrefIntegrity(doi, result.integrityMetadata);
    const check = await deps.recordLatest(persist(resource.id, assessment, now));
    return { check, stale: false, refreshError: null, reused: false };
  } catch (error) {
    const message = error instanceof ProviderError ? error.message : "Crossref integrity check could not be completed.";
    // Never overwrite a previously known result, particularly adverse evidence, on outage.
    if (previous) return { check: previous, stale: true, refreshError: message, reused: true };
    const check = await deps.recordLatest(unavailable(resource.id, message, now));
    return { check, stale: false, refreshError: message, reused: false };
  }
}

/** Phase 10/11 handoff: refresh/reuse selected canonical Resources and return warning-ready states. */
export async function ensureResourcesIntegrity(resourceIds: string[], options: { force?: boolean } = {}) {
  return Promise.all([...new Set(resourceIds)].map((resourceId) => ensureResourceIntegrity(resourceId, options)));
}

export async function getLatestResourceIntegrity(resourceId: string) { return getLatestIntegrityCheck(resourceId); }
