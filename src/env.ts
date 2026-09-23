import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Integrations are optional until their implementation phases. Call
// requireServerEnv from the feature that needs a particular credential.
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().optional(),
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    OPENALEX_API_KEY: z.string().min(1).optional(),
    CROSSREF_MAILTO: z.string().email().optional(),
    GOOGLE_BOOKS_API_KEY: z.string().min(1).optional(),
    UPLOADTHING_TOKEN: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
    MAX_STUDY_FILE_MB: z.coerce.number().positive().default(50),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    OPENALEX_API_KEY: process.env.OPENALEX_API_KEY,
    CROSSREF_MAILTO: process.env.CROSSREF_MAILTO,
    GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    MAX_STUDY_FILE_MB: process.env.MAX_STUDY_FILE_MB,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  emptyStringAsUndefined: true,
});

export function requireServerEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === "") {
    throw new Error(`${key} is required for this feature. Add it to your local .env file.`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
