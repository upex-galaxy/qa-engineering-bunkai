# HD-T01: TMS-Home | Active test runs table

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Phase** | Standalone (first automation ticket in this epic) |
| **Items** | 7 TCs (1 multi-row parameterized: BK-852) |
| **Dependencies** | None |
| **Requires** | Staging test-user creds (`.env`), a discoverable seeded workspace (e.g. `sir-tests-a-lot`) with ≥2 projects each carrying ≥1 Test + Environment, `bun run api:sync` executed before Phase 2 (see automation-plan.md §Architecture Decisions) |
| **Source** | Story: BK-256 (Epic BK-254 — Home Dashboard) |

## Summary

BK-256 ships the Home screen's "Active test runs" widget: a workspace-wide table of runs currently `running`, a live count, and a one-click Resume into the most recently active run. The feature is already merged (status "Ready For Release") — this scope automates the 7 Candidate TCs already documented in Xray against the live `lib/home/active-runs.ts` rollup and `components/home/ActiveRuns.tsx` render. Coverage spans the table's full row contract (AC1), the empty state (AC2), and the Resume action's clickability (AC3) and exact destination (state-transition + boundary risk beyond AC). A related defect, BK-620 (cross-project Test leak), was filed during the original manual pass; it does not falsify any AC of this story and is treated purely as a test-data-isolation risk for TC1's multi-project precondition (see automation-plan.md §4).

## Test Cases

> Bodies live in Jira. Synced copies sit under
> `.context/PBI/epics/EPIC-BK-254-home-dashboard/stories/STORY-BK-256-tms-home-show-active-test-runs-summary-and-table/test-cases/`.

| TMS ID | Title | Type | Priority |
|--------|-------|------|----------|
| BK-849 | TC1: should list every active run with run id, project, mode, status, progress and executor given 2+ projects have active runs | Positive | Critical |
| BK-850 | TC2: should show the empty state given no run in the workspace is active | Negative (empty-state) | High |
| BK-851 | TC3: should resume the most recently active run from Home | Positive (navigation, generic) | Critical |
| BK-852 | TC4: should exclude a run from the active table once its status becomes \<status\> (Scenario Outline: Finished, Aborted) | State-transition (parameterized, 2 rows) | High |
| BK-853 | TC5: should show a run as blocked when one of its steps is blocked | Positive (derived sub-state) | High |
| BK-854 | TC7: should render a non-zero mid-progress value while a run is still active | Boundary (BVA) | Medium |
| BK-855 | TC8: should navigate to the correct run's execution screen when Resume is clicked | Positive (navigation, exact target) | High |

TC6 was EP-merged into BK-852 by `/test-documentation` (same action + same outcome, differing only by precondition status value) — no separate BK-key exists for it. A TC9 referenced only in an informal session note ("tie-break resolved as accepted/non-blocking") is NOT a synced TMS Test and is out of this automation scope.

## Automation Plan

**Order**:
1. **BK-850** first — cheapest (UI-only render, isolated throw-away workspace via `POST /api/v1/workspaces`), and it validates `HomeApi`/`HomePage` wiring end-to-end on the simplest path before the run-lifecycle helpers are exercised.
2. **BK-849** — establishes the `RunsApi` precondition helpers (start run) that every remaining TC reuses.
3. **BK-851**, **BK-855** — reuse BK-849's run-creation helper; BK-855 additionally needs two runs with distinguishable recency.
4. **BK-853**, **BK-854** — reuse run-creation + add `markRunStep` helper calls.
5. **BK-852** last — reuses run-creation + adds `finishRun`/`abortRun` helper calls (2 data rows).

**Shared fixtures**: All 7 scenarios share `HomePage` (UI) for the table/empty-state/resume assertions and `HomeApi.getActiveRuns` (API) as a cross-check helper. TCs BK-849, BK-851, BK-852, BK-853, BK-854, BK-855 additionally share `RunsApi` (new, helpers-only, no `@atc` under this ticket — see automation-plan.md §3) for run-lifecycle precondition setup: `startRunSuccessfully`, `markRunStep`, `finishRun`, `abortRun`, `getRunById`.

**Blocked by**: Nothing hard-blocking. Two plan-time judgment calls are documented as `open_questions` in the automation-plan (per-cell row locators beyond the row-level test-id, and the 0-done-steps BVA boundary) — neither blocks writing the plan, both should be resolved/confirmed before or during Phase 2 Code.

**Preconditions for the whole scope**: A reachable workspace with ≥2 projects, each carrying ≥1 Test chained to ≥1 executable ATC and ≥1 configured Environment (so `POST /api/v1/runs` can start a run). Confirmed live via the OpenAPI MCP (schema-read-only, this session) that the full precondition chain is reachable over public REST — no direct DB/RPC access is required for setup: `POST /api/v1/workspaces` (isolated throw-away workspace, used for BK-850's empty-state precondition), `POST /api/v1/workspaces/{id}/projects`, `POST /api/v1/atcs`, `POST /api/v1/tests`, `POST /api/v1/projects/{id}/environments`, `POST /api/v1/runs`, `POST /api/v1/runs/{id}/steps/{stepId}/mark`, `POST /api/v1/runs/{id}/finish`, `POST /api/v1/runs/{id}/abort`. `api/openapi-types.ts` is still the shipped stub (`bun run api:sync` has never been run in this repo) — Phase 2 Code must run it first to get real typed request/response shapes for `api/schemas/home.types.ts` and `api/schemas/runs.types.ts`.

## Merged TCs (if any)

| Removed ID | Merged Into | Reason |
|------------|-------------|--------|
| TC6 (no BK-key — never synced standalone) | BK-852 | Same action (open Home) + same outcome (excluded from active table), differing only in precondition status value (`aborted` vs `passed`/`failed`) — EP-merge within one partition, already performed by `/test-documentation`. |

## Updated TCs (if any)

None — all 7 TCs are unmodified from the synced Xray content.

## Acceptance Criteria

- [ ] AC1 (multi-project active-runs table, all 6 columns) automated via BK-849
- [ ] AC2 (empty state) automated via BK-850
- [ ] AC3 (resume most-recently-active run) automated via BK-851 (generic navigation) + BK-855 (exact destination)
- [ ] Business Rule (Running/Blocked active, Finished/Aborted excluded) automated via BK-852 (exclusion) + BK-853 (Blocked derived sub-state, `runs.status` stays `running`)
- [ ] BVA on step-completion progress automated via BK-854 (mid-progress + done==total-but-still-running edge) — see automation-plan.md §Technique-derivation check for the flagged 0-done-steps gap
- [ ] Tests pass on local and staging
