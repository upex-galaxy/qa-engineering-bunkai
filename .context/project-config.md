# Project Configuration

> Project: Bunkai (分解) — Test Management System
> Target repo under test: `upex-bunkai-tms`
> Generated: 2026-08-17
> Discovery scope: Phase 1 — Constitution only (`/project-discovery`, run from `qa-engineering-bunkai`)

## Repositories

Split-sibling-repo layout: this QA repo (`qa-engineering-bunkai`) and the application repo (`upex-bunkai-tms`) are separate git repositories, cloned as siblings under `C:/Users/carlo/Desktop/upex/`.

| Repository | Resolved path | Branch | Purpose |
|------------|-----|--------|---------|
| `upex-bunkai-tms` (target/app repo) | `C:/Users/carlo/Desktop/upex/upex-bunkai-tms` | `main` (default; `git_strategy` also declares an integration branch — see Discovery Gaps) | Bunkai product — Next.js app + API + Supabase backend, under test |
| `qa-engineering-bunkai` (this repo) | `C:/Users/carlo/Desktop/upex/qa-engineering-bunkai` | `main` | QA/testing boilerplate driving discovery, sprint testing, automation |

Found in: `upex-bunkai-tms/.agents/project.yaml` §`backend.backend_repo` / `frontend.frontend_repo` (both `.`, confirming a single monorepo-style app, not split FE/BE repos) and this repo's own `.agents/project.yaml` §`backend.backend_repo: ../upex-bunkai-tms`.

## Tech Stack

### Frontend
- Framework: Next.js `^15` (App Router), React `^19` — Found in: `upex-bunkai-tms/package.json` (`dependencies.next`, `dependencies.react`)
- Language: TypeScript `^5.9.3`, strict mode on — Found in: `upex-bunkai-tms/tsconfig.json` (`"strict": true`)
- Styling: Tailwind CSS `^3.4` + `class-variance-authority` + `tailwind-merge` — Found in: `upex-bunkai-tms/package.json`, `tailwind.config.ts`
- Component primitives: Radix UI (`@radix-ui/react-dialog`, `-dropdown-menu`, `-tabs`, `-tooltip`), `cmdk` (command palette), `shadcn/ui`-style setup (`components.json` present) — Found in: `upex-bunkai-tms/package.json`, `components.json`
- Notable UI libs: `@monaco-editor/react` (ATC step editor), `@tanstack/react-table` (table views), `@dnd-kit/*` (drag-and-drop), `react-markdown` + `remark-gfm` + `rehype-sanitize` (markdown rendering with sanitization) — Found in: `upex-bunkai-tms/package.json`
- State: no dedicated global-state library detected (no Redux/Zustand in `package.json`); relies on React state + Server Components/Server Actions patterns typical of Next.js App Router — **Discovery Gap**: not independently verified by reading component code; flagged, not assumed.

### Backend
- Framework: Next.js API Route Handlers under `app/api/v1/*` (no separate backend framework) — Found in: `upex-bunkai-tms/app/api/v1/` (directory listing: `acceptance-criteria`, `activity`, `atcs`, `auth`, `bugs`, `environments`, `health`, `imports`, `invites`, `me`, `milestones`, `modules`, `notification-preferences`, `notifications`, `projects`, `runs`, `tests`, `tokens`, `user-stories`, `workspaces`)
- Language: TypeScript, `type: module`, package manager Bun — Found in: `upex-bunkai-tms/package.json` (`"type": "module"`, `scripts.*` all `bun ...`)
- ORM: none — direct Supabase client (`@supabase/supabase-js`, `@supabase/ssr`) + hand-written SQL migrations + Postgres RPCs (`SECURITY DEFINER` functions) for write paths — Found in: `upex-bunkai-tms/lib/supabase/{client,server,admin,rpc}.ts`, `upex-bunkai-tms/supabase/migrations/*.sql` (e.g. `bunkai_create_run`, `bunkai_create_bug` RPCs in `0031_runs.sql`, `0046_bugs.sql`)
- API spec: OpenAPI, generated via `@asteasolutions/zod-to-openapi` from Zod schemas, served at `app/api/openapi` and documented via `@scalar/api-reference-react` at `app/api/docs` — Found in: `upex-bunkai-tms/lib/openapi/registry.ts`, `upex-bunkai-tms/app/api/openapi/`, `upex-bunkai-tms/app/api/docs/`, `upex-bunkai-tms/package.json` (`scripts.api:sync`, `scripts.openapi:gen`). Re-verified during Phase 2 SRS (technical surface — the reachable spec, ready for `bun run api:sync`); per `phase-2-srs.md` §2, API contracts are not an SRS output of this skill — see `.context/SRS/architecture.md` §7/§4 for the security/API-surface context that IS in scope.
- Auth: Supabase Auth (cookie-based session via `@supabase/ssr`), gated by `middleware.ts` — Found in: `upex-bunkai-tms/middleware.ts` (protects `/home`, `/projects`, `/onboarding`, `/settings`, `/activity`; public: `/login`, `/auth`, `/api/auth`). Also supports Personal Access Tokens (PAT / Bearer) for headless/API callers — Found in: `upex-bunkai-tms/lib/api/pat.ts`, `upex-bunkai-tms/app/api/v1/tokens/`, ADR `upex-bunkai-tms/.context/ADR/ADR-0005-pat-issuance-role-gate.md`.

### Database
- Type: PostgreSQL 16 — Found in: `upex-bunkai-tms/.agents/project.yaml` §`database.db_type`
- Provider: Supabase (single project, shared across local/staging/production for MVP — same `db_project_ref`) — Found in: `upex-bunkai-tms/.agents/project.yaml` §`environments.*.db_project_ref` (all three environments resolve to `fmbpikzpkafptqximhxn`)
- Schema management: hand-written, sequentially numbered SQL migrations (`0001`…`0068` as of this discovery) under `upex-bunkai-tms/supabase/migrations/` — no Prisma/TypeORM. Row-Level Security (RLS) enforced on every table observed (`workspaces`, `projects`, `modules`, `user_stories`, `atcs`, `tests`, `runs`, `bugs`, `milestones`, …) — Found in: `upex-bunkai-tms/supabase/migrations/0001_tenancy.sql` through `0068_story_traceability_report.sql`
- Access for QA discovery: resolved via `[DB_TOOL]` (DBHub MCP), not yet configured with real credentials in this session — **Discovery Gap**.

### Infrastructure
- Cloud/hosting: Vercel (web + API, serverless/edge Next.js deploy) — Found in: `upex-bunkai-tms/.agents/project.yaml` §`environments.staging.web_url` / `environments.production.web_url` (both `*.vercel.app` domains)
- CI/CD: **no `.github/workflows/` directory found** in the target repo — Found in: `find upex-bunkai-tms -maxdepth 2 -iname ".github"` returned nothing; confirmed by direct `ls .github/workflows/` (No such file or directory). Deploys appear to run through Vercel's git-integration build pipeline rather than GitHub Actions — **not independently confirmed, Discovery Gap**.
- Monitoring: Sentry + PostHog are named as *planned/intended* in the business model doc, not confirmed present in `package.json` dependencies — Found in: `upex-bunkai-tms/.context/business/business-model.md` §"Cost Structure" (aspirational — no `@sentry/*` or `posthog-js` dependency present in `upex-bunkai-tms/package.json` as of this discovery). Treat as **Discovery Gap / not yet implemented**, not a confirmed integration.
- Package manager / runtime: Bun `>= 1.0.0` — Found in: `upex-bunkai-tms/package.json` scripts (all prefixed `bun`), `upex-bunkai-tms/README.md` §Prerequisites

## Environments

| Environment | Web URL | API URL | Purpose | Access |
|-------------|---------|---------|---------|--------|
| Local | `http://localhost:3000` | `http://localhost:3000/api` | Dev | Direct (`bun run dev`) |
| Staging | `https://staging-upexbunkai.vercel.app` | `https://staging-upexbunkai.vercel.app/api` | Pre-prod / integration-branch validation | Vercel preview alias, no VPN detected |
| Production | `https://upexbunkai.vercel.app` (defensive `bunkai.io` domain planned, not yet wired) | `https://upexbunkai.vercel.app/api` | Live | Read-only for QA by default |

Found in: `upex-bunkai-tms/.agents/project.yaml` §`environments.{local,staging,production}`.

**Conflict found** — this QA repo's own `.agents/project.yaml` (`qa-engineering-bunkai/.agents/project.yaml` §`environments`) declares a *different* environment set: `local`, `qa` (`https://qa.upexbunkai.vercel.app`), `staging` (`https://staging-upexbunkai.vercel.app`), `production` (`https://myproject.com` — an unfilled placeholder). Only `local` and `staging` URLs agree between the two files. The QA repo's `qa` environment and its placeholder `production` URL do not correspond to any environment declared in the target repo's own `.agents/project.yaml`, and the QA repo's `webapp_domain: upexbunkai.vercel.app` differs from the target's `webapp_domain: bunkai.io`. **Not resolved by this discovery** — flagged for the user; `qa-engineering-bunkai/.agents/project.yaml` was intentionally left unedited per instructions.

## Tools and Access

- Issue tracker: Jira Cloud, project key `BK` — resolved via `[ISSUE_TRACKER_TOOL]` (`/acli`). Found in: `upex-bunkai-tms/.agents/project.yaml` §`issue_tracker` (`atlassian_url: upexgalaxy71.atlassian.net`), matches `qa-engineering-bunkai/.agents/project.yaml` §`issue_tracker.atlassian_url`.
- Database: resolved via `[DB_TOOL]` (DBHub MCP per this repo's tool-resolution table); not exercised in this discovery session (read-only, no live query run).
- Docs: in-repo `.context/` tree (PRD, SRS, business, ADRs) — no external Confluence/Notion detected. Found in: `upex-bunkai-tms/.context/` (extensive: `PRD/`, `SRS/`, `business/`, `ADR/`, `PBI/`, `design/`, `designs/`).
- Credentials: never read or pasted into this document. Env var *names* only — see `upex-bunkai-tms/.env.example` for the full contract (`ATLASSIAN_*`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_*`, `QA_E2E_USER_EMAIL` / `QA_E2E_USER_PASSWORD` for the dedicated QA automation identity, `RESEND_API_KEY`, `TAVILY_API_KEY`, `N8N_API_*`).

## Access Checklist

- [x] Repository read access (local clone present, read throughout this discovery)
- [ ] Database access (MCP or direct) — not exercised this session, `[DB_TOOL]` not invoked
- [x] Issue tracker access — project key `BK` resolved from both repos' `.agents/project.yaml`; live Jira connectivity not tested this session
- [ ] Staging environment reachable — URL recorded, not pinged this session
- [ ] CI/CD visibility — no `.github/workflows/` exists in target repo to observe; Vercel deploy pipeline visibility not verified

## Discovery Gaps

- [ ] Frontend global-state approach (if any) beyond React/Server Component defaults — not verified by reading component internals, only inferred from absent state-library dependencies in `package.json`.
- [ ] CI/CD pipeline mechanics — no GitHub Actions workflows exist; whether Vercel's git-integration alone gates deploys (build/lint/test gates before promotion) was not independently confirmed. Local `.husky/pre-commit` and `.husky/pre-push` hooks run `types:check`, `vars:check`, `skills:check` (commit) and `format:check` + `lint:check` + `vars:env:check` + `skills:registry:check` (push) — **neither hook runs the test suite** (see Project Assessment).
- [ ] Sentry / PostHog monitoring — named as intended in `business-model.md` §Cost Structure but no corresponding dependency found in `package.json`; status is aspirational, not implemented.
- [ ] Live database schema drift vs. migration files — migrations were read as the authoritative source per project-discovery doctrine ("prefer schema over ORM models"); no live `[DB_TOOL]` query was run to confirm the deployed schema matches the 68 migration files on disk.
- [ ] Production custom domain (`bunkai.io`) — declared as a target in `.agents/project.yaml` comments but not yet wired; production currently resolves to the Vercel `*.vercel.app` alias only.
- [ ] Environment-variable conflict between the two repos' `.agents/project.yaml` files (see "Conflict found" note above under Environments) — needs a human decision on which is authoritative for QA session targeting.
