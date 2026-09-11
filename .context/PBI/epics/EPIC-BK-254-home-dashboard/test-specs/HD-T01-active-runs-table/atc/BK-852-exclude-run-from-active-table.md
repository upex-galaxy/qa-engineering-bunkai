# ATC Spec: BK-852 — verifyRunExcludedFromActiveTable

> Ticket: BK-256
> Component: HomePage (tests/components/ui/HomePage.ts)
> Type: UI — Verification (state-transition, parameterized 2 rows)
> Parent Story: BK-256

## 1. Test Case Summary

| Name | Objective | Precondition | Acceptance Criteria |
|---|---|---|---|
| verifyRunExcludedFromActiveTable | Confirm a run disappears from the active table (and count) once it transitions out of `running` | Run transitions `running` → `Finished` (`passed`/`failed`) OR `Aborted` | Business Rule (active = Running/Blocked only) |

This is the EP-merge of the original ATP's TC4 (Finished) + TC6 (Aborted), already performed by `/test-documentation` — see spec.md §Merged TCs. One ATC, two data rows.

## 2. ATC Contract

```typescript
/**
 * ATC: Navigate to Home and verify a specific run is absent from the
 * active-runs table and excluded from the active count.
 * Fixed assertions:
 *  - The run's row (home-active-runs-row-{runId}) is NOT present
 *  - The active count does not include this run
 */
@atc('BK-852')
async verifyRunExcludedFromActiveTable(runId: string): Promise<void> { /* ... */ }
```

## 3B. UI Details

- Page path: `/home`
- Locators: `activeRunsRow(runId)` (`` home-active-runs-row-${runId} ``, asserted `.not.toBeVisible()` / `toHaveCount(0)`), `activeRunsCount()` (`home-active-runs-count`)
- Playwright assertions: `await expect(this.activeRunsRow(runId)).toHaveCount(0)`

## 4. Assertions Split

### Fixed (inside ATC)
- Row for `runId` has zero count in the DOM

### Test-level (in test file)
- The active count strictly decreases by 1 relative to a pre-transition baseline read via `HomeApi.getActiveRuns` (the ATC itself does not know the "before" count — that comparison is a test-level flow assertion spanning 2 reads)

## 5. Code Template

```typescript
@atc('BK-852')
async verifyRunExcludedFromActiveTable(runId: string): Promise<void> {
  await this.goto();
  await expect(this.activeRunsRow(runId)).toHaveCount(0);
}
```

Test file usage (parameterized, one `test()` per data row):

```typescript
const exclusionScenarios = [
  { label: 'Finished', transition: (runId: string) => api.runs.finishRun({ runId, verdict: 'passed' }) },
  { label: 'Aborted', transition: (runId: string) => api.runs.abortRun({ runId, reason: 'Automated BK-256 teardown' }) },
];

for (const scenario of exclusionScenarios) {
  test(`BK-256: should exclude a run from the active table once its status becomes ${scenario.label}`, async ({ test: fixture }) => {
    const { api, ui } = fixture;
    const [, run] = await api.runs.startRunSuccessfully(runPayload);
    const [, before] = await api.home.getActiveRuns(workspaceId);

    await scenario.transition(run.id);
    await ui.home.verifyRunExcludedFromActiveTable(run.id);

    const [, after] = await api.home.getActiveRuns(workspaceId);
    expect(after.active_count).toBe(before.active_count - 1);
  });
}
```

## 6. Technique-derivation check

| AC | Technique fired | ATCs produced |
|---|---|---|
| Business Rule (active excludes Finished/Aborted) | State-Transition (status field) | BK-852 — one parameterized ATC, 2 rows |

**Equivalence Partitioning detail:**

| Input | Expected output | Same ATC? |
|---|---|---|
| `finishRun({ verdict: 'passed' })` | Row excluded, count -1 | Yes — same partition ("terminal, excluded") |
| `finishRun({ verdict: 'failed' })` | Row excluded, count -1 | Yes — same partition. Not separately data-driven in the TMS row set (Xray's 2 Examples rows are Finished/Aborted, not passed/failed/aborted) — `passed` is the representative "Finished" value used; `failed` is the same partition and not required as a 3rd row per the TMS-authorized set. |
| `abortRun(...)` | Row excluded, count -1 | Yes — same partition, but a DIFFERENT precondition path (abort vs finish) is still asserted as its own Examples row per the TMS Scenario Outline (not further collapsed) |

**Two reduction axes**:

| Parameterized ATC | Reduction applied | Rows after reduction |
|---|---|---|
| BK-852 `verifyRunExcludedFromActiveTable` | none (EP already applied at the TMS layer; 2 surviving rows are not a Decision-Table/Pairwise combination of independent factors, just 2 same-outcome partitions) | 2 (Finished, Aborted) |

## 7. Dependencies

- Precondition Steps: none (inline — see automation-plan.md §Component Strategy "Preconditions" row for why this isn't a Steps module yet)
- Required Components: `RunsApi.finishRun`, `RunsApi.abortRun` (both new, this ticket), `HomeApi.getActiveRuns` (new, this ticket)

## 8. Data Context

See automation-plan.md §4, row "BK-852" — Generate (fresh Run) + Modify (`finishRun`/`abortRun`). Cleanup: none — a finished/aborted run is terminal, nothing further to tear down.

## 9. Checklist

- [x] `verb{Resource}{Scenario}` naming — `verifyRunExcludedFromActiveTable`
- [x] Max 2 positional params — 1 param (`runId: string`)
- [x] Correct return type — `void` for UI ATC
- [x] Fixed vs test-level assertions split (§4)
- [x] Not duplicating an existing ATC — confirmed against `kata-manifest.json`; also confirms this correctly implements the TMS-side EP-merge (one ATC, not two)
