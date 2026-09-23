import { z } from "zod";
import { normalizeDoi } from "./normalization";

export const openAlexWorkIdSchema = z.string().trim().regex(/^W[1-9]\d{0,19}$/i).transform((id) => `W${id.slice(1)}`);
export const googleBookIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const crossrefDoiSchema = z.string().trim().max(512)
  .transform(normalizeDoi)
  .refine((doi): doi is string => doi !== null && /^10\.\d{4,9}\/[a-z0-9._;()/:+-]+$/i.test(doi))
  .transform((doi) => doi!);

export const discoverySaveLocatorSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("openalex"), providerIdentifier: openAlexWorkIdSchema }).strict(),
  z.object({ provider: z.literal("crossref"), providerIdentifier: crossrefDoiSchema }).strict(),
  z.object({ provider: z.literal("google_books"), providerIdentifier: googleBookIdSchema }).strict(),
]);

export type DiscoverySaveLocator = z.infer<typeof discoverySaveLocatorSchema>;
