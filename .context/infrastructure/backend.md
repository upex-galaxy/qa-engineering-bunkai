# Backend Infrastructure — Bunkai TMS

> Target repo: `upex-bunkai-tms`. Discovery scope: Phase 3 — Infrastructure, sub-step 1 (`/project-discovery`, run from `qa-engineering-bunkai`).
> Generated: 2026-08-17.
> Read-only discovery — no code, install, build, or dev commands were executed against `upex-bunkai-tms` in this pass. Every claim below is evidenced with a file path or listed under Discovery Gaps.

---

## Runtime

| Aspect | Value | Found in |
|---|---|---|
| Runtime / package manager | Bun `>= 1.0.0` | `README.md` §Prerequisites (Phase 1 finding); every `package.json` script is a bare command run under Bun, `"type": "module"` |
| Language | TypeScript `^5.9.3`, strict mode on | `tsconfig.json` (`"strict": true`) |
| Framework | Next.js `^15` (App Router) — API surface is Route Handlers under `app/api/v1/*`, no separate backend framework (no Express/Fastify/NestJS dependency) | `package.json` (`dependencies.next`), `app/api/v1/` directory listing (~35 resource groups, ~128 route files per `.context/SRS/architecture.md`) |
| Module system | ESNext modules, bundler resolution | `tsconfig.json` (`"module": "ESNext"`, `"moduleResolution": "bundler"`) |
| Path aliases | `@/*`, `@app/*`, `@components/*`, `@lib/*` | `tsconfig.json` §`compilerOptions.paths` |
| Node/TS target | `ES2022` | `tsconfig.json` |

No `.nvmrc` / `.node-version` file was found — the project runs on Bun rather than Node directly, so no separate Node version pin was expected or looked for beyond Bun's own version floor.

---

## Package Scripts

All commands below are copy-pasted verbatim from `upex-bunkai-tms/package.json` §`scripts` — do not paraphrase; drift kills (CLAUDE.md Rule #11).

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Local dev server |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve a production build |
| `typecheck` / `types:check` | `tsc --noEmit` | Type check only (duplicate script names) |
| `types:gen` | `bun scripts/gen-supabase-types.ts` | Generate TypeScript types from the live Supabase schema |
| `api:sync` | `bun scripts/sync-openapi.ts` | Sync OpenAPI-derived types |
| `openapi:gen` | `bun scripts/openapi-gen.ts` | Generate the OpenAPI spec from Zod registries |
| `openapi:diff` | `bun scripts/openapi-diff.ts` | Diff OpenAPI spec versions |
| `format:check` / `format:fix` | `prettier --check` / `--write '**/*.{json,yml,yaml,css,scss,html}'` | Formatting gate (note: does not cover `.ts`/`.tsx` — those are ESLint's job via `lint-staged`) |
| `lint:check` / `lint:fix` | `eslint .` / `eslint --fix .` | Lint gate |
| `vars:check` | `bun scripts/lint-vars.ts` | `{{VAR}}` template lint |
| `vars:env:check` | `bun scripts/check-vars.ts` | Env var contract lint |
| `skills:check` | `bun scripts/lint-skills.ts` | Skill doc lint |
| `skills:registry` / `skills:registry:check` | `bun scripts/build-skill-registry.ts [--check]` | Skill registry freshness |
| `jira:sync-fields` / `jira:sync-workflows` / `jira:sync-issues` / `jira:sync-link-types` / `jira:check` | `bun scripts/sync-jira-*.ts` / `bun scripts/check-jira-setup.ts` | Jira catalog sync + setup check |
| `repo:check` | `format:check && lint:check && types:check && vars:check && vars:env:check && skills:check && skills:registry:check` | Full local CI-equivalent gate (see Discovery Gaps — no CI runs this) |
| `repo:fix` | Same set, `fix` variants where available | Auto-fix equivalent |
| `clean` | `rm -rf node_modules dist .next` | Clean build artifacts |
| `prepare` | `husky` | Installs git hooks |
| `claude` / `opencode` | `bash -c 'set -a; . ./.env; set +a; exec <tool> "$@"'` | Loads `.env` before launching the named AI CLI |
| `setup` / `setup:doctor` / `agents:setup` / `up` / `onboarding` | Bootstrapping/updater scripts | Project scaffolding, not app runtime |

**No dedicated `test` script exists in `package.json`.** 124 `*.test.ts` files were found in the repo tree (route handlers, RLS `*-isolation.test.ts`, `middleware.test.ts`). Given `bun` is the runtime and Bun ships a built-in test runner, these are presumed run via `bun test` directly — **not independently confirmed** (no CI workflow and no `package.json` script references it). See Discovery Gaps.

---

## Core Dependencies

| Category | Package | Version | Purpose |
|---|---|---|---|
| Framework | `next` | `^15` | App Router + API Route Handlers |
| Framework | `react` / `react-dom` | `^19` | UI runtime |
| Database client | `@supabase/supabase-js` | `^2.106.0` | Supabase client (Postgres via PostgREST + RPC) |
| Database client | `@supabase/ssr` | `^0.10.3` | Cookie-based SSR session client (used in `middleware.ts` and `lib/supabase/server.ts`) |
| Validation | `zod` | `^4.4.3` | Request/response schema validation, per-domain in `lib/*/validation.ts` |
| API spec | `@asteasolutions/zod-to-openapi` | `^8.5.0` | Generates OpenAPI spec from `.openapi()`-annotated Zod schemas |
| API docs UI | `@scalar/api-reference-react` | `^0.9.38` | Serves interactive API docs at `/api/docs` |
| Markdown | `react-markdown`, `remark-gfm`, `rehype-sanitize` | `^10.1.0`, `^4.0.1`, `^6.0.0` | Sanitized Markdown render pipeline for US/AC/ATC bodies |
| ORM | **none** | — | No Prisma/TypeORM/Drizzle/Sequelize dependency. Direct Supabase client + hand-written SQL migrations + Postgres `SECURITY DEFINER` RPCs for write paths |
| Auth | **none dedicated (Supabase Auth)** | — | No NextAuth/Passport/jose/jsonwebtoken dependency; auth is delegated entirely to Supabase Auth (GoTrue) via `@supabase/ssr` |
| HTTP client | native `fetch` | — | No axios/got/ky dependency found |
| Test tooling | none in `devDependencies` beyond types | — | No `vitest`/`jest`/`mocha` dependency; presumed Bun's built-in test runner (see Discovery Gaps above) |

---

## Environment Variables

Names and example formats only — no values read or recorded, per CLAUDE.md Rule #1 and the discovery skill's "never paste secret values" rule. Source: `upex-bunkai-tms/.env.example`.

### Required

| Variable | Format hint | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase project URL (server + client) |
| `SUPABASE_PUBLISHABLE_KEY` | publishable key string | Browser-safe Supabase key |
| `SUPABASE_SECRET_KEY` | secret key string | Server-only Supabase key |
| `SUPABASE_JWT_SECRET` | secret string | Sign/verify custom JWTs (PAT impersonation, per ADR-0001) |
| `POSTGRES_HOST` | `db.<project-ref>.supabase.co` | Direct Postgres host |
| `POSTGRES_USER` | `postgres` (default in template) | Direct Postgres user |
| `POSTGRES_PASSWORD` | secret string | Direct Postgres password |
| `POSTGRES_DATABASE` | `postgres` (default in template) | Direct Postgres database name |
| `POSTGRES_URL` | pooled connection string, port 6543 | App runtime DB connection (pooled) |
| `POSTGRES_URL_NON_POOLING` | direct connection string, port 5432 | Direct DB connection (used for admin/migration-adjacent work) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (local default) | Base URL for auth redirects / OAuth callbacks / email links |
| `ATLASSIAN_URL` / `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN` | site URL / email / API token | Jira integration (`lib/jira/*`, import runner) |

**Discovery Gap / inconsistency found**: `middleware.ts` reads `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (line 6), but `.env.example` does not declare that variable name — it declares `SUPABASE_PUBLISHABLE_KEY` instead (per the file's own comment: "modern Supabase projects use the new pair... legacy anon/service_role keys are intentionally NOT listed here"). Either `middleware.ts` is reading a variable that `.env.example` doesn't document, or there is an undocumented legacy/new-key naming split in the running app. Not resolved by this discovery — flagged for the user.

### Optional

| Variable | Purpose |
|---|---|
| `QA_E2E_USER_EMAIL` / `QA_E2E_USER_PASSWORD` | Dedicated non-production automation identity for live-UI QA probes (per `.agents/project.yaml` §`testing.automation_identity`) |
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token for the Supabase MCP control plane (project management, migration apply, advisors, edge functions) — admin-scope |
| `POSTGRES_PRISMA_URL` | Pooled connection string with `pgbouncer=true` — listed for Prisma compatibility even though no Prisma is used in this codebase |

### External Service

| Variable | Service | Purpose |
|---|---|---|
| `TAVILY_API_KEY` | Tavily | Web search MCP |
| `N8N_API_URL` / `N8N_API_KEY` | n8n | Workflow automation MCP |
| `RESEND_API_KEY` | Resend | Transactional email — used by application code (send call sites not independently traced, see `.context/SRS/architecture.md` Discovery Gaps) and for the `resend` CLI |

---

## Database Configuration

| Aspect | Value | Found in |
|---|---|---|
| Type | PostgreSQL 16 | `.agents/project.yaml` §`database.db_type` |
| Provider | Supabase — single project shared across local/staging/production for MVP (`db_project_ref: fmbpikzpkafptqximhxn` in all three environments) | `.agents/project.yaml` §`environments.*.db_project_ref` |
| ORM | None — direct `@supabase/supabase-js` client + hand-written SQL + `SECURITY DEFINER` RPCs | `lib/supabase/{client,server,admin,rpc}.ts` |
| Migration tool | No Supabase CLI config found (`supabase/config.toml` absent) — migrations are applied to the remote project via the **Supabase MCP `apply_migration` tool**, which also records a ledger row in `supabase_migrations.schema_migrations` | `supabase/migrations/README.md` |
| Migration count | 69 files in `supabase/migrations/` (68 numbered SQL files `0001`–`0068` + this directory's own `README.md`) | `supabase/migrations/` directory listing |
| Seed mechanism | **None found** — no `seed.sql`, no seed script in `package.json` | Discovery Gap |
| Row-Level Security | Enforced on every workspace-scoped table observed | `.context/SRS/architecture.md` §5 (carried forward, already verified in Phase 2) |
| Type generation | `bun scripts/gen-supabase-types.ts` (`types:gen` script) generates TS types from the live schema — separate from migration application | `package.json` |

### Migration Commands

```bash
# Migrations are NOT applied via a local CLI command in this repo.
# Convention (supabase/migrations/README.md):
#   1. Author a new file: supabase/migrations/NNNN_<slug>.sql (next sequential ordinal)
#   2. Apply it to the remote Supabase project via the Supabase MCP `apply_migration` tool
#      (never via `execute_sql` — that bypasses the ledger and causes drift)
#   3. The MCP call records a matching row in supabase_migrations.schema_migrations

# Regenerate TypeScript types after a schema change:
bun scripts/gen-supabase-types.ts   # package.json script: types:gen
```

**Discovery Gap**: no local/self-hosted Postgres or Supabase CLI stack (`supabase start`) was found — QA automation and any local dev work connects to the same remote Supabase project used by staging/production (single-tenancy for MVP). There is no isolated local database.

---

## Build Configuration

| Aspect | Value | Found in |
|---|---|---|
| Build command | `next build` | `package.json` §`scripts.build` |
| Output | Standard Next.js `.next/` build output (no `output: 'standalone'` or custom `distDir` configured) | `next.config.ts` |
| `next.config.ts` contents | `reactStrictMode: true`, `outputFileTracingRoot`, `typedRoutes: true`, `images.remotePatterns: []` (6 lines total — no `headers()`, no custom webpack/Turbopack config, no rewrites/redirects) | `next.config.ts` (full file read) |
| Bundler | Not explicitly configured — Next.js default (see `frontend.md` for the bundler determination, since it is a build-time/client concern) | `next.config.ts`, `package.json` (`dev` script has no `--turbo` flag) |
| Type checking | `tsc --noEmit`, `strict: true` | `tsconfig.json`, `package.json` §`scripts.types:check` |

---

## Local Development Setup

**Not executed in this discovery session** — provided as the copy-pasteable recipe implied by `package.json` scripts and `.env.example`, per the skill's required template. Verify manually before relying on it.

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env — minimum required for `bun run dev` to start without runtime errors:
#   NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
#   SUPABASE_PUBLISHABLE_KEY=<publishable key>
#   SUPABASE_SECRET_KEY=<secret key>
#   NEXT_PUBLIC_APP_URL=http://localhost:3000
# NOTE: also verify whether NEXT_PUBLIC_SUPABASE_ANON_KEY is required — middleware.ts
# reads it but .env.example does not declare it (see Discovery Gaps above).

# 3. Database
# No local migration/seed command exists — this project connects to the shared
# remote Supabase project (fmbpikzpkafptqximhxn) for local/staging/production alike.
# There is no `db:migrate` / `db:seed` step to run locally.

# 4. Start development server
bun run dev

# 5. Verify
curl http://localhost:3000/api/v1/health
```

---

## Health Check Endpoints

| Endpoint | Behavior | Found in |
|---|---|---|
| `GET /api/v1/health` | Returns a static `{ ok: true, service, env, ts }` — liveness only, no dependency check (no DB ping, no Supabase Auth reachability check) | `app/api/v1/health/route.ts` (carried forward from `.context/SRS/non-functional-specs.md` NFR-REL-002) |

---

## Auth Flow (backend-side)

- **Cookie session** — Supabase Auth via `@supabase/ssr`. `middleware.ts` gates navigation to `PROTECTED_PREFIXES = ['/home','/projects','/onboarding','/settings','/activity']`; unauthenticated requests to those paths redirect to `/login?next=<path>`. Public prefixes: `/login`, `/auth`, `/api/auth`.
- **Bearer PAT** — headless/CLI/agent callers authenticate via `Authorization: Bearer bk_pat_*`, minted through `POST /api/v1/tokens` (session-only) or at sign-up/sign-in/confirm time.
- Every `/api/v1/*` route is wrapped by `withApiHandler` (`lib/api/handler.ts`); `auth: 'required'` is the default — a route is public only via an explicit opt-out (health, OpenAPI spec, sign-in/up/confirm).
- Full auth architecture already documented in `.context/SRS/architecture.md` §7 — not re-derived here, referenced for the backend infra picture.

---

## Discovery Gaps

- [ ] No `test` script in `package.json` despite 124 `*.test.ts` files in the repo — presumed `bun test` (Bun's built-in runner) but not independently confirmed; no CI workflow exists to read the authoritative command from.
- [ ] `middleware.ts` reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which is not declared in `.env.example` (which instead declares `SUPABASE_PUBLISHABLE_KEY`) — naming mismatch, not resolved here.
- [ ] No seed mechanism found (`seed.sql`, seed script) — local/QA data setup process unconfirmed.
- [ ] No local/self-hosted Postgres or Supabase CLI stack found — all environments (local/staging/production) share one remote Supabase project (`fmbpikzpkafptqximhxn`); QA automation has no isolated database to seed/tear down against. This was already flagged in `.context/SRS/architecture.md` as a "Test-Architecture ADR Candidate" — restated here as it bears directly on backend infra.
- [ ] `NEXT_PUBLIC_APP_URL` default in `.env.example` is `http://localhost:3000` — production/staging values not independently confirmed to be set via this exact variable name in Vercel (no `vercel.json` to check).
- [ ] Connection pooling behavior (`POSTGRES_URL` pooled vs `POSTGRES_URL_NON_POOLING`) is documented in `.env.example` comments but no code path was traced to confirm which one the app actually uses at runtime (Supabase client likely goes through PostgREST, not a direct `POSTGRES_URL` connection — not verified).
- [ ] Resend email send call sites not traced (carried forward from `.context/SRS/architecture.md`) — env var present, no code path confirmed.

**Carried-forward, not re-resolved here** (see `.context/project-config.md` and `.context/SRS/architecture.md` for full detail):
- `.agents/project.yaml` environment/domain values disagree between this QA repo and the target repo (`upexbunkai.vercel.app` vs `bunkai.io`; QA repo's `qa` environment and placeholder `production` URL have no counterpart in the target's own file).
- Target repo's actual working branch was observed as `staging` (re-confirmed in this session: `git branch --show-current` → `staging`, tracking `origin/staging`), not `main`. The target's own `.agents/project.yaml` §`git_strategy` declares a `main-integration` strategy (`main` = production, `staging` = long-lived integration branch, `main` must always be an ancestor of `staging`) — this is a **fuller, more current record** than Phase 1's `project-config.md`, which only flagged `staging` as "possible unconfirmed integration branch." Not overwritten here per instructions; flagged for the user to reconcile.
