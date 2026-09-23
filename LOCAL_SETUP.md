# HCCite local setup — Phase 03

The product specification is `README.md`. The current implementation includes the Phase 01 interface, Phase 02 Clerk authentication, and Phase 03 PostgreSQL/Drizzle persistence contracts. Search, study processing, AI, citation generation, and dashboard behavior remain later phases.

## Run

1. Install Node.js 20 or newer and pnpm, then run `pnpm install`.
2. Create a free Clerk application in the [Clerk Dashboard](https://dashboard.clerk.com/). Enable email sign-up and sign-in in its settings. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the same Clerk instance. Leave the Clerk route and fallback URL values as shown. Set these before starting development or building for production.
3. Run `pnpm dev` and open `http://localhost:3000`.

## PostgreSQL and Drizzle

Phase 03 needs PostgreSQL 14 or newer. Install/run PostgreSQL locally or use a PostgreSQL service, create a dedicated empty database named `hccite`, then set `DATABASE_URL` in `.env.local` using the connection string for that database. Keep the value private and never commit `.env.local`. When running Drizzle CLI commands, make sure `DATABASE_URL` is also present in the shell process environment (for PowerShell, set `$env:DATABASE_URL` first); Next.js loads `.env.local` for the app, but Drizzle Kit runs as a separate CLI process.

Run `pnpm db:generate` to generate a migration from the checked-in schema; schema generation does not need a running database. Run `pnpm db:migrate` to apply checked-in migrations to the database named by `DATABASE_URL`. `pnpm db:push` is available for disposable local schema experiments, but migrations are the reproducible setup path. `pnpm db:studio` opens Drizzle Studio against the configured database.

The migrations create the `hccite_*` tables, enum types, indexes, constraints, and foreign keys in PostgreSQL's `public` schema. There are no seed records: the app does not fabricate bibliographic or academic data. `pnpm test:db` runs the focused Phase 03 repository and constraint integration suite against the configured `DATABASE_URL` (or the local Vercel environment file); it uses clearly labelled synthetic fixtures and cleans them up afterward. Use a database you control for this command.

To rebuild a disposable local database from scratch, stop the app, drop and recreate only the dedicated `hccite` database using your local PostgreSQL tools, then run `pnpm db:migrate`. PostgreSQL has no automatic down migration generated here; preserve any data you need before rebuilding. Do not run reset/drop commands against a shared or production database. Drizzle's generated SQL and journal are kept under `drizzle/`; applied migration state is recorded in the database.

If PostgreSQL is not running or `DATABASE_URL` is not configured, migrations and live repository checks remain pending. The application still builds because database connections are opened only when a repository is used.

Keep `.env.local` and all secrets untracked. If either Clerk key is missing, the public landing and auth setup message remain accessible; every workspace and account route stays closed.

## Authentication routes

`/` is public. `/sign-in` and `/sign-up` are public Clerk-hosting routes with optional catch-all segments for multi-step flows. `/profile` and all workspace pages are private. A signed-out request to a private page redirects to `/sign-in`, with its destination preserved for return after sign-in. Private `/api` paths deny unauthenticated requests with `401` when Clerk is configured, or `503` when its keys are absent.

The workspace includes `/dashboard`, `/research-articles`, `/doi-lookup`, `/books`, `/ai-analyzer`, `/studies`, `/collections`, and study-specific `/studies/[studyId]/analysis`, `/literature`, and `/rrl`. Those research pages still explain their later-phase status. The account button opens Clerk profile and sign-out actions; `/profile` provides the full profile screen.

## Server authorization handoff

In every private Server Component, Server Action, or route handler, call `await requireUserId()` from `src/server/auth.ts` immediately before reading or changing user data. Never take an owner ID from browser input. For a user-owned row, load it and call `requireOwnedRecord(row, ownerId)` before returning or mutating it. The helper returns the row to its owner and returns a 404 for absent or foreign rows. `UserProfile.id` is internal: resolve it from the authenticated Clerk ID (`clerkUserId`) and use that internal ID as `ownerId` when checking rows whose `userId` references `UserProfile.id`. Scope list queries by that same internal ID at the database query level.

`src/middleware.ts` provides a request boundary for all current workspace paths and `/api`; the workspace server layout repeats the session check. New data access must use the server helpers near the query or mutation because a layout alone does not authorize a record or rerun on every client navigation.

Phase 03 repositories call `getCurrentUserProfile()` in `src/server/repositories/profiles.ts` to derive the Clerk ID from `requireUserId()` and upsert the corresponding internal `UserProfile`. Never accept a Clerk ID or `UserProfile.id` from client input. User-owned repositories scope each query by the resolved internal profile; nested study/draft data is reached only after an owner-scoped parent check. Public normalized `Resource` records can be shared. Use `deleteStudy(studyId, deleteStoredFile)` when study file storage is introduced so the external object is removed before the database cascade.

## Checks

Run `pnpm test:auth`, `pnpm test:db`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`. For database setup, run `pnpm db:generate` and `pnpm db:migrate`; live migration checks need a configured PostgreSQL `DATABASE_URL`. Other credentials listed in `.env.example` are for later phases.
