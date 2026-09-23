/** Explicit manual verification against live provider metadata and a synthetic development profile. */
import assert from "node:assert/strict";
import postgres from "postgres";
import { setTestIdentity } from "./db-test-auth.mjs";
import { searchCrossrefTitle } from "../src/server/discovery/providers/crossref.ts";
import { searchGoogleBooks } from "../src/server/discovery/providers/google-books.ts";
import { saveDiscoveredResource } from "../src/server/discovery/save.ts";
import { generateCitation } from "../src/server/citation/index.ts";
import { listSavedResources, updateSavedResource, removeSavedResource } from "../src/server/repositories/resources.ts";
import { createCollection, createTag, addResourceToCollection, attachTag, listLibraryLinks } from "../src/server/repositories/collections.ts";
import { closeDb } from "../src/server/db/index.ts";

const identity = "hccite-phase05-live-verification-synthetic";
const client = postgres(process.env.DATABASE_URL, { max: 1 });
setTestIdentity(identity);
try {
  await client`delete from hccite_user_profile where clerk_user_id = ${identity}`;
  const articleResults = await searchCrossrefTitle("machine learning in medicine");
  const article = articleResults.items.find((r) => r.type === "article" && r.doi && r.authors.length && r.year && r.venue);
  const bookResults = await searchGoogleBooks("research methods", 0);
  const book = bookResults.items.find((r) => r.type === "book" && r.sourceIdentifier && r.authors.length && r.year && r.publisher);
  assert.ok(article, "live article with complete citation metadata");
  assert.ok(book, "live book with complete citation metadata");
  for (const [label, discovered] of [["article", article], ["book", book]]) {
    const locator = { provider: discovered.source, providerIdentifier: discovered.source === "crossref" ? discovered.doi : discovered.sourceIdentifier };
    const first = await saveDiscoveredResource(locator);
    const again = await saveDiscoveredResource(locator);
    assert.equal(first.savedResourceId, again.savedResourceId);
    assert.equal(first.resource.id, again.resource.id);
    assert.equal((await listSavedResources()).filter((row) => row.resource.id === first.resource.id).length, 1);
    for (const style of ["apa", "mla", "chicago"]) {
      const citation = generateCitation(first.resource, style);
      assert.equal(citation.ok, true, JSON.stringify(citation));
    }
    await updateSavedResource(first.savedResourceId, { readingStatus: "reading", notes: `Synthetic ${label} verification note` });
    const tag = await createTag({ name: `Synthetic ${label} verification` });
    await attachTag(first.savedResourceId, tag.id);
    const collection = await createCollection({ name: `Synthetic ${label} collection` });
    await addResourceToCollection(collection.id, first.resource.id);
    await addResourceToCollection(collection.id, first.resource.id);
    assert.ok((await listLibraryLinks()).tagLinks.some((link) => link.savedResourceId === first.savedResourceId));
    assert.ok((await listLibraryLinks()).collectionLinks.some((link) => link.resourceId === first.resource.id));
    console.log(`${label}: live discovery, save, duplicate, APA, MLA, Chicago, status, note, tag, collection passed`);
    await removeSavedResource(first.savedResourceId);
    assert.equal((await listSavedResources()).some((row) => row.resource.id === first.resource.id), false);
    assert.ok((await client`select id from hccite_resource where id = ${first.resource.id}`).length, "canonical resource survives unsave");
  }
} finally {
  await client`delete from hccite_user_profile where clerk_user_id = ${identity}`;
  await closeDb();
  await client.end();
}
