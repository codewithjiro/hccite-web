import "server-only";

import { z } from "zod";
import { env } from "~/env";
import { generateCitation } from "~/server/citation";
import { getDb } from "~/server/db";
import { resources, studyRelatedSources } from "~/server/db/schema";
import { ensureResourcesIntegrity } from "~/server/integrity/service";
import { createGeneratedRrlDraft } from "~/server/repositories/rrl";
import { getOwnedStudyProfile } from "~/server/repositories/studies";
import { and, eq } from "drizzle-orm";
import { citationToken, renderRrlDocument } from "./core";
import { generateRrlWithGemini, type RrlGeminiInput } from "./gemini";

const id = z.string().uuid();
export const generateRrlInputSchema = z.object({ citationStyle: z.enum(["apa", "mla", "chicago"]), generationRequestId: id, confirmRetractedSourceIds: z.array(id).max(1000).default([]) }).strict();

type Selected = { associationId: string; resource: typeof resources.$inferSelect };
const integrityWarning = (check: { status: string; updateLabel: string | null } | null) => check?.updateLabel ?? (check?.status === "unknown" ? "Integrity metadata is unknown; it is not a clean result." : null);

/** Resolves selected sources afresh from the owner-scoped Study; no browser source metadata is authoritative. */
export async function getRrlWorkspace(studyId: string) {
  const owned = await getOwnedStudyProfile(studyId);
  if (owned.study.status !== "ready" || !owned.profile) throw new Error("A ready saved Study Profile is required.");
  const selected = await getSelectedSources(owned.study.id);
  const health = await ensureResourcesIntegrity(selected.map((item) => item.resource.id));
  return { study: owned.study, profile: owned.profile, selected: selected.map((item, index) => ({ associationId: item.associationId, resource: item.resource, citationKey: `HCCITE:S${index + 1}`, integrity: health[index] ?? null })), drafts: [] };
}

async function getSelectedSources(studyId: string): Promise<Selected[]> {
  const rows = await getDb().select({ associationId: studyRelatedSources.id, resource: resources }).from(studyRelatedSources).innerJoin(resources, eq(resources.id, studyRelatedSources.resourceId)).where(and(eq(studyRelatedSources.studyId, studyId), eq(studyRelatedSources.selectedForRrl, true)));
  // Stable token positions are ordered by canonical title then UUID, never browser order.
  return rows.sort((a, b) => a.resource.title.localeCompare(b.resource.title) || a.resource.id.localeCompare(b.resource.id));
}

export async function generateOwnedRrl(studyId: string, rawInput: unknown, overrides: { generate?: typeof generateRrlWithGemini } = {}) {
  const input = generateRrlInputSchema.parse(rawInput);
  const owned = await getOwnedStudyProfile(studyId);
  if (owned.study.status !== "ready" || !owned.profile) throw new Error("A ready saved Study Profile is required.");
  const selected = await getSelectedSources(owned.study.id);
  if (!selected.length) throw new Error("Select at least one related-literature source before generating an RRL.");
  const integrity = await ensureResourcesIntegrity(selected.map((item) => item.resource.id));
  const retracted = selected.filter((_, index) => integrity[index]?.check?.status === "retracted").map((item) => item.resource.id);
  if (retracted.some((resourceId) => !input.confirmRetractedSourceIds.includes(resourceId))) {
    return { requiresRetractedConfirmation: true as const, retractedSourceIds: retracted };
  }
  const sources = selected.map((item, index) => {
    const health = integrity[index]?.check ?? null;
    return { resourceId: item.resource.id, citationKey: `HCCITE:S${index + 1}`, sourceSnapshot: {
      title: item.resource.title, authors: item.resource.authors, year: item.resource.year, type: item.resource.type, venue: item.resource.venue, publisher: item.resource.publisher, doi: item.resource.doi, isbn: item.resource.isbn, abstract: item.resource.abstract, source: item.resource.source, sourceIdentifier: item.resource.sourceIdentifier, url: item.resource.url, selectedStudyRelatedSourceId: item.associationId, contextAvailability: item.resource.abstract ? "abstract_available" : "title_only", integrity: health ? { status: health.status, updateLabel: health.updateLabel, checkedAt: health.checkedAt.toISOString() } : { status: "unknown", updateLabel: "Integrity status is unavailable." },
    } };
  });
  const geminiInput: RrlGeminiInput = { profile: owned.profile as unknown as Record<string, unknown>, citationStyle: input.citationStyle, sources: sources.map((source) => ({
    citationKey: source.citationKey, title: String(source.sourceSnapshot.title), authors: source.sourceSnapshot.authors as string[], year: source.sourceSnapshot.year as number | null, type: String(source.sourceSnapshot.type), venue: source.sourceSnapshot.venue as string | null, publisher: source.sourceSnapshot.publisher as string | null, doi: source.sourceSnapshot.doi as string | null, isbn: source.sourceSnapshot.isbn as string | null, abstract: source.sourceSnapshot.abstract as string | null, contextAvailability: source.sourceSnapshot.contextAvailability as "abstract_available" | "title_only", integrity: { status: String((source.sourceSnapshot.integrity as { status: string }).status), warning: (source.sourceSnapshot.integrity as { updateLabel: string | null }).updateLabel },
  })) };
  const document = await (overrides.generate ?? generateRrlWithGemini)(geminiInput);
  const sourceByKey = new Map(sources.map((source) => [source.citationKey, source]));
  const citationLinks = [...new Map(document.sections.flatMap((section) => section.citationKeys.map((citationKey) => [citationKey, { citationKey, resourceId: sourceByKey.get(citationKey)!.resourceId, sectionKey: section.key, contextSnippet: section.text.slice(0, 10000) }] as const))).values()];
  const draft = await createGeneratedRrlDraft({ studyId: owned.study.id, citationStyle: input.citationStyle, content: renderRrlDocument(document), model: env.GEMINI_MODEL, modelVersion: env.GEMINI_MODEL, generationRequestId: input.generationRequestId, structuredContent: document, integrityContext: sources.map((source) => source.sourceSnapshot.integrity), sources, citationLinks });
  return { requiresRetractedConfirmation: false as const, draft };
}

export function bibliographyForSnapshot(sources: Array<{ resource: typeof resources.$inferSelect; citationKey: string }>, style: "apa" | "mla" | "chicago") {
  return sources.map((source) => ({ citationKey: citationToken(source.citationKey), result: generateCitation(source.resource, style) }));
}

export function describeIntegrity(check: { check: { status: string; updateLabel: string | null } | null; stale: boolean; refreshError: string | null }) {
  return { status: check.check?.status ?? "unknown", warning: integrityWarning(check.check), stale: check.stale, refreshError: check.refreshError };
}
