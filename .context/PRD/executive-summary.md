# Executive Summary — Bunkai TMS

> Target repo: `upex-bunkai-tms`. Discovery scope: Phase 2 — PRD, sub-step 1 (`/project-discovery`, run from `qa-engineering-bunkai`).
> Generated: 2026-08-17.
> **Mindset**: this document describes what the system DOES today, derived from source code and schema. Where the target repo's own `.context/PRD/executive-summary.md` and `business-model.md` make forward-looking or narrative claims not verifiable in code, that is flagged explicitly rather than restated as fact.

---

## 1. Problem Statement

### The Challenge

Bunkai positions itself against incumbent Test Management Systems — its own docs name Xray, Zephyr Scale, TestRail, and qTest — as tools that store test cases as free-form, duplicated step lists with traceability to requirements as an optional, rarely-filled free-text field.

> "Existing Test Management Systems ... are document vaults with execution glued on top. Their data model treats each test case as a monolithic blob of free-form steps stored in a folder."
> — `upex-bunkai-tms/.context/PRD/executive-summary.md` §1

This narrative framing (source: the target's own docs) is not independently verifiable against the named competitor products. What IS independently verifiable is Bunkai's own counter-design, enforced at the schema level:

- `atcs.user_story_id` is `not null references public.user_stories(id) on delete restrict` — an ATC (Acceptance Test Case) cannot exist without a User Story. Found in: `upex-bunkai-tms/supabase/migrations/0004_atcs.sql:57`.
- `atc_acceptance_criteria` is a mandatory join table (`atc_id`, `acceptance_criterion_id` both `not null`) binding every ATC to at least one Acceptance Criterion. Found in: `upex-bunkai-tms/supabase/migrations/0004_atcs.sql:389-393`. The application-layer minimum-1 guard is also independently confirmed at `upex-bunkai-tms/lib/atcs/validation.ts:41` (`acceptance_criterion_ids: z.array(z.string().uuid()).min(1)`) — this resolves a gap the Phase-1 `business-model.md` had flagged as unverified.
- `test_steps.atc_id` is `not null ... on delete restrict` — a Test is a chain of ATC *references*, not copied step text, so editing an ATC updates every Test that chains it. Found in: `upex-bunkai-tms/supabase/migrations/0024_tests.sql:65`.

### Current Alternatives

Not independently verifiable from this codebase (no competitor-product code to inspect). The target's own docs name Xray, Zephyr Scale, TestRail, and qTest as the alternatives QA teams currently use. **Discovery Gap** — see below.

---

## 2. Solution Overview

### Product Vision (one sentence)

Bunkai is a multi-tenant Test Management System whose data model makes test-to-requirement traceability structural (schema-enforced), not an optional convention, for QA teams authoring, chaining, executing, and triaging test work.

### Core Capabilities

| # | Feature | Problem Addressed | Evidence (route or component) |
|---|---|---|---|
| 1 | ATC authoring (reusable test-case library) | Duplicated, orphan test steps with no requirement link | `components/atcs/` (`AtcEditor.tsx`, `NewAtcEditor.tsx`, `StepEditor.tsx`), `app/(app)/projects/[projectSlug]/atcs/new/page.tsx`, `app/(app)/projects/[projectSlug]/atcs/[atcId]/page.tsx` |
| 2 | Test chain building (ordered ATC references) | "Edit once, every test updates" — vs. copy-pasted step blobs | `components/tests/`, `app/(app)/projects/[projectSlug]/tests/new/page.tsx`, `test_steps` table (`supabase/migrations/0024_tests.sql`) |
| 3 | Manual Run execution | Executing a Test and recording pass/fail/block per step | `components/runs/RunnerView.tsx`, `app/(app)/projects/[projectSlug]/runs/[runId]/page.tsx`, `app/api/v1/runs/[id]/steps/[stepId]/mark` |
| 4 | Native bug management, anchored to Module/Run/ATC | Bug context normally escapes to Jira, losing which ATC/run surfaced it | `components/bugs/`, `app/(app)/projects/[projectSlug]/bugs/page.tsx`, `app/api/v1/bugs/`, `bugs` table (`supabase/migrations/0046_bugs.sql`) |
| 5 | Coverage / traceability / metrics reporting | "What does this sprint cover?" unanswerable without manual work | `lib/coverage/`, `lib/traceability/`, `lib/metrics/`, `app/(app)/projects/[projectSlug]/traceability/page.tsx`, `app/(app)/projects/[projectSlug]/metrics/page.tsx` |

Adjacent, evidenced but not in the top-5 (kept out per the 5-feature cap, still real and shipped): Milestone planning (`lib/milestones/`, `supabase/migrations/0064_milestones.sql`), Jira import (`lib/jira/import-runner.ts`, `app/api/v1/imports/`), Personal Access Tokens for headless/CI/agent callers (`lib/api/pat.ts`, `app/api/v1/tokens/`), in-app notifications (`lib/notifications/`).

### Key Differentiators

- **Schema-enforced traceability, not UI convention.** The ATC → User Story FK and the ATC → Acceptance Criterion minimum-1 join are database constraints plus a Zod-level guard, not a form field a user can leave blank. Confidence: High — code-verified (see §1).
- **Three declared executor modes on one data model.** `runs.executor_mode` is `check (in ('human','agent','ci'))` — Found in: `upex-bunkai-tms/supabase/migrations/0031_runs.sql:81`. Only the `human` (manual runner UI) path was confirmed end-to-end in this discovery; `agent`/`ci` paths are schema-real but their UI/orchestration surface was not traced. Treat the "agent" and "ci" modes as a structural capability, not a fully-verified user-facing feature.
- **API-first / PAT-based headless access.** OpenAPI is generated from the same Zod schemas that validate requests (`lib/openapi/registry.ts`), and Personal Access Tokens carry fine-grained scopes (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`) — Found in: `lib/api/pat.ts:12-18`. This is a real, shipped mechanism (not marketing copy): migration `0033_remediate_bk135_admin_scope.sql` documents a since-fixed privilege-escalation bug in this exact path, which is itself evidence the mechanism is live and exercised.

---

## 3. Success Metrics

### Tracked Metrics

**None found.** No analytics/telemetry SDK call site was located in `upex-bunkai-tms` (`package.json` has no Sentry, PostHog, or equivalent dependency — corroborated by Phase 1's `project-config.md` §Infrastructure). Any metric below is therefore Inferred, not Tracked.

### Inferred KPIs (from features and the target's own MVP doc, not from real tracking)

| Metric | Type | Source |
|---|---|---|
| Workspace activation: ≥1 Module + ≥1 ATC + ≥1 Test + ≥1 Run in first 24h | Adoption | `upex-bunkai-tms/.context/PRD/executive-summary.md` §3 (target's own MVP target table — narrative, not measured in code) |
| Avg ATCs created per active workspace in week 1 | Engagement | same source |
| Tests-per-ATC reuse ratio at day 30 | Engagement | same source; structurally plausible given `test_steps.atc_id` allows repeat references (`upex-bunkai-tms/supabase/migrations/0024_tests.sql:60-68`) |
| % of ATCs anchored to a US + AC | Structural correctness | Same source, but this one IS schema-guaranteed at 100% by construction (§1) — the only "metric" in this table with a code-level backstop |

### Unknown Metrics

- Actual usage numbers (workspace count, ATC count, run frequency) — no telemetry, no dashboard export available to this read-only discovery.
- Whether any of the Inferred KPIs above are computed anywhere in the running product (e.g. an admin analytics view) — not found in the route tree (`app/(app)/` has no `/admin` or `/analytics` route).

---

## 4. Target Users (brief)

Full personas in `user-personas.md`. System roles are enforced via `workspace_members.role` — Found in: `upex-bunkai-tms/supabase/migrations/0001_tenancy.sql:43-44` (`check (role in ('viewer','member','admin','owner'))`).

| System Role | Need | Evidence |
|---|---|---|
| `viewer` | Read/browse ATCs, Tests, Runs, Bugs, Metrics without changing them | RLS SELECT-only policies, e.g. `atcs_select_workspace_member` (`supabase/migrations/0005_rls_helpers.sql:346`); UI gate `canEdit = ['member','admin','owner'].includes(role)` (`app/(app)/projects/[projectSlug]/milestones/[milestoneId]/page.tsx:54`) |
| `member` | Author and execute the day-to-day QA work: create/edit Modules, User Stories, ATCs, Tests, run Tests, file Bugs | `bunkai_can_write_workspace()` grants write when `role in ('member','admin','owner')` (`supabase/migrations/0005_rls_helpers.sql:35-50`) |
| `admin` | Everything `member` can do, plus manage workspace membership (invite/remove members, change roles) | `workspace_members_insert_admin` / `_update_admin` / `_delete_admin` policies require `role in ('admin','owner')` (`supabase/migrations/0001_tenancy.sql:134-145`) |
| `owner` | Everything `admin` can do, plus update/delete the Workspace itself | `workspaces_update_owner` / `workspaces_delete_owner` require `role = 'owner'` (`supabase/migrations/0001_tenancy.sql:111-128`) |

A fifth, non-human actor class exists structurally: headless callers authenticated via Personal Access Token, scoped by `atc:read` / `atc:write` / `run:execute` / `workspace:admin` (`lib/api/pat.ts:12-18`) and corresponding to `runs.executor_mode in ('agent','ci')`. See `user-personas.md` for how this is documented as a persona.

---

## 5. Product Scope

### What's Included (current, code-verified capabilities)

- Multi-tenant Workspace → Project → Module (depth ≤ 6) hierarchy, RLS-isolated per workspace.
- User Story + Acceptance Criterion authoring, with optional Jira `external_id`/`external_url` linkage.
- ATC authoring (steps + assertions), mandatorily anchored to a User Story and ≥1 Acceptance Criterion.
- Test chain building (ordered ATC references, repeats allowed).
- Manual Run execution (step-by-step marking, evidence, in-place bug reporting) against a named Project Environment.
- Native Bug tracking (`open → in_progress → resolved/closed`), optionally provenance-linked to Run/Run Step/ATC.
- Milestone planning (target-dated project checkpoints).
- Jira import (`lib/jira/import-runner.ts`).
- REST API (`app/api/v1/*`) + generated OpenAPI spec + Personal Access Token auth for headless/CI/agent callers.
- In-app notifications with Realtime (Supabase Realtime) push.

### What's Not Included (confirmed absent, not merely undocumented)

- Billing/subscription enforcement: `workspaces.plan` (`community`\|`cloud`\|`enterprise`) is modeled in schema but no billing code or plan-gating logic was found anywhere in this discovery pass.
- Automated/CI Run *ingestion* UI: `runs.executor_mode` allows `'ci'` at the schema level, but no results-import adapter (JUnit/Playwright/Cypress) was found in the route tree or `lib/`.
- SSO/SAML, audit log, granular role hierarchy beyond the 4-value `workspace_members.role` enum.
- Self-hosted/Docker Compose distribution — the repo runs on a single shared Supabase project across local/staging/production (Phase 1 finding).

### Future Indicators (named in the target's own docs as roadmap, not shipped)

- Mind-map/graph view of relationships, 3D toggle — `upex-bunkai-tms/.context/PRD/executive-summary.md` §5 "Non-goals for MVP".
- Semantic search of ATCs (pgvector), automated-execution import adapters, SSO/SAML/audit/role-hierarchy, self-hosted distribution — same source, same section.
- Four `soon`-tagged sidebar nav entries (ATC Library, Test Runs, Bug Reports, Metrics as *workspace-wide* aggregates) are rendered disabled in the live UI — Found in: `components/layout/AppSidebar.tsx:170-173` (`href: null` + `aria-disabled` + "Coming soon" title). Note these same capabilities DO exist project-scoped (`ProjectSubNav` in `project-sub-nav.tsx`) — only the workspace-wide rollup is unbuilt.

---

## 6. Discovery Gaps

| Gap | Impact | Suggested Source |
|---|---|---|
| No independent verification of the "document vault" framing against Xray/Zephyr/TestRail/qTest | Competitive-positioning claims in this doc are narrative, not code-verified | Product/market research, not this codebase |
| No analytics/telemetry SDK found — all Success Metrics are inferred, not measured | Cannot confirm actual adoption/engagement against the stated targets | Confirm whether metrics are computed via direct DB query/BI tool outside this repo |
| `agent`/`ci` executor modes are schema-real but their end-to-end UI/API flow was not traced | Risk of describing an unbuilt flow as shipped if assumed from the enum alone | Dedicated Phase-3 pass through `app/api/v1/runs` + `lib/runs/` for non-`human` executor paths |
| Billing/plan enforcement status | `workspaces.plan` exists but gating logic location (if any) unconfirmed | Deeper pass through `app/(app)/settings/` and any Stripe-adjacent code |

---

## 7. QA Relevance

### Critical Testing Areas

- **Structural anchoring chain** (ATC → User Story → Acceptance Criterion, `on delete restrict`): deletion-order and orphan-prevention testing is a first-class negative-test surface, not a one-off edge case.
- **Cross-workspace RLS isolation**: every table observed enforces RLS via workspace membership; the target repo's own `*-isolation.test.ts` naming convention across `lib/bugs/`, `lib/runs/`, etc. shows the team already treats this as a distinct, high-value test category.
- **Role-gated mutation paths**: `viewer` vs `member`+ vs `admin`+ vs `owner`-only actions (see §4 table) are each a distinct authorization boundary to verify, both via RLS-direct and via the UI's own `canEdit` gates.
- **Run/Bug state machines**: `runs.status` (`running`→`passed`/`failed`/`aborted`) and `bugs.status` (`open`→`in_progress`→`resolved`→`closed`) are the two confirmed state machines — both are State-Transition/BVA technique triggers.

### Risk Areas

- PAT scope enforcement: `workspace:admin` scope had a documented privilege-escalation bug (BK-135, remediated in `supabase/migrations/0033_remediate_bk135_admin_scope.sql`). Regression coverage on token-issuance role-gating is high-value given this history.
- Milestone target-date validation is deliberately write-time-only (not a standing CHECK constraint) — a subtle business rule (BR-5 in Phase 1's `domain-glossary.md`) worth a dedicated edit-without-date-change test.
- `agent`/`ci` executor modes: unverified end-to-end, so any test plan assuming a working non-human Run flow should first confirm the flow exists before writing test cases against it.

---

## 8. Document References

| Document | Status |
|---|---|
| `.context/PRD/user-personas.md` | Produced this session (Phase 2 PRD sub-step 2) |
| `.context/PRD/user-journeys.md` | Produced this session (Phase 2 PRD sub-step 3) |
| `.context/business/business-feature-map.md` | Not produced this session — out of scope per this task's instructions; owned by the `/business-feature-map` command |
| `.context/business/business-model.md` (this repo, Phase 1) | Prerequisite, read for continuity |
| `.context/business/domain-glossary.md` (this repo, Phase 1) | Prerequisite, read for continuity |
| `.context/project-config.md` (this repo, Phase 1) | Prerequisite, read for continuity |
| `upex-bunkai-tms/.context/PRD/executive-summary.md` | Target repo's own doc — used as accelerant, cross-checked against code where possible, flagged where narrative-only |
