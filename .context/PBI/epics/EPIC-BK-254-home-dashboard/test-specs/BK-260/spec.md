# BK-260: TMS-Home | Show a condensed recent activity feed

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Phase** | Standalone (second automation ticket in EPIC-BK-254; sibling to HD-T01/BK-256) |
| **Items** | 5 TCs (1 multi-row parameterized: BK-624) |
| **Dependencies** | None. Reuses `RunsApi` precondition helpers created for BK-256 (HD-T01) as-is. |
| **Requires** | Staging test-user creds (`.env`), a discoverable seeded workspace with ≥1 project carrying ≥1 executable Test + configured Environment (same fixture BK-256/HD-T01 discovers, e.g. `sir-tests-a-lot` per `.agents/project.yaml`) |
| **Source** | Story: BK-260 (Epic BK-254 — Home Dashboard) |

## Summary

BK-260 ships Home's condensed "Recent activity" feed: a thin presentation layer over BK-49's activity stream (`fetchActivityPage`), windowed to the last 24h and capped at 6 rows, with a header "View all" link and an empty-state variant of the same link. The feature is already merged (status "Ready For Release"); this scope automates 5 of the Story's 6 Candidate TCs — item rendering across entity types (BK-624), the two "View all" navigation variants (BK-625/BK-626), the empty state (BK-627), and cross-workspace RLS isolation (BK-631). TC5 (BK-628, error state) is explicitly excluded from this pass — see "Excluded TCs" below. TC6 (BK-629) and TC7 (BK-630) are `Draft` in Jira, not `Candidate`, and are out of scope entirely (not automated, not planned).

## Test Cases

> Bodies live in Jira. Synced copies sit under
> `.context/PBI/epics/EPIC-BK-254-home-dashboard/stories/STORY-BK-260-tms-home-show-a-condensed-recent-activity-feed/test-cases/`.

| TMS ID | Title | Type | Priority |
|--------|-------|------|----------|
| BK-624 | TC1: should show actor, action, target, relative time, glyph and verdict for each event type given workspace has recent tracked activity | Positive (parameterized, EP across entity types) | Critical |
| BK-625 | TC2: should navigate to /activity when "View all" header link is selected | Positive (navigation) | High |
| BK-626 | TC3: should navigate to /activity when link is selected from empty state | Positive (navigation, distinct DOM location) | High |
| BK-627 | TC4: should show empty state given workspace has no tracked activity in last 24h | Negative (empty-state) | High |
| BK-631 | TC8: should not show activity from a different workspace given RLS scoping | Security / risk-beyond-AC (decision table) | Critical |

### Excluded TC: BK-628 (TC5 — error state)

**Not automated in this pass, and no `atc/*.md` file is produced for it.** `RecentActivity`'s server component (`app/(app)/home/page.tsx`) calls `fetchActivityPage` directly via a server-side Supabase RPC — there is no HTTP round-trip from the browser for Playwright's `page.route` to intercept, so the usual "mock a 500" mechanism this repo's other error-state ATCs use is not reachable here. Every input-driven path that could plausibly reach `RecentActivityError` was checked and found to NOT produce a genuine read failure: a malformed cursor is caught upstream of this feed (the condensed feed never sends one), an unknown/foreign `bk_active_ws` cookie value is silently rejected by `resolveActiveWorkspaceId` and falls back to the caller's own first workspace (never propagates to the RPC as an invalid id), and RLS on a genuinely inaccessible workspace returns an empty row set, not an error, which renders the *empty* state, not the *error* state. There is no valid HTTP/cookie/param input this ATC could send that deterministically trips the error path without DB-level fault injection (killing the connection, revoking the RPC grant), which is out of scope for E2E automation against shared staging. BK-628 stays **Manual / code-reviewed only** (already verified by code review per the Story's `comments.md` — 27/8/2026 entry: "recommend closing the live-evidence gap in Stage 5 automation" was written before this session confirmed the path is not reachable through the UI/API surface at all). This is a **planning-time blocker finding**, not a silent drop — flagged in automation-plan.md §7 Risks.

## Automation Plan

**Order**:
1. **BK-627** first — cheapest precondition (one throw-away empty workspace via `POST /api/v1/workspaces`), validates `HomePage`'s recent-activity locators end-to-end on the simplest render path.
2. **BK-625** — reuses BK-627's empty workspace (the header "View all" link renders in every feed state, so no dedicated precondition is needed) and is UI-only.
3. **BK-626** — reuses the same empty-workspace precondition as BK-627, adds the empty-state-specific link.
4. **BK-631** — reuses the empty-workspace pattern for Workspace B, adds a second Generate (Workspace A + one real event) and the `HomePage.useWorkspace` cookie-switch helper already established by BK-256.
5. **BK-624** last — the heaviest precondition (Discover an existing project + Generate 4 real events across entity types), reuses `RunsApi`'s run-lifecycle helpers from BK-256 as-is.

**Shared fixtures**: All 5 scenarios share `HomePage` (UI) for the recent-activity locators/ATCs. BK-624, BK-627, BK-631 additionally share `HomeApi` (new helper: `createWorkspace`) for Generate-pattern workspace setup. BK-624 additionally shares `RunsApi` (existing, BK-256) for the two `run.finished` rows, plus two NEW helper components this ticket introduces: `ModulesApi` (module row) and `BugsApi` (bug row) — see automation-plan.md §2 Component Strategy for why these are new components rather than additions to `HomeApi`.

**Blocked by**: Nothing hard-blocking for the 5 automated TCs. BK-628 (TC5) is a documented scope exclusion (see above), not a blocker on this scope's own completion.

**Preconditions for the whole scope**: A reachable workspace the test user owns with ≥1 project carrying ≥1 executable Test + configured Environment (Discover, for BK-624's `run.finished` rows only — same fixture workspace BK-256/HD-T01 already discovers). `POST /api/v1/workspaces` (Generate, guaranteed-empty workspace — reused by BK-625, BK-626, BK-627, and twice by BK-631) and `POST /api/v1/workspaces/{id}/projects` + `POST /api/v1/projects/{id}/modules` + `PATCH /api/v1/modules/{id}` + `POST /api/v1/bugs` + `POST /api/v1/bugs/{id}/status` (Generate, for BK-624's module/bug rows and BK-631's Workspace-A seed event) are all confirmed live via direct route-source read this session (not OpenAPI-MCP — direct file read of `app/api/v1/**/route.ts`, since this session's exploration read source directly).

## Merged TCs (if any)

| Removed ID | Merged Into | Reason |
|------------|-------------|--------|
| none (TMS layer) | — | No TMS-level merge. The `test` entity-type row from BK-624's own Examples table is EP-merged into the `module` row — see atc/BK-624.md §6 for the technique-derivation detail. This is an automation-layer (ATC data-row) merge, not a TMS Test merge — both `entity_type` values remain implicitly covered by the doctrine argument, not by two separate rows. |

## Updated TCs (if any)

| TC ID | Spec File | What Was Added | Reason |
|-------|-----------|-----------------|--------|
| BK-624 | atc/BK-624.md | 2 of the Examples table's 5 rows substituted (`module.created`→`module.renamed`, `bug.created`→`bug.status_changed`); 3 of 5 rows' elapsed-time BVA columns (5m/2h buckets) not engineered live | Substitution: `module.created`/`bug.created` are not in `ACTIVITY_ALLOWED_ACTIONS` and would never produce a visible row — see atc/BK-624.md §"Data substitution rationale". Time-bucket reduction: events created via API carry `created_at = NOW()` with no backdating parameter; see atc/BK-624.md §"BVA reduction rationale". |

## Acceptance Criteria

- [ ] AC1 (row shows actor/action/target/relative-time/glyph/verdict, given recent activity) automated via BK-624 (4 of the original 5 data rows; substitutions + BVA reduction documented and justified, not silently dropped)
- [ ] AC2 (View all navigates to full activity view) automated via BK-625 (header link) + BK-626 (empty-state link, distinct DOM location)
- [ ] AC3 (empty state shown when nothing recent) automated via BK-627
- [ ] Risk-beyond-AC (RLS workspace isolation) automated via BK-631, adapted from the Gherkin's literal "foreign, non-member workspace" wording to a same-user two-workspace construction — see atc/BK-631.md §"Adaptation rationale"
- [ ] BK-628 (error state) intentionally NOT automated this pass — Manual/code-verified only, rationale in "Excluded TC" above
- [ ] Tests pass on local and staging
