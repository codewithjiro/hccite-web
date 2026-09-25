import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { setTestIdentity } from "./db-test-auth.mjs";
import { closeDb } from "../src/server/db/index.ts";
import * as collectionsRepo from "../src/server/repositories/collections.ts";
import * as dashboardRepo from "../src/server/repositories/dashboard.ts";
import * as resourcesRepo from "../src/server/repositories/resources.ts";
import * as rrlRepo from "../src/server/repositories/rrl.ts";
import * as studiesRepo from "../src/server/repositories/studies.ts";

const token = `hccite-dashboard-${process.pid}-${Date.now()}`;
const userA = `${token}-a`;
const userB = `${token}-b`;
const client = postgres(process.env.DATABASE_URL, { max: 1 });
let resourceId;

test("Phase 12 dashboard counts and recent activity are owner-scoped", async () => {
  try {
    const resource = await resourcesRepo.createResource({
      type: "article", title: "Synthetic dashboard source", authors: ["Dashboard Author"], year: 2026,
      doi: `10.5555/${token}`, source: "manual", sourceIdentifier: token,
    });
    resourceId = resource.id;

    setTestIdentity(userA);
    const studyA = await studiesRepo.createStudy({
      title: "User A dashboard study", originalFileName: "a.pdf", fileType: "pdf",
      fileUrl: "https://example.invalid/a.pdf", fileStorageKey: `${token}-a-file`,
    });
    await resourcesRepo.saveResource({ resourceId: resource.id });
    await collectionsRepo.createCollection({ name: "User A dashboard collection" });
    await studiesRepo.addStudyRelatedSource(studyA.id, { resourceId: resource.id, selectedForRrl: true });
    await rrlRepo.createRrlDraft({ studyId: studyA.id, citationStyle: "apa", content: "A claim [HCCITE:S1]. Another claim [HCCITE:S1].", selectedResourceIds: [resource.id] });

    setTestIdentity(userB);
    await studiesRepo.createStudy({
      title: "User B private dashboard study", originalFileName: "b.pdf", fileType: "pdf",
      fileUrl: "https://example.invalid/b.pdf", fileStorageKey: `${token}-b-file`,
    });
    await collectionsRepo.createCollection({ name: "User B private dashboard collection" });
    let data = await dashboardRepo.getDashboardData();
    assert.deepEqual(data.counts, { studies: 1, savedSources: 0, collections: 1, citationsGenerated: 0 });
    assert.equal(data.recentStudies[0].title, "User B private dashboard study");
    assert.equal(data.recentSavedResources.length, 0);
    assert.deepEqual(data.unavailable, []);

    setTestIdentity(userA);
    data = await dashboardRepo.getDashboardData();
    assert.deepEqual(data.counts, { studies: 1, savedSources: 1, collections: 1, citationsGenerated: 2 });
    assert.equal(data.recentStudies[0].id, studyA.id);
    assert.equal(data.recentSavedResources[0].resource.id, resource.id);
    assert.ok(data.recentStudies.every((study) => !study.title.includes("User B")));
  } finally {
    await client`delete from public.hccite_user_profile where clerk_user_id in (${userA}, ${userB})`;
    if (resourceId) await client`delete from public.hccite_resource where id = ${resourceId}`;
    await client.end();
    await closeDb();
  }
});
