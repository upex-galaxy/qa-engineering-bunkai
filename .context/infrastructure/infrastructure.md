# Infrastructure Mapping — Bunkai TMS

> Target repo: `upex-bunkai-tms`. Discovery scope: Phase 3 — Infrastructure, sub-step 3 (`/project-discovery`, run from `qa-engineering-bunkai`).
> Generated: 2026-08-17.
> Read-only discovery — no code, install, build, or dev commands were executed against `upex-bunkai-tms` in this pass. Deployment platform (Vercel) is inferred from URL evidence, not independently confirmed via a platform-specific config file (none exists).

---

## Overview Diagram

```mermaid
graph TB
    Dev["Developer / AI agent<br/>(local, bun run dev)"] -->|git push| StagingBranch["staging branch<br/>(integration)"]
    StagingBranch -->|ff-only promote| MainBranch["main branch<br/>(production)"]

    StagingBranch -.->|Vercel git-integration build<br/>(no vercel.json — unconfirmed gating)| StagingEnv["Staging<br/>staging-upexbunkai.vercel.app"]
    MainBranch -.->|Vercel git-integration build| ProdEnv["Production<br/>upexbunkai.vercel.app"]

    Dev --> LocalEnv["Local<br/>localhost:3000"]

    LocalEnv --> Supabase[("Supabase project<br/>fmbpikzpkafptqximhxn<br/>Postgres 16 + Auth + Realtime")]
    StagingEnv --> Supabase
    ProdEnv --> Supabase

    Husky["Husky git hooks<br/>(pre-commit / pre-push)"] -.->|local gate only,<br/>no CI equivalent found| Dev

    style Supabase fill:#2d6cdf,color:#fff
```

**Key structural finding**: local, staging, and production all point at the **same** Supabase project ref (`fmbpikzpkafptqximhxn`) — there is no environment-level database isolation. This is restated from `.context/project-config.md` because it is the single most consequential fact for how CI/CD and deployment safety should be read below.

---

## CI/CD Configuration

| Aspect | Value |
|---|---|
| Platform | **None found.** No `.github/workflows/` directory, no `.gitlab-ci.yml`, no `azure-pipelines.yml`, no `.circleci/config.yml`, no `Jenkinsfile` — confirmed by direct directory listing in this session (`ls -la .github` → "no .github dir") |
| Local git hooks (Husky) | `pre-commit`: `bunx lint-staged` (staged-file lint/format) + `bun run types:check` + `bun run vars:check` + `bun run skills:check`, plus a conditional `skills:registry:check` when skill files are staged. `pre-push`: `bun run format:check && bun run lint:check && bun run vars:env:check && bun run skills:registry:check` |
| Test execution in hooks | **Neither hook runs the test suite** — `types:check`/`vars:check`/`skills:check` (commit) and `format:check`/`lint:check`/`vars:env:check`/`skills:registry:check` (push) do not include any `bun test` invocation |
| `repo:check` aggregate script | `format:check && lint:check && types:check && vars:check && vars:env:check && skills:check && skills:registry:check` — exists in `package.json` but is not wired into any automated trigger (no CI to run it, hooks run a subset directly inline rather than calling this script) |

**Conclusion**: there is no automated CI/CD pipeline in this repository. Whatever gating exists between a `git push` and a live deployment is either (a) entirely delegated to Vercel's own git-integration build step, or (b) manual. Neither is independently confirmed — see Discovery Gaps.

---

## Deployment Configuration

| Aspect | Value | Confidence |
|---|---|---|
| Hosting platform | Vercel (inferred) | Medium — inferred solely from `*.vercel.app` URLs in `.agents/project.yaml`; **no `vercel.json` exists** in the repo to confirm build command, framework preset, or region config |
| Deployment method | Presumed Vercel's Next.js git-integration (automatic build+deploy on push to a connected branch) | Not independently confirmed — no platform config file, no CI logs, no dashboard access in this session |
| Preview deployments | Not confirmed — Vercel's default PR-preview behavior is plausible given the platform, but no evidence (no `.github/workflows`, no PR-comment bot config) was found either way | Discovery Gap |
| Regions / replicas | Not found — no config artifact specifies this | Discovery Gap |
| Docker / container | **Not applicable** — no `Dockerfile`, no `docker-compose.yml` found. Per the discovery skill's own gotcha ("missing Dockerfile is not a red flag" for Vercel-style deployments), this is expected, not a gap |

---

## Environments Matrix

| Environment | URL | Branch | Auto Deploy | Database | Approval |
|---|---|---|---|---|---|
| Local | `http://localhost:3000` | — (any local branch; working branch observed as `staging` this session) | — | Shared Supabase project `fmbpikzpkafptqximhxn` | — |
| Staging | `https://staging-upexbunkai.vercel.app` | `staging` (per target's own `git_strategy.branches.integration`) | Assumed Yes (Vercel git-integration), **not independently confirmed** | Same shared Supabase project `fmbpikzpkafptqximhxn` | — |
| Production | `https://upexbunkai.vercel.app` (defensive `bunkai.io` domain named in `.agents/project.yaml` comments but **not yet wired**) | `main` | Assumed Yes (Vercel git-integration), **not independently confirmed** | Same shared Supabase project `fmbpikzpkafptqximhxn` | Not documented — target's `git_strategy.policy.direct_push_to_protected: confirm` governs direct pushes to `main`/`staging`, but this is a *git* guard, not a deployment-approval gate |

Source: `upex-bunkai-tms/.agents/project.yaml` §`environments.{local,staging,production}` and §`git_strategy.branches`.

### Environment / domain conflict — explicit, not resolved

| Field | This QA repo's `.agents/project.yaml` | Target repo's own `.agents/project.yaml` |
|---|---|---|
| `webapp_domain` | `upexbunkai.vercel.app` | `bunkai.io` |
| Environments declared | `local`, `qa` (`https://qa.upexbunkai.vercel.app`), `staging`, `production` (`https://myproject.com` — unfilled placeholder) | `local`, `staging`, `production` (no `qa` environment) |
| Agreement | Only `local` and `staging` URLs agree between the two files | — |

This table is carried forward from `.context/project-config.md` (Phase 1 finding), restated here per the task's explicit instruction — **not resolved by this discovery**, flagged for the user to reconcile. The QA repo's `qa` environment and placeholder `production` URL have no counterpart in the target's own file.

### Branch discrepancy — explicit, not resolved

- Phase 1's `.context/project-config.md` recorded `main` as the resolved default branch for the target repo, with `staging` only flagged as a "possible unconfirmed integration branch."
- This Phase 3 session independently re-confirmed the working branch is `staging` (`git branch --show-current` → `staging`, tracking `origin/staging`; `git status --porcelain` clean).
- The target's own `.agents/project.yaml` §`git_strategy` (read fully in this pass) resolves this more precisely than Phase 1 could: strategy is `main-integration`, with `main` = production/default branch and `staging` = a long-lived integration branch (all `feature/*`/`fix/*` work branches off `staging`, promotion to `main` is fast-forward-only, and the invariant "`main` must always be an ancestor of `staging`" is explicitly documented).
- **Not re-resolved here** — this is additional evidence for the user's reconciliation, not a Phase-3 decision to make. The apparent tension (default branch `main` vs. observed working branch `staging`) is explainable by the `main-integration` strategy itself (day-to-day work happens on `staging`), but that interpretation is offered as context, not stated as settled fact.

---

## Environment Variables by Environment

Per-environment **values** were not read (no dashboard/Vercel access in this session; read-only discovery). The variable **names** are identical across environments per `.env.example` — see `backend.md` and `frontend.md` for the full Required/Optional/External-Service breakdown. The only environment-varying values inferable from evidence are:

| Variable | Local | Staging | Production |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://staging-upexbunkai.vercel.app` (inferred) | `https://upexbunkai.vercel.app` (inferred) |
| Supabase project ref (`db_project_ref`) | `fmbpikzpkafptqximhxn` | `fmbpikzpkafptqximhxn` (same) | `fmbpikzpkafptqximhxn` (same) |

All other vars (Supabase keys, Postgres connection strings, Atlassian/Resend/Tavily/n8n keys) are presumed identical or per-environment-set in Vercel's dashboard — **not verified**.

---

## Secrets Management

| Secret category | Storage mechanism | Access scope |
|---|---|---|
| Supabase keys, Postgres credentials, Atlassian/Resend/Tavily/n8n API keys | Local: `.env` (gitignored, not present in this read-only session — only `.env.example` and `.envrc` exist on disk). Deployed: presumed Vercel Environment Variables dashboard (platform-standard for Vercel-hosted Next.js apps) | Not independently verified — no Vault/AWS Secrets Manager/Doppler/1Password CLI reference found anywhere in the repo |
| QA automation identity (`QA_E2E_USER_EMAIL`/`PASSWORD`) | Same `.env` mechanism | Dedicated non-production account per `.agents/project.yaml` §`testing.automation_identity` (per_env: `{}` — same fixture works across all three environments, consistent with the single shared Supabase project) |
| DB read-only QA role | `qa_inspector_ro.<project-ref>` via the Supabase session pooler (port 5432) | `upex-bunkai-tms/dbhub.toml` — explicitly documents "Real passwords live in the credentials Epic (BK-29), never in this file" |
| Rotation cadence | **Not documented anywhere found** | Discovery Gap |

---

## Cloud Services

| Service | Provider | Purpose | Confidence |
|---|---|---|---|
| Database + Auth + Realtime | Supabase (managed Postgres 16) | Primary datastore, auth, live push | High — `package.json` deps + `middleware.ts` + `.agents/project.yaml` |
| Hosting | Vercel | Web + API serverless deploy | Medium — URL evidence only, no `vercel.json` |
| Issue tracker | Atlassian Jira (Cloud), project key `BK` | User Story import source (`lib/jira/*`), backlog | High |
| Transactional email | Resend | Email sending (implied) | Medium — env var present, send call sites not traced |
| MCP control plane | Supabase MCP (via `SUPABASE_ACCESS_TOKEN`) | Migration apply, project management, advisors, edge functions | High — `supabase/migrations/README.md` explicitly documents `apply_migration` as the migration mechanism |
| Web search / workflow MCPs | Tavily, n8n | Non-product tooling for AI agent workflows | High (env vars present), not product infrastructure |
| Object storage | **None found** | No R2/S3/MinIO client dependency; `bugs.evidence_urls` is a plain URL-string array with an untraced upload pipeline | Not implemented / Discovery Gap |
| Monitoring / APM / analytics | **None found** (Sentry, PostHog named only in aspirational planning docs) | — | Not implemented — see Monitoring section below |

---

## Database Infrastructure

| Aspect | Value |
|---|---|
| Provider | Supabase (managed) |
| Engine | PostgreSQL 16 |
| Topology | Single project (`fmbpikzpkafptqximhxn`), shared across local/staging/production — no per-environment isolation |
| Region | Not found — no region config in any repo file |
| Backups | Platform-delegated (Supabase-managed) — not independently verifiable from this repo; no backup schedule or DR runbook found |
| Connection method | PostgREST/`supabase-js` for app traffic; direct `POSTGRES_URL`/`POSTGRES_URL_NON_POOLING` documented in `.env.example` but usage not traced in code |
| Schema management | Hand-written SQL migrations (`supabase/migrations/0001`–`0068`), applied via Supabase MCP `apply_migration`, ledgered in `supabase_migrations.schema_migrations` |
| Connection pooling | Not independently verified — no Supavisor/pool-size config file found (carried forward from `.context/SRS/non-functional-specs.md` NFR-PERF-003) |

---

## Infrastructure Resources Diagram

```mermaid
graph LR
    subgraph "Vercel (hosting, inferred)"
        WebApp["Next.js 15 app<br/>(UI + REST API in one deployable)"]
    end

    subgraph "Supabase project: fmbpikzpkafptqximhxn"
        PG[("Postgres 16<br/>68 migrations, RLS everywhere")]
        Auth["Supabase Auth (GoTrue)"]
        Realtime["Supabase Realtime<br/>(Postgres logical replication)"]
    end

    subgraph "External services"
        Jira["Atlassian Jira<br/>(User Story import)"]
        Resend["Resend<br/>(transactional email)"]
    end

    subgraph "MCP control plane (AI-agent tooling, not product runtime)"
        SupaMCP["Supabase MCP<br/>(migration apply, admin)"]
        DBHub["DBHub MCP<br/>(QA read-only role)"]
    end

    WebApp -->|supabase-js / PostgREST| PG
    WebApp -->|cookie session + PAT| Auth
    WebApp -.->|WebSocket subscribe| Realtime
    WebApp -->|Jira REST API| Jira
    WebApp -.->|send (untraced)| Resend

    SupaMCP -->|apply_migration| PG
    DBHub -->|read-only, session pooler| PG
```

---

## IaC

**None found.** No Terraform (`*.tf`), Pulumi (`Pulumi.yaml`), AWS CDK (`cdk.json`), Serverless Framework (`serverless.yml`), or Kubernetes/Helm (`k8s/`, `helm/`) artifacts exist anywhere in the repository. Infrastructure is a single Supabase project (managed via dashboard + Supabase MCP for migrations) plus a Vercel-hosted deployable with no infrastructure-as-code layer.

---

## Monitoring & Observability

| Aspect | Value | Found in |
|---|---|---|
| Error tracking | **Not implemented** — no `@sentry/*`, `@rollbar/*`, or `bugsnag` dependency | `package.json` full dependency list (re-confirmed this pass) |
| Uptime monitoring | **Not found** — no UptimeRobot/Pingdom/BetterStack config or reference anywhere in the repo | Discovery Gap |
| APM / metrics | **Not implemented** — no Datadog/New Relic/Grafana Cloud/CloudWatch/`@opentelemetry/*` dependency | `package.json` |
| Logging | Structured single-line JSON logs to stdout only, emitted by every `withApiHandler`-wrapped route (`{ level, ts, component, request_id, method, path, status, duration_ms, ... }`). This is Vercel-indexable but there is no confirmed log-shipping destination beyond Vercel's own retention, and no retention period was found documented | `lib/api/logging.ts` (carried forward from `.context/SRS/non-functional-specs.md` NFR-OBS-001) |
| Alerting | **Not implemented** — nothing consumes the stdout logs beyond Vercel's own log retention | Discovery Gap |
| Product analytics | **Not implemented** — no `posthog-js` dependency, despite being named as planned in the target's own `business-model.md` | `package.json` |

**Sentry and PostHog are named as intended in `upex-bunkai-tms/.context/business/business-model.md` §"Cost Structure" but have no corresponding dependency in `package.json`** — this was already established independently in `.context/project-config.md` (Phase 1) and `.context/SRS/architecture.md`/`non-functional-specs.md` (Phase 2); restated here for infrastructure-section completeness, not re-derived.

---

## Deployment Checklist

**No documented deployment checklist, runbook, or rollback procedure was found anywhere in the target repo** (`.context/` tree, root-level docs, `.github/` — which doesn't exist). The following is offered as inference from the available evidence, clearly marked as such, not as a confirmed team process:

| Phase | Inferred practice | Confidence |
|---|---|---|
| Pre-deploy | Local Husky `pre-push` gate (`format:check`, `lint:check`, `vars:env:check`, `skills:registry:check`) runs before any push reaches `origin` | High (hook content read directly) — but this is a **local** gate, bypassable by anyone who skips hooks; it is not a server-side/CI gate |
| Pre-deploy | `repo:check` aggregate script exists (`format+lint+types+vars+skills`, full repo) but is not wired to any automated trigger — presumed manual-only | Medium |
| Deploy | Presumed automatic on push to `main` (production) / `staging` (staging), via Vercel's git integration | Low — no `vercel.json`, no CI logs, no dashboard access to confirm |
| Post-deploy | **No smoke test, health-check-poll, or deployment-verification step found** | Discovery Gap |
| Rollback | **No documented rollback mechanism found** — no `vercel rollback` script, no "redeploy prior SHA" runbook, no mention in any `.context/ADR/` file read so far | Discovery Gap |

---

## Discovery Gaps

- [ ] Vercel build/deploy configuration entirely unconfirmed — no `vercel.json` exists; framework preset, build command override, and region settings are Vercel-dashboard-only and were not accessible in this session.
- [ ] Preview-deployment-per-PR behavior not confirmed (plausible Vercel default, not verified).
- [ ] Deployment approval gates (if any) between `staging` and `main` promotion — the target's `git_strategy.policy.direct_push_to_protected: confirm` is a **git push** guard, not a confirmed deployment-approval gate; these may or may not be the same control.
- [ ] No documented rollback procedure anywhere in the target repo.
- [ ] No documented smoke-test / deployment-verification step.
- [ ] Secret rotation cadence not documented anywhere.
- [ ] Backup/DR posture entirely platform-delegated (Supabase) and not independently verifiable from this repo (carried forward from `.context/SRS/non-functional-specs.md`).
- [ ] No CI/CD pipeline exists at all — every gate found (Husky hooks) is local-only and bypassable; there is no server-side enforcement of lint/type/test correctness before a deploy.
- [ ] Region/replica configuration for both Vercel and Supabase not found in any repo file.

**Carried-forward, not resolved here** (see `.context/project-config.md` for the original finding, and the "Environments Matrix" section above for the fuller cross-reference gathered in this pass):
- Environment/domain conflict between this QA repo's and the target repo's own `.agents/project.yaml` (`webapp_domain`, environment set, placeholder production URL).
- Target repo's working branch (`staging`) vs. Phase 1's recorded default branch (`main`) — this pass adds the target's own `git_strategy` block as corroborating context (main-integration strategy), but does not adjudicate the discrepancy.

---

## QA Relevance

| Infra fact | Test implication |
|---|---|
| No CI/CD pipeline exists | Any automated regression suite this QA repo builds (`/regression-testing`) cannot currently hook into a GitHub Actions trigger — it would need to run manually, via a scheduled job, or the team would need to adopt GitHub Actions (or another CI) first. This is a real gap for Stage 6 of this repo's own pipeline. |
| Single shared Supabase project across all environments | Any QA automation that writes data (Runs, Bugs, ATCs) against "staging" is writing to the **same physical database** as local dev and — critically — production. Test-data isolation (workspace/project scoping, cleanup discipline) is not optional; it is the only isolation boundary that exists. This is the basis for the "Test-Architecture ADR Candidate" flagged in `.context/SRS/architecture.md`. |
| No rollback procedure documented | A regression-testing GO/NO-GO decision (`/regression-testing`) has no corresponding "if NO-GO, here's how the team reverts" answer to point to — worth surfacing to the team as a gap alongside any release-readiness report. |
| Husky hooks don't run tests | Local commits/pushes are not blocked by a failing test suite — a broken test can be pushed to `staging` or even `main` without any automated stop. Regression suite runs are the only safety net once code is merged. |
| No monitoring/alerting | Post-deploy verification for QA purposes cannot rely on Sentry/APM signals — manual smoke testing or synthetic health checks (`GET /api/v1/health`, liveness only) are the only automated signals available today. |
| `dbhub.toml` `qa_inspector_ro` read-only role | QA's `[DB_TOOL]` (DBHub MCP) access is explicitly scoped read-only, session pooler only (port 5432, not 6543) — any DB-level verification this QA repo performs must stay read-only by design, matching the provisioned role. |
