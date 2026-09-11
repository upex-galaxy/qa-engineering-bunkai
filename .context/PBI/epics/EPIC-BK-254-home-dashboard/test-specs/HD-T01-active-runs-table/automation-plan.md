# Test Automation Plan: BK-256

> Ticket: BK-256 — TMS-Home | Show active test runs summary and table
> Type: e2e (hybrid API+UI for 6/7 TCs; UI-only for BK-850)
> Sprint: N/A (story already merged — "Ready For Release"; this is retroactive automation of Candidate TCs)
> Created: 2026-09-11

## 1. Ticket Summary

- **What to test**: the Home screen's "Active test runs" widget — a workspace-wide table of runs with `status='running'`, a live count, a per-row "Blocked" derived chip, step-completion progress, and a Resume action that opens the most recently active run's own execution screen.
- **Acceptance Criteria**:
  - AC1: 2+ projects have active runs → Home lists every one of them with run id, project, execution mode, status, progress, executor.
  - AC2: no active runs → table shows an empty state.
  - AC3: ≥1 active run → QA Lead can resume the most recently active run directly from Home.
  - Business Rule: active = `status IN (running, blocked)`; Finished (`passed`/`failed`) and Aborted are excluded. (Confirmed at the data layer: `runs.status` has no `blocked` value — Blocked is a derived, presentation-only sub-state; see D1/D2 below.)
- **Dependencies**: None. This is the first ticket automated in this repo against the real Bunkai product (the only pre-existing components are the generic `AuthApi`/`LoginPage`/`ExampleApi`/`ExamplePage` scaffolds — confirmed via `kata-manifest.json`, which carries zero `BK-*` ATC IDs).

## 2. Architecture Decisions

> **ADR promotion check** (playbook §2): none of the decisions below are promoted to an ADR. Reasoning: the new fixture usage (`{ test }` for hybrid scenarios) is the *existing* KATA fixture-selection rule, not a new lifecycle; the run-lifecycle helpers (`RunsApi`) are ticket-local precondition scaffolding expected to be reused (not redesigned) by the future "TMS-Run Execution" epic's own automation ticket, which is a normal cross-ticket reuse, not a cross-module architectural contract; and there is no auth-in-tests change, no new test-data-isolation *contract* (Discover/Modify/Generate is applied per the existing playbook framework, not a new pattern). If the future Run Execution ticket needs to change how runs are created/marked for automation (e.g., a dedicated "test-only" fast-path), that decision belongs to that ticket, promoted to an ADR then if it turns out to be cross-cutting.

Dev decisions D1–D7 (from the Story's synced `implementation-plan.md`) that constrain test design:

| Dev decision | Test-design impact |
|---|---|
| **D1** — "Active" = `runs.status = 'running'`; no `blocked` value exists at `runs.status` | BK-852's exclusion ATC only needs to drive `runs.status` to `passed`/`failed`/`aborted` via `finish`/`abort`, never a `blocked` run-level value — confirmed there is nothing to (mis)test at that level. |
| **D2** — "Blocked" is a per-row UI sub-state derived from `run_steps.status='blocked'`; `runs.status` stays `running` | BK-853's fixed assertion must check BOTH the chip (`data-status="blocked"`) AND that the underlying `status` field the API returns for that run is still `"running"` — not two separate ATCs, one ATC with two assertions (same precondition + action, same TC per the TC-identity rule). |
| **D3** — New endpoint `GET /api/v1/workspaces/{id}/active-runs`, gated on `atc:read` (not `run:execute`) | `HomeApi.getActiveRuns` uses the session cookie set by `AuthApi`/`LoginPage` login (cookie sessions hold every capability) — no separate PAT/scope wiring needed for this ticket's read path. |
| **D4** — Executor resolved via existing `bunkai_resolve_activity_actors` RPC, no new RPC | No test-design impact; internal to the app. Executor identity in TC1's assertion is whatever the logged-in test user's resolved label is — asserted structurally (label present, non-empty), not against a hardcoded name. |
| **D5** — Progress = `done/total` from `run_steps`, not a stored column | BK-854's precondition needs a run with a KNOWN step count and a KNOWN number of steps marked — both controlled via `RunsApi.markRunStep` calls, count derived from the Test's ATC chain used to start the run (so the test must know/control how many steps that Test has). |
| **D6** — "Most recently active" = `max(run_steps.executed_at)` falling back to `started_at`, `id desc` tie-break | BK-855's precondition needs 2+ candidate runs with an unambiguous recency ordering (see `atc/BK-855-*.md` §8 for exactly how — literal `id desc` tie-break collision is NOT engineered, matching the informal "TC9" note in the ticket, which is explicitly out of this automation scope). |
| **D7** — Run id = first 8 chars of uuid, mono; started time = absolute UTC `YYYY-MM-DD HH:MM`; no overflow menu; no "All runs" link | Confirms there is no extra "overflow menu" or "all runs" ATC to plan for — matches Out-of-scope (`step-by-step run execution`, `run history`, `filtering beyond default view`). |

### Component Strategy

| Decision | Value | Rationale |
|---|---|---|
| API component (feature) | `HomeApi.ts` (new) | Mirrors the app's own `lib/home/` module grouping (`lib/home/active-runs.ts`, shared by sibling Home-epic stories BK-255/257/258/259/260). One domain component per Home widget's underlying endpoint family. |
| API component (setup helpers) | `RunsApi.ts` (new) | Wraps the run-lifecycle mutation endpoints (`POST /api/v1/runs`, `.../abort`, `.../finish`, `.../steps/{stepId}/mark`, `GET /api/v1/runs/{id}`) — confirmed live via the OpenAPI MCP this session. These endpoints belong to a DIFFERENT feature ("TMS-Run Execution", explicitly out-of-scope for BK-256's own ACs) and have no BK-* TMS Test ID of their own yet, so their methods are helpers (no `@atc`) for this ticket — see §3 "New Helpers". |
| UI component | `HomePage.ts` (new) | One Page component for the Home screen's Active-Runs widget. Sibling Home-epic stories (welcome banner, recent projects, bug counts, coverage, activity feed) will likely add ATCs to this same class later — flagged so a future ticket watches the 15–20 ATC/file ceiling (kata-architecture.md §5), not a concern yet at 7 ATCs. |
| Fixture | `{ test }` for BK-849, BK-851, BK-852, BK-853, BK-854, BK-855 (hybrid: API setup via `RunsApi` + UI drive/verify via `HomePage`, cross-checked via `HomeApi`). `{ ui }` for BK-850's `test()` call itself (UI-only render/assertion) — its precondition setup uses `{ api }` in `beforeAll` only, per the standard e2e-patterns.md §7 template (`beforeAll(async ({ api }) => ...)` + `test(async ({ ui }) => ...)`), which does not violate the "no browser for API-only setup" rule since `beforeAll`'s fixture request is independent of the test's. |
| Test file | `tests/e2e/home/viewActiveRunsTable.test.ts` | One file, one ticket, one `describe('BK-256: ...')` — all 7 TCs are aspects of the same feature/screen; doctrine allows (and the naming convention expects) keeping one ticket in one file even at 7 TCs (top of the 1–7 expected range). |
| Preconditions | Inline per test (no Steps module) | The run-creation/mark/finish/abort chain is reused 6 times across 6 tests IN THIS ONE FILE, not across 3+ *files* — kata-architecture.md §8's Steps threshold ("3+ ATCs repeated across 3+ test FILES") is not met. Keep as direct helper calls inside each test's Arrange step; revisit as a `RunSetupSteps` class only once a second file (e.g. the future Run-Execution ticket) needs the same chain. |

### UI Elements

| Element | Locator Strategy | Locator Value |
|---|---|---|
| Active runs section | `getByTestId` | `home-active-runs` |
| Active runs table | `getByTestId` | `home-active-runs-table` |
| Active runs row (dynamic) | `getByTestId` | `` home-active-runs-row-${runId} `` |
| Active runs count | `getByTestId` | `home-active-runs-count` |
| Empty state | `getByTestId` | `home-active-runs-empty` |
| Resume button | `getByTestId` | `home-active-runs-resume` |
| Status chip (per row, derived) | CSS attribute (documented product contract, not a `data-testid`) | `[data-status]` inside the row, e.g. `activeRunsRow(runId).locator('[data-status]')` — reuses `app/globals.css`'s `.status-chip[data-status]` / `.dot[data-status]` grammar per D2 |

**Open question (locator gap)**: only row-level (`home-active-runs-row-{id}`) and section-level test-ids are documented. Per-cell locators inside a row (project name, mode, status text, progress text, executor) have no documented `data-testid`s. Phase 2 Code must inspect `components/home/ActiveRuns.tsx` directly for the real per-cell selectors, or fall back to `getByRole`/text-scoped-within-row queries per e2e-patterns.md §3 "When a data-testid is missing" (and file a test-id-gap ticket if genuinely absent) — flagged as `open_question`, not resolved here.

### API Details

| Aspect | Value |
|---|---|
| Endpoint (feature under test) | `GET /api/v1/workspaces/{id}/active-runs` — query param `limit` (1–20, default 5). Confirmed live via OpenAPI MCP: 200 (possibly-empty `runs[]` + `active_count`), 400 (bad workspace id), 401, 403 (missing `atc:read`), 422 (`limit` out of range), 500 (never collapses a failed read into an empty list — worth a light negative-path note, out of this ticket's TMS scope but consistent with "risk-beyond-AC" doctrine; not automated here since no TC authorizes it — see open_questions). |
| Endpoints (setup helpers, `RunsApi`) | `POST /api/v1/runs` (requires `Idempotency-Key` header, 8–128 chars `[a-zA-Z0-9_-]`), `POST /api/v1/runs/{id}/abort`, `POST /api/v1/runs/{id}/finish`, `POST /api/v1/runs/{id}/steps/{stepId}/mark`, `GET /api/v1/runs/{id}` |
| OpenAPI Type(s) | `api/schemas/home.types.ts` (new facade: `ActiveRunsResponse`, `ActiveRunRow`) + `api/schemas/runs.types.ts` (new facade: `RunResponse`, `RunCreateBody`, `RunStepMarkBody`, `RunFinishBody`, `RunAbortBody`). **Blocked on `bun run api:sync`** — `api/openapi-types.ts` is still the shipped stub (`export type components = any; export type paths = any;`), confirmed by direct read this session. Phase 2 Code must run `bun run api:sync` against a live backend first, then build both facades from the real generated types (per api-patterns.md §4) instead of hand-typing interim `Custom Types`. |
| Auth Required | Yes — cookie session (via `AuthApi`/`LoginPage` login flow) for both the read and the setup mutations. No PAT/scope wiring needed for this ticket. |
| Return Pattern | 2-tuple `[APIResponse, ActiveRunsResponse]` for `HomeApi.getActiveRuns` (GET) and `[APIResponse, RunResponse]` / `[APIResponse, RunResponse, RunCreateBody]` for `RunsApi` methods per the GET/mutation tuple convention. |

## 3. ATC Registry

### Existing ATCs (Reuse)

None. `kata-manifest.json` was checked first (per Critical Rule #12) — its only entries are the generic scaffold IDs `PROJ-101`/`PROJ-102`/`PROJ-103` across `AuthApi`, `ExampleApi`, `LoginPage`, `ExamplePage`. No `BK-*` ATC ID exists anywhere in `components.api[].atcs[]` or `components.ui[].atcs[]`, and no `HomeApi`/`HomePage`/`RunsApi` component name exists — confirming zero ID-collision risk and zero duplicate-component risk for everything proposed below.

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| BK-849 | `HomePage` | `viewActiveRunsAcrossProjects(expectedRunIds: string[])` | Navigate to Home, wait for the active-runs table, assert every expected run row is present with all 6 data points structurally rendered. |
| BK-850 | `HomePage` | `viewActiveRunsEmptyState()` | Navigate to Home, assert the empty-state test-id is visible (and the table/rows are not). |
| BK-851 | `HomePage` | `resumeMostRecentActiveRunSuccessfully()` | Click Resume, assert the browser navigated away from `/home` (generic — does not assert the exact destination). |
| BK-852 | `HomePage` | `verifyRunExcludedFromActiveTable(runId: string)` | Navigate to Home, assert the given run's row is absent and the count does not include it. Parameterized — called once per data row (`Finished`, `Aborted`) from the test file, per the EP-merge already performed in Xray. See `atc/BK-852-exclude-run-from-active-table.md`. |
| BK-853 | `HomePage` | `verifyRunShowsBlockedChip(runId: string)` | Navigate to Home, assert the run's row renders a `data-status="blocked"` chip, AND (via `HomeApi.getActiveRuns`) that the same run's underlying `status` is still `"running"`. |
| BK-854 | `HomePage` | `verifyRunProgressRendersValue({ runId, doneSteps, totalSteps }: ProgressArgs)` | Navigate to Home, assert the run's row progress text equals `` `${doneSteps}/${totalSteps}` ``. Object param — 3 logical values collapse to 2 positional max. |
| BK-855 | `HomePage` | `resumeNavigatesToTargetRun({ expectedProjectSlug, expectedRunId }: ResumeTargetArgs)` | Click Resume, assert the exact destination `/projects/{expectedProjectSlug}/runs/{expectedRunId}` — distinct fixed assertion from BK-851 (exact vs generic), so a distinct ATC per Rule 3 (different assertion shape, not a mergeable EP variant). See `atc/BK-855-resume-navigates-to-correct-run.md`. |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|---|---|---|---|
| `HomeApi` | `getActiveRuns(workspaceId: string, params?: { limit?: number })` | `[APIResponse, ActiveRunsResponse]` | GET `/api/v1/workspaces/{id}/active-runs`. Read-only — used as a verification step inside BK-853's ATC and for test-level cross-checks in BK-849/852/854. |
| `HomeApi` | `findWorkspaceBySlug(slug: string)` | `Workspace \| null` | Discover helper — GETs `/api/v1/workspaces` (list the caller's workspaces) and filters client-side by `slug`. Silent-fail (returns `null`) per typescript-patterns.md §7 utility rule; callers `test.skip()` on `null`. |
| `RunsApi` | `startRunSuccessfully(payload: RunCreateBody)` | `[APIResponse, RunResponse, RunCreateBody]` | POST `/api/v1/runs` (with a generated `Idempotency-Key` header per call, via `crypto.randomUUID()` or `faker.string.alphanumeric(32)`). Precondition-setup helper for a DIFFERENT feature (Run Execution) — not decorated `@atc` under BK-256; expected to gain `@atc('BK-XXX')` once that feature's own TMS Tests exist and reuse this exact method (reuse-not-rebuild, per kata-manifest doctrine). |
| `RunsApi` | `markRunStep(args: { runId: string, stepId: string, status: 'passed' \| 'failed' \| 'blocked' })` | `[APIResponse, RunResponse]` | POST `/api/v1/runs/{id}/steps/{stepId}/mark`. Object param (3 logical fields). |
| `RunsApi` | `finishRun(args: { runId: string, verdict: 'passed' \| 'failed' })` | `[APIResponse, RunResponse]` | POST `/api/v1/runs/{id}/finish`. |
| `RunsApi` | `abortRun(args: { runId: string, reason: string })` | `[APIResponse, RunResponse]` | POST `/api/v1/runs/{id}/abort` (reason must be 3–500 chars per the live schema). |
| `RunsApi` | `getRunById(runId: string)` | `[APIResponse, RunResponse]` | GET `/api/v1/runs/{id}` — reads the expanded `run_atcs`/`run_steps` snapshot so a test can discover real `stepId`s to pass into `markRunStep`. |

## 4. Test Data Strategy

Every precondition below was checked against the live endpoint surface via the OpenAPI MCP (schema-read-only) this session — the full setup chain (workspace → project → ATC → Test → Environment → Run → step-mark/finish/abort) is reachable over public REST; no direct DB/RPC access is required, resolving the plan-time DB-feasibility question the orchestrator raised as a judgment call.

| Ticket | Precondition | Pattern | Feasibility | Notes |
|---|---|---|---|---|
| BK-849 | Workspace has active runs in 2+ different projects | Discover (workspace/projects/Tests/Environments) + Generate (fresh `Run` per project) | Feasible | Discover the seeded fixture workspace by slug (`HomeApi.findWorkspaceBySlug('sir-tests-a-lot')` or equivalent per `.agents/project.yaml`); for 2 of its projects, discover an existing Test + Environment pair and `RunsApi.startRunSuccessfully` a fresh run in each. **BK-620 interaction**: the fixture workspace's projects must be genuinely independent Tests (not the leaked cross-project Test from BK-620) — Discover by project-scoped Test listing, never by a bare workspace-wide Test search, so the isolation strategy does not accidentally rely on (or get masked by) the BK-620 leak. Each test run creates its OWN fresh `Run` (test independence rule) rather than reusing another test's run. |
| BK-850 | No active runs anywhere in the workspace | Generate (throw-away workspace) | Feasible, low-risk | `POST /api/v1/workspaces` creates a brand-new, guaranteed-empty workspace (auto-enrolls the caller as owner) in `beforeAll`. Preferred over Modify-ing the shared fixture workspace's runs, which would race against BK-849/851/852/853/854/855 potentially running in parallel against the same shared workspace. |
| BK-851 | ≥1 active run, resumed one is the most recently started | Discover (project/Test/Environment) + Generate (1 fresh `Run`) | Feasible | Single run is trivially "most recent" — no ordering contention to engineer. |
| BK-852 | A run transitions `running` → `Finished` (`passed`/`failed`) or `Aborted` | Generate (fresh `Run`) + Modify (`RunsApi.finishRun` / `RunsApi.abortRun`) | Feasible | Directly maps to the confirmed `POST /api/v1/runs/{id}/finish` and `.../abort` endpoints — these ARE the dev plan's `bunkai_finish_run`/`bunkai_abort_run` RPCs, exposed over public REST. 2 data rows, one run generated per row. |
| BK-853 | A run is `running` with ≥1 step `blocked` | Generate (fresh `Run`) + Modify (`RunsApi.getRunById` to discover a `stepId`, then `RunsApi.markRunStep({ status: 'blocked' })`) | Feasible | Maps directly to the confirmed `POST /api/v1/runs/{id}/steps/{stepId}/mark` endpoint (`bunkai_mark_run_step`). |
| BK-854 | A run is `running` with `0 < done_steps < total_steps` | Generate (fresh `Run` from a Test with ≥2 executable steps) + Modify (mark a strict subset `passed`, leave the rest `pending`) | Feasible | Requires discovering/creating a Test whose ATC chain yields ≥2 steps so a genuine 0<done<total split is possible; a 1-step Test cannot produce this boundary. |
| BK-855 | Home's Resume target is unambiguous among 2+ active runs | Discover (project/Test/Environment) + Generate (2 sequential `Run`s) | Feasible, timing-sensitive | See `atc/BK-855-resume-navigates-to-correct-run.md` §8 — 2 runs created with a deliberate small gap (mark a step on the first before creating the second) so recency is unambiguous by construction; the literal `id desc` tie-break collision is NOT engineered (matches the out-of-scope "TC9" note). |

### DataFactory additions / Constants additions

```typescript
// tests/data/types.ts
export interface RunCreatePayload {
  test_id: string
  environment_id: string
  actor?: 'human' | 'agent' | 'ci'
}

// tests/data/DataFactory.ts (new methods)
generateIdempotencyKey(): string   // faker.string.alphanumeric(32) — satisfies the 8-128 char [\w-] contract
generateAbortReason(): string      // faker.lorem.sentence() truncated/padded into the 3-500 char window
```

## 5. Test Scenarios

### File: `tests/e2e/home/viewActiveRunsTable.test.ts`

Fixture: mixed — see per-scenario below. All scenarios sit under one `test.describe('BK-256: Validate the Home active-runs table')`.

#### Scenario 1 — BK-849 (multi-project table)
Test: `"BK-256: should list every active run across 2+ projects with run id, project, mode, status, progress and executor"`
Preconditions: 2 fresh runs started via `RunsApi.startRunSuccessfully` in 2 different discovered projects of the fixture workspace.
ATCs called: `HomePage.viewActiveRunsAcrossProjects([runA.id, runB.id])`.
Test-level assertions: the returned `ActiveRunsResponse.active_count` from `HomeApi.getActiveRuns` includes both runs; row content for each matches its own project/mode/executor (not swapped).
Teardown: none required — runs stay `running`; each test creates its own runs so no cross-test interference.

#### Scenario 2 — BK-850 (empty state)
Test: `"BK-256: should show the empty state when no run in the workspace is active"`
Fixture: `{ ui }` for the test body; `{ api }` in `beforeAll` only.
Preconditions: `beforeAll` creates a throw-away workspace via `HomeApi`/raw `apiPOST` (no runs ever started in it); `test.skip()` if creation fails.
ATCs called: `HomePage.viewActiveRunsEmptyState()`.
Test-level assertions: none beyond the ATC's fixed assertion (this is a pure render check).
Teardown: none — throw-away workspace is not cleaned up (no delete-workspace precondition in scope; flagged as a minor housekeeping note, not a blocker).

#### Scenario 3 — BK-851 (resume, generic)
Test: `"BK-256: should resume the most recently active run directly from Home"`
Preconditions: 1 fresh run started.
ATCs called: `HomePage.resumeMostRecentActiveRunSuccessfully()`.
Test-level assertions: none beyond the ATC's fixed assertion (navigation occurred).
Teardown: none.

#### Scenario 4 — BK-855 (resume, exact target)
Test: `"BK-256: should navigate to the correct run's execution screen when Resume is clicked"`
Preconditions: 2 runs created with an unambiguous recency gap (see `atc/BK-855-*.md`).
ATCs called: `HomePage.resumeNavigatesToTargetRun({ expectedProjectSlug, expectedRunId })`.
Test-level assertions: none beyond the ATC's fixed assertion (exact URL match).
Teardown: none.

#### Scenario 5 — BK-852 (state-transition, parameterized)
Test: `"BK-256: should exclude a run from the active table once its status becomes {status}"` — one `test()` generated per data row via a `for` loop over `[{ label: 'Finished', transition: () => runsApi.finishRun({ runId, verdict: 'passed' }) }, { label: 'Aborted', transition: () => runsApi.abortRun({ runId, reason: '...' }) }]`.
Preconditions: 1 fresh run per row, transitioned via the row's `transition()` before the assertion.
ATCs called: `HomePage.verifyRunExcludedFromActiveTable(runId)`.
Test-level assertions: `HomeApi.getActiveRuns` count strictly decreases by 1 relative to a pre-transition baseline read.
Teardown: none — transitioned runs are terminal, no further state to clean.

#### Scenario 6 — BK-853 (blocked chip)
Test: `"BK-256: should show a run as blocked when one of its steps is blocked"`
Preconditions: 1 fresh run; `RunsApi.getRunById` to discover a real `stepId`; `RunsApi.markRunStep({ status: 'blocked' })` on it.
ATCs called: `HomePage.verifyRunShowsBlockedChip(runId)`.
Test-level assertions: none beyond the ATC's fixed assertions (chip + underlying status, per D2 — both are one TC's assertions).
Teardown: none.

#### Scenario 7 — BK-854 (mid-progress boundary)
Test: `"BK-256: should render a non-zero mid-progress value while a run is still active"`
Preconditions: 1 fresh run from a Test with ≥2 steps; mark a strict subset (e.g. 1 of 3) `passed`.
ATCs called: `HomePage.verifyRunProgressRendersValue({ runId, doneSteps: 1, totalSteps: 3 })`.
Test-level assertions: a second read after marking the remaining steps confirms the run STAYS listed as active at `done==total` while `status` is still `running` (the doctrine-required edge already inside this TC's own Expected Results — not a separate ATC).
Teardown: none.

## 6. Implementation Order

- [ ] Run `bun run api:sync` against the live backend; regenerate `api/openapi-types.ts`
- [ ] Add types to `tests/data/types.ts` (`RunCreatePayload`)
- [ ] Add factory methods to `tests/data/DataFactory.ts` (`generateIdempotencyKey`, `generateAbortReason`)
- [ ] Create `api/schemas/home.types.ts` + `api/schemas/runs.types.ts` facades; re-export both from `api/schemas/index.ts`
- [ ] Create `tests/components/api/HomeApi.ts` (helpers: `getActiveRuns`, `findWorkspaceBySlug`)
- [ ] Create `tests/components/api/RunsApi.ts` (helpers: `startRunSuccessfully`, `markRunStep`, `finishRun`, `abortRun`, `getRunById`)
- [ ] Register both in `tests/components/ApiFixture.ts` (and forward `setAuthToken`/`clearAuthToken`/`setRequestContext` per api-patterns.md §6)
- [ ] Create `tests/components/ui/HomePage.ts` (7 ATCs: BK-849, BK-850, BK-851, BK-852, BK-853, BK-854, BK-855)
- [ ] Register `HomePage` in `tests/components/UiFixture.ts`
- [ ] Create `tests/e2e/home/viewActiveRunsTable.test.ts` (7 scenarios, one `describe`)
- [ ] Run tests, types:check, lint:check; regenerate `kata-manifest.json` and stage it
- [ ] Link each of the 7 Tests to its automated test (`test_automation` link) + flip `automated`/`automation-candidate` labels once merged with CI green (per SKILL.md §Phase 2 step 6)
- [ ] TMS TC transitions to Pull Request when the PR opens (`create_pr` transition) — Automated only lands post-merge via the `merged` transition

## 7. Success Criteria

- [ ] All 3 ACs covered (the floor) — also: risk-beyond-AC covered where a TC already authorizes it (D2's dual assertion in BK-853, D6's ordering in BK-855). The `500` "never collapses to empty list" risk on the read endpoint is noted in §API Details but NOT automated here (no TC authorizes it) — see open_questions.
- [ ] Boundary cases (BVA) automated wherever an AC has a range/limit — BK-854 covers strict-mid and the `done==total`-but-still-`running` edge. The `0`-done-steps edge is **NOT** covered by any of the 7 TCs — flagged as `open_question`, not silently added as an 8th ATC.
- [ ] KATA compliance (layers, ATC atomicity, inline-then-extract locators, max-2-positional-params, import aliases)
- [ ] Fixture correct per scenario (§Component Strategy table)
- [ ] No hardcoded waits
- [ ] Aliases used (`@api/`, `@ui/`, `@schemas/`, `@variables`, `@TestContext`, `@TestFixture`)
- [ ] Tests pass locally and on staging
- [ ] TMS TC moved to Pull Request on PR open (never "Automated" after local validation)
