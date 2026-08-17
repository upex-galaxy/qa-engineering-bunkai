# Business API Map — Bunkai (discovered)

> Target repo: `upex-bunkai-tms` (read-only — nothing in that repo was modified to produce this document).
> Primary source: every `route.ts` under `upex-bunkai-tms/app/api/v1/**` (60 files, all read in full), plus `lib/api/handler.ts`, `lib/api/principal.ts`, `lib/api/pat.ts`, `lib/api/error-envelope.ts`, `middleware.ts`, and `lib/openapi/registry.ts`.
> Cross-checked against: `.context/business/business-data-map.md` (schema/entity ground truth) and `.context/business/domain-glossary.md` (terminology) in this repo.
> Generated: 2026-08-17.

Terminology follows `domain-glossary.md` exactly: **Workspace**, **Project**, **Module**, **User Story**, **Acceptance Criterion (AC)**, **ATC**, **Test**, **Run**, **Bug**, **Milestone**, **Project Environment**, **Personal Access Token (PAT)**.

---

## 1. Auth model summary

Every route is a Next.js Route Handler wrapped in `withApiHandler()` (`lib/api/handler.ts`). Auth is **secure by default**: a route is authenticated (`auth: 'required'`) unless it explicitly opts out with `auth: 'public'`. The public set is small and exhaustive: `GET /api/v1` (index), `GET /api/v1/health`, and the five pre-session auth routes — `check-email`, `confirm`, `magic-link`, `resend`, `signin`, `signup`.

**Two auth methods collapse into one `Principal`** (ADR-0001, `lib/api/principal.ts:resolveIdentity`) — a handler never branches on how the caller authenticated:

| | Cookie session | Bearer PAT |
|---|---|---|
| Carrier | Supabase SSR session cookie (`sb-*-auth-token`) | `Authorization: Bearer bk_pat_<12-char-prefix>.<secret>` |
| Resolved via | `createClient().auth.getUser()` | `requireBearerToken()` → `lib/api/middleware/bearer.ts`, hash-lookup against `access_token_secrets` |
| Capabilities | Full set — `ALL_CAPABILITIES` (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`) | Exactly the token's own `access_tokens.scopes[]` |
| `db` client | SSR client — RLS evaluates against the real `auth.uid()` | Anon client carrying a short-lived, per-request user-scoped JWT (`impersonatingClient`) — RLS evaluates identically to a cookie session |
| Precedence | — | Checked **first**: an `Authorization: Bearer` header is never shadowed by a stale cookie |

A route can additionally declare `requires: ['atc:read' | 'atc:write' | 'run:execute' | 'workspace:admin']`; `requireCapability()` throws 403 `forbidden` if the principal lacks it. Because a cookie session always holds the full set, `requires` **only ever constrains PAT callers** in practice. Many read-heavy routes (`GET /activity`, `GET /bugs`, `GET /tests/{id}/runs`, the four report/coverage endpoints) declare no `requires` at all — any authenticated principal with *any* active workspace role (viewer included) passes, because the real membership check happens inside a `SECURITY DEFINER` Postgres RPC or RLS policy, not in the route.

**`assertWorkspaceContext()`** (ADR-0006, `lib/api/principal.ts`) is a second, narrower gate applied only to workspace-admin-shaped routes (workspace `PATCH`, invites CRUD): a Bearer PAT may act only on the single workspace it was minted against (`access_tokens.workspace_id`); a global (workspace-less) token is rejected outright for these; cookie sessions bypass this check (the UI is trusted, and RLS + an explicit role re-check inside the route do the real gating).

**Role/permission checks observed beyond capabilities:**
- `workspace_members.role` (`viewer < member < admin < owner`) gates writes at two layers: Postgres RLS policies (coarse, e.g. "member+ can insert") and `SECURITY DEFINER` RPCs that re-check the role explicitly (e.g. `bunkai_can_write_workspace`, admin/owner-only invite issuance).
- `POST /api/v1/workspaces/{id}/invites` re-reads the caller's own membership row via the RLS-scoped client *before* running any admin-client uniqueness probe — deliberately, so a non-admin never gets to leak membership-existence facts (`app/api/v1/workspaces/[id]/invites/route.ts:39-54`).
- A **PAT cannot mint or revoke PATs** — `POST /api/v1/tokens` and `DELETE /api/v1/tokens/{id}` both throw 403 `forbidden` when `principal.via === 'bearer'`, closing a privilege-escalation/persistence path (a leaked PAT minting itself a replacement).
- `POST /api/v1/tokens` and the headless `signin`/`signup`/`confirm` PAT-minting paths all reject an attempt to request `workspace:admin` scope unless a specific `workspace_id` is given and the caller is admin/owner there (`lib/api/pat.ts:assertTokenIssuanceAuthorized`, ADR-0005) — there is no such thing as a global admin token.

**`middleware.ts` is a separate, page-level gate — it does NOT protect `/api/v1/*`.** It redirects unauthenticated browser navigation away from `/home`, `/projects`, `/onboarding`, `/settings`, `/activity` to `/login`, and explicitly whitelists `/api/auth` as public. Every `/api/v1/*` route's authentication is enforced entirely by `withApiHandler`/`resolveIdentity`, independent of this middleware.

---

## 2. Endpoint inventory by domain

Evidence for every row is `app/api/v1/<path>/route.ts` in `upex-bunkai-tms`. "Auth" column: **Public** = no auth; **Required** = any authenticated principal, no capability; **`cap:X`** = `requires: ['X']`; **admin-gated** = `workspace:admin` capability + `assertWorkspaceContext`.

### acceptance-criteria (3 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/acceptance-criteria/{id}` | Read one active AC | Required | RLS-hidden row reads as 404 (outsider = insider-invisible) |
| PATCH | `/acceptance-criteria/{id}` | Edit title/detail and/or move (reorder) | Required | Reorder runs through `bunkai_move_acceptance_criterion` (atomic re-number); a viewer's write touches 0 rows → 403 `not_a_member` |
| DELETE | `/acceptance-criteria/{id}` | Soft-archive, close position gap | Required | `bunkai_archive_acceptance_criterion`; auto-reverts parent User Story out of `ready_to_test` if it was the last active AC |

### activity (1 endpoint)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/activity` | Paginated workspace audit feed, newest first | Required | Bearer callers **must** supply `?workspace_id` (422 without it); cookie callers fall back to the `bk_active_ws` cookie. Inaccessible workspace collapses into the same `200 {items:[]}` an empty one returns |

### atcs (5 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/atcs` | Create an ATC + steps + assertions transactionally | `cap:atc:write` | Cross-entity validation (AC ∈ User Story, Module ∈ US's project subtree); step positions must be strictly increasing ints from 1 |
| PATCH | `/atcs/{id}` | Full-replace edit (PUT-style) | `cap:atc:write` | Optimistic lock via custom `X-If-Match` header (not standard `If-Match` — Vercel edge rewrites that to 412, BK-96); empty body = no-op 200; `user_story_id`/`module_id`/`slug` immutable; response reports `affected_test_count` |
| GET | `/atcs/search` | Project-scoped full-text + autocomplete | `cap:atc:read` | Caller-supplied workspace scope is **ignored** — server derives it from the actor's own memberships |
| GET | `/atcs/{id}/usage` | "Used in N Tests" report | `cap:atc:read` | Reachable-but-unused ATC returns `200 {count:0}`, never 404 |
| POST | `/atcs/{id}/duplicate` | Deep-copy an ATC (steps/assertions/AC-bindings) | `cap:atc:write` | Fresh slug, `version=1`; optional body `new_title`, default `<source> (copy)` |

### auth (6 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/auth/check-email` | Email-first routing: does this email exist / is it confirmed | Public | **Deliberate enumeration exception** (ADR-0007) — the only auth endpoint that reveals account existence, by design, to route the login UI |
| POST | `/auth/signup` | Provision account, verification-first | Public | No session, no PAT minted here (closes an old auto-confirm backdoor); 409 on existing email, detected two ways (explicit error + empty-`identities` 200 trick) |
| POST | `/auth/confirm` | Verify signup OTP, mint session + PAT | Public | Response is byte-identical to `signin`'s `{user, session, pat, warning}` shape |
| POST | `/auth/resend` | Resend the signup confirmation OTP | Public | Dedicated no-password rail (fixed BK-181, where reusing `/signup` tripped its password-strength Zod check) |
| POST | `/auth/signin` | Password sign-in, mints session + PAT | Public | Uniform 401 on bad email OR bad password — never discloses which |
| POST | `/auth/magic-link` | Send a login-only magic link | Public | `shouldCreateUser: false` pinned (BK-175 fix — this endpoint must never silently enroll a new account) |

### bugs (4 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/bugs` | File a Bug — run-linked or standalone | `cap:atc:write` | Run-linked body carries **only** `run_step_id`; server derives project/module/atc via a membership-gated re-read and rejects unless the step's own status is `failed` (ATP-N1 backstop) |
| GET | `/bugs` | Filtered, paginated, aggregate-bearing list | Required | Keyset cursor pagination; a caller who can't see `project_id` gets the same empty `200` a genuinely-empty visible project would (never 403) |
| POST | `/bugs/{id}/assign` | Assign / reassign / unassign | `cap:atc:write` | Runs through the caller's own RLS-scoped client — `bunkai_assign_bug` has no `service_role` grant at all |
| POST | `/bugs/{id}/status` | Advance lifecycle one stage | `cap:atc:write` | `open→in_progress→resolved→closed`, one stage at a time, never backward, never skipping (45310/45311) |

### environments (2 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| PATCH | `/environments/{id}` | Rename | Required | Same trim/length/uniqueness rules as create |
| DELETE | `/environments/{id}` | Remove | Required | **Blocked 409** while ≥1 Run still references it |

### health (1 endpoint)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/health` | Liveness probe | Public | Returns `{ok, service, env, ts}` |

*(Plus `GET /api/v1` — public discovery/index endpoint returning `{version, openapi, docs, status}`, and its own `OPTIONS` CORS-preflight handler.)*

### imports (2 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/imports` | Enqueue an **async Jira Story import** for a project | Required | At most one active (`queued`/`running`) import per project — 409 `import_in_progress`, race-proofed by a partial unique index; processed in a Vercel `after()` background task |
| GET | `/imports/{id}` | Poll job status + per-run counts + `errors[]` | Required | Member-only via RLS; foreign job reads as 404 |

> **Premise check on "Mode 3 / CI-results ingestion":** the briefing asked to look for a CI-results-file / JUnit ingestion endpoint under `imports/`. None exists. `POST /api/v1/imports` is exclusively a **Jira Story import** (JQL-driven, via `lib/jira/import-runner.ts`) — it pulls User Stories + Acceptance Criteria *from* Jira, it does not ingest test results *into* Bunkai. The differentiator the business docs describe as automated/CI execution is instead `runs.executor_mode = 'ci'` on `POST /api/v1/runs` (§3 below) — a CI pipeline calls the same Run-creation/step-mark/finish API a human or AI agent would, authenticated via PAT, rather than uploading a results file for Bunkai to parse. Confirmed against `upex-bunkai-tms/.context/business/business-model.md` (no "Mode 3"/"CI results"/"JUnit" language exists there either) and `lib/jira/import-runner.ts`.

### invites (1 endpoint)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/invites/accept` | Invitee redeems a raw token | Required | Caller's auth email must match the invite's email; **never demotes** — an existing equal-or-higher membership is rejected (409) rather than silently downgraded (fixes a real bug where accept could demote an owner) |

### me (2 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/me` | Introspect principal: user, every workspace, active workspace + role, auth source/scopes | Required | Single query serves cookie and PAT identically (ADR-0001) |
| POST | `/me/active-workspace` | Rotate the caller's active workspace (`bk_active_ws` cookie) | Required, session-only | Non-member target → 403; does not touch the Supabase JWT |

### milestones (1 endpoint)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| PATCH | `/milestones/{id}` | Edit name / target date / description | Required | Target-date bounds (today-or-later, ≤5yr) fire **only when the date value actually changes** — a description-only edit of a past-dated milestone still succeeds. No DELETE exists by design. |

### modules (4 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| PATCH | `/modules/{id}` | Rename/describe **or** move (re-parent) — mutually exclusive in one request | Required | Move validates cycle (45001), depth>6 (45002), invalid parent (45003) |
| DELETE | `/modules/{id}` | Cascade soft-archive: module + descendants + their User Stories/ACs/ATCs | Required | Single-transaction `bunkai_archive_module_subtree` RPC |
| POST | `/modules/{id}/user-stories` | Create a User Story under the module | Required | Jira key (`external_id`) validated `LETTERS-NUMBER`, upper-cased, unique per project (case-insensitive) |
| GET | `/modules/{id}/user-stories` | List active stories | Required | — |

### notification-preferences (2 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/notification-preferences` | Caller's own 4-editable + 2-locked preference grid | Required | Personal + **global** (no workspace concept) |
| PATCH | `/notification-preferences` | Instant-save one (event_type, channel) cell | Required | `mentions` is excluded from the editable enum — locked at both the Zod layer (422) and DB layer (defense in depth) until a future Team Chat epic |

### notifications (1 endpoint)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/notifications/{id}/read` | Mark one of the caller's own notifications read | Required | Plain RLS-scoped UPDATE, no RPC; idempotent (re-marking already-read succeeds) |

### projects (11 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/projects/{id}/bugs` | Bare-bones bug list (superseded, kept for compat) | Required | Superseded by `GET /bugs?project_id=`; left in place deliberately |
| GET | `/projects/{id}/bugs/heatmap` | Per-module defect heatmap + week-over-week trend | Required | `?window=7d\|30d\|90d` (default 30d); unsupported window → 400 (not the usual 422) |
| GET | `/projects/{id}/coverage` | Modules with untested/uncovered ACs | Required | No pagination — bounded rollup |
| GET | `/projects/{id}/environments` | List project environments | Required | Ordered `name asc` |
| POST | `/projects/{id}/environments` | Create an environment | Required | Trim, length 1-50, case-insensitive uniqueness |
| GET | `/projects/{id}/metrics/recovery-cycles` | Per-story time-to-recover (first fail → first all-pass) | Required | `median_recovery_seconds` computed at the route, not the RPC |
| GET | `/projects/{id}/milestones` | List milestones | Required | Ordered `target_date asc, id asc` |
| POST | `/projects/{id}/milestones` | Create a milestone | Required | Date bounds always enforced on create (no "unchanged" carve-out) |
| POST | `/projects/{id}/modules` | Create a module | Required | Path/slug auto-derived (CJK/Cyrillic hash fallback), depth ≤6, sibling-position auto-increment |
| GET | `/projects/{id}/runs/report` | Filtered Run report (date/module/status/executor) with recomputed totals | Required | `totals` reflects the **filtered set**, not all-time (opposite convention from `/tests/{id}/runs`) |
| GET | `/projects/{id}/traceability` | AC → ATC → Test → Run → Defect chain for one User Story | Required | `?story=` UUID cross-checked against `{id}` via `module_id → modules.project_id` (never nullable `user_stories.project_id`) before the RPC runs |

*(All 11 projects/* routes share the same non-disclosure posture: missing/foreign-workspace/non-member Project → uniform 404, never 403, never an existence echo.)*

### runs (5 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/runs` | Start a Run of a Test against an environment | `cap:run:execute` | **`Idempotency-Key` header REQUIRED**; domain `start_token` gives a separate 24h dedupe window; snapshots the chain into `run_atcs`/`run_steps` at creation |
| GET | `/runs/{id}` | Expanded Run view (header + ordered snapshot) | Required | Viewer role suffices |
| POST | `/runs/{id}/abort` | Abort an in-progress Run | `cap:run:execute` | First-wins row lock; reason 3-500 chars; only from `status='running'` |
| POST | `/runs/{id}/finish` | Close a Run with a final verdict | `cap:run:execute` | Verdict must be `passed`/`failed` only (never `aborted`); first-wins lock |
| POST | `/runs/{id}/steps/{stepId}/mark` | Mark one step passed/failed/blocked | `cap:run:execute` | **UPDATE-in-place** (last-write-wins, unlike abort/finish's first-wins) — recomputes parent `run_atcs.status` from ALL sibling steps every call |

### tests (6 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/tests?tag=` | List Tests carrying one tag | `cap:atc:read` | `tag` query param required; GIN `@>` containment match |
| POST | `/tests` | Create a Test (ordered ATC chain) | `cap:atc:write` | `Idempotency-Key` REQUIRED; chain must be ≥1 ATC, all same-workspace |
| GET | `/tests/{id}` | Expanded Test view (chain + steps + assertions) | Required | `?expand=` accepted but ignored (always fully expanded) |
| PATCH | `/tests/{id}/reorder` | Reorder the ATC chain | `cap:atc:write` | Body is the **complete new order** (`step_ids`), never a diff; `X-If-Match` optimistic lock; 409 embeds the live chain on conflict |
| GET | `/tests/{id}/runs` | Run history (terminal runs only) | Required | `?outcome=` rejects `running` (422); `totals` is all-time, filter-invariant (opposite of the project report route) |
| PUT | `/tests/{id}/tags` | Replace the whole tag set | `cap:atc:write` | PUT semantics — empty array clears all tags; `X-If-Match` lock |

### tokens (3 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/tokens` | Issue a PAT | Required, **session-only** | `workspace:admin` scope requires admin/owner role in the named workspace; raw secret returned exactly once |
| GET | `/tokens` | List caller's own tokens (no secret) | Required | RLS-scoped by `auth.uid()` |
| DELETE | `/tokens/{id}` | Soft-revoke (`revoked_at`) | Required, **session-only** | Never hard-deleted — stays in the audit trail |

### user-stories (5 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| GET | `/user-stories/{id}` | Read one active story | Required | — |
| PATCH | `/user-stories/{id}` | Edit title/description/Jira key/status | Required | Jira key **immutable once set** (409 on change attempt); `status=ready_to_test` blocked (409 `ac_required_for_ready_to_test`) unless ≥1 active AC |
| DELETE | `/user-stories/{id}` | Soft-archive | Required | — |
| POST | `/user-stories/{id}/acceptance-criteria` | Add an AC | Required | Atomic position rebalance via `bunkai_insert_acceptance_criterion` |
| GET | `/user-stories/{id}/acceptance-criteria` | List active ACs in order | Required | — |

### workspaces (16 endpoints)

| Method | Path | Purpose | Auth | Notable rule |
|---|---|---|---|---|
| POST | `/workspaces` | Create a workspace, auto-enrol caller as `owner` | Required | Reserved-slug rejection; 409 on slug collision |
| GET | `/workspaces` | List caller's workspaces + own role per workspace | Required | Two queries merged in JS (`mergeWorkspaceRoles`) |
| GET | `/workspaces/{id}` | Read one workspace | Required | — |
| PATCH | `/workspaces/{id}` | Rename | `cap:workspace:admin`, admin-gated | RLS restricts to owner; non-owner write touches 0 rows → 403 |
| DELETE | `/workspaces/{id}/membership` | Self-service "leave workspace" | Required, session-only | Blocked if it's the caller's last active membership anywhere, or if sole active owner; auto-revokes the caller's workspace-scoped PATs on success |
| GET | `/workspaces/{id}/invites` | List pending invites | `cap:workspace:admin`, admin-gated | Status derived (pending/accepted/revoked/expired) |
| POST | `/workspaces/{id}/invites` | Issue an invite | `cap:workspace:admin`, admin-gated | Email must be unique among active members; one live invite per (workspace,email) (409) |
| POST | `/workspaces/{id}/invites/{inviteId}` | Rotate (resend) an invite token | `cap:workspace:admin`, admin-gated | Fresh secret + 7-day expiry |
| DELETE | `/workspaces/{id}/invites/{inviteId}` | Revoke an invite | `cap:workspace:admin`, admin-gated | Sets `revoked_at` |
| GET | `/workspaces/{id}/active-runs` | In-progress Runs across the workspace + progress | `cap:atc:read` | Backs the Home dashboard widget — same function, byte-identical numbers |
| GET | `/workspaces/{id}/coverage` | Workspace-wide AC coverage roll-up | `cap:atc:read` | Sum-of-counts, NOT average of per-project percentages |
| GET | `/workspaces/{id}/open-bugs` | Outstanding defects by severity | `cap:atc:read` | `open_count` always derived as sum of `by_severity` |
| POST | `/workspaces/{id}/projects` | Create a project | Required | Slug auto-derived + reserved-word check |
| GET | `/workspaces/{id}/recent-projects` | Projects by recent activity + module/ATC counts | `cap:atc:read` | Gated on `atc:read` specifically so a narrowly-scoped CI token (`run:execute` only) cannot enumerate project inventory |
| GET | `/workspaces/{id}/notifications` | Caller's own inbox for one workspace | Required | `workspace_id` is a plain filter, not a trust boundary — RLS is the real gate |
| POST | `/workspaces/{id}/notifications/read-all` | Mark every visible unread notification read | Required | Idempotent; personal mutation, not workspace:admin-gated |

---

## 3. Critical endpoints deep-dive

The following are the highest-risk endpoints for QA — state-machine transitions, first-wins concurrency, cross-tenant provenance, and credential issuance.

### 3.1 `POST /api/v1/runs` — start a Run

- **Auth**: `cap:run:execute`. **Requires `Idempotency-Key` header** — its absence is a hard 400, distinct from the *domain* `start_token` (a 24h same-Test dedupe window inside the RPC). Two independent idempotency layers to test separately.
- Request: `{ test_id, environment_id, executor_mode?, start_token? }`. `executor_mode` is **forced to `human`** for a cookie session regardless of body content; only a Bearer caller may declare `agent`/`ci`.
- Response: `201` (new Run) or `200` (idempotent replay within the window) — same body shape `{ run }`.
- Edge cases worth testing: replaying the same `Idempotency-Key` with a *different* body (should this be rejected or ignored — verify against `lib/api/idempotency.ts`); `start_token` reuse after 24h (mints a fresh Run, no error); environment belonging to a different project than the Test resolves to (`environment_invalid`); a Test with zero executable steps (`no_executable_steps`); idempotency-store write failure post-RPC-success (the code explicitly does NOT fail the request or discard the key in that case — logs only).

### 3.2 `POST /api/v1/runs/{id}/finish` and `POST /api/v1/runs/{id}/abort`

- **Auth**: `cap:run:execute`. Both are **first-wins**, closed under the same row lock — a concurrent double-submit (or a race between finish and abort) on an already-terminal Run returns `409 conflict`, never a silent overwrite.
- `finish` verdict is caller-chosen (`passed`/`failed` only — `aborted` is rejected with a frozen validation message). `abort` requires a reason (3-500 chars, frozen message).
- Both skip every still-`pending` step/position to a terminal skip state as part of the same transaction.
- Edge case: finishing/aborting a Run that is already `passed`/`failed`/`aborted` → 409 in all six combinations; worth a full state-transition matrix, not just one negative case.

### 3.3 `POST /api/v1/runs/{id}/steps/{stepId}/mark`

- **Auth**: `cap:run:execute`. Unlike finish/abort, this is **UPDATE-in-place / last-write-wins** — re-marking the same step (e.g. failed → passed) is allowed and immediately recomputes the parent position's status from the full current sibling set (not incrementally). No Idempotency-Key.
- Edge case: marking a step on a Run that is no longer `running` (already finished/aborted) — verify the RPC's status guard actually blocks this (it should, per the "member+ write gate, the status='running' guard" comment); marking with an empty-string `note`/`evidence_url` (normalized to `null`, not stored as `''`).

### 3.4 `POST /api/v1/bugs` — run-linked filing path

- **Auth**: `cap:atc:write`. The run-linked branch (`run_step_id` only in the body) is the highest-risk shape: `project_id`/`module_id`/`run_id`/`atc_id` are **never accepted from the client** — they're derived server-side through a membership-gated re-read of the run, closing a cross-tenant provenance-injection class of bug the migration comments call out explicitly as having "shipped once already."
- **ATP-N1 backstop**: filing is rejected (`422 validation_failed`, `reason: run_step_not_failed`) unless the target step's live status is exactly `failed` — worth testing against `blocked`/`passed`/`pending` steps specifically, not just the happy path.
- Edge case: the failing step's ATC (and even the run's chain-position-1 snapshot module) was deleted after the run started — falls through to a `422 run_module_missing` rather than a 500 or a bug with a dangling module.

### 3.5 `PATCH /api/v1/tests/{id}/reorder`

- **Auth**: `cap:atc:write`. Body is the **complete permutation** of `step_ids` (not `atc_id`s — a chain may legitimately repeat an ATC at multiple positions). Optimistic lock via the **non-standard `X-If-Match` header** (chosen specifically because Vercel's edge intercepts and rewrites the standard `If-Match` to a 412 before the handler ever sees it — BK-96, a real platform gotcha worth its own regression test).
- On a version conflict (`45125`), the 409 body embeds the **live** chain/version from a fresh re-read, not just the stale error — verify the response actually reflects the conflicting writer's state, not the caller's stale one.
- Edge cases: submitting a chain missing one step or containing an extra one → `422 chain_mismatch` with `details.missing`/`details.extra`; empty chain or duplicate step ids → `422 chain_invalid` (a *different* code from `chain_mismatch` — don't conflate them in test assertions).

### 3.6 `POST /api/v1/tokens` — PAT issuance

- **Auth**: session-only — a Bearer caller gets an unconditional 403, tested directly (not inferred).
- `workspace:admin` scope is refused unless `workspace_id` is supplied **and** the caller is `admin`/`owner` there; a member requesting `workspace:admin` for a workspace they belong to as `member` should get 403, not a silently-downgraded token.
- The raw secret is returned exactly once in the response body — verify the DB only ever persists the SHA-256 hash (`access_token_secrets`), and that `GET /tokens` never echoes it back.

### 3.7 `POST /api/v1/invites/accept`

- **Auth**: any signed-in caller (not workspace-scoped — the token itself is the authorization).
- Email-gated: the caller's *own* Supabase auth email must case-insensitively match the invite's `email` — test with a signed-in user whose email differs from the invite (403), not just an unauthenticated call.
- **No-demote invariant**: an existing membership with an equal-or-higher role than the invite offers is rejected with `409 already_member_equal_or_higher_role` rather than silently upserted — this is the exact regression the migration comment says was previously live (an accept could demote a workspace owner to member). A dedicated negative test (owner accepts a stale `member`-role invite → 409, role unchanged) is high value here.

---

## 4. Error handling conventions

Every failure returns the same envelope (`lib/api/error-envelope.ts`):

```json
{ "error": { "code": "validation_failed", "message": "...", "details": { "reason": "..." }, "request_id": "..." } }
```

`code` is the stable, branch-on-this value (not `message`, which is human prose and can change). `request_id` echoes `x-request-id` (inbound header or a freshly minted UUID) — the repo's own convention is "quote this in bug reports," worth carrying into QA's own bug-report template.

Recurring, deliberate conventions observed:

1. **Non-disclosure collapse (P0002 pattern).** A missing row, a row in a workspace the caller isn't a member of, and (for several routes) a row that exists but is cross-project, all collapse into the **identical** `404 not_found` — never a distinct 403, never an existence echo. Example: `GET /api/v1/runs/{id}` (`app/api/v1/runs/[id]/route.ts`) and `GET /api/v1/tests/{id}` both map RPC error `P0002` straight to a generic 404 via `mapRunRpcError`/`mapTestRpcError`. QA implication: a 403 response from most read/write-detail routes is itself sometimes a signal of a bug, since the intended behavior is a uniform 404.
2. **Optimistic-lock conflicts (409, `reason: version_conflict`).** `PATCH /api/v1/tests/{id}/reorder` and `PUT /api/v1/tests/{id}/tags` both echo the *live* server state (`current_version`, `current_chain`/`current_tags`) inside `details` on a 409 — not just an empty conflict signal. Same pattern on `PATCH /api/v1/atcs/{id}` via `X-If-Match`.
3. **HYBRID validation model.** Most create/update routes keep the coarse house `code` (`validation_failed`, 422) but attach a granular, stable `details.reason` (e.g. `name_too_short`, `depth_exceeded`, `module_slug_duplicate`) — e.g. `POST /api/v1/projects/{id}/modules` (`app/api/v1/projects/[id]/modules/route.ts`). QA should assert on `details.reason`, not the prose `message`.
4. **Domain-specific codes bypass the generic bucket entirely** where the ATP/business rule needs to be independently branch-able — see the full `ApiErrorCode` union in `lib/api/error-envelope.ts`: `ac_outside_user_story`, `module_outside_project_subtree`, `steps_position_invalid`, `slug_collision`, `chain_empty`, `chain_mismatch`, `chain_invalid`, `no_executable_steps`, `environment_invalid`.
5. **Anti-enumeration on auth routes.** `signin`/`signup`/`confirm`/`resend`/`magic-link` all map upstream Supabase errors by **HTTP status only** and never forward the raw upstream message (`auth/resend/route.ts`'s own header explicitly cites this as the fix for a prior leak, BK-181).

---

## 5. Discovery gaps

- **5.1 — No CI-results-file/JUnit ingestion endpoint exists.** The briefing's premise (a "Mode 3: automated execution" importing CI results under `imports/`) does not match the code: `POST /api/v1/imports` is exclusively a Jira Story import (JQL-driven). Automated/CI execution is instead modeled as `runs.executor_mode = 'ci'` on the ordinary `POST /api/v1/runs` → mark-steps → finish flow, PAT-authenticated. Verified against `lib/jira/import-runner.ts` and a full-text search of `upex-bunkai-tms/.context/business/business-model.md` (no "Mode 3"/"CI results"/"JUnit" text present there either). Flagging this explicitly rather than silently reinterpreting the brief.
- **5.2 — Request/response body shapes are summarized, not exhaustively enumerated.** Per the task's own priority order (endpoint-surface completeness over shape depth), Zod schema field lists were read for every route but not transcribed field-by-field into this document beyond what's needed for the critical-endpoints section and the "Notable rule" column. A follow-up pass reading `lib/*/validation.ts` directly would be needed for a full OpenAPI-equivalent field/type table — the live spec at `GET /api/openapi` (generated by `lib/openapi/registry.ts` from the same Zod schemas) is the authoritative source for that and was not itself fetched (would require a running instance).
- **5.3 — `route.openapi.ts` sibling files were not read.** `lib/openapi/registry.ts`'s header states each route has a `route.openapi.ts` sibling that registers its OpenAPI schema; this pass read every `route.ts` handler but did not open the `route.openapi.ts` siblings (if they exist for all 60 routes or only a subset was not verified).
- **5.4 — Rate limiting was not independently verified.** `ApiErrorCode` includes `rate_limited` (429) and several auth routes map upstream `status===429`, but whether the app-level rate limiter ADR-0007 flags as a "documented follow-up, not yet shipped" (for `check-email`'s enumeration exposure) has since shipped was not checked — treat `check-email` as still only Supabase-OTP-unprotected unless confirmed otherwise.
- **5.5 — Live schema/DB access was not exercised.** Consistent with `.context/project-config.md`'s own Discovery Gaps, no `[DB_TOOL]` query confirmed the deployed RPC signatures match the route-level `lib/supabase/rpc.ts` wrapper calls read in this pass — the analysis trusts the TypeScript call sites, not a live introspection of the Postgres functions.
- **5.6 — `/api/v1/health` and `/api/v1` root were the only two "meta" endpoints found**; no separate `/api/v1/version` or admin/ops-only endpoints exist beyond what's listed in §2.
