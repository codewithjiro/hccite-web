# HCCite local setup

The product contract is [README.md](README.md). This guide describes the final Phase 12 school-project build.

## Requirements

- Node.js 20 or newer (the final verification used Node.js 24)
- pnpm 11.x (the repository pins `pnpm@11.19.0`)
- PostgreSQL 14 or newer, or a compatible hosted PostgreSQL database such as Neon
- Free/Hobby projects for Clerk, UploadThing, OpenAlex, Google Books, and Gemini
- A contact email for Crossref polite-pool requests
- Vercel only if deploying; it is not required for local development

Use free-tier accounts only. UploadThing free-plan files are URL-accessible, and Gemini Free Tier content may be used by Google to improve its products. HCCite must therefore be used only with public, synthetic, sample, or otherwise non-confidential documents.

## Environment variables

Copy `.env.example` to `.env.local` and configure these names. Never commit real values.

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL
NEXT_PUBLIC_CLERK_SIGN_UP_URL
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
DATABASE_URL
OPENALEX_API_KEY
CROSSREF_MAILTO
GOOGLE_BOOKS_API_KEY
UPLOADTHING_TOKEN
MAX_STUDY_FILE_MB
GEMINI_API_KEY
GEMINI_MODEL
INTEGRITY_CHECK_TTL_HOURS
```

Server-only values are read only by server modules. Do not prefix database, provider, UploadThing, Gemini, or Clerk secret values with `NEXT_PUBLIC_`.

For Vercel deployments, add `OPENALEX_API_KEY` and `GEMINI_API_KEY` under the project's **Settings → Environment Variables** for each environment that should use those providers (Development, Preview, and/or Production), then redeploy. The application reads those exact server-side names at request time; there is no separate `vercel.json` secret mapping.

## Database

Create a dedicated HCCite database and set `DATABASE_URL`. Apply the checked-in migrations:

```powershell
pnpm install
$env:DATABASE_URL = "<your PostgreSQL URL>"
pnpm db:migrate
```

Drizzle Kit reads `DATABASE_URL` from the shell process; unlike the Next.js app, it does not automatically load `.env.local` in this repository.

`pnpm db:generate` generates a migration after an intentional schema change. `pnpm db:push` is only for disposable local experiments. `pnpm db:studio` opens Drizzle Studio. There are no production seed records and no fabricated academic references.

The database integration suites use clearly labelled synthetic fixtures, clean them up, and require a database the developer controls. Do not point destructive development workflows at shared or production data. PostgreSQL does not have an automatic down migration here; back up data before rebuilding a disposable database.

## Clerk and external services

Create a Clerk application with email sign-up/sign-in and configure both Clerk keys from the same instance. Configure the free OpenAlex API key, Crossref contact email, Google Books API key, UploadThing token, and Gemini API key. The approved default `GEMINI_MODEL` is `gemini-3.8-flash`.

UploadThing must remain on the authenticated `studyUploader` route. The application performs extension, MIME, size, and content-signature validation before creating a Study. The configured maximum is controlled by `MAX_STUDY_FILE_MB` and defaults to 50 MB.

## Local start

```powershell
pnpm install
$env:DATABASE_URL = "<your PostgreSQL URL>"
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`, create or sign in to a Clerk account, and open `/dashboard`.

For a production-like local run:

```powershell
pnpm build
pnpm start
```

## Verification

Run every phase suite and the final quality gates:

```powershell
pnpm test:auth
pnpm test:db
pnpm test:discovery
pnpm test:citation
pnpm test:studies
pnpm test:analysis
pnpm test:literature
pnpm test:integrity
pnpm test:rrl
pnpm test:rrl-audit
pnpm test:dashboard
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Live-provider verification is separate from fixture tests. A missing key, exhausted free quota, provider outage, or database connection reset is `BLOCKED`, not a mocked pass. Never enable paid OpenAlex or Gemini usage to make a check pass.

## Ownership and security conventions

All workspace routes and `/api` routes are authenticated. Repositories derive the current Clerk principal server-side with `getCurrentUserProfile()` and filter by the internal `UserProfile.id`; browser-supplied owner IDs are never accepted. Nested Study, source-selection, RRL, citation-detail, audit, and export access resolves through an owner-scoped Study. Canonical Resource metadata is shared, while saved state, notes, tags, collections, studies, analyses, selections, drafts, links, and audits are private.

Deleting a Study first deletes its UploadThing object and then the database row, whose foreign-key cascades remove analyses, sections, related-source associations, drafts, source snapshots, citation links, and audits. If storage deletion fails, the Study remains for retry. A post-storage database failure is surfaced as a retryable partial failure. Shared canonical Resources are not deleted with a Study.

## Known external limits

- OpenAlex, Google Books, Crossref, UploadThing, and Gemini can rate-limit or become unavailable. HCCite shows retryable/unknown states and preserves saved data.
- OpenAlex and Gemini must remain on free usage; the app never activates paid capacity automatically.
- Gemini processing uses bounded retries. A real `429 RESOURCE_EXHAUSTED` can block a live Study Profile or RRL check even when local retry/idempotency logic passes.
- Crossref outage never implies a verified DOI or clean integrity state. Existing adverse evidence is retained.
- UploadThing free-plan files are public by URL. Do not upload confidential, sensitive, or unpublished research documents.
- Gemini Free Tier has privacy and quota constraints. Use only non-confidential/demo studies.
- Remote/serverless PostgreSQL can occasionally reset long-running integration-test connections; rerun the affected suite and report the exact external error if it persists.

## Suggested demo flow

1. Sign in and show the owner-scoped dashboard and empty/real record states.
2. Search OpenAlex, look up a DOI with Crossref, and search Google Books.
3. Save a source, generate APA/MLA/Chicago citations, add notes/tags, and add it to a collection.
4. Upload a non-confidential PDF or DOCX and process its Study Profile.
5. Find related literature, inspect Source Health, and select sources.
6. Generate an RRL, open a `[HCCITE:S#]` citation detail, and run Bibliography Audit.
7. Show that export works only for the exact current passing audit; edit the draft to make the audit stale, then re-audit.
8. Delete the Study and confirm its stored object and owned descendants are removed while shared Resources remain.
