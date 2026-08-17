# Business Model — Bunkai (discovered)

> Target repo: `upex-bunkai-tms`. Confidence: **Medium-High** — the target repo already carries its own extensively cited `.context/business/business-model.md` and `.context/PRD/executive-summary.md`, both of which read as engineering-grounded (they cite specific tables, migrations, RPCs) rather than marketing copy. This document independently re-derives and cross-checks the claims against source code (schema, README, package.json) rather than copying the target's own doc verbatim; where a claim could only be confirmed via the target's own business docs (e.g. pricing tiers, which are not encoded in code), that is stated explicitly and downgraded to Medium/Low confidence.
> Generated: 2026-08-17 — Phase 1, sub-step 3 (`/project-discovery`).

---

## 1. Problem Statement

Bunkai is being built as a Test Management System (TMS) — a tool for QA teams to author, organize, and execute test cases and track defects. Its stated differentiation is structural, not feature-count: existing TMSs (the target's own docs name Xray, Zephyr Scale, TestRail, qTest as the incumbents) let teams store test cases as free-form, duplicated step lists with traceability to requirements as an optional free-text field. Bunkai's data model instead makes traceability structural: an ATC (Acceptance Test Case) cannot exist without being anchored to a User Story and at least one Acceptance Criterion, enforced at the schema level via a mandatory many-to-many join table.

Source: `upex-bunkai-tms/.context/PRD/executive-summary.md` §1 ("Problem Statement") — states the same positioning against the same four named competitors.

This traceability-by-construction claim is independently verifiable in the schema, not just asserted in prose:
- `atc_acceptance_criteria` is a join table with `atc_id` and `acceptance_criterion_id` both `not null`, `primary key (atc_id, acceptance_criterion_id)` — Found in: `upex-bunkai-tms/supabase/migrations/0004_atcs.sql:389-393`.
- `atcs.user_story_id` is `not null references public.user_stories(id) on delete restrict` — Found in: `upex-bunkai-tms/supabase/migrations/0004_atcs.sql:57`. The `restrict` (not `cascade`/`set null`) means a User Story cannot be deleted while ATCs still reference it — a structural, not just conventional, guarantee.
- `test_steps.atc_id` is `not null ... on delete restrict` — Found in: `upex-bunkai-tms/supabase/migrations/0024_tests.sql:65`, i.e. a Test is literally an ordered list of ATC references (`test_steps`), not a copy of steps — confirming the "edit once, every test updates" claim in the PRD.

Confidence: **High** for the structural/traceability claim (independently verified in migrations). **Medium** for the market-positioning framing against named competitors (Xray/Zephyr/TestRail/qTest) — this is asserted in the target's own docs but not independently verified against those products.

## 2. Solution Overview (what the code actually builds)

Core domain objects observed directly in the schema and API surface, in dependency order:

`Workspace` → `Project` → `Module` (self-referential tree, depth ≤ 6) → `User Story` → `Acceptance Criterion` → `ATC` (Acceptance Test Case, with `atc_steps` + `atc_assertions`) → `Test` (an ordered chain of ATC references, via `test_steps`) → `Run` (an executable instance of a Test against a `Project Environment`, snapshotting `run_atcs` + `run_steps`) → `Bug` (optionally provenance-linked to a Run/Run Step/ATC). `Milestone` (target-dated project checkpoint) sits alongside as a planning entity.

Found in: `upex-bunkai-tms/supabase/migrations/0001_tenancy.sql` (Workspace), `0002_projects_modules.sql` (Project, Module), `0003_authoring.sql` (User Story, Acceptance Criterion), `0004_atcs.sql` (ATC + children), `0024_tests.sql` (Test), `0031_runs.sql` (Run + Project Environment), `0046_bugs.sql` (Bug), `0064_milestones.sql` (Milestone).

The API surface (`upex-bunkai-tms/app/api/v1/*`) exposes each of these as REST resources, plus supporting concerns: `auth`, `tokens` (Personal Access Tokens for headless/CI callers), `imports` (external import jobs — Jira import confirmed via `upex-bunkai-tms/lib/jira/import-runner.ts`), `notifications` + `notification-preferences`, `activity` (audit trail), `me` (current-user context), `environments`. Found in: `upex-bunkai-tms/app/api/v1/` directory listing.

Three execution modes for a Run are declared in the schema itself: `executor_mode text not null check (executor_mode in ('human', 'agent', 'ci'))` — Found in: `upex-bunkai-tms/supabase/migrations/0031_runs.sql:81`. This directly substantiates the target's own claim of "manual, agentic, and automated (CI/CD) execution modes sharing one data model" (`upex-bunkai-tms/.context/business/business-model.md` §"Value Propositions"), though only the `human` mode's UI (manual step-by-step runner) was confirmed present in the route tree (`app/(app)/projects/[projectSlug]/`); `agent`/`ci` execution paths were not traced end-to-end in this Phase-1-scoped discovery.

Confidence: **High** — this section is derived directly from schema + route-tree inspection, not from prose claims.

## 3. Customer Segments (as evidenced by the product surface)

| Segment | Evidence in the product | Confidence |
|---|---|---|
| QA engineers / testers authoring and executing tests | Primary UI surface: ATC builder (`components/atcs/`), test chain builder, manual run executor, bug filing UI (`components/bugs/`, `components/runs/`) | High — matches the bulk of the route tree and component directories |
| QA leads / engineering managers wanting coverage visibility | Dedicated coverage + traceability + metrics surfaces: `lib/coverage/`, `lib/traceability/`, `lib/metrics/` (defect heatmap, recovery-cycle report), `app/(app)/home` dashboard | High — distinct code paths exist for aggregate reporting, not just per-test views |
| Developers checking "is my feature tested?" | `lib/traceability/story-traceability-isolation.test.ts`, `lib/traceability/chain-view.ts`, `supabase/migrations/0068_story_traceability_report.sql` | Medium — the traceability *data* clearly supports this use case; no dedicated "developer" role/permission distinct from `workspace_members.role` (`viewer|member|admin|owner`) was found, so this may be the same `viewer` role rather than a first-class persona in the code |
| External/automation callers (scripts, CI, AI agents) | Personal Access Token issuance + scoping (`app/api/v1/tokens/`, `lib/api/pat.ts`), full REST + OpenAPI surface, `executor_mode in ('agent','ci')` on `runs` | High — the API-first design is structural (PAT auth path, OpenAPI generation pipeline), not aspirational |

Source for persona *naming* (Elena/Mateo/Sara/Karim) is the target's own PRD, not independently verifiable from code alone: Found in: `upex-bunkai-tms/.context/PRD/executive-summary.md` §4 ("Target Users"), `upex-bunkai-tms/.context/PRD/user-personas.md`. Confidence: **Low-Medium** on persona names/priorities specifically (this is product narrative, not enforced by the system); **High** on the underlying role/segment capabilities, which are enforced in code (RLS role checks, PAT scopes).

## 4. Value Propositions

- **Structural traceability** — an ATC cannot be created without a User Story + ≥1 Acceptance Criterion (see §1). Confidence: High (schema-verified).
- **Edit-once test maintenance** — Tests reference ATCs by id (`test_steps.atc_id`), not by copied content; editing an ATC's steps/assertions is reflected everywhere it's chained. Confidence: High (schema-verified); ADR `upex-bunkai-tms/.context/ADR/ADR-0009-atc-edit-propagation-contract.md` documents the propagation contract explicitly.
- **Native defect management anchored to the test cycle** — `bugs` rows optionally carry `run_id`, `run_step_id`, `atc_id` as provenance (nullable, `on delete set null`), and always carry `module_id` (mandatory). Confidence: High (schema-verified, `upex-bunkai-tms/supabase/migrations/0046_bugs.sql:93-103`).
- **API-first / automatable** — OpenAPI spec generated from the same Zod schemas that validate requests (`upex-bunkai-tms/lib/openapi/registry.ts`), PAT auth for non-interactive callers. Confidence: High.
- **Multi-tenant workspace model with RLS-enforced isolation** — every table observed enables `row level security` and scopes access through a workspace-membership chain (`workspace_members.status = 'active'`). Confidence: High — directly observed in every migration read (0001–0064).
- **Open-core / self-hostable distribution** — asserted in the target's business-model doc as a *planned* differentiator; **not verifiable from this MVP codebase**, which runs on a single shared Supabase project per `.agents/project.yaml` (`db_project_ref` identical across local/staging/production). Confidence: **Low** — treat as roadmap intent, not current product fact. Source: `upex-bunkai-tms/.context/business/business-model.md` §"Value Propositions" ("Open-source + self-hostable").

## 5. Revenue Streams

**Discovery Gap** — no billing/subscription/payment code was found in this discovery pass (no Stripe/Paddle/LemonSqueezy dependency in `upex-bunkai-tms/package.json`; a `bk-224-billing` design mockup set exists under `.context/designs/` but is design-stage only, not implemented). The target's own business-model doc describes a three-tier Open Core plan (Community/free, Cloud/per-seat subscription, Enterprise/annual license) — Found in: `upex-bunkai-tms/.context/business/business-model.md` §"Revenue Streams". This is recorded here as **Unknown from code — requires confirmation that this is still current intent**, per the doctrine's rule to mark unverifiable Business Model Canvas blocks explicitly rather than presenting roadmap narrative as shipped fact. The schema does carry a `workspaces.plan text not null default 'community' check (plan in ('community','cloud','enterprise'))` column (Found in: `upex-bunkai-tms/supabase/migrations/0001_tenancy.sql:32-33`), which corroborates that the three-tier *shape* is at least modeled in the data, even though no billing logic gates behavior on it yet in the areas this discovery inspected.

## 6. Key Activities (mapped to code evidence)

| Activity | Evidence | Confidence |
|---|---|---|
| Authoring test structure (Modules, User Stories, ACs, ATCs) | `app/(app)/projects/[projectSlug]/`, `lib/modules/`, `lib/user-stories/`, `lib/acceptance-criteria/`, `lib/atcs/` | High |
| Building reusable Test chains | `lib/tests` area (via `tests`/`test_steps` schema), `components/tests/` | High |
| Executing manual Runs | `lib/runs/` (start-run, mark-step, report-bug, history), `components/runs/` | High |
| Filing and triaging Bugs | `lib/bugs/` (validation, list-query, transition-bug-status), `components/bugs/` | High |
| Measuring coverage / traceability / defect trends | `lib/coverage/`, `lib/traceability/`, `lib/metrics/` (defect-heatmap, recovery-cycle) | High |
| Milestone planning | `lib/milestones/` (target-date validation, countdown), `supabase/migrations/0064_milestones.sql` | High |
| Importing from Jira | `lib/jira/` (`adf-to-markdown.ts`, `extract-acceptance-criteria.ts`, `import-runner.ts`), `app/api/v1/imports/` | High |
| Team/workspace administration | `lib/account/`, `lib/workspaces/`, `app/(app)/settings/{account,tokens,workspaces}` | High |

## 7. Key Partners

- **Supabase** — database, auth, (likely) realtime. Found in: `upex-bunkai-tms/package.json` (`@supabase/supabase-js`, `@supabase/ssr`), `lib/notifications/realtime-notifications-channel.ts`, `lib/runs/realtime-run-channel.ts` (names strongly imply Supabase Realtime usage, though the underlying transport was not traced to a WebSocket connection in this pass — ADR `.context/ADR/ADR-0010-realtime-transport-supabase-realtime.md` confirms this decision explicitly).
- **Vercel** — hosting, inferred from `*.vercel.app` environment URLs in `.agents/project.yaml`. Confidence: High (URL evidence), though no `vercel.json`/deploy-config file exists to confirm build settings.
- **Atlassian Jira** — import/sync integration (`lib/jira/client.ts`, `lib/jira/import-runner.ts`) and the project's own issue-tracker-of-record (`BK` project key). Confidence: High.
- **Resend** — transactional email, evidenced by `RESEND_API_KEY` in `.env.example` and the notification-digest email design mockup (`.context/designs/.../email-digest-template.html`). Confidence: Medium (env var + design artifact present; sending code path not traced in this pass).

## 8. Cost Structure

**Discovery Gap** — no infrastructure-as-code, billing dashboard export, or cost-tracking artifact was found in the repo to verify actual costs. The target's own `business-model.md` names Vercel, Supabase, Upstash, Cloudflare R2, Sentry, and PostHog as anticipated cost centers; only Vercel and Supabase were independently corroborated in this discovery (via env vars and URL patterns). Upstash/R2/Sentry/PostHog have no corresponding dependency or config file in `upex-bunkai-tms/package.json` or `.env.example` — treat as **roadmap intent, not confirmed spend**.

## Discovery Gaps

- [ ] Revenue model (pricing, tier gating logic) — no billing code found; tier *names* are modeled in `workspaces.plan` but not enforced anywhere observed. Source of truth should be a direct question to the product owner or a deeper Phase-2/3 pass through `app/(app)/settings/` and any Stripe-adjacent code not yet written.
- [ ] Whether the "open-source, self-hostable" distribution model is current MVP scope or Phase-2+ roadmap — the codebase runs on a single shared Supabase project, which is consistent with either interpretation and doesn't resolve it.
- [ ] External monitoring/analytics stack (Sentry, PostHog) — named as intent, not found as dependencies.
- [ ] Persona names/priorities (Elena, Mateo, Sara, Karim) — sourced only from the target's own PRD narrative, not independently verifiable from code (personas are a documentation construct, not an enforced code concept beyond the `workspace_members.role` enum).
- [ ] Actual pricing figures, if any exist beyond the "$20-30/seat/mo" placeholder in the target's own business-model doc — explicitly marked TBD in that source document itself.

## QA Relevance

| Business aspect | Testing implication |
|---|---|
| ATC → User Story → Acceptance Criterion is a hard FK/RESTRICT chain | Any test-data setup/teardown for QA must respect deletion order (children before parents) or expect `on delete restrict` failures — a legitimate negative-test target (attempt to delete a referenced User Story and assert the API/DB rejects it). |
| RLS enforced per-table via workspace membership | Cross-tenant isolation is a first-class, high-value test surface — the repo's own `*-isolation.test.ts` naming convention (`lib/bugs/list-isolation.test.ts`, `lib/runs/history-isolation.test.ts`, etc.) shows the team already treats this as a distinct test category worth mirroring in QA's own test plan. |
| `runs.executor_mode` includes `agent` and `ci`, not just `human` | QA test plans should distinguish manual-run UI testing from API-driven run creation (PAT-authenticated), since these are structurally different code paths, not the same flow with a different UI skin. |
| `workspaces.plan` models tiers but no billing logic was found | Feature-gating-by-plan is not yet a testable surface — do not write test cases assuming plan-based restrictions exist until Phase 2/3 confirms whether/where they're enforced. |
| No CI runs the 134-file test suite (see `CLAUDE.md` §Project Assessment) | QA's own regression suite is currently the *only* automated safety net exercised on a schedule — raises the stakes of `/regression-testing` for this project specifically. |

## Sources Used

- `upex-bunkai-tms/.context/PRD/executive-summary.md`
- `upex-bunkai-tms/.context/business/business-model.md`
- `upex-bunkai-tms/README.md`
- `upex-bunkai-tms/package.json`
- `upex-bunkai-tms/.agents/project.yaml`
- `upex-bunkai-tms/.env.example`
- `upex-bunkai-tms/supabase/migrations/0001_tenancy.sql`
- `upex-bunkai-tms/supabase/migrations/0002_projects_modules.sql`
- `upex-bunkai-tms/supabase/migrations/0003_authoring.sql`
- `upex-bunkai-tms/supabase/migrations/0004_atcs.sql`
- `upex-bunkai-tms/supabase/migrations/0024_tests.sql`
- `upex-bunkai-tms/supabase/migrations/0031_runs.sql`
- `upex-bunkai-tms/supabase/migrations/0046_bugs.sql`
- `upex-bunkai-tms/supabase/migrations/0064_milestones.sql`
- `upex-bunkai-tms/app/api/v1/` (directory listing)
- `upex-bunkai-tms/lib/` (directory listing + spot-read files named above)
- `upex-bunkai-tms/.context/ADR/ADR-0009-atc-edit-propagation-contract.md`
- `upex-bunkai-tms/.context/ADR/ADR-0010-realtime-transport-supabase-realtime.md`
