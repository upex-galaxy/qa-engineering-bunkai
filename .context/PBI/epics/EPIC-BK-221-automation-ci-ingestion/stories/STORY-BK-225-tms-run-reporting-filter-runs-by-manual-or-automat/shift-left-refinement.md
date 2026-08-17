# Shift-Left Refinement: BK-225 — TMS-Run Reporting | Filter runs by manual or automated execution mode

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming, batch-of-1)
**Refined on**: 2026-08-17
**Refined by**: QA — Shift-Left batch session
**Modality**: Xray

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Elena Vargas, Senior QA Engineer (story author persona) — needs to distinguish manual QA effort from automated/CI coverage at a glance.
- **Secondary personas**: Mateo (sprint-review persona from the Workflow field) — asks "how much of this regression ran by hand?"; any workspace role viewer+ per the Visibility business rule.
- **Business value proposition**: Makes execution mode a first-class, visible dimension so a team can answer coverage-by-mode questions without a spreadsheet — directly extends the "traceability by construction" value proposition (`business-model.md` §1/§4) into the reporting layer.
- **KPI(s) influenced**: Manual-vs-automated coverage ratio, a leading indicator for the automation-maturity narrative the Automation & CI Ingestion epic (BK-221) exists to support.
- **User journey position**: Sits inside the existing Run Reporting surface (project runs view + Test run history + run detail), extending three already-shipped/in-flight read surfaces rather than introducing a new screen.

### Technical context
- **Frontend**: `components/runs/ProjectRunsReportView.tsx` (BK-38, already shipping the filter row + totals strip this Story extends), the Test run history view (BK-37, `RunHistoryView`), and the Run detail header (BK-34/36/37/39 territory). Design intent explicitly says the badge "reuses the existing pill/chip component family... same shape as verdict chips" — `.status-chip[data-status]` tokens already exist in `app/globals.css` per BK-38's implementation plan.
- **Backend**: `GET /projects/{id}/runs/report` (BK-38, already live) — **already accepts an `executor` filter param with 3 values (`human`/`agent`/`ci`)**, per `business-api-map.md` line 166 and BK-38's own AC2/business-rules ("executor type values are human, agent, and CI"). `runs.executor_mode` is the underlying column (`business-data-map.md` §2.13). `GET /tests/{id}/runs` (BK-37) is the Test-scoped run-history endpoint this Story also needs to extend for the badge.
- **External services**: none.
- **Integration points specific to this Story**: (1) the existing BK-38 `runs/report` RPC/endpoint — extend or wrap; (2) the existing BK-37 Test run-history endpoint — add badge data; (3) the Run detail endpoint (`GET /runs/{id}`) — add badge beside the verdict chip.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Low | Mode is purely derived from `executor_mode` (`human` -> Manual, `agent`/`ci` -> Automated) — no new business rule, just a 3-to-2 value collapse. |
| Integration | **High** | Touches THREE existing/in-flight surfaces (BK-38 project report, BK-37 Test history, Run detail) rather than one; **significant overlap with BK-38's already-shipped `executor` filter** — see Critical Question #1 below. |
| Data validation | Low | No new input validation — mode is read-only/derived, never entered (per Business Rules). |
| UI | Medium | New badge component reuse (low effort) + new per-mode totals row (genuinely new aggregate, not currently computed anywhere) + 3 empty-state variants. |

**Estimated test effort**: Medium-High — driven entirely by the integration surface (3 touch points, 1 of which already has a competing/overlapping implementation) rather than by business-logic complexity.

### Epic-level inheritance
- `.context/PBI/epics/EPIC-BK-221-automation-ci-ingestion/module-context.md` does **not exist** — no epic-level risks/answers to inherit or cite. This is a Discovery Gap (see below), not a blocker.
- Sibling Stories in the same epic (all Backlog, none built): BK-222 (Submit automated run), BK-227 (Track automation status of a Test), BK-223 (Stream step results), BK-226 (CI upload), BK-228 (CI-triggered runs linked to commit/branch).

---

## Phase 2 — Story Quality Analysis

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|---|---|---|---|
| 1 | AC2 ("mode filter combines with the existing outcome and environment filters") vs AC4 (mode-specific empty state) | When mode=Automated is combined with outcome/environment and the COMBINATION yields zero rows (but Automated runs DO exist elsewhere in the project), does the UI show AC4's mode-specific "no automated runs reported yet" copy, or BK-38's generic no-match empty state? Showing AC4's copy here would be **misleading** — it implies zero automated runs exist project-wide when they simply don't match the other filters. | Cannot write the empty-state assertion without knowing which of 2 mutually-exclusive UI states fires. | Scope AC4's specific copy to "mode filter is the ONLY active filter and returns 0" — any other zero-match combination falls through to the existing generic empty state. |
| 2 | Business Rules "Totals... aborted runs kept... counted the way aborted runs are counted today" | BK-38's own shipped totals strip counts **passed/failed only** (AC1: "32 passed, 8 failed") — there is no evidence aborted runs are counted in ANY totals today. Does "counted the way aborted runs are counted today" mean aborted runs are **excluded** from the new Manual/Automated totals too (mirroring BK-38), or does the Manual/Automated split include them (since it's a different dimension than pass/fail)? | Directly changes the expected number in every totals scenario that includes an aborted run. | Confirm: does "Manual 12, Automated 30" count ALL terminal runs (incl. aborted) or only passed+failed runs, matching BK-38's pass/fail total scope exactly? |
| 3 | Scope bullet "Execution-mode badge... in the run detail header" vs Business Rules "Design intent: Run detail header shows the mode badge beside the verdict chip" | Consistent with each other, but neither specifies ordering (badge-then-verdict or verdict-then-badge) or spacing/hierarchy when both chips are visible simultaneously. | Low-impact visual-regression risk only — flagged as Edge, not Critical. | Confirm order once the mockup is available (see Gap #4 below). |

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
|---|---|---|---|---|
| 1 | AC / scope overlap | **BK-38 (sibling, already `QA Approved`) already ships an `executor` filter with 3 values (`human`/`agent`/`ci`) on the SAME `GET /projects/{id}/runs/report` endpoint this Story targets**, already shows "executor mode" per row (BK-38 AC4), and its totals are already recomputed from the filtered set. BK-225's marginal, non-duplicated scope is: (a) collapsing 3 raw values into a 2-bucket Manual/Automated label, (b) a genuinely NEW per-mode totals aggregate (BK-38 only totals passed/failed), (c) extending the badge to the BK-37 Test-history view and the Run-detail header, which BK-38 never touched. | An explicit "Relationship to BK-38" section in the Story so Dev doesn't re-implement the filter from scratch, and so QA doesn't file a false duplicate-feature defect. | Wasted dev effort re-building an existing filter; QA confusion distinguishing "is this bug already fixed in BK-38 or is it new in BK-225"; a real risk of two competing filter UIs (BK-38's raw 3-value toggle vs BK-225's 2-bucket badge/filter) coexisting inconsistently in the same view. |
| 2 | Technical detail | No confirmed UI path produces `agent`/`ci` runs today (`business-feature-map.md` §9, FEAT-014 gap) — `executor_mode` is **forced to `human`** for any cookie-session Run creation; only a Bearer/PAT caller may declare `agent`/`ci` (`business-api-map.md` §3.1). **However**, BK-38 (already `QA Approved`) needed exactly this kind of data to validate its own AC2 ("agent-executed runs under Payment module") — so PAT-driven creation of `agent`/`ci` runs is a proven, already-used test-data path, not a hypothetical one. | State explicitly in the Story (or its ATP) that automated-run test data is seeded via a PAT-authenticated `POST /runs` call with `executor_mode: agent|ci`, the same mechanism BK-38's own QA pass already relied on — not via BK-222's (still-Backlog) dedicated ingestion API. | Without this note, a tester might incorrectly block the Story on BK-222 shipping first. |
| 3 | Business rule | The mockup field only points to an external HTML file path (`test-runs-index--ci-extension.html`) that **does not exist in this repo's `.context/designs/`** (confirmed absent this pass). | Locate or re-attach the mockup before Dev starts — exact badge placement/copy/layout is currently undocumented beyond prose. | Testability of the precise visual contract is Partial (see below) until the mockup is available. |

### Edge cases not in Story

| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|---|---|---|---|
| 1 | An aborted run's mode badge — does "Automated" still render on an aborted CI run? | Yes — mode is a property of the executor, independent of the run's terminal verdict (business rule: "Mode is fixed at run creation and immutable afterwards") | Medium | Add to AC — **NEEDS PO/DEV CONFIRMATION** |
| 2 | Both Manual and Automated counts are 0 (brand-new project, zero runs at all) | Falls through to BK-38's existing "no-runs" first-use empty state, not the AC4 "no automated runs" copy (AC4 presumes *some* runs exist, just none automated) | Medium | Test only — don't add AC, but assert the correct one of the 2 empty states fires |
| 3 | A run created via PAT with an invalid/future `executor_mode` value bypassing the enum CHECK somehow | Badge renders a fallback/unknown state rather than crashing the row | Low | Test only — defensive UI test, not a business scenario |
| 4 | Filtering to "Manual" when 100% of runs are Automated (inverse of AC4's Automated-empty case) | Same mode-specific empty-state pattern, mirrored copy ("no manual runs...") | Medium | Add to AC — **NEEDS PO/DEV CONFIRMATION** (Story only wrote the Automated-empty example; Manual-empty is the symmetric case) |

### Contradictions
No hard contradictions between description / ACs / comments — the one comment (Ely's mockup pointer) doesn't conflict with anything, it's just unreachable in this repo. The closest thing to a contradiction is Ambiguity #2 above (BK-38's totals precedent vs. this Story's aborted-run counting rule), which reads more as an underspecified interaction than a direct disagreement.

### Testability validation
**Verdict**: Partial

Issues:
- Mockup file unreachable — exact badge/filter/totals visual layout not independently verifiable pending Gap #3.
- Scope-overlap with BK-38 (Gap #1) means the exact API contract for the Manual/Automated filter (new param vs. client-side collapse of BK-38's existing `executor` param) is undefined until Dev decides — blocks writing precise API-level outlines today (outlines below are named at the behavior level, not the exact param shape).
- Otherwise: ACs are concrete (real numbers, e.g. "12 manual runs and 30 automated runs"), Business Rules are explicit about derivation/immutability/visibility, and the persona/workflow narrative is clear.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Every run row carries an execution-mode badge

#### Scenario 1.1: Should display "Manual" badge on a human-executed run row (Type: Positive, Priority: High)
- **Given**: project "Web Store" has a finished run with `executor_mode = human`
- **When**: Elena opens the project runs view
- **Then**: the run's row shows a "Manual" badge, neutral tone, same shape as the existing verdict chip family

#### Scenario 1.2: Should display "Automated" badge on an agent-executed run row (Type: Positive, Priority: High)
- **Given**: project "Web Store" has a finished run with `executor_mode = agent`
- **When**: Elena opens the project runs view
- **Then**: the run's row shows an "Automated" badge, accent tone

#### Scenario 1.3: Should display "Automated" badge on a CI-executed run row (Type: Positive, Priority: High)
- **Given**: project "Web Store" has a finished run with `executor_mode = ci`
- **When**: Elena opens the project runs view
- **Then**: the run's row shows an "Automated" badge — same label/tone as Scenario 1.2, confirming the 2-bucket collapse treats `agent` and `ci` identically at the badge layer

#### Scenario 1.4: Should display mode badge beside verdict chip in Run detail header (Type: Positive, Priority: Medium)
- **Given**: a finished run with `executor_mode = agent` and `status = passed`
- **When**: Elena opens the Run detail view
- **Then**: the header shows both the mode badge and the verdict chip together (exact order — **NEEDS PO/DEV CONFIRMATION**, see Ambiguity #3)

#### Scenario 1.5: Should display mode badge in Test run history rows (Type: Positive, Priority: Medium)
- **Given**: a Test with 5 runs across mixed modes
- **When**: Elena opens that Test's run history (BK-37 surface)
- **Then**: each row carries the same mode badge as the project runs view — confirming the badge is NOT project-report-specific

### Original AC2 — Filter the runs view to a single mode

#### Scenario 2.1: Should filter the runs view to only Automated runs (Type: Positive, Priority: High)
- **Given**: the project runs view lists 12 manual runs and 30 automated runs
- **When**: Elena applies the execution-mode filter "Automated"
- **Then**: only the 30 automated runs remain listed

#### Scenario 2.2: Should combine mode filter with outcome filter (Type: Positive, Priority: High)
- **Given**: the project has 30 automated runs, 5 of which are `failed`
- **When**: Elena applies mode="Automated" AND outcome="Failed"
- **Then**: only the 5 automated+failed runs are listed, totals reflect that 5-row subset

#### Scenario 2.3: Should combine mode filter with environment filter (Type: Positive, Priority: High)
- **Given**: the project has automated runs across "Staging" and "Production" environments
- **When**: Elena applies mode="Automated" AND environment="Production"
- **Then**: only automated runs targeting Production are listed

#### Scenario 2.4: Should restore full mixed list when mode filter is cleared (Type: Positive, Priority: Medium)
- **Given**: Elena has the mode filter set to "Automated"
- **When**: she clears the mode filter
- **Then**: the full mixed-mode list and totals return (mirrors BK-38's AC5 clear-filters pattern)

### Original AC3 — Totals split per execution mode

#### Scenario 3.1: Should show Manual/Automated totals alongside pass/fail totals with no filters applied (Type: Positive, Priority: High)
- **Given**: the project has 12 manual runs and 30 automated runs
- **When**: Elena opens the project runs view with no filters applied
- **Then**: the summary shows "Manual 12", "Automated 30" next to the existing pass/fail totals

#### Scenario 3.2: Should show "Manual 0" boundary when no manual runs exist (Type: Boundary, Priority: Medium)
- **Given**: the project has 30 automated runs and 0 manual runs
- **When**: Elena opens the project runs view with no filters
- **Then**: the summary shows "Manual 0, Automated 30" — zero rendered explicitly, not hidden

#### Scenario 3.3: Should show "Automated 0" boundary when no automated runs exist (Type: Boundary, Priority: Medium)
- **Given**: the project has 12 manual runs and 0 automated runs
- **When**: Elena opens the project runs view with no filters
- **Then**: the summary shows "Manual 12, Automated 0"

#### Scenario 3.4: Should count an aborted run in per-mode totals — NEEDS PO/DEV CONFIRMATION (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: whether aborted runs are included in the Manual/Automated split (see Ambiguity #2 — BK-38 precedent excludes aborted from its own pass/fail totals)
- **Given**: the project has 1 aborted automated run alongside 30 finished automated runs
- **When**: Elena opens the project runs view with no filters
- **Then**: "Automated" total is either 30 or 31 depending on PO's answer — this scenario exists to pin down which

### Original AC4 — Empty filter result keeps context

#### Scenario 4.1: Should show mode-specific empty state when Automated filter alone matches nothing (Type: Negative, Priority: High)
- **Given**: the project has no automated runs yet, and no other filter is active
- **When**: Elena applies the execution-mode filter "Automated"
- **Then**: an empty state explains no automated runs have been reported yet and points to how runs get reported (agents and CI pipelines)
- **And**: clearing the filter restores the full list

#### Scenario 4.2: Should show mode-specific empty state when Manual filter alone matches nothing — NEEDS PO/DEV CONFIRMATION (Type: Negative, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: symmetric case not literally in the original Story (Edge case #4)
- **Given**: the project has only automated runs, zero manual runs
- **When**: Elena applies the execution-mode filter "Manual"
- **Then**: a mirrored mode-specific empty state (not the generic no-match state)

#### Scenario 4.3: Should fall through to the generic no-match state when mode+other-filter combination matches nothing — NEEDS PO/DEV CONFIRMATION (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: resolves Ambiguity #1
- **Given**: the project has 30 automated runs project-wide, but 0 automated runs in the "Staging" environment
- **When**: Elena applies mode="Automated" AND environment="Staging"
- **Then**: the GENERIC no-match empty state fires (BK-38's existing "0 rows, 0 totals, never an error" behavior) — NOT the mode-specific "no automated runs reported yet" copy, because automated runs DO exist, just not in this combination

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 8 | Badge rendering (3 modes/surfaces) + filter application (3) + clear-filter (1) + totals-no-filter (1) |
| Negative | 3 | Two empty-state variants + the ambiguous fallthrough case |
| Boundary | 2 | Zero-count totals on each side of the split |
| Edge | 2 | Aborted-run counting + Manual-side empty-state symmetry (both NEEDS PO/DEV CONFIRMATION) |
| Integration | 2 | Overlap-resolution with BK-38's existing filter/report endpoint |
| API | 0 | No new endpoint confirmed yet — pending Gap #1 resolution (extend BK-38's `runs/report` vs. new param) |
| **Total** | **17** | |

**Rationale**: The AC surface itself is small (4 ACs, low business-logic complexity), but the **integration risk with BK-38's already-shipped `executor` filter** is the dominant driver here — most of the outline count above exists to pin down the overlap boundary and the two empty-state branches, not to explore novel business logic. A Story this size would normally yield ~8-10 outlines; the extra count is directly attributable to Gap #1 and Ambiguity #1.

### Outline list

#### Positive
- **Should display "Manual" badge on a human-executed run row** — Pre: run with `executor_mode=human`. Expected: "Manual" badge, neutral tone.
- **Should display "Automated" badge on an agent-executed run row** — Pre: run with `executor_mode=agent`. Expected: "Automated" badge, accent tone.
- **Should display "Automated" badge on a CI-executed run row** — Pre: run with `executor_mode=ci`. Expected: same "Automated" badge as agent — confirms 2-bucket collapse.
- **Should display mode badge in Run detail header beside verdict chip** — Pre: any finished run. Expected: both chips visible together.
- **Should display mode badge in Test run history rows** — Pre: Test with mixed-mode runs. Expected: badge present on BK-37 surface too.
- **Should filter the runs view to Automated only** — Pre: 12 manual + 30 automated runs. Expected: 30 rows remain.
- **Should combine mode filter with outcome and environment filters** — Pre: mixed-mode, mixed-outcome, mixed-environment runs. Expected: intersection narrows correctly (decision-table shape, mirrors BK-38's own combined-filter ATC).
- **Should restore full list when mode filter is cleared** — Pre: mode filter active. Expected: full mixed list + totals return.

#### Negative
- **Should show mode-specific empty state when Automated alone matches nothing** — Pre: zero automated runs, no other filter. Expected: "no automated runs reported yet" copy + pointer to agents/CI.
- **Should show mirrored empty state when Manual alone matches nothing** — Pre: zero manual runs, no other filter. Expected: symmetric copy (NEEDS PO/DEV CONFIRMATION).
- **Should fall through to generic no-match state on mode+other-filter zero-match** — Pre: automated runs exist project-wide but not in the applied environment/status combo. Expected: BK-38's existing generic empty state, not the mode-specific one (NEEDS PO/DEV CONFIRMATION).

#### Boundary
- **Should show "Manual 0" when zero manual runs exist** — Pre: 0 manual, N automated. Expected: explicit zero, not hidden row.
- **Should show "Automated 0" when zero automated runs exist** — Pre: N manual, 0 automated. Expected: explicit zero.

#### Edge
- **Should count (or exclude) an aborted automated run in the Automated total** — Pre: 1 aborted + N finished automated runs. Expected: pending PO answer (NEEDS PO/DEV CONFIRMATION).
- **Should render badge correctly on an aborted run row regardless of totals-counting answer** — Pre: aborted run, any mode. Expected: badge still reflects `executor_mode`, independent of verdict.

#### Integration
- **Should resolve whether the mode filter reuses BK-38's existing `executor` param or introduces a new one** — Pre: n/a (a Dev/API-design question, not a runtime scenario). Expected: documented decision before implementation starts (NEEDS PO/DEV CONFIRMATION, Gap #1).
- **Should confirm the per-mode totals aggregate is new server-side logic, not reused from BK-38's pass/fail-only totals** — Pre: n/a. Expected: documented decision (Gap #1).

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original story? | Criticality | Action |
|---|---|---|---|---|
| 1 | Aborted run mode badge + total inclusion | No | High | Add to AC — **NEEDS PO/DEV CONFIRMATION** |
| 2 | Both totals zero (brand-new project) | No | Medium | Test only — assert correct fallthrough to BK-38's existing no-runs state |
| 3 | Invalid/unexpected `executor_mode` value on the badge | No | Low | Test only — defensive UI case |
| 4 | Manual-side empty state (symmetric to the Automated example given) | No | Medium | Add to AC — **NEEDS PO/DEV CONFIRMATION** |
| 5 | Mode filter + other-filter combo yields zero while mode alone would not | No | High | Add to AC — **NEEDS PO/DEV CONFIRMATION** (resolves Ambiguity #1) |

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- The single most important finding is **scope overlap with BK-38** (already `QA Approved`, ships an `executor` filter on the exact same endpoint this Story targets) — this Story's genuinely-new surface is narrower than it reads at first pass: a 2-bucket label collapse, a new per-mode totals aggregate, and extending the badge to 2 additional surfaces (Test history, Run detail) that BK-38 never touched.
- ACs themselves are concrete and well-written (real numbers, clear Given/When/Then-able language) — the gap is in the *interaction* between this Story's empty-state/totals rules and BK-38's already-shipped behavior, not in the ACs' own clarity.
- Mockup is referenced but unreachable in this repo, so exact visual contract (badge placement, empty-state copy, chip ordering) is Partial pending that asset.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Is BK-225 meant to extend BK-38's already-shipped `executor` filter (human/agent/ci), or ship a parallel Manual/Automated filter alongside it?**
   - **Context**: BK-38 (`QA Approved`) already filters project runs by `executor` with 3 raw values and already shows "executor mode" per row. BK-225's Out of Scope explicitly limits itself to a single "Automated" bucket (no agent-vs-ci split) — implying it's meant to be a UI-level relabeling/collapse of BK-38's existing capability, not a from-scratch filter.
   - **Impact if unanswered**: Dev could build a second, competing filter control in the same view; QA cannot write a precise API-level test until the contract (new param vs. client-side collapse) is fixed.
   - **Suggested answer**: BK-225 collapses BK-38's existing 3-value `executor` filter into a 2-bucket UI (Manual = human, Automated = agent|ci), reusing the same underlying filter/endpoint, and ADDS the net-new per-mode totals aggregate BK-38 does not compute today.

2. **Are aborted runs included in the Manual/Automated totals?**
   - **Context**: BK-38's own shipped totals strip counts passed/failed only (its own AC1 example: "32 passed, 8 failed" — no aborted count anywhere). BK-225's business rule says aborted runs are "counted the way aborted runs are counted today," which — per BK-38's precedent — may mean NOT counted in totals at all.
   - **Impact if unanswered**: Every totals scenario involving an aborted run has an ambiguous expected number.
   - **Suggested answer**: Mirror BK-38 exactly — exclude aborted runs from the Manual/Automated totals, consistent with how they're excluded from the pass/fail totals today.

3. **Does the mode-specific empty state (AC4) apply ONLY when the mode filter is the sole active filter, or also when mode is combined with other filters and the combination (not the mode alone) yields zero?**
   - **Context**: AC4's copy ("no automated runs have been reported yet") is misleading if automated runs exist but simply don't match a co-applied outcome/environment filter.
   - **Impact if unanswered**: Wrong empty-state message shown to users, could cause a support/confusion report ("it says no automated runs exist but I know there are some").
   - **Suggested answer**: Scope AC4's specific copy to mode-alone-empty only; any filtered-combination zero-match falls through to BK-38's existing generic empty state.

---

## Technical Questions for Dev

1. **Does the per-mode totals aggregate extend `bunkai_report_project_runs` (BK-38's RPC) or require a new function/migration?** — BK-38's totals CTE currently only sums passed/failed; adding a Manual/Automated split is a genuinely new aggregate dimension, not a filter-parameter addition. Testing impact: determines whether this Story needs its own DB-level integration test file (mirroring BK-38's `report-rpc.test.ts` pattern) or can extend the existing one.
2. **Where does the Run-detail-header badge and Test-history badge get their `executor_mode` from?** — `GET /runs/{id}` (Run detail) and the BK-37 Test-history endpoint would each need to surface `executor_mode` in their response shape if they don't already. Testing impact: confirms whether this is a pure frontend change (data already present) or requires backend response-shape changes on 2 additional endpoints.
3. **Mockup file `test-runs-index--ci-extension.html` referenced in the Jira comment is not present in this repo's `.context/designs/`** — needs to be re-attached or its path corrected before Stage 2 automation/UI work starts. Testing impact: blocks precise visual-contract test authoring (chip ordering, exact copy strings) until resolved.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---|---|---|
| 1 | Story doesn't mention BK-38 at all despite direct endpoint/UI overlap | Add an explicit "Relationship to BK-38" note in the Story description | Prevents duplicate implementation and duplicate/confused QA effort |
| 2 | Business Rules says aborted runs are counted "the way aborted runs are counted today" without citing where "today" is defined | Cite BK-38's AC1 (passed/failed-only totals) explicitly as the precedent, or state the divergence if one is intended | Removes Ambiguity #2 without requiring a live PO round-trip |
| 3 | AC4 gives only the Automated-empty example | Add the symmetric Manual-empty example, and explicitly scope whether combined-filter zero-match uses the same copy | Removes Ambiguities #1 and closes Edge case #4 without inference |

---

## Data feasibility flags

**DATA-FEASIBILITY-RISK: downgraded from the Phase 1 Selection flag, but still real.**

- **Entity / fixture status**: `runs.executor_mode` (`human`/`agent`/`ci`) already exists in schema and is already exercised in production-adjacent testing — BK-38 (`QA Approved`) needed `agent`-executed runs to validate its own AC2, proving the PAT-driven creation path (`POST /runs` with `executor_mode: agent|ci`, Bearer-only per `business-api-map.md` §3.1) is a proven, already-used test-data mechanism.
- **API contract gap**: none for run creation itself. The open gap is specifically the **Manual/Automated totals aggregate**, which does not exist in any shipped endpoint today (Technical Question #1).
- **Required pre-work**: none blocking — a tester can seed `agent`/`ci` runs via PAT today without waiting on BK-222. The original Selection-phase flag (zero automated runs may exist anywhere) is **not accurate** once BK-38's own test-data precedent is accounted for; downgrading this from a blocker-risk to a "seed it yourself via PAT" note.

---

## Recommended testing strategy

### Pre-implementation
- Get PO answers on the 3 Critical Questions above before Dev starts — the BK-38 overlap question in particular changes the actual scope of work.
- Locate or re-request the mockup asset referenced in the Jira comment.

### During implementation
- Dev should explicitly cross-reference BK-38's `bunkai_report_project_runs` RPC and `ProjectRunsReportView.tsx` rather than building either fresh, per Critical Question #1's likely answer.
- Flag any new DB migration (for the per-mode totals aggregate) for the same review-workload-forecast discipline BK-38's own implementation plan used.

### Post-implementation (in-sprint by /sprint-testing)
- Full outline set from Phase 4 above, upgraded with parametrization tables + test-data JSON once BK-38-overlap and empty-state ambiguities are resolved.
- Explicit regression pass on BK-38's own existing filter/totals behavior — this Story touches the same RPC/view, so BK-38's already-`QA Approved` scenarios are a regression surface, not just a dependency.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|---|---|---|---|
| 1 | Duplicate/competing filter UI ships alongside BK-38's existing one | Medium | High | Integration outlines (Gap #1 resolution) |
| 2 | Totals-counting divergence from BK-38 causes a visible number mismatch between the two totals strips a user might see side-by-side | Medium | Medium | Scenario 3.4, Boundary outlines |
| 3 | Wrong empty-state copy shown on a filtered-combination zero-match | Medium | Low-Medium | Scenario 4.3, Negative outlines |
| 4 | Regression in BK-38's already-shipped filter/report behavior while extending the same RPC/view | Low-Medium | High (BK-38 is already `QA Approved` — a regression here undoes finished work) | Post-implementation regression pass (Recommended testing strategy) |

---

## Next steps

- [ ] PO answers the 3 Critical Questions before sprint planning, especially the BK-38 relationship question
- [ ] Dev answers the 3 Technical Questions before estimation
- [ ] Mockup asset located/re-attached
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and add parametrization + test-data JSON to the outlines above
