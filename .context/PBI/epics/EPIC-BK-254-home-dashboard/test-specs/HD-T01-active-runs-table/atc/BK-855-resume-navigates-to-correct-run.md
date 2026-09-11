# ATC Spec: BK-855 — resumeNavigatesToTargetRun

> Ticket: BK-256
> Component: HomePage (tests/components/ui/HomePage.ts)
> Type: UI — Navigation (exact destination)
> Parent Story: BK-256

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| resumeNavigatesToTargetRun | Confirm Resume lands on the CORRECT run's own execution screen when 2+ active runs exist, not just "some" screen | Home's resume action targets a specific run, determined by the D6 recency ordering | AC3 (risk-beyond-AC: exact-target correctness, distinct from BK-851's generic-navigation check) |

## 2. ATC Contract

```typescript
export interface ResumeTargetArgs {
  expectedProjectSlug: string
  expectedRunId: string
}

/**
 * ATC: Click Resume on Home and verify the browser lands on the
 * exact expected run's execution screen.
 * Fixed assertions:
 *  - URL matches exactly /projects/{expectedProjectSlug}/runs/{expectedRunId}
 */
@atc('BK-855')
async resumeNavigatesToTargetRun(args: ResumeTargetArgs): Promise<void> { /* ... */ }
```

Object param used deliberately even though there are only 2 logical values — both are required, equally weighted identifiers for the same assertion (not an "options bag" with optionals), consistent with typescript-patterns.md §1's self-documenting-call-site rationale for multi-value ATCs.

## 3B. UI Details

- Page path: `/home` → after click, `/projects/{slug}/runs/{runId}`
- Locators: `activeRunsResumeButton()` (`home-active-runs-resume`)
- Playwright assertions: `await this.activeRunsResumeButton().click(); await this.page.waitForURL(url => url.pathname.includes('/runs/')); await expect(this.page).toHaveURL(new RegExp(`/projects/${args.expectedProjectSlug}/runs/${args.expectedRunId}$`));`

## 4. Assertions Split

### Fixed (inside ATC)
- Exact URL match against `expectedProjectSlug` + `expectedRunId`

### Test-level (in test file)
- None beyond the ATC's fixed assertion — the whole point of this TC is the exact-destination check itself, which IS the fixed assertion (per Rule 6, "URL redirect checks" are explicitly a fixed-assertion example)

## 5. Code Template

```typescript
@atc('BK-855')
async resumeNavigatesToTargetRun(args: ResumeTargetArgs): Promise<void> {
  await this.goto();
  await this.activeRunsResumeButton().click();
  await this.page.waitForURL(url => url.pathname.includes('/runs/'));
  await expect(this.page).toHaveURL(
    new RegExp(`/projects/${args.expectedProjectSlug}/runs/${args.expectedRunId}$`),
  );
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|---|---|---|
| AC3 (resume) | EP (always) + risk-beyond-AC (exact-target correctness, since the AC text only says "resume the most recently active run" without spelling out destination precision) | BK-851 (generic navigation happened) + BK-855 (exact destination) — 2 ATCs, different fixed-assertion shape, not a mergeable EP variant per Rule 3 |

**Equivalence Partitioning detail:**

| Input | Expected output | Same ATC? |
|---|---|---|
| Resume clicked, 1 active run | Navigates away from Home | BK-851's partition |
| Resume clicked, 2+ active runs, target is unambiguous | Navigates to the SPECIFIC target run's screen | BK-855's partition — different assertion granularity (exact vs generic), kept separate per the TMS's own (unmerged) 2-TC decision |

**Boundary Value Analysis detail**: N/A — no range/limit on "which run is targeted"; the relevant edge is a STATE ordering (D6), not a numeric boundary. See Dependencies below for how the ordering is engineered without claiming BVA coverage it doesn't need.

## 7. Dependencies

- Precondition: 2 runs created via `RunsApi.startRunSuccessfully`, with a deliberate, engineered recency gap — **NOT** a literal `id desc` tie-break collision:
  1. Create run A (`started_at` ≈ T0).
  2. Mark one of run A's steps via `RunsApi.markRunStep` (bumps `run_steps.executed_at` to ≈ T0+ε, becoming run A's `max(run_steps.executed_at)` recency signal per D6).
  3. Create run B AFTER that mark call (`started_at` ≈ T1 > T0+ε, and run B has no marked steps yet, so its recency signal falls back to its own `started_at`).
  4. Because T1 > T0+ε by construction (sequential API calls, not a race), run B is unambiguously "most recently active" under D6's ordering — `expectedRunId = runB.id`, `expectedProjectSlug` = run B's project's slug.
  - This deliberately avoids trying to force an actual timestamp COLLISION (which would exercise the `id desc` tie-break itself) — that exact scenario is the informally-noted, non-TMS-synced "TC9" and is explicitly out of this automation's scope per the ticket brief. Flagging this here so a future reader does not mistake this ATC for tie-break coverage.
- Required Components: `RunsApi.startRunSuccessfully`, `RunsApi.markRunStep` (both new, this ticket)

## 8. Data Context

See automation-plan.md §4, row "BK-855" — Discover (project/Test/Environment) + Generate (2 sequential Runs). Feasibility flagged "timing-sensitive" in that table because the gap between T0+ε and T1 relies on sequential `await`ed API calls, not a fixed sleep — if this proves flaky in CI, the fallback is to poll `RunsApi.getRunById` until run A's mark is durably reflected before issuing run B's create call, still with no hardcoded wait per kata-architecture.md's no-hardcoded-waits rule.

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `resumeNavigatesToTargetRun`
- [x] Max 2 positional params — 1 object param (2 logical fields, deliberately grouped)
- [x] Correct return type — `void` for UI ATC
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC — distinct from BK-851 by fixed-assertion shape (exact vs generic), confirmed not an EP-mergeable variant
