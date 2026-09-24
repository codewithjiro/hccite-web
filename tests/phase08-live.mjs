// Controlled, opt-in Phase 08 smoke verification. Uses one existing ready non-confidential Study.
import assert from "node:assert/strict";
import postgres from "postgres";
import { setTestIdentity } from "./db-test-auth.mjs";
import { closeDb } from "../src/server/db/index.ts";
import { deriveLiteratureQueries } from "../src/server/literature/core.ts";
import { searchLiterature } from "../src/server/literature/search.ts";
import { associateLiteratureSource, listStudyRelatedSources, setLiteratureSelection } from "../src/server/repositories/literature.ts";
import { getOwnedStudyProfile } from "../src/server/repositories/studies.ts";
import { explainRelevance } from "../src/server/literature/relevance.ts";
import { lookupCrossrefDoi } from "../src/server/discovery/providers/crossref.ts";

if (process.env.RUN_PHASE08_LIVE !== "1") throw new Error("Set RUN_PHASE08_LIVE=1 to run controlled live verification.");
const client = postgres(process.env.DATABASE_URL, { max: 1 });
let createdAssociationId = null, createdResourceId = null, restoreAssociation = null;
try {
  const [fixture] = await client`select s.id, u.clerk_user_id from public.hccite_study s join public.hccite_user_profile u on u.id=s.user_id join public.hccite_study_analysis a on a.study_id=s.id where s.status='ready' order by s.updated_at desc limit 1`;
  assert.ok(fixture, "A ready non-confidential Study Profile is required for live verification.");
  setTestIdentity(fixture.clerk_user_id);
  const { profile } = await getOwnedStudyProfile(fixture.id);
  const queries = deriveLiteratureQueries(profile);
  assert.ok(queries.length);
  let scholarly = null;
  for (const query of queries) { const attempt = await searchLiterature(query); if (attempt.items.some((item) => item.source === "openalex")) { scholarly = attempt; break; } scholarly ??= attempt; }
  if (!scholarly.items.length) console.log(JSON.stringify({ liveProviderWarnings: scholarly.warnings.map(({ provider, code }) => ({ provider, code })) }));
  const books = await searchLiterature("education theory handbook");
  assert.ok(books.booksSearched && books.items.some((item) => item.source === "google_books"), "Google Books must return a real book.");
  const crossref = await lookupCrossrefDoi("10.1038/nphys1170");
  assert.equal(crossref.resource.doi, "10.1038/nphys1170");
  const candidate = scholarly.items.find((item) => item.sourceIdentifier && item.source === "openalex") ?? books.items.find((item) => item.sourceIdentifier && item.source === "google_books");
  assert.ok(candidate);
  const [beforeResource] = await client`select id from public.hccite_resource where (doi is not null and lower(doi)=${candidate.doi}) or (source=${candidate.source} and source_identifier=${candidate.sourceIdentifier}) limit 1`;
  const [priorAssociation] = beforeResource ? await client`select id, selected_for_rrl from public.hccite_study_related_source where study_id=${fixture.id} and resource_id=${beforeResource.id}` : [];
  const associated = await associateLiteratureSource(fixture.id, { provider: candidate.source, providerIdentifier: candidate.sourceIdentifier });
  const [beforeAssociation] = await client`select id from public.hccite_study_related_source where id=${associated.association.id}`;
  assert.ok(beforeAssociation);
  if (!beforeResource) createdResourceId = associated.resource.id;
  if (priorAssociation) restoreAssociation = priorAssociation;
  else createdAssociationId = associated.association.id;
  const repeated = await associateLiteratureSource(fixture.id, { provider: candidate.source, providerIdentifier: candidate.sourceIdentifier });
  assert.equal(repeated.association.id, associated.association.id);
  assert.equal((await listStudyRelatedSources(fixture.id)).filter((row) => row.resource.id === associated.resource.id).length, 1);
  assert.equal((await setLiteratureSelection(fixture.id, { associationId: associated.association.id, selected: true })).selectedForRrl, true);
  assert.equal((await setLiteratureSelection(fixture.id, { associationId: associated.association.id, selected: true })).selectedForRrl, true);
  assert.equal((await setLiteratureSelection(fixture.id, { associationId: associated.association.id, selected: false })).selectedForRrl, false);
  const relevance = await explainRelevance(profile, candidate);
  assert.ok(relevance.reason && relevance.score >= 0 && relevance.score <= 1);
  setTestIdentity(`phase08-foreign-${Date.now()}`);
  await assert.rejects(setLiteratureSelection(fixture.id, { associationId: associated.association.id, selected: true }), /NEXT_NOT_FOUND/);
  const report = { profileQuery: true, openAlexResults: scholarly.items.filter((item) => item.source === "openalex").length, openAlexWarnings: scholarly.warnings.filter((w) => w.provider === "openalex").map((w) => w.code), googleBooksResult: true, crossrefLookup: true, crossrefEnriched: scholarly.items.some((item) => Array.isArray(item.citationMetadata.provenance) && item.citationMetadata.provenance.some((p) => p.provider === "crossref")), relevance: true, associationIdempotent: true, selectionIdempotent: true, foreignOwnerDenied: true };
  console.log(JSON.stringify(report));
  assert.ok(report.openAlexResults, "OpenAlex must return a real source.");
} finally {
  if (restoreAssociation) await client`update public.hccite_study_related_source set selected_for_rrl=${restoreAssociation.selected_for_rrl} where id=${restoreAssociation.id}`;
  if (createdAssociationId) await client`delete from public.hccite_study_related_source where id=${createdAssociationId}`;
  if (createdResourceId) await client`delete from public.hccite_resource r where r.id=${createdResourceId} and not exists (select 1 from public.hccite_saved_resource s where s.resource_id=r.id) and not exists (select 1 from public.hccite_study_related_source s where s.resource_id=r.id)`;
  await closeDb(); await client.end();
}
