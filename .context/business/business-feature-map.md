# Business Feature Map — Bunkai (discovered)

> Target repo: `upex-bunkai-tms` (read-only — nothing in that repo was modified to produce this document).
> Mode: **CREATE** — this file did not exist prior to this pass.
> Sources: `app/(app)/**` + `app/(auth)/**` route tree, `app/api/v1/**` route handlers (verified per-file via `export const GET|POST|PATCH|PUT|DELETE`, not assumed from directory names), `app/qa/**`, `package.json`, `.env.example`, `components/layout/AppSidebar.tsx`, cross-checked against `.context/business/business-data-map.md`, `.context/business/domain-glossary.md`, `.context/business/business-model.md`, `.context/PRD/executive-summary.md`, `.context/PRD/user-journeys.md` (all in this repo, generated earlier this session).
> Terminology follows `domain-glossary.md` exactly — Workspace, Project, Module, User Story, Acceptance Criterion (AC), ATC (Acceptance Test Case), Test, Run, Bug, Milestone, Project Environment, Personal Access Token (PAT). No synonyms invented.
> Endpoint-level request/response detail is intentionally kept terse here — full endpoint documentation is owned by the concurrently-generated `.context/business/business-api-map.md`. This document's job is the feature/capability layer: what a user or system can **do**.
> Generated: 2026-08-17.

---

## 1. Inventory summary

| Category  | Features | Status                                                    |
|-----------|----------|------------------------------------------------------------|
| Core      | 12       | Stable — primary US→AC→ATC→Test→Run→Bug traceability chain |
| Secondary | 7        | Stable — supporting/administrative capabilities             |
| Beta      | 0        | —                                                           |
| Planned   | 2        | Rendered disabled in UI ("soon") — see §7                  |

21 features cataloged. No feature flags (env-var gated) were found in the codebase (see §7) — the only "planned but visible" surface is the sidebar's 4 disabled nav items, of which 2 correspond to features already live at the project scope (counted once, under Core) and 2 have no working scope at all today (counted as Planned).

---

## 2. Feature catalog by domain

### Domain: Authentication & Session

#### Feature: Account Sign-up / Sign-in

| Aspect | Value |
|---|---|
| **ID** | FEAT-001 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/auth/signup`, `POST /api/v1/auth/signin`, `POST /api/v1/auth/magic-link`, `POST /api/v1/auth/confirm`, `POST /api/v1/auth/resend`, `POST /api/v1/auth/check-email` |
| **UI** | `/login` (`app/(auth)/login/page.tsx`), `/auth/callback`, `/auth/oauth/[provider]` |
| **Users** | Anonymous visitor -> authenticated user |
| **Dependencies** | Supabase Auth (password + OTP/magic-link + OAuth + cookie session) |
| **Evidence** | `app/api/v1/auth/*/route.ts`, `app/qa/page.tsx:8` (`auth-method=supabase-password+otp+cookie+bearer-pat`) |

**Capabilities:**
- [x] Email+password sign-up/sign-in
- [x] Magic-link (OTP) sign-in
- [x] OAuth provider callback route exists (`/auth/oauth/[provider]`) — provider(s) not enumerated in this pass
- [x] Email confirmation + resend-confirmation
- [x] Pre-flight check-email (duplicate-account probe)
- [ ] 2FA/MFA — none found (`user-journeys.md` §9 Discovery Gaps)

#### Feature: Bearer/PAT Authentication for Headless Callers

| Aspect | Value |
|---|---|
| **ID** | FEAT-002 |
| **Status** | Stable |
| **Endpoints** | N/A (cross-cutting — every `/api/v1/*` route accepts a PAT bearer token as an alternative to the cookie session) |
| **UI** | `/settings/tokens` |
| **Users** | CLI/CI/AI-agent callers; any workspace member issuing their own token |
| **Dependencies** | `access_tokens` + `access_token_secrets` tables |
| **Evidence** | `lib/api/pat.ts`, `app/qa/page.tsx:8` |

**Capabilities:**
- [x] Explicit-actor auth path for non-interactive callers (`p_actor_user_id`, since PAT calls carry no Supabase JWT — see `business-data-map.md` §4.5)
- [x] Scope-checked authorization (`atc:read`/`atc:write`/`run:execute`/`workspace:admin`)
- [ ] Not independently re-verified in this pass whether every route enforces scope checks uniformly — cross-check against `business-api-map.md`

---

### Domain: Workspace & Team Management

#### Feature: Workspace Lifecycle

| Aspect | Value |
|---|---|
| **ID** | FEAT-003 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/workspaces`, `GET /api/v1/workspaces`, `GET /api/v1/workspaces/[id]`, `PATCH /api/v1/workspaces/[id]` |
| **UI** | `/onboarding` (create), `/settings/workspaces` (rename), `/projects` (switch/list) |
| **Users** | Any signed-in user (create); `owner` (rename/delete) |
| **Dependencies** | `workspaces` table, `bunkai_bootstrap_workspace` RPC |
| **Evidence** | `app/api/v1/workspaces/route.ts:53,98`, `app/api/v1/workspaces/[id]/route.ts:17,41`, `app/(app)/onboarding/page.tsx` |

**Capabilities:**
- [x] Create (atomically seeds the creator as `owner` — `business-data-map.md` §2.1)
- [x] Read (list + detail)
- [x] Update (rename)
- [ ] Delete — **no `DELETE /api/v1/workspaces/[id]` route was found in this pass**, despite `workspaces_delete_owner` RLS policy existing in schema (`business-data-map.md` §2.1). Discovery gap — see §9.

#### Feature: Workspace Membership & Roles

| Aspect | Value |
|---|---|
| **ID** | FEAT-004 |
| **Status** | Stable |
| **Endpoints** | `DELETE /api/v1/workspaces/[id]/membership` (leave/remove) |
| **UI** | `/workspaces/[id]/members` |
| **Users** | `admin`/`owner` (manage others' roles); any member (leave own membership) |
| **Dependencies** | `workspace_members` table, 4-value role enum (`viewer`/`member`/`admin`/`owner`) |
| **Evidence** | `app/api/v1/workspaces/[id]/membership/route.ts:22`, `lib/account/workspaces.ts:91` (`isSoleOwner` guard), `business-data-map.md` §2.2 (`bunkai_leave_workspace`) |

**Capabilities:**
- [x] Self-service leave, blocked when it is the caller's last active membership or they are the sole active owner (`45212`/`45213`)
- [x] Sole-owner-cannot-leave guard surfaced in UI (`isSoleOwner`)
- [ ] Dedicated role-change (re-role a member) endpoint not independently located in this pass — likely folds into a members-list route not enumerated here; flag for `business-api-map.md` cross-check

#### Feature: Workspace Invites

| Aspect | Value |
|---|---|
| **ID** | FEAT-005 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/workspaces/[id]/invites`, `GET /api/v1/workspaces/[id]/invites`, `POST /api/v1/workspaces/[id]/invites/[inviteId]`, `DELETE /api/v1/workspaces/[id]/invites/[inviteId]`, `POST /api/v1/invites/accept` |
| **UI** | `/workspaces/[id]/members`, `/invites/accept` |
| **Users** | `admin`/`owner` (issue/revoke); invitee (accept, no auth required to land on the page — auth happens at accept) |
| **Dependencies** | `workspace_invites` + `workspace_invite_secrets` (SHA-256 token hash, split table for `qa_inspector_ro` isolation) |
| **Evidence** | `app/api/v1/workspaces/[id]/invites/route.ts:23,163`, `app/api/v1/workspaces/[id]/invites/[inviteId]/route.ts:18,71`, `app/api/v1/invites/accept/route.ts:21`, `user-journeys.md` §5 |

**Capabilities:**
- [x] Issue (email + role, never `owner`)
- [x] List pending invites
- [x] Accept (token-redeem, creates `workspace_members` row)
- [x] Revoke
- [ ] Exact expiry/already-accepted error copy not traced (`user-journeys.md` §9 Discovery Gap)

---

### Domain: Access Control (headless)

#### Feature: Personal Access Token (PAT) Management

| Aspect | Value |
|---|---|
| **ID** | FEAT-006 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/tokens`, `GET /api/v1/tokens`, `DELETE /api/v1/tokens/[id]` |
| **UI** | `/settings/tokens` |
| **Users** | Any member (own tokens, global or workspace-scoped); `admin`/`owner` only for `workspace:admin`-scoped tokens |
| **Dependencies** | `access_tokens` / `access_token_secrets` |
| **Evidence** | `app/api/v1/tokens/route.ts:32,111`, `app/api/v1/tokens/[id]/route.ts:17`, `lib/api/pat.ts:86` ("Only workspace admins or owners can issue workspace:admin tokens.") |

**Capabilities:**
- [x] Issue (raw secret shown once; scoped `atc:read`/`atc:write`/`run:execute`/`workspace:admin`)
- [x] List (own tokens)
- [x] Revoke — HTTP `DELETE`, implemented as a soft-revoke (`revoked_at`) per schema, not a physical row delete (`business-data-map.md` §2.9)
- [x] Privilege-escalation history: BK-135 (`0033_remediate_bk135_admin_scope.sql`) — remediated, high regression-test priority (see §8)

---

### Domain: Project Management

#### Feature: Project Lifecycle

| Aspect | Value |
|---|---|
| **ID** | FEAT-007 |
| **Status** | Stable (Create/Read); **Update/Delete not located — see gap** |
| **Endpoints** | `POST /api/v1/workspaces/[id]/projects`, `GET /api/v1/workspaces/[id]/recent-projects` |
| **UI** | `/projects`, `/projects/new`, `/projects/[projectSlug]` |
| **Users** | Any active member (read); `member`+ (create, per RLS) |
| **Dependencies** | `projects` table |
| **Evidence** | `app/api/v1/workspaces/[id]/projects/route.ts:24`, `app/api/v1/workspaces/[id]/recent-projects/route.ts:40` |

**Capabilities:**
- [x] Create
- [x] Read via a **"recent projects"** endpoint only — **no root `GET /api/v1/projects` or `GET /api/v1/projects/[id]` route was found in this pass** (confirmed absent: `app/api/v1/projects/` contains only the `[id]/*` subresource routes below, no `route.ts` at the `[id]` level either). How the `/projects` list page and `/projects/[projectSlug]` detail page actually fetch full project data was not traced to a specific endpoint — flag for `business-api-map.md`.
- [ ] Update (rename/edit description) — no route found
- [ ] Delete/archive — no route found

#### Feature: Project Environments

| Aspect | Value |
|---|---|
| **ID** | FEAT-008 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/projects/[id]/environments`, `POST /api/v1/projects/[id]/environments`, `PATCH /api/v1/environments/[id]`, `DELETE /api/v1/environments/[id]` |
| **UI** | Environment selector inside the Run-start flow (`/projects/[projectSlug]/tests/[testId]` -> start Run); no dedicated environments-management page was found in the route tree |
| **Users** | `member`+ write; any member reads |
| **Dependencies** | `project_environments` table |
| **Evidence** | `app/api/v1/projects/[id]/environments/route.ts:19,42`, `app/api/v1/environments/[id]/route.ts:21,47` |

**Capabilities:**
- [x] Create, Read, Rename, Delete (delete blocked while any Run still references it — `45211 environment_in_use`, `business-data-map.md` §2.12)
- [x] Seeded with `Staging`+`Production` per project at creation time
- [ ] No dedicated UI management page located — capability appears API-only or embedded inline; flag for Phase 3 verification

#### Feature: Module Tree (Feature-area authoring structure)

| Aspect | Value |
|---|---|
| **ID** | FEAT-009 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/projects/[id]/modules`, `PATCH /api/v1/modules/[id]`, `DELETE /api/v1/modules/[id]` |
| **UI** | Module tree nav inside `/projects/[projectSlug]` (project shell sidebar) |
| **Users** | `member`+ write; any member reads |
| **Dependencies** | `modules` table (self-referential, depth <= 6, materialized `path`) |
| **Evidence** | `app/api/v1/projects/[id]/modules/route.ts:34`, `app/api/v1/modules/[id]/route.ts:37,150` |

**Capabilities:**
- [x] Create (root or nested, depth <= 6 enforced)
- [x] Rename/move (`bunkai_update_module`/`bunkai_move_module` — rebuilds descendant paths atomically)
- [x] Archive/cascade-delete subtree (`bunkai_archive_module_subtree`) — DELETE HTTP verb maps to soft-delete, not physical removal
- [ ] No dedicated `GET /api/v1/modules/[id]` single-module read route found — likely read as part of the project tree payload; not independently confirmed
- [ ] Known edge-case gap inherited from schema: recursive archive walk can strand a live descendant under an archived ancestor in rare cases (`business-data-map.md` §2.5, "Known gap")

---

### Domain: Requirements Authoring

#### Feature: User Story Authoring

| Aspect | Value |
|---|---|
| **ID** | FEAT-010 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/modules/[id]/user-stories`, `GET /api/v1/modules/[id]/user-stories`, `GET /api/v1/user-stories/[id]`, `PATCH /api/v1/user-stories/[id]`, `DELETE /api/v1/user-stories/[id]` |
| **UI** | Story authoring inside `/projects/[projectSlug]` (module drill-down) |
| **Users** | `member`+ write; any member reads |
| **Dependencies** | `user_stories` table; optional Jira `external_id`/`external_url` provenance |
| **Evidence** | `app/api/v1/modules/[id]/user-stories/route.ts:27,96`, `app/api/v1/user-stories/[id]/route.ts:29,53,200`, `user-journeys.md` §3 |

**Capabilities:**
- [x] Full CRUD
- [x] `draft` -> `ready_to_test` status gate, requires >=1 active Acceptance Criterion (`45010 ac_required_for_ready_to_test`)
- [x] Jira import provenance fields (`external_id`/`external_url`) — see FEAT-018

#### Feature: Acceptance Criteria Authoring

| Aspect | Value |
|---|---|
| **ID** | FEAT-011 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/user-stories/[id]/acceptance-criteria`, `GET /api/v1/user-stories/[id]/acceptance-criteria`, `GET /api/v1/acceptance-criteria/[id]`, `PATCH /api/v1/acceptance-criteria/[id]`, `DELETE /api/v1/acceptance-criteria/[id]` |
| **UI** | Nested inside the User Story authoring surface |
| **Users** | `member`+ write; any member reads |
| **Dependencies** | `acceptance_criteria` table, ordered per Story |
| **Evidence** | `app/api/v1/user-stories/[id]/acceptance-criteria/route.ts:30,95`, `app/api/v1/acceptance-criteria/[id]/route.ts:30,54,149` |

**Capabilities:**
- [x] Full CRUD, collision-free reordering ("negative-parking" position rebalance, `business-data-map.md` §2.7)
- [x] Archiving the last active AC auto-reverts the parent Story to `draft`

---

### Domain: Test Case Authoring (core differentiator)

#### Feature: ATC (Acceptance Test Case) Authoring

| Aspect | Value |
|---|---|
| **ID** | FEAT-012 |
| **Status** | Stable — **the product's structural differentiator** (`business-model.md` §1/§4) |
| **Endpoints** | `POST /api/v1/atcs`, `PATCH /api/v1/atcs/[id]`, `POST /api/v1/atcs/[id]/duplicate`, `GET /api/v1/atcs/search`, `GET /api/v1/atcs/[id]/usage` |
| **UI** | `/projects/[projectSlug]/atcs/new`, `/projects/[projectSlug]/atcs/[atcId]` |
| **Users** | `member`+ write; any member reads |
| **Dependencies** | `atcs` + `atc_steps` + `atc_assertions` + `atc_acceptance_criteria` (M:N) |
| **Evidence** | `app/api/v1/atcs/route.ts:16`, `app/api/v1/atcs/[id]/route.ts:30`, `app/api/v1/atcs/[id]/duplicate/route.ts:17`, `app/api/v1/atcs/search/route.ts:22`, `app/api/v1/atcs/[id]/usage/route.ts:17`, `lib/atcs/validation.ts:39,41` |

**Capabilities:**
- [x] Create/edit, mandatorily anchored to exactly 1 User Story + >=1 Acceptance Criterion (Zod `min(1)` client-side, RPC backstop server-side per BR-2)
- [x] Optimistic-lock edit (`version`, `If-Match`, `45022 version_conflict`)
- [x] Duplicate (deep-copy steps/assertions/AC-bindings into a new ATC + new slug)
- [x] Full-text search (`bunkai_search_atcs`, restricted to caller's own memberships)
- [x] "Used in N Tests" usage report
- [x] `layer` classification (`UI`/`API`/`Unit`), `tags[]` (capped)
- [ ] **No dedicated `GET /api/v1/atcs/[id]` single-ATC read route was found in this pass** — the ATC detail page likely fetches via a different mechanism (server component direct query, or a route not matched by the grep pattern used). Flag for `business-api-map.md` cross-check.
- [ ] No standalone archive/delete route found for a single ATC outside of the module-cascade archive path (FEAT-009) — not confirmed whether an ATC can be individually archived.

#### Feature: Test Chain Building

| Aspect | Value |
|---|---|
| **ID** | FEAT-013 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/tests`, `GET /api/v1/tests`, `GET /api/v1/tests/[id]`, `PATCH /api/v1/tests/[id]/reorder`, `PUT /api/v1/tests/[id]/tags`, `GET /api/v1/tests/[id]/runs` |
| **UI** | `/projects/[projectSlug]/tests/new`, `/projects/[projectSlug]/tests/[testId]` |
| **Users** | `member`+ write (workspace-scoped, not project-scoped — a Test's chain may reference ATCs across Projects in the same Workspace); any member reads |
| **Dependencies** | `tests` + `test_steps` (ordered ATC-reference chain, repeats allowed) |
| **Evidence** | `app/api/v1/tests/route.ts:27,48`, `app/api/v1/tests/[id]/route.ts:18`, `app/api/v1/tests/[id]/reorder/route.ts:24`, `app/api/v1/tests/[id]/tags/route.ts:25`, `app/api/v1/tests/[id]/runs/route.ts:36` |

**Capabilities:**
- [x] Create (>=1 ATC required, `45120`), all ATCs must resolve inside the caller's workspace (`45122`, non-disclosing)
- [x] Reorder chain positions (optimistic-locked, no-op short-circuit)
- [x] Tag management (reserved tags `smoke`/`sanity`/`regression` lowercased; commas rejected)
- [x] Per-Test Run history
- [ ] No delete/archive route found for a Test

---

### Domain: Test Execution

#### Feature: Manual Run Execution

| Aspect | Value |
|---|---|
| **ID** | FEAT-014 |
| **Status** | Stable — human executor mode confirmed end-to-end; `agent`/`ci` executor modes are schema-real but their UI/orchestration path was not traced (see §7 Planned) |
| **Endpoints** | `POST /api/v1/runs`, `GET /api/v1/runs/[id]`, `POST /api/v1/runs/[id]/abort`, `POST /api/v1/runs/[id]/finish`, `POST /api/v1/runs/[id]/steps/[stepId]/mark` |
| **UI** | `/projects/[projectSlug]/runs/[runId]` (`RunnerView.tsx`), `/projects/[projectSlug]/runs`, `/projects/[projectSlug]/tests/[testId]/runs` |
| **Users** | `member`+ (start/mark/finish/abort); any member reads |
| **Dependencies** | `runs` + `run_atcs` + `run_steps` (snapshot semantics — ADR-0004); `project_environments` |
| **Evidence** | `app/api/v1/runs/route.ts:55`, `app/api/v1/runs/[id]/route.ts:16`, `app/api/v1/runs/[id]/abort/route.ts:23`, `app/api/v1/runs/[id]/finish/route.ts:21`, `app/api/v1/runs/[id]/steps/[stepId]/mark/route.ts:20`, `user-journeys.md` §4 |

**Capabilities:**
- [x] Start a Run against a Project Environment (snapshots the chain at start; 24h idempotency replay guard)
- [x] Mark step pass/fail/blocked/skipped (never re-markable to `pending`); parent position status recomputed from full sibling set each time
- [x] Finish (verdict `passed`/`failed`, caller-chosen) or Abort (reason 3-500 chars required)
- [x] Three declared `executor_mode` values in schema (`human`/`agent`/`ci`) — only `human` has a confirmed UI path
- [x] "Editing a Test does not retroactively alter an in-flight/completed Run" — documented as correct behavior (ADR-0004)
- [ ] `agent`/`ci` Run creation — schema-real, no dedicated UI found; likely API-only via PAT (`user-journeys.md` §9)

#### Feature: In-Run Bug Reporting

| Aspect | Value |
|---|---|
| **ID** | FEAT-015 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/bugs` (also reachable from within the Runner UI, provenance-linked) |
| **UI** | Inline "Report Bug" action inside `RunnerView.tsx` on a fail/blocked step |
| **Users** | `member`+ |
| **Dependencies** | `bugs` table, provenance FKs to `runs`/`run_steps`/`atcs` (all `on delete set null`) |
| **Evidence** | `lib/runs/report-bug-view.ts`, `app/api/v1/bugs/route.ts:88`, `user-journeys.md` §4 step 4 |

**Capabilities:**
- [x] File a Bug without leaving the Runner, auto-populating `run_id`/`run_step_id`/`atc_id`/`module_id`
- [x] Cross-project provenance-injection rejected (`45305`-`45307`, BR-4)

---

### Domain: Defect Management

#### Feature: Bug / Defect Tracking

| Aspect | Value |
|---|---|
| **ID** | FEAT-016 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/bugs`, `GET /api/v1/bugs`, `GET /api/v1/projects/[id]/bugs`, `POST /api/v1/bugs/[id]/status`, `POST /api/v1/bugs/[id]/assign`, `GET /api/v1/projects/[id]/bugs/heatmap` |
| **UI** | `/projects/[projectSlug]/bugs` |
| **Users** | `member`+ (file/triage); any member reads |
| **Dependencies** | `bugs` table |
| **Evidence** | `app/api/v1/bugs/route.ts:88,232`, `app/api/v1/bugs/[id]/status/route.ts:57`, `app/api/v1/bugs/[id]/assign/route.ts:51`, `app/api/v1/projects/[id]/bugs/route.ts:25`, `app/api/v1/projects/[id]/bugs/heatmap/route.ts:33` |

**Capabilities:**
- [x] Standalone or Run-provenance filing (`module_id` always mandatory)
- [x] Status transitions strictly forward, one stage at a time: `open -> in_progress -> resolved -> closed` (`45310`/`45311`, two-layer enforcement)
- [x] Assignment, gated to active non-`viewer` members (`45312`/`45313`)
- [x] Severity (`P1`-`P4`), defect-heatmap aggregate report
- [ ] **No dedicated `GET/PATCH/DELETE /api/v1/bugs/[id]` single-bug route was found** — full-record edit (title/description/severity outside status/assignee) and delete were not located as endpoints in this pass. Flag for `business-api-map.md`.

---

### Domain: Planning

#### Feature: Milestone Planning

| Aspect | Value |
|---|---|
| **ID** | FEAT-017 |
| **Status** | Stable (no delete by design) |
| **Endpoints** | `POST /api/v1/projects/[id]/milestones`, `GET /api/v1/projects/[id]/milestones`, `PATCH /api/v1/milestones/[id]` |
| **UI** | `/projects/[projectSlug]/milestones`, `/projects/[projectSlug]/milestones/[milestoneId]` |
| **Users** | `member`+ write (UI `canEdit` gate confirmed at `milestones/[milestoneId]/page.tsx:54`); any member reads |
| **Dependencies** | `milestones` table |
| **Evidence** | `app/api/v1/projects/[id]/milestones/route.ts:20,46`, `app/api/v1/milestones/[id]/route.ts:21` |

**Capabilities:**
- [x] Create/Read/Update (target-date bound checked write-time-only, per BR-5 — deliberately not a standing CHECK)
- [x] No delete — "out of scope by design," same default-deny-on-writes precedent as Project Environments (`business-data-map.md` §2.15)

---

### Domain: External Integrations

#### Feature: Jira Import

| Aspect | Value |
|---|---|
| **ID** | FEAT-018 |
| **Status** | Stable |
| **Endpoints** | `POST /api/v1/imports`, `GET /api/v1/imports/[id]` |
| **UI** | Not independently located in the route tree in this pass — likely embedded in a project settings/import panel not enumerated |
| **Users** | `member`+ |
| **Dependencies** | `import_jobs` table, `lib/jira/*` (client, ADF-to-markdown, AC extraction), async worker (Vercel `after()` background task per `business-data-map.md` §2.17) |
| **Evidence** | `app/api/v1/imports/route.ts:20`, `app/api/v1/imports/[id]/route.ts:11`, `lib/jira/import-runner.ts` |

**Capabilities:**
- [x] Enqueue a JQL-driven import job (max 1 active per project — `409 import_in_progress`)
- [x] Poll job status/counts (`imported`/`created`/`updated`/`skipped`, `errors[]`)
- [x] User Stories carry `external_id`/`external_url` provenance from Jira
- [ ] No third-party Jira SDK dependency in `package.json` — the client is a hand-rolled REST wrapper (`lib/jira/client.ts`); not independently read in this pass
- [ ] Import-triggering UI page not located — Discovery Gap

---

### Domain: Insight & Reporting

#### Feature: Traceability & Coverage Reporting

| Aspect | Value |
|---|---|
| **ID** | FEAT-019 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/projects/[id]/traceability`, `GET /api/v1/projects/[id]/coverage`, `GET /api/v1/workspaces/[id]/coverage` |
| **UI** | `/projects/[projectSlug]/traceability` |
| **Users** | Any active member |
| **Dependencies** | `bunkai_report_story_traceability` RPC (0068), reads across the full US->AC->ATC->Test->Run chain |
| **Evidence** | `app/api/v1/projects/[id]/traceability/route.ts:34`, `app/api/v1/projects/[id]/coverage/route.ts:21`, `app/api/v1/workspaces/[id]/coverage/route.ts:44` |

**Capabilities:**
- [x] Project-level US<->AC<->ATC<->Test chain view with derived "state" (a 4th, display-only status grain — see `business-data-map.md` §3.1)
- [x] Project- and workspace-level coverage rollups
- [x] Known, closed defect in this exact surface: `DEFECT-BK-317` — the traceability view's derived `state` legitimately surfaces `'aborted'`, a value literal AC-01 of `STORY-BK-45` did not enumerate (Severity Low, no functional impact — see `business-data-map.md` §3.1)

#### Feature: Metrics Dashboards (Defect Heatmap, Recovery Cycle)

| Aspect | Value |
|---|---|
| **ID** | FEAT-020 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/projects/[id]/bugs/heatmap`, `GET /api/v1/projects/[id]/metrics/recovery-cycles`, `GET /api/v1/projects/[id]/runs/report` |
| **UI** | `/projects/[projectSlug]/metrics` |
| **Users** | Any active member |
| **Dependencies** | `lib/metrics/`, `lib/coverage/` |
| **Evidence** | `app/api/v1/projects/[id]/bugs/heatmap/route.ts:33`, `app/api/v1/projects/[id]/metrics/recovery-cycles/route.ts:29`, `app/api/v1/projects/[id]/runs/report/route.ts:52` |

**Capabilities:**
- [x] Defect heatmap (module x severity, presumed — not independently verified in this pass)
- [x] Recovery-cycle report (bug-fix turnaround)
- [x] Project-wide Run report (grouped by module via `runs.module_id` snapshot)
- [ ] No workspace-wide rollup of these three (only the 4 sidebar "soon" items — see §7) — project-scoped only today

---

### Domain: Notifications & Activity

#### Feature: In-App Notifications

| Aspect | Value |
|---|---|
| **ID** | FEAT-021 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/workspaces/[id]/notifications`, `POST /api/v1/notifications/[id]/read`, `POST /api/v1/workspaces/[id]/notifications/read-all`, `GET /api/v1/notification-preferences`, `PATCH /api/v1/notification-preferences` |
| **UI** | Notification inbox (bell icon, not independently traced to a dedicated route — likely a shell overlay), `/settings/notifications` |
| **Users** | Recipient only (own inbox); any member sets own preferences |
| **Dependencies** | `notifications`, `notification_preferences`, `activity_log`-driven producer triggers, Supabase Realtime push |
| **Evidence** | `app/api/v1/workspaces/[id]/notifications/route.ts:34`, `app/api/v1/notifications/[id]/read/route.ts:15`, `app/api/v1/workspaces/[id]/notifications/read-all/route.ts:16`, `app/api/v1/notification-preferences/route.ts:30,36`, `lib/notifications/realtime-notifications-channel.ts` |

**Capabilities:**
- [x] Run-lifecycle notifications (`run.finished`/`run.aborted`, recipient = the Run's starter, self-suppressed only for interactive same-actor completions)
- [x] Bug-lifecycle notifications (`bug.assigned`/`bug.reassigned`/`bug.status_changed`)
- [x] Mark-read (single + bulk)
- [x] Per-user, per-event-type, per-channel (`in_app`/`email`) preferences — `mentions` event type declared but structurally locked (future Team Chat epic)
- [x] Realtime push (Supabase Realtime, per ADR-0010)
- [ ] Actual email-channel delivery (Resend) not confirmed wired to notification events in this pass — `RESEND_API_KEY` exists only in `.env.example`, no Resend dependency in `package.json` (see §6)

This feature is **not** counted separately from the Notification Preferences settings surface — both share FEAT-021's ID as one capability with two entry points, per the `notifications`/`notification_preferences` 1:1 domain pairing in `business-data-map.md` §2.16.

#### Feature: Activity / Audit Log

| Aspect | Value |
|---|---|
| **ID** | FEAT-022 |
| **Status** | Stable (read-only surface) |
| **Endpoints** | `GET /api/v1/activity` |
| **UI** | `/activity` |
| **Users** | Any active member (workspace-scoped rows only; global rows hidden from regular users) |
| **Dependencies** | `activity_log` table — append-only, written exclusively by `SECURITY DEFINER` RPCs/triggers, no client INSERT/UPDATE/DELETE path |
| **Evidence** | `app/api/v1/activity/route.ts:33`, `app/(app)/activity/page.tsx` |

**Capabilities:**
- [x] Read own workspace's audit trail
- [x] Sole upstream source feeding both notification-producer triggers (FEAT-021)
- [ ] No client write path — by design, not a gap

---

### Domain: Personal Settings & Home

#### Feature: Account & Personal Settings

| Aspect | Value |
|---|---|
| **ID** | FEAT-023 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1/me`, `POST /api/v1/me/active-workspace` |
| **UI** | `/settings/account` |
| **Users** | Self only |
| **Dependencies** | `lib/account/`, `auth.users` |
| **Evidence** | `app/api/v1/me/route.ts:49`, `app/api/v1/me/active-workspace/route.ts:22` |

**Capabilities:**
- [x] Current-user identity/context read
- [x] Switch active workspace (multi-workspace membership support)
- [ ] Profile edit (name/avatar) not independently located as an endpoint

#### Feature: Home Dashboard

| Aspect | Value |
|---|---|
| **ID** | FEAT-024 |
| **Status** | Stable |
| **Endpoints** | (composed from `workspaces/[id]/recent-projects`, `workspaces/[id]/active-runs`, `workspaces/[id]/open-bugs`) |
| **UI** | `/home` |
| **Users** | Any active member |
| **Dependencies** | Indexed read models — `0059_home_recent_projects_indexes.sql`, `0060_home_active_runs_index.sql`, `0061_home_open_bugs_index.sql` per `business-data-map.md` §5.2 |
| **Evidence** | `app/api/v1/workspaces/[id]/recent-projects/route.ts:40`, `app/api/v1/workspaces/[id]/active-runs/route.ts:39`, `app/api/v1/workspaces/[id]/open-bugs/route.ts:39` |

**Capabilities:**
- [x] Recent Projects widget
- [x] Active Runs widget
- [x] Open Bugs widget

---

### Domain: Public / Developer-facing (unauthenticated)

#### Feature: API Reference Portal

| Aspect | Value |
|---|---|
| **ID** | FEAT-025 |
| **Status** | Stable |
| **Endpoints** | `GET /api/v1` (index), `GET /api/v1/health`, generated `/api/openapi` spec |
| **UI** | `/api/docs` (Scalar API Reference React UI) |
| **Users** | Public, unauthenticated |
| **Dependencies** | `@scalar/api-reference-react`, `@asteasolutions/zod-to-openapi` (spec generated from the same Zod schemas that validate requests) |
| **Evidence** | `app/api/v1/route.ts:12`, `app/api/v1/health/route.ts:6`, `lib/openapi/registry.ts`, `app/api/docs/` |

**Capabilities:**
- [x] Interactive OpenAPI reference
- [x] Health check endpoint

#### Feature: Software Testability Guide (`/qa`)

| Aspect | Value |
|---|---|
| **ID** | FEAT-026 |
| **Status** | Stable — a **public, unauthenticated teaching surface for QA/AI agents**, not a TMS product feature itself |
| **Endpoints** | N/A (static content page, references the live API) |
| **UI** | `/qa` |
| **Users** | Public — explicitly "no auth gate" (`app/qa/page.tsx:31`); credentials for trying it live are deliberately kept out of the page itself, pointed at a Jira Epic instead |
| **Dependencies** | none beyond the app itself |
| **Evidence** | `app/qa/page.tsx:1-35` (`qa-guide-snapshot` metadata block: `auth-method=supabase-password+otp+cookie+bearer-pat`, `docs-route=/api/docs`), `app/qa/_components/*`, `app/qa/qa-config.ts` |

**Capabilities:**
- [x] Renders request/response example cards (`RequestCards.tsx`), copy-paste agent code blocks (`AgentCodeBlock.tsx`), architecture diagram (`ArchDiagram.tsx`)
- [x] This is Bunkai's own onboarding surface for QA engineers/AI agents integrating against its API — conceptually adjacent to, but distinct from, this QA repo's own `/agentic-qa-onboard` skill (different product, same pattern)

This is counted under "Secondary" in §1, not "Core" — it teaches the product, it is not the product's own value-delivery surface.

---

## 3. CRUD matrix

Legend: ✅ Full · ⚠️ Partial/conditional · ❌ Not available (by design or unconfirmed — see notes)

| Entity | Create | Read | Update | Delete | Evidence |
|---|---|---|---|---|---|
| Workspace | ✅ | ✅ | ✅ | ❌ Not found — RLS policy exists, no API route located | `app/api/v1/workspaces/route.ts`, `[id]/route.ts` |
| WorkspaceMember | ✅ via invite-accept | ⚠️ Not independently located as a dedicated GET | ⚠️ Re-role endpoint not located | ✅ Leave/remove | `app/api/v1/workspaces/[id]/membership/route.ts` |
| WorkspaceInvite | ✅ | ✅ | ✅ Accept | ✅ Revoke | `app/api/v1/workspaces/[id]/invites*` |
| Project | ✅ | ⚠️ "Recent projects" only — no full list/detail route found | ❌ Not found | ❌ Not found | `app/api/v1/workspaces/[id]/projects`, `recent-projects` |
| Module | ✅ | ⚠️ No dedicated single-read route found | ✅ | ✅ Cascade soft-delete | `app/api/v1/projects/[id]/modules`, `modules/[id]` |
| User Story | ✅ | ✅ | ✅ | ✅ | `app/api/v1/modules/[id]/user-stories`, `user-stories/[id]` |
| Acceptance Criterion | ✅ | ✅ | ✅ | ✅ | `app/api/v1/user-stories/[id]/acceptance-criteria`, `acceptance-criteria/[id]` |
| ATC (+ steps/assertions) | ✅ | ⚠️ Search + usage found; no single-ATC GET route located | ✅ (optimistic-locked) | ⚠️ Only via module cascade — no standalone route found | `app/api/v1/atcs*` |
| Access Token (PAT) | ✅ | ✅ | ❌ N/A by design | ✅ Soft-revoke | `app/api/v1/tokens*` |
| Test (+ test_steps) | ✅ | ✅ | ⚠️ Reorder + tags only, no full edit route found | ❌ Not found | `app/api/v1/tests*` |
| Project Environment | ✅ | ✅ | ✅ | ✅ (blocked while in use) | `app/api/v1/projects/[id]/environments`, `environments/[id]` |
| Run (+ run_atcs/run_steps) | ✅ | ✅ | ⚠️ Mark/abort/finish only — snapshot immutability is by design | ❌ By design (permanent record) | `app/api/v1/runs*` |
| Bug | ✅ | ✅ List; ⚠️ no single-Bug GET route found | ⚠️ Status + assignee only — no full-edit route found | ❌ Not found | `app/api/v1/bugs*` |
| Milestone | ✅ | ✅ | ✅ | ❌ By design (no delete RPC exists) | `app/api/v1/projects/[id]/milestones`, `milestones/[id]` |
| Notification | ❌ System-produced only | ✅ | ⚠️ Mark-read only (single + bulk) | ❌ By design | `app/api/v1/workspaces/[id]/notifications*` |
| NotificationPreference | ✅ Upsert via PATCH | ✅ | ✅ | N/A | `app/api/v1/notification-preferences` |
| ImportJob | ✅ | ✅ | ❌ Worker-only | ❌ Not found | `app/api/v1/imports*` |
| ActivityLog | ❌ System-produced only | ✅ | ❌ By design | ❌ By design | `app/api/v1/activity` |

**Cross-reference with `business-data-map.md`**: all 31 tables inventoried there resolve into the 18 primary rows above (children — `workspace_invite_secrets`, `access_token_secrets`, `magic_link_token*`, `atc_steps`, `atc_assertions`, `test_steps`, `run_atcs`, `run_steps`, `feature_flags`, `idempotency_keys`, `user_view_state` — are internal/implementation-detail tables with no independent client-facing CRUD surface, correctly folded into their parent feature above). No entity in the data map was found orphaned of any feature, and no feature in this catalog references an entity absent from the data map.

---

## 4. API endpoint inventory (terse — full detail in `business-api-map.md`)

Grouped by domain. Auth column: **Public** = no session required, **Member** = any active workspace member, **Member+** = `member`/`admin`/`owner`, **Admin+** = `admin`/`owner` only.

| Domain | Method + Endpoint | Purpose | Auth |
|---|---|---|---|
| Auth | `POST /api/v1/auth/{signup,signin,magic-link,confirm,resend,check-email}` | Account creation/session | Public |
| Workspaces | `POST,GET /api/v1/workspaces` · `GET,PATCH /api/v1/workspaces/[id]` | Workspace CRUD (partial) | Member+ |
| Workspaces | `DELETE /api/v1/workspaces/[id]/membership` | Leave/remove member | Member |
| Workspaces | `POST,GET,DELETE /api/v1/workspaces/[id]/invites*` | Invite lifecycle | Admin+ |
| Workspaces | `GET /api/v1/workspaces/[id]/{recent-projects,active-runs,open-bugs,notifications,coverage}` | Home/dashboard read models | Member |
| Workspaces | `POST /api/v1/workspaces/[id]/projects` | Create Project | Member+ |
| Invites | `POST /api/v1/invites/accept` | Redeem invite token | Public (token-gated) |
| Tokens | `POST,GET /api/v1/tokens` · `DELETE /api/v1/tokens/[id]` | PAT issuance/list/revoke | Member (Admin+ for `workspace:admin` scope) |
| Modules | `POST /api/v1/projects/[id]/modules` · `PATCH,DELETE /api/v1/modules/[id]` | Module tree CRUD | Member+ |
| User Stories | `POST,GET /api/v1/modules/[id]/user-stories` · `GET,PATCH,DELETE /api/v1/user-stories/[id]` | Story CRUD | Member+ |
| Acceptance Criteria | `POST,GET /api/v1/user-stories/[id]/acceptance-criteria` · `GET,PATCH,DELETE /api/v1/acceptance-criteria/[id]` | AC CRUD | Member+ |
| ATCs | `POST /api/v1/atcs` · `PATCH /api/v1/atcs/[id]` · `POST /api/v1/atcs/[id]/duplicate` · `GET /api/v1/atcs/search` · `GET /api/v1/atcs/[id]/usage` | ATC authoring | Member+ (write), Member (read) |
| Tests | `POST,GET /api/v1/tests` · `GET /api/v1/tests/[id]` · `PATCH /api/v1/tests/[id]/reorder` · `PUT /api/v1/tests/[id]/tags` · `GET /api/v1/tests/[id]/runs` | Test chain CRUD + history | Member+ (write), Member (read) |
| Environments | `GET,POST /api/v1/projects/[id]/environments` · `PATCH,DELETE /api/v1/environments/[id]` | Environment CRUD | Member+ |
| Runs | `POST /api/v1/runs` · `GET /api/v1/runs/[id]` · `POST /api/v1/runs/[id]/{abort,finish}` · `POST /api/v1/runs/[id]/steps/[stepId]/mark` | Run execution | Member+ |
| Bugs | `POST,GET /api/v1/bugs` · `GET /api/v1/projects/[id]/bugs` · `POST /api/v1/bugs/[id]/{status,assign}` · `GET /api/v1/projects/[id]/bugs/heatmap` | Defect tracking | Member+ (write), Member (read) |
| Milestones | `GET,POST /api/v1/projects/[id]/milestones` · `PATCH /api/v1/milestones/[id]` | Milestone CRUD (no delete) | Member+ |
| Traceability/Coverage | `GET /api/v1/projects/[id]/{traceability,coverage,runs/report,metrics/recovery-cycles}` · `GET /api/v1/workspaces/[id]/coverage` | Reporting | Member |
| Imports | `POST /api/v1/imports` · `GET /api/v1/imports/[id]` | Jira import job | Member+ |
| Notifications | `GET /api/v1/workspaces/[id]/notifications` · `POST /api/v1/notifications/[id]/read` · `POST /api/v1/workspaces/[id]/notifications/read-all` · `GET,PATCH /api/v1/notification-preferences` | Inbox + preferences | Member (own) |
| Activity | `GET /api/v1/activity` | Audit trail read | Member |
| Me | `GET /api/v1/me` · `POST /api/v1/me/active-workspace` | Current-user context | Member |
| Meta | `GET /api/v1` · `GET /api/v1/health` | Index + health check | Public |

---

## 5. UI component inventory

### Forms

| Form | Purpose | Route | Evidence |
|---|---|---|---|
| Sign-up/Sign-in | Authenticate | `/login` | `app/(auth)/login/page.tsx` |
| Onboarding (Workspace creation) | First Workspace | `/onboarding` | `app/(app)/onboarding/page.tsx` (`OnboardingForm`) |
| Invite Member | Email + role | `/workspaces/[id]/members` | `app/(app)/workspaces/[id]/members/page.tsx` |
| ATC Editor | Author steps/assertions/AC-anchors | `/projects/[projectSlug]/atcs/new`, `.../atcs/[atcId]` | `components/atcs/AtcEditor.tsx`, `NewAtcEditor.tsx`, `StepEditor.tsx` |
| Test Builder | Chain ATCs into a Test | `/projects/[projectSlug]/tests/new` | `components/tests/` |
| Run Marker | Mark step outcomes + evidence | `/projects/[projectSlug]/runs/[runId]` | `components/runs/RunnerView.tsx` |
| Bug Report (in-Run) | File a Bug inline | inside Runner | `lib/runs/report-bug-view.ts` |
| Milestone Form | Create/edit checkpoint | `/projects/[projectSlug]/milestones` | `lib/milestones/` |
| Token Issuance | Create a PAT | `/settings/tokens` | `app/(app)/settings/tokens/page.tsx` |
| Project Creation | New Project | `/projects/new` | `app/(app)/projects/new/page.tsx` |

### Dashboards / Views

| View | Purpose | Route | Evidence |
|---|---|---|---|
| Home Dashboard | Recent Projects, Active Runs, Open Bugs widgets | `/home` | `app/(app)/home/page.tsx` |
| Activity Feed | Audit trail | `/activity` | `app/(app)/activity/page.tsx` |
| Project Home / ATC Explorer | Browse ATC library for a Project | `/projects/[projectSlug]` | `app/(app)/projects/[projectSlug]/page.tsx` |
| Traceability Chain View | US<->AC<->ATC<->Test chain | `/projects/[projectSlug]/traceability` | `TraceabilityChainView.tsx` (per `business-data-map.md` §3.1) |
| Metrics Dashboard | Coverage/defect trend charts | `/projects/[projectSlug]/metrics` | `lib/metrics/` |
| Bug List | Kanban-style triage view | `/projects/[projectSlug]/bugs` | `components/bugs/` |
| Run History | Project-wide + per-Test | `/projects/[projectSlug]/runs`, `.../tests/[testId]/runs` | `components/runs/` |
| API Reference | Interactive OpenAPI docs | `/api/docs` | `@scalar/api-reference-react` |
| Testability Guide | QA/agent onboarding | `/qa` | `app/qa/_components/QaShell.tsx` |

### Actions (modals, dialogs, confirmations)

| Action | Trigger | Evidence |
|---|---|---|
| Leave Workspace | Settings > Workspace | `lib/account/workspaces.ts:91` (`isSoleOwner` guard blocks) |
| Revoke Invite | Members page | `app/api/v1/workspaces/[id]/invites/[inviteId]/route.ts:71` |
| Revoke Token | Tokens settings | `app/api/v1/tokens/[id]/route.ts:17` |
| Duplicate ATC | ATC detail | `app/api/v1/atcs/[id]/duplicate/route.ts:17` |
| Abort Run | Runner toolbar | `app/api/v1/runs/[id]/abort/route.ts:23` |
| Finish Run | Runner toolbar | `app/api/v1/runs/[id]/finish/route.ts:21` |
| Assign Bug | Bug detail/list | `app/api/v1/bugs/[id]/assign/route.ts:51` |
| Transition Bug Status | Bug detail/kanban | `app/api/v1/bugs/[id]/status/route.ts:57` |
| Mark Read (single/all) | Notification inbox | `app/api/v1/notifications/[id]/read/route.ts:15`, `.../read-all/route.ts:16` |

---

## 6. Third-party integrations

| Service | Purpose | Package | Status | Features using it |
|---|---|---|---|---|
| Supabase | Postgres DB, Auth, Realtime | `@supabase/supabase-js`, `@supabase/ssr` | Active | All (data layer + FEAT-001 auth + FEAT-014/021 realtime push) |
| Vercel | Hosting/deploy | (inferred — no dependency, URL evidence only) | Active (inferred) | All (deployment target) |
| Atlassian Jira | External requirement import | Hand-rolled REST client, `lib/jira/*` — **no SDK dependency in `package.json`** | Active | FEAT-018 (Jira Import), FEAT-010 (`external_id`/`external_url` provenance) |
| Resend | Transactional email | **Not in `package.json` dependencies** — `RESEND_API_KEY` present only in `.env.example` | Planned/unconfirmed | FEAT-021 (email notification channel exists as a schema value, delivery not confirmed wired) |
| Scalar | API reference UI | `@scalar/api-reference-react` | Active | FEAT-025 |
| `@asteasolutions/zod-to-openapi` | OpenAPI spec generation from Zod schemas | dependency | Active | FEAT-025, and indirectly every validated endpoint |

No Sentry, PostHog, Stripe/Paddle/LemonSqueezy, Upstash, or Cloudflare R2 dependency was found in `package.json`, despite these being named as anticipated cost centers in `business-model.md` §8 — treat as roadmap intent, not shipped integrations.

---

## 7. Feature flags and WIP

### Feature flags

**None found.** No `FEATURE_`/`ENABLE_`/`BETA_`-prefixed environment variable was located in `.env.example` or via a codebase grep for those prefixes. A `feature_flags` table exists in the schema (`business-data-map.md` §2.18: `key`, `scope` `global`/`workspace`, `enabled`, `payload`) but **no client write policy** — Studio/service_role/migrations only — meaning flags, if any are seeded, are operator-controlled, not user- or env-var-toggleable. No seeded flag content was inspected in this pass (would require a live DB query, out of scope for a read-only code pass).

| Flag | Description | Default | Environment |
|---|---|---|---|
| — | No client-visible flags found | — | — |

### Planned / WIP

| Planned feature | Evidence (TODOs, stubs) | Estimated status |
|---|---|---|
| Workspace-wide ATC Library rollup | `components/layout/AppSidebar.tsx:170` (`href: null`, rendered with a "soon" badge, `aria-disabled`, title="Coming soon") | Not started — project-scoped ATC browsing (FEAT-012) already exists; only the workspace-wide aggregate is missing |
| Workspace-wide Test Runs rollup | `components/layout/AppSidebar.tsx:171` | Not started — same pattern as above, project-scoped Run history (FEAT-014) already exists |
| Workspace-wide Bug Reports rollup | `components/layout/AppSidebar.tsx:172` | Not started — project-scoped Bug tracking (FEAT-016) already exists |
| Workspace-wide Metrics rollup | `components/layout/AppSidebar.tsx:173` | Not started — project-scoped Metrics (FEAT-020) already exists |
| `mentions` notification event type | `notification_preferences` CHECK allows the value but INSERT/UPDATE policies reject it (`business-data-map.md` §2.16) | Structurally locked pending a future "Team Chat epic" |
| `agent`/`ci` Run executor UI | `runs.executor_mode` schema-permits both; no UI route creates a non-`human` Run | Schema-ready, UI/orchestration not built — API-only today via PAT (unconfirmed) |
| Open-core/self-hostable distribution | `business-model.md` §4 — asserted roadmap intent, current MVP runs on one shared Supabase project | Not started at the infrastructure level |
| Billing/plan enforcement | `workspaces.plan` column exists (`community`/`cloud`/`enterprise`), no gating logic found anywhere | Modeled, not enforced |

No TODO/FIXME/HACK code comments were found in `app/` or `lib/` via a direct grep in this pass — WIP surfaces above were identified structurally (disabled nav items, unenforced schema columns), not from inline developer comments.

---

## 8. QA relevance

### Feature test coverage matrix

The target repo carries 134 `*.test.ts` unit/integration files (Bun test runner, colocated under `lib/`), but **no CI workflow runs them** and **this QA repo (`qa-engineering-bunkai`) has no E2E suite yet** — see this file's own `CLAUDE.md` §"Project Assessment (Phase 1)". Below, `Unit`/`Integration` are marked from the presence of a plausible colocated test file name pattern observed during discovery (e.g. `*-isolation.test.ts`, `transition-bug-status-isolation.test.ts`, `start-run.test.ts`), **not from an exhaustive line-by-line coverage audit** — treat as directional, not authoritative. `E2E` is uniformly ❌ for every feature: no Playwright/E2E suite exists against this target in either repo today.

| Feature ID | Unit | Integration | E2E | Status |
|---|---|---|---|---|
| FEAT-001 Auth | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E — critical path, zero automated UI coverage |
| FEAT-002 PAT auth | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-003 Workspace lifecycle | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-004 Membership/roles | ✅ Likely (`isolation.test.ts` convention observed) | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-005 Invites | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-006 PAT management | ✅ Likely (BK-135 remediation implies test coverage added) | ⚠️ Unverified | ❌ | Needs E2E — history of a real security bug here |
| FEAT-007 Project lifecycle | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E; also has an API-surface gap (§9) |
| FEAT-008 Environments | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-009 Modules | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E; known edge-case gap (stranded descendant) |
| FEAT-010 User Stories | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-011 Acceptance Criteria | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-012 ATC authoring | ✅ Likely (`lib/atcs/*.test.ts` confirmed to exist per `CLAUDE.md` assessment) | ⚠️ Unverified | ❌ | Needs E2E — core differentiator, highest business value at risk |
| FEAT-013 Test chains | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-014 Run execution | ✅ Likely (`lib/runs/*.test.ts`, `start-run.test.ts` cited in `user-journeys.md`) | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-015 In-Run bug reporting | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-016 Bug tracking | ✅ Likely (`lib/bugs/*.test.ts` confirmed to exist per `CLAUDE.md` assessment; `transition-bug-status-isolation.test.ts` named explicitly) | ⚠️ Unverified | ❌ | Needs E2E; also has an API-surface gap (§9) |
| FEAT-017 Milestones | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-018 Jira import | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-019 Traceability/coverage | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E — DEFECT-BK-317 already found here once via manual QA |
| FEAT-020 Metrics dashboards | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-021 Notifications | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-022 Activity log | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-023 Account settings | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-024 Home dashboard | ⚠️ Unverified | ⚠️ Unverified | ❌ | Needs E2E |
| FEAT-025 API reference | ⚠️ Unverified | ⚠️ Unverified | ❌ | Low priority — public docs page |
| FEAT-026 Testability guide | ⚠️ Unverified | ⚠️ Unverified | ❌ | Low priority — public docs page |

### High-risk features (prioritize testing)

| Feature | Risk | Reason |
|---|---|---|
| FEAT-012 ATC Authoring | HIGH | Core differentiator (`business-model.md` §4) — if the anchoring/traceability guarantee breaks, the entire product value proposition fails |
| FEAT-002/006 PAT auth + management | HIGH | Documented real privilege-escalation incident (BK-135, `workspace:admin` scope) — regression coverage on token-issuance role-gating is explicitly named high-value in `business-model.md` §"QA Relevance" |
| FEAT-014 Run Execution | HIGH | Entire manual-QA value loop depends on this completing cleanly (`user-journeys.md` §8); snapshot-immutability invariant is easy to accidentally violate in future changes |
| FEAT-016 Bug Tracking + provenance | HIGH | Native defect management is a named differentiator; broken provenance (cross-project injection) defeats it — BR-4 exists specifically because this class of bug shipped once already (per an adversarial review cited in `business-data-map.md` §2.14) |
| FEAT-019 Traceability Reporting | MEDIUM-HIGH | Already produced one real (low-severity) defect, DEFECT-BK-317, from a grain-vocabulary mismatch — the multi-grain status model (`business-data-map.md` §3.1) is inherently error-prone to future changes |
| Cross-workspace RLS isolation (cross-cutting, not a single FEAT-ID) | HIGH | Every table enforces RLS via workspace membership; the target's own `*-isolation.test.ts` naming convention already treats this as a first-class category — QA's own test plan should mirror it explicitly, per `domain-glossary.md` "QA Usage Guide" |
| FEAT-003 Workspace lifecycle | MEDIUM | Missing DELETE endpoint despite an RLS policy existing for it (§9) — either a real gap or an unlocated route; either way it's unverified, and workspace deletion is inherently high-blast-radius if/when it does exist |

### Discovery-confidence disclaimer

This QA repo has **zero E2E automation today** (per this file's own `CLAUDE.md` §"Project Assessment", Testing Maturity 2/4). Every "Needs E2E" row above is therefore the default state, not a special finding — the matrix exists to make that gap explicit and auditable per feature rather than asserted as one blanket statement.

---

## 9. Discovery gaps

- **9.1 — Several expected single-resource GET/PATCH/DELETE routes were not found**, despite the corresponding CRUD capability being schema-real: `GET/PATCH/DELETE /api/v1/projects/[id]` (project detail/edit/delete), `GET /api/v1/projects` (project list), `GET /api/v1/atcs/[id]` (single-ATC read), `GET/PATCH/DELETE /api/v1/bugs/[id]` (single-bug read/edit/delete), `DELETE /api/v1/workspaces/[id]` (workspace delete, RLS policy exists per `business-data-map.md` §2.1). These may exist under a route-file naming pattern the `export const METHOD` grep used in this pass didn't match (e.g. a catch-all handler, a different export style, or a file this pass's directory listing missed), or the underlying data may be served through a different mechanism (Next.js Server Component direct query, bypassing the REST layer entirely for first-paint reads). **Recommended**: cross-check every row flagged ⚠️/❌ in §3's CRUD matrix against the sibling `business-api-map.md` document, which was generated concurrently with a narrower, endpoint-focused mandate and may have traced these more precisely.
- **9.2 — No UI route was located for Jira Import (FEAT-018) or standalone Environment management (FEAT-008)** — both have confirmed API routes but no dedicated page was found in the `app/(app)/**` route tree; they may be modal/inline surfaces embedded in a page not separately routed (e.g. Project Settings), which this pass's route-tree-only method wouldn't surface.
- **9.3 — Resend integration status is ambiguous.** `RESEND_API_KEY` is documented in `.env.example` with real setup instructions, and an email-digest design mockup exists (per `business-model.md` §7), but `resend` is **not** a `package.json` dependency and no send-call site was independently traced in this pass. Treat email-channel notification delivery (part of FEAT-021) as unconfirmed, not shipped.
- **9.4 — `/qa` route (FEAT-026) purpose was resolved in this pass** (a public testability-guide teaching surface for QA/AI agents integrating the API), closing the Discovery Gap `user-journeys.md` §9 had left open for it.
- **9.5 — Workspace re-role (changing an existing member's role after invite-acceptance) was not traced to a specific endpoint** in this pass — `workspace_members.role` is mutable per schema (`business-data-map.md` §2.2), and the Members page evidently reads role data, but no PATCH-style role-change route was located among the grepped exports.
- **9.6 — OAuth provider(s) behind `/auth/oauth/[provider]` were not enumerated** — the dynamic route confirms the capability exists, but which specific providers (Google, GitHub, etc.) are configured was out of scope for a route-tree-only pass.
- **9.7 — Feature-flag seed content was not queried.** The `feature_flags` table exists with no client write policy; whether any flags are currently seeded and what they gate (if anything client-visible reads them) was not checked — would require `[DB_TOOL]` access, out of scope for this read-only code pass (mirrors the same DB-access gap already flagged in this repo's Project Assessment, `CLAUDE.md` Blockers).
- **9.8 — Defect-heatmap and recovery-cycle report exact dimensionality not verified.** FEAT-020's two headline reports (`GET /api/v1/projects/[id]/bugs/heatmap`, `.../metrics/recovery-cycles`) were confirmed to exist as routes; their precise grouping axes (e.g. heatmap = module x severity, or something else) were not read from the handler bodies in this pass.
- **9.9 — Test coverage matrix (§8) is directional, not measured.** No `bun test --coverage` output was inspected (none is wired per this repo's own Project Assessment) — Unit/Integration marks are inferred from file-naming patterns cited across the already-read context docs, not from an independent test-file-by-test-file audit of all 134 files.
