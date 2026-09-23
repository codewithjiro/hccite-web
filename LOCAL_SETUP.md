# HCCite local setup — Phase 01

The repository's authoritative product `README.md` was not present in the supplied workspace. This file documents only the implemented foundation. The implementation brief is `agents/PHASE_01_FOUNDATION.md`.

## Run the app

1. Install Node.js 20 or newer and pnpm. This workspace was built with Node 24 and pnpm 11.
2. Run `pnpm install`.
3. Run `pnpm dev`, then open `http://localhost:3000`.

No account, database, or API key is required for Phase 01. The sign-in pages and workspace routes are clearly marked previews. Use `pnpm lint`, `pnpm typecheck`, and `pnpm build` for checks.

## Later configuration

Copy `.env.example` to an ignored `.env` file when you begin connecting services. Add real secrets locally; do not commit them. The example lists Clerk, PostgreSQL, OpenAlex, Crossref, Google Books, UploadThing, and Gemini settings. The only browser-exposed value is Clerk's publishable key. Server credentials are validated when their feature is used, so leaving them unset does not prevent Phase 01 from starting.

PostgreSQL/Drizzle domain tables and migrations arrive in Phase 03. `start-database.sh` is the optional Create T3 App helper for a local PostgreSQL container under Bash/WSL, Docker, or Podman. Database commands require `DATABASE_URL` and are not part of the Phase 01 check.

Before any Phase 06 study upload, the app must warn that this build is for non-confidential/demo files only. UploadThing free-plan URLs can be accessed by anyone with the URL. Do not put private research files in the preview.

## Routes

`/` is the landing page. `/sign-in` and `/sign-up` explain that Clerk arrives in Phase 02. The route shell includes `/dashboard`, `/research-articles`, `/doi-lookup`, `/books`, `/ai-analyzer`, `/studies`, `/collections`, and `/studies/[studyId]/analysis`, `/studies/[studyId]/literature`, `/studies/[studyId]/rrl`.
