# Test Automation Plan: BK-260

> Ticket: BK-260 — TMS-Home | Show a condensed recent activity feed
> Type: e2e (hybrid API+UI for 4/5 TCs; UI-only for BK-625)
> Sprint: N/A (story already merged — "Ready For Release"; this is retroactive automation of Candidate TCs)
> Created: 2026-09-21

## 0. Anti-duplication pre-flight (Critical Rule #12)

`kata-manifest.json` (root, `generatedAt: 2026-09-11T22:23:20.084Z`, currently clean per `bun run kata:manifest:check`) was read in full before drafting anything below. Checked:

- **Component names**: `HomePage` and `HomeApi` already exist (created for BK-256/HD-T01) — this plan EXTENDS both, per the briefing's own instruction, not create new `RecentActivity`-named classes. `RunsApi` already exists and is reused as-is (zero changes). `ModulesApi` and `BugsApi` do NOT exist anywhere in the manifest — confirmed new.
- **ATC IDs**: none of `BK-624`, `BK-625`, `BK-626`, `BK-627`, `BK-631` appear anywhere in `components.api[].atcs[].id` or `components.ui[].atcs[].id`. Zero collision risk.
- **Method names**: `viewCondensedActivityFeedItem` / `navigateToActivityFromHeaderLink` / `navigateToActivityFromEmptyState` / `viewRecentActivityEmptyState` / `verifyActivityIsolatedByWorkspace` (this plan's proposed names, see §3) do not appear anywhere in `components.ui[].atcs[].method` (`HomePage`'s existing 7 methods are all `*ActiveRuns*` / `resume*`, no overlap). Confirmed no name collision.

## 1. Ticket Summary

- **What to test**: Home's "Recent activity" widget — a condensed, presentation-only feed reusing BK-49's activity stream (`fetchActivityPage`), windowed to `HOME_CHANGE_WINDOW_HOURS` (24h) and capped at `HOME_ACTIVITY_FEED_LIMIT` (6) rows, with a header "View all" link and an empty-state variant of the same link.
- **Acceptance Criteria** (from `acceptance-criteria.md`):
  - AC1: workspace has recent activity → Home shows a short list of the most recent events, each showing actor, action, target, relative time.
  - AC2: member selects the "View all" link → taken to the full activity view (`/activity`).
  - AC3: workspace has no recent activity → condensed feed shows an empty state.
- **Risk-beyond-AC** (not in any AC, but carried by TC8/BK-631 per the Story's own ATP row "Cross-workspace activity never leaks (RLS)"): `activity_log_select_workspace_member` RLS must never leak a foreign workspace's events into the caller's feed.
- **Dependencies**: None. Reuses `RunsApi` (BK-256) unchanged. BK-49 (TMS-Activity), the Story this reuses, is itself still `Ready For QA` — not a blocker, since BK-260 calls `fetchActivityPage` directly (shared function, not an HTTP dependency) per `context.md`.

## 2. Architecture Decisions

> **ADR promotion check** (playbook §2): none of the decisions below are promoted to an ADR. The two new API components (`ModulesApi`, `BugsApi`) are ticket-local precondition scaffolding for foreign domains, following the exact precedent `RunsApi` already set for BK-256 (helpers-only, no `@atc`, expected to gain real `@atc` IDs once those domains get their own TMS Tests) — a normal cross-ticket reuse pattern, not a new architectural contract. Extending `HomePage.goto()`'s wait condition is a backward-compatible addition (see below), not a lifecycle change. No new test-data-isolation contract, no auth-in-tests change.

### Component Strategy

| Decision | Value | Rationale |
|---|---|---|
| UI component | `HomePage.ts` (extend, existing) | Per the briefing's explicit instruction and the class's own doc-comment ("sibling Home-epic stories will likely add ATCs to this same class") — this ticket adds its 5 ATCs here, bringing the class to 12 ATCs (still under the 15–20/file ceiling in kata-architecture.md §5). |
| API component (feature) | `HomeApi.ts` (extend, existing) | Gains ONE new helper: `createWorkspace(payload: WorkspaceCreateBody)`. BK-256 deliberately left workspace creation as a raw `apiPOST` call at the test-file level (`home.types.ts`'s own comment: "no dedicated HomeApi ATC covers this") because BK-256 needed it exactly once. BK-260 needs it 3 times (shared by BK-625/626/627, twice more by BK-631) — enough repetition within ONE component to promote it to a thin typed helper (DRY, not yet a Steps-module threshold — see "Preconditions" row below). |
| API component (setup helpers, module domain) | `ModulesApi.ts` (new) | Mirrors `RunsApi.ts`'s established pattern exactly: these endpoints (`POST /api/v1/projects/{id}/modules`, `PATCH /api/v1/modules/{id}`) belong to a DIFFERENT feature (module management, out of scope for BK-260's own ACs) and have no BK-* TMS Test of their own yet — helpers only, no `@atc`, named after their OWN domain (not `HomeApi`), same as `RunsApi`'s doc-comment precedent. |
| API component (setup helpers, bug domain) | `BugsApi.ts` (new) | Same rationale as `ModulesApi` — wraps `POST /api/v1/bugs` (standalone) + `POST /api/v1/bugs/{id}/status`, a different feature (bug triage), helpers only. |
| Fixture | `{ test }` (hybrid) for BK-624, BK-626, BK-627, BK-631. `{ ui }` (UI-only) for BK-625 — see "Fixture challenge" below. | API setup + UI verify = hybrid per kata-architecture.md §7's fixture-selection table, EXCEPT BK-625 which needs neither a special precondition nor an API cross-check. |
| Test file | `tests/e2e/home/viewRecentActivityFeed.test.ts` | One file, one ticket, one `describe('BK-260: ...')` — mirrors HD-T01's `viewActiveRunsTable.test.ts` naming and one-ticket-one-file convention. |
| Preconditions | Inline per test (no Steps module) | The empty-workspace-creation chain is reused across 4 tests IN THIS ONE FILE (BK-625/626/627/631), not across 3+ *files* — kata-architecture.md §8's Steps threshold ("3+ ATCs repeated across 3+ test FILES") is not met. Revisit only once a second ticket/file needs the same empty-workspace precondition. |
| `HomePage.goto()` | Extend (not replace) the existing wait condition | Currently waits for `activeRunsTable().or(activeRunsEmpty())` only (BK-256's own widget). BK-260's ATCs need the recent-activity widget resolved too, and both widgets stream independently inside the same page's Suspense boundaries. Extend to `Promise.all([activeRunsTable().or(activeRunsEmpty()).first().waitFor(), recentActivityList().or(recentActivityEmpty()).first().waitFor()])` — additive, does not change BK-849..855's existing behavior (their own wait condition still resolves exactly when it did before; it now just ALSO waits for a widget those ATCs never asserted on, at zero cost since both widgets load in the same RSC pass). |

### Fixture challenge (per briefing instruction)

The briefing's default assumption ("all 5 ATCs need hybrid `{ test }`") is correct for 4 of 5. **BK-625 (header "View all" link) is challenged and overridden to UI-only `{ ui }`**: per `context.md` and direct read of `RecentActivity.tsx`, the header link lives in `RecentActivityShell`, rendered unconditionally by EVERY state (list, empty, error, skeleton) — there is no precondition to set up and no API cross-check the ATC needs. `ui.home.goto()` against whatever workspace is already active (no `useWorkspace()` call needed) is sufficient. This mirrors BK-850's own fixture note in HD-T01 (`{ ui }` for the test body, `{ api }` only in an unrelated `beforeAll` when one exists) — here there is no `beforeAll` at all.

### UI Elements

| Element | Locator Strategy | Locator Value |
|---|---|---|
| Recent-activity section | `getByTestId` | `home-recent-activity` |
| Recent-activity list | `getByTestId` | `home-recent-activity-list` |
| Recent-activity item (dynamic) | `getByTestId` | `` home-recent-activity-item-${eventId} `` |
| Recent-activity empty state | `getByTestId` | `home-recent-activity-empty` |
| Header "View all" link | `getByTestId` | `home-recent-activity-view-all` |
| Empty-state "Browse the full activity feed" link | `getByTestId` | `home-recent-activity-empty-view-all` |
| Verdict chip (per item, derived — reuses HD-T01's `[data-status]` precedent) | CSS attribute | `[data-status]` inside the item, e.g. `recentActivityItem(id).locator('[data-status]')` |
| Item glyph icon (per item, derived — NEW locator gap, no `data-testid`) | CSS class on the icon's `<svg>` | `recentActivityItem(id).locator('span[aria-hidden="true"] svg')`, asserted via its Tailwind color class (`text-signal-fail` for bug, `text-signal-running` for run, `text-accent` for the generic fallback) |

**Open question (locator gap, same pattern as HD-T01's per-cell gap)**: the item row (`home-recent-activity-item-{id}`) has no per-field `data-testid`s for actor / action label / item label — only the row-level and glyph-level (class-based) hooks above exist. Phase 2 Code asserts actor/action-label/item-label via `toContainText()` scoped to the row (structural assertion per e2e-patterns.md §3 "When a data-testid is missing"), not per-field exact matches. Flagged as `open_question`, consistent with how HD-T01 flagged its own per-cell gap rather than silently working around it — a follow-up ticket should add per-field `data-testid`s to `RecentActivity.tsx`'s item row.

### API Details

| Aspect | Value |
|---|---|
| Endpoint (feature under test) | None directly — BK-260 has no dedicated read endpoint; Home's server component calls `fetchActivityPage` (BK-49's shared function) directly. Nothing to wrap in `HomeApi` for the read side. |
| Endpoints (setup helpers, this ticket) | `POST /api/v1/workspaces` (existing type, `HomeApi.createWorkspace` — NEW helper), `POST /api/v1/workspaces/{id}/projects` (raw `apiPOST`, one-off, BK-624 only — not worth a named helper for a single call site), `POST /api/v1/projects/{id}/modules` + `PATCH /api/v1/modules/{id}` (`ModulesApi`, NEW component), `POST /api/v1/bugs` + `POST /api/v1/bugs/{id}/status` (`BugsApi`, NEW component) |
| Endpoints (setup helpers, reused unchanged) | `RunsApi.startRunSuccessfully` (`POST /api/v1/runs`) + `RunsApi.finishRun` (`POST /api/v1/runs/{id}/finish`) — both already exist from BK-256, zero changes needed |
| OpenAPI Type(s) | `api/openapi-types.ts` already carries real generated types (confirmed via direct read this session — `ModuleCreateBody`, `ModuleUpdateBody`, `ModuleDetail`, `WorkspaceCreateBody` at their respective line numbers; `BugStandaloneCreateBody`, `BugDetail`, `BugStatusTransitionBody` also present). Unlike BK-256, **no `bun run api:sync` blocker this time** — the stub state BK-256 hit has already been resolved. New facades needed: `api/schemas/modules.types.ts` (`ModuleCreateBody`, `ModuleUpdateBody`, `ModuleDetail`) and `api/schemas/bugs.types.ts` (`BugStandaloneCreateBody`, `BugDetail`, `BugStatusTransitionBody`), following `runs.types.ts`'s existing facade pattern. `home.types.ts` already carries `WorkspaceCreateBody`/`WorkspaceCreateResponse` (added for BK-850) — reused as-is for the new `HomeApi.createWorkspace` helper, zero new types needed there. |
| Auth Required | Yes — cookie session (existing `AuthApi`/`LoginPage` login flow). No PAT/scope wiring needed. |
| Return Pattern | 2-tuple `[APIResponse, WorkspaceCreateResponse]` for `HomeApi.createWorkspace`; `[APIResponse, ModuleDetail, ModuleCreateBody]` / `[APIResponse, ModuleDetail]` for `ModulesApi`; `[APIResponse, BugDetail, ...]` / `[APIResponse, BugDetail]` for `BugsApi` — per the standard mutation/verification tuple convention. |

## 3. ATC Registry

### Existing ATCs (Reuse)

None from `HomePage`/`HomeApi` (BK-260's 5 TCs are all new coverage). `RunsApi.startRunSuccessfully` and `RunsApi.finishRun` (both helpers, no `@atc`, created for BK-256) are reused UNCHANGED as precondition setup for BK-624's two `run.finished` rows — zero code changes to `RunsApi.ts`.

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|---|---|---|---|
| BK-624 | `HomePage` | `verifyActivityItemRenders(args: ActivityItemAssertionArgs)` | Navigate to Home, assert one specific item's row renders actor/action-label/item-label/relative-time/glyph/verdict-chip correctly. Parameterized — called once per surviving data row (4 of the original 5, see atc/BK-624.md). Object param (7 logical fields collapse to 1). |
| BK-625 | `HomePage` | `navigateToActivityFromHeaderLink()` | Click the header "View all" link, assert navigation to `/activity`. |
| BK-626 | `HomePage` | `navigateToActivityFromEmptyState()` | Given the feed is empty, click the empty-state "Browse the full activity feed" link, assert navigation to `/activity`. Distinct ATC from BK-625 per Rule 3 (different DOM location asserted by a distinct data-testid, matching the Story's own "distinct DOM location from TC2" note in the Test issue). |
| BK-627 | `HomePage` | `viewRecentActivityEmptyState()` | Navigate to Home, assert the empty-state test-id is visible with the exact scoped copy, and the list is not rendered. |
| BK-631 | `HomePage` | `verifyActivityIsolatedByWorkspace(foreignEventId: string)` | Given the active workspace was switched (via existing `useWorkspace()`) to a workspace that never produced `foreignEventId`, navigate to Home and assert that event's row is absent. |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|---|---|---|---|
| `HomeApi` | `createWorkspace(payload: WorkspaceCreateBody)` | `[APIResponse, WorkspaceCreateResponse]` | POST `/api/v1/workspaces`. Promoted from BK-256's raw-`apiPOST` pattern (see §2) since this ticket calls it 3 separate times. |
| `ModulesApi` (new) | `createModule(args: { projectId: string, payload: ModuleCreateBody })` | `[APIResponse, ModuleDetail, ModuleCreateBody]` | POST `/api/v1/projects/{id}/modules`. Precondition-setup helper for a different feature (module management) — no `@atc` under BK-260, mirrors `RunsApi`'s precedent. |
| `ModulesApi` (new) | `renameModule(args: { moduleId: string, name: string })` | `[APIResponse, ModuleDetail]` | PATCH `/api/v1/modules/{id}` with `{ name }`. Produces the `module.renamed` activity event BK-624's module row needs. |
| `BugsApi` (new) | `createBugStandalone(payload: BugStandaloneCreateBody)` | `[APIResponse, BugDetail, BugStandaloneCreateBody]` | POST `/api/v1/bugs` (standalone path — `project_id` + `module_id` in body, no `run_step_id`). Precondition-setup helper, no `@atc` under BK-260. |
| `BugsApi` (new) | `transitionBugStatus(args: { bugId: string, status: 'in_progress' \| 'resolved' \| 'closed' })` | `[APIResponse, BugDetail]` | POST `/api/v1/bugs/{id}/status`. Produces the `bug.status_changed` activity event BK-624's bug row needs (open → in_progress, one legal adjacent step). |

## 4. Test Data Strategy

| Ticket | Precondition | Pattern | Feasibility | Notes |
|---|---|---|---|---|
| BK-624 (module row) | A `module.renamed` event exists, created moments before assertion | Discover (existing workspace + project, reused from `RunsApi`'s fixture discovery) + Generate (`ModulesApi.createModule` then `renameModule`) | Feasible | Needs a project — reuses the SAME discovered project the run rows use, so this ATC's whole precondition chain runs against ONE discovered workspace/project, not four separate ones. |
| BK-624 (bug row) | A `bug.status_changed` event exists | Discover (same project) + Generate (`BugsApi.createBugStandalone` then `transitionBugStatus({ status: 'in_progress' })`) | Feasible | `open → in_progress` is the first legal adjacency in the bug lifecycle (`bunkai_transition_bug_status` — never backward, never skipping a stage); no assignee needed, so no actor-resolution helper is required (unlike `bug.assigned`, which was considered and rejected — see atc/BK-624.md). |
| BK-624 (run.finished passed) | A run reaches `passed` | Discover (project/Test/Environment, `RunsApi.findRecentProjects` → `findExecutableTestInProject` → `findEnvironmentInProject`) + Generate (`RunsApi.startRunSuccessfully` then `finishRun({ verdict: 'passed' })`) | Feasible | Zero new code — reuses BK-256's `RunsApi` helpers verbatim. |
| BK-624 (run.finished failed) | A second, independent run reaches `failed` | Same as above, `finishRun({ verdict: 'failed' })` | Feasible | A SECOND fresh run (test independence — no shared mutable run between the two verdict rows). |
| BK-625 | Home is reachable in any feed state | None (Discover implicit — default active workspace) | Feasible, zero setup | See "Fixture challenge" above — the header link's precondition is trivial by design. |
| BK-626 | Workspace has zero tracked activity (so the empty state, and its link, render) | Generate (throw-away workspace via `HomeApi.createWorkspace`) | Feasible | Same throw-away-workspace pattern BK-850 (HD-T01) established — avoids racing BK-624's mutations on a shared workspace. |
| BK-627 | Same as BK-626 | Generate (throw-away workspace, reusable across BK-626/BK-627 in the SAME test if desired, or one each — see §5 Scenarios) | Feasible | |
| BK-631 (Workspace A) | Workspace A has ≥1 real allowed-action event, owned by the SAME test user | Generate (throw-away workspace + throw-away project + one `module.renamed` event, reusing `ModulesApi`) | Feasible | Reuses the exact same module-creation chain as BK-624's module row — no new code, just a second call site. |
| BK-631 (Workspace B) | Workspace B is a second, empty workspace also owned by the test user | Generate (`HomeApi.createWorkspace`, zero activity) | Feasible | |

**Adaptation note (BK-631)**: the Gherkin's literal wording ("activity events exist in a workspace the QA engineer does not belong to... even with a forged active-workspace cookie") is NOT directly testable through the UI/API surface — `resolveActiveWorkspaceId` (`lib/workspaces/active.ts`) silently rejects a `bk_active_ws` cookie naming a workspace the caller is not a member of and falls back to the caller's own first workspace, so a forged-cookie-to-a-foreign-workspace scenario never reaches the RPC with that workspace id at all; it is not a reachable code path from outside. The adapted, still-meaningful E2E construction — two workspaces BOTH owned by the same test user, `useWorkspace()` (the EXISTING `bk_active_ws` cookie helper from HD-T01, reused unchanged) switching between them — asserts the identical underlying risk (`activity_log_select_workspace_member` RLS must scope strictly by `workspace_id`, never leak across the boundary) with a deterministic, repeatable setup. Full rationale in atc/BK-631.md.

### DataFactory additions / Constants additions

```typescript
// tests/data/types.ts
export interface ModuleRenamePayload {
  name: string
}

// tests/data/DataFactory.ts (new methods)
generateModuleName(): string   // faker.commerce.productName() prefixed 'test.' — satisfies the 2-80 char, alphanumeric-required contract
generateWorkspaceSlug(): string // lowercase-hyphen, 3-40 chars, avoids RESERVED_SLUGS by construction (prefix 'bk260-')
generateBugTitle(): string     // faker-backed, satisfies BugStandaloneCreateBody's title contract
```

## 5. Test Scenarios

### File: `tests/e2e/home/viewRecentActivityFeed.test.ts`

Fixture: mixed — see per-scenario below. All scenarios sit under one `test.describe('BK-260: Validate Home's condensed recent activity feed')`.

#### Scenario 1 — BK-627 (empty state)
Test: `"BK-260: should show an empty state when the workspace has no tracked activity in the last 24 hours"`
Preconditions: `beforeAll` (or inline) creates a throw-away workspace via `HomeApi.createWorkspace`; `test.skip()` if creation fails.
ATCs called: `HomePage.viewRecentActivityEmptyState()`.
Test-level assertions: none beyond the ATC's fixed assertions.
Teardown: none — throw-away workspace not cleaned up (matches HD-T01's own precedent, no delete-workspace endpoint in scope).

#### Scenario 2 — BK-626 (empty-state link navigation)
Test: `"BK-260: should navigate to /activity when the empty-state link is selected"`
Preconditions: same throw-away empty workspace (may reuse Scenario 1's, or its own — test independence favors its own if run order is not guaranteed; document as its own Generate call).
ATCs called: `HomePage.navigateToActivityFromEmptyState()`.
Test-level assertions: none beyond the ATC's fixed assertions.
Teardown: none.

#### Scenario 3 — BK-625 (header link navigation)
Test: `"BK-260: should navigate to /activity when the header View all link is selected"`
Fixture: `{ ui }` only (see Fixture challenge, §2).
Preconditions: none.
ATCs called: `HomePage.navigateToActivityFromHeaderLink()`.
Test-level assertions: none.
Teardown: none.

#### Scenario 4 — BK-631 (cross-workspace isolation)
Test: `"BK-260: should not show another workspace's activity when a different workspace is active"`
Preconditions: Workspace A created + one `module.renamed` event seeded in it (`ModulesApi`); Workspace B created empty (`HomeApi.createWorkspace`).
ATCs called: `HomePage.useWorkspace(workspaceB.id)` (existing helper, not an ATC) then `HomePage.verifyActivityIsolatedByWorkspace(eventIdFromA)`.
Test-level assertions: none beyond the ATC's fixed assertion.
Teardown: none.

#### Scenario 5 — BK-624 (item rendering, parameterized)
Test: `"BK-260: should render {entityType} activity correctly on the condensed feed"` — one `test()` per surviving data row, generated via a `for` loop over the 4-row fixture table (see atc/BK-624.md §5 Code Template).
Preconditions: Discover the fixture workspace/project (`RunsApi.findRecentProjects` + `findExecutableTestInProject` + `findEnvironmentInProject`, shared `beforeAll`); per row, Generate the specific event immediately before that row's own assertion (module rename / bug status transition / run start+finish ×2).
ATCs called: `HomePage.verifyActivityItemRenders(args)`.
Test-level assertions: none beyond the ATC's fixed assertions (each row IS the full TC per the TC-identity rule — precondition = "this event exists", action = "open Home").
Teardown: none — generated module/bug/run entities are left in place (throw-away, does not corrupt shared state; matches HD-T01's own no-teardown precedent for Generate-pattern data).

## 6. Implementation Order

- [ ] Add types to `tests/data/types.ts` (`ModuleRenamePayload`)
- [ ] Add factory methods to `tests/data/DataFactory.ts` (`generateModuleName`, `generateWorkspaceSlug`, `generateBugTitle`)
- [ ] Create `api/schemas/modules.types.ts` + `api/schemas/bugs.types.ts` facades; re-export both from `api/schemas/index.ts`
- [ ] Add `createWorkspace` helper to existing `tests/components/api/HomeApi.ts`
- [ ] Create `tests/components/api/ModulesApi.ts` (helpers: `createModule`, `renameModule`)
- [ ] Create `tests/components/api/BugsApi.ts` (helpers: `createBugStandalone`, `transitionBugStatus`)
- [ ] Register both new components in `tests/components/ApiFixture.ts` (and `TestFixture.ts`)
- [ ] Extend `tests/components/ui/HomePage.ts`: new locators (`recentActivityList`, `recentActivityItem`, `recentActivityEmpty`, `recentActivityViewAllHeader`, `recentActivityEmptyViewAll`), extended `goto()` wait condition, 5 new ATCs (BK-624, BK-625, BK-626, BK-627, BK-631)
- [ ] Create `tests/e2e/home/viewRecentActivityFeed.test.ts` (5 scenarios, one `describe`)
- [ ] Run tests, types:check, lint:check; regenerate `kata-manifest.json` and stage it
- [ ] Link each of the 5 Tests to its automated test (`test_automation` link) + flip `automated`/`automation-candidate` labels once merged with CI green
- [ ] TMS TC transitions to Pull Request when the PR opens (`create_pr` transition) — Automated only lands post-merge via the `merged` transition

## 7. Risks & Open Questions

- **BK-628 (TC5, error state) is not automatable through the UI/API surface** — see spec.md "Excluded TC". This is a planning-time finding, not an implementation gap: no follow-up automation ticket should be opened for it without a DB-fault-injection mechanism this repo does not have. Recommend the Story's `comments.md` note ("recommend closing the live-evidence gap in Stage 5 automation") be updated to reflect this finding.
- **BK-624's time-bucket BVA is reduced, not fully engineered** — only the "just now" (<1min) bucket is live-verifiable (create → assert immediately). The "5m ago" / "2h ago" buckets from the Story's own Examples table require backdating `created_at`, which no API exposes and which DBHub (unavailable this session — connection timeout) would be needed for, and even then would be a risky direct-DB mutation against shared staging. This mirrors the EXACT reasoning the Story's own TC6 (BK-629, window-boundary BVA) used to justify staying `Draft`/non-Candidate rather than being force-fit into automation. Logged per test-design-doctrine.md's RISK checklist item ("any scope-driven drop is explicit and logged, never silent") — not a silent gap.
- **BK-624's entity-type Examples are reduced from 5 to 4 rows** — `test.created` is EP-merged into `module.renamed` (same generic-glyph fallback code path, same item-label-derivation pattern: `nonEmptyString(payload.field) ?? fallback`). Full justification in atc/BK-624.md §6.
- **BK-631's Gherkin is adapted, not literally implemented** — see §4 Adaptation note above and atc/BK-631.md. The risk under test (RLS never leaks across workspaces) is preserved; the construction (two workspaces owned by the same user) differs from the literal "foreign, non-member workspace" wording because the literal construction is not reachable through the product's own cookie-resolution logic.
- **No teardown for Generate-pattern data** (workspaces, projects, modules, bugs, runs created by this scope) — matches HD-T01's precedent (no delete-workspace/delete-project endpoint exists). Flagged as a minor housekeeping note, not a blocker; staging accumulates throw-away entities over time across both tickets' test runs.
- **Concurrency risk on BK-624's row ordering** — the ATC asserts specific rows are present and correctly rendered, not that the feed's TOP N rows are exactly these 4 (a genuinely concurrent staging event from another tester/process could theoretically push one of these 4 out of the 6-row cap in the seconds between Generate and assertion). Low-probability given `HOME_ACTIVITY_FEED_LIMIT=6` and 4 rows generated immediately before assertion; noted as a flake-risk, not mitigated further (matches the acceptable-risk posture HD-T01 took for its own shared-workspace multi-project precondition).

## 8. Success Criteria

- [ ] AC1 covered (the floor) via BK-624's 4 surviving data rows — also: risk-beyond-AC covered by the glyph-fallback EP-merge reasoning and the verdict-chip present/absent partition (run rows vs. module/bug rows)
- [ ] AC2 covered via BK-625 (header) + BK-626 (empty-state, distinct DOM location) — two ATCs, not an EP-merge, because the Story's own Test issue explicitly calls out "distinct DOM location from TC2" as the differentiator
- [ ] AC3 covered via BK-627
- [ ] Risk-beyond-AC (RLS isolation) covered via BK-631, adaptation documented
- [ ] BVA reduction on BK-624's time buckets is explicit and logged (§7), not silently dropped
- [ ] KATA compliance (layers, ATC atomicity, inline-then-extract locators, max-2-positional-params via object params, import aliases)
- [ ] Fixture correct per scenario (§2 Component Strategy + Fixture challenge)
- [ ] No hardcoded waits — `goto()`'s extended wait condition uses `waitFor()` on testid locators, never `waitForTimeout`
- [ ] Aliases used (`@api/`, `@ui/`, `@schemas/`, `@variables`, `@TestContext`, `@TestFixture`)
- [ ] Tests pass locally and on staging
- [ ] TMS TC moved to Pull Request on PR open (never "Automated" after local validation)
