# ATC Spec: BK-849 — viewActiveRunsAcrossProjects

> Ticket: BK-256
> Component: HomePage (tests/components/ui/HomePage.ts)
> Type: UI — Verification (table render, multi-row, multi-project)
> Parent Story: BK-256

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| viewActiveRunsAcrossProjects | Confirm the active-runs table lists every currently-running run across 2+ different projects with all 6 required data points per row | Workspace has ≥2 active runs, in ≥2 different projects | AC1 |

## 2. ATC Contract

```typescript
/**
 * ATC: Navigate to Home and verify every expected active run renders
 * with its full row contract (id, project, mode, status, progress, executor).
 * Fixed assertions:
 *  - Active-runs section + table are visible
 *  - Every expectedRunId has a visible row (home-active-runs-row-{id})
 *  - Each row's cell content is non-empty for all 6 data points
 */
@atc('BK-849')
async viewActiveRunsAcrossProjects(expectedRunIds: string[]): Promise<void> { /* ... */ }
```

## 3B. UI Details

- Page path: `/home` (via `HomePage.goto()`)
- Locators: `activeRunsSection()` (`home-active-runs`), `activeRunsTable()` (`home-active-runs-table`), `activeRunsRow(runId)` (`` home-active-runs-row-${runId} ``)
- Playwright assertions: `expect(this.activeRunsTable()).toBeVisible()`; `for (const id of expectedRunIds) await expect(this.activeRunsRow(id)).toBeVisible()`
- Per-cell content: **not resolvable from the documented test-ids alone** — see §7 Dependencies / open question. Interim approach for Phase 2: assert `await this.activeRunsRow(id).textContent()` is non-empty and, once real per-cell selectors are found in `components/home/ActiveRuns.tsx`, tighten to per-field assertions (project name text, mode icon/label, status chip `[data-status]`, progress text pattern `/^\d+\/\d+$/`, executor label non-empty).

## 4. Assertions Split

### Fixed (inside ATC)
- Table visible
- Every `expectedRunId` has a visible row
- Row content structurally non-empty (interim — tighten once per-cell locators are confirmed)

### Test-level (in test file)
- `HomeApi.getActiveRuns` count includes both seeded runs
- Row content for run A matches project/mode/executor of run A specifically, not swapped with run B (requires the per-cell locators from §7 to assert precisely — until then, cross-check via the API response body instead of the DOM)

## 5. Code Template

```typescript
@atc('BK-849')
async viewActiveRunsAcrossProjects(expectedRunIds: string[]): Promise<void> {
  await this.goto();
  await expect(this.activeRunsTable()).toBeVisible();
  for (const runId of expectedRunIds) {
    const row = this.activeRunsRow(runId);
    await expect(row).toBeVisible();
    await expect(row).not.toBeEmpty();
  }
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|---|---|---|
| AC1 (multi-project active-runs table) | EP (always) | BK-849 — one partition: "≥2 projects have active runs", full row contract |

**Equivalence Partitioning detail:**

| Input | Expected output | Same ATC? |
|---|---|---|
| 2 projects with 1 active run each | All 6 columns rendered, both rows visible | Base case (this ATC) |
| 3+ projects with active runs | Same behavior, more rows | Yes — same partition, not a separate ATC (no TMS ID authorizes an N-project variant) |

**Boundary Value Analysis detail**: N/A for this ATC — "2+ projects" has no numeric range/limit; BVA applies to the progress value, covered by BK-854 (see automation-plan.md §7 for the flagged 0-done-steps gap).

## 7. Dependencies

- Precondition: `RunsApi.startRunSuccessfully` x2 (different projects, different Test/Environment pairs), reusing the Discover-first workspace/project/Test lookup documented in automation-plan.md §4.
- Required Components: `HomeApi` (exists? No — new, this ticket), `RunsApi` (exists? No — new, this ticket), `HomePage` (exists? No — new, this ticket).
- **Open question — per-cell locators**: only `home-active-runs-row-{id}` (row-level) is a documented test-id; no per-cell test-ids for project/mode/status/progress/executor are given. Resolve by reading `components/home/ActiveRuns.tsx` at Phase 2 Code time, or file a test-id-gap ticket per e2e-patterns.md §3 if genuinely absent.
- **BK-620 interaction (test-data isolation)**: the 2 projects used for this ATC's precondition must each have their OWN, non-leaked Test (discover by project-scoped Test listing, e.g. via that project's Test Plans or a project-filtered Test search — never a bare workspace-wide Test search, which is exactly the surface BK-620 found broken). This does not verify or rely on BK-620's fix either way; it just avoids letting an untested cross-project leak silently satisfy (or corrupt) this precondition's "2 different projects" claim.

## 8. Data Context

See automation-plan.md §4, row "BK-849" — Discover (workspace/projects/Tests/Environments) + Generate (2 fresh Runs).

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `viewActiveRunsAcrossProjects`
- [x] Max 2 positional params — 1 param (`expectedRunIds: string[]`)
- [x] Correct return type — `void` for UI ATC
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC — confirmed against `kata-manifest.json` (no `HomePage` component exists yet)
