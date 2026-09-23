import "server-only";

import { discoverySaveLocatorSchema, type DiscoverySaveLocator } from "./locator";
import { getOpenAlexWorkById } from "./providers/openalex";
import { lookupCrossrefDoi } from "./providers/crossref";
import { getGoogleBookById } from "./providers/google-books";
import { saveResource, upsertDiscoveryResource } from "~/server/repositories/resources";

type Dependencies = {
  openalex: typeof getOpenAlexWorkById;
  crossref: typeof lookupCrossrefDoi;
  googleBooks: typeof getGoogleBookById;
  upsert: typeof upsertDiscoveryResource;
  save: typeof saveResource;
};

const productionDependencies: Dependencies = {
  openalex: getOpenAlexWorkById,
  crossref: lookupCrossrefDoi,
  googleBooks: getGoogleBookById,
  upsert: upsertDiscoveryResource,
  save: saveResource,
};

export async function saveDiscoveredResource(locator: DiscoverySaveLocator, dependencies: Dependencies = productionDependencies) {
  const valid = discoverySaveLocatorSchema.parse(locator);
  const resource = valid.provider === "openalex" ? await dependencies.openalex(valid.providerIdentifier)
    : valid.provider === "crossref" ? (await dependencies.crossref(valid.providerIdentifier)).resource
      : await dependencies.googleBooks(valid.providerIdentifier);
  if (resource.source !== valid.provider || resource.sourceIdentifier !== valid.providerIdentifier) {
    throw new Error("Provider record identity did not match the requested locator.");
  }
  const result = await dependencies.upsert(resource);
  const saved = await dependencies.save({ resourceId: result.resource.id });
  return { resource: result.resource, saved: !!saved, reused: result.reused, ambiguous: result.ambiguous };
}
