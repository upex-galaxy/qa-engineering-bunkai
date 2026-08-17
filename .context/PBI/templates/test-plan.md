# Format Reference — Test Plan / ATP (`test-plan.md`)

> **Reference-only.** This file documents the canonical SHAPE of a story-scoped Acceptance Test Plan for project `BK`. It is NOT a per-ticket authoring target. Grounded in the real synced example `STORY-BK-2-.../acceptance-test-plan.md` (Jira key BK-2).

---

## TMS Modality resolved for this project: **`jira-native`** (no Xray)

Determined from two independent, agreeing sources — no fabrication, no guess:

1. The synced `acceptance-test-plan.md` for BK-2 states explicitly, in its own header: `***TMS Modality:*** \`jira-native\` (no Xray) — user-confirmed 2026-05-27`.
2. `.agents/jira-required.yaml` documents a `# ---- TMS Modality jira-native fields (no Xray) ----` block whose fields (`acceptance_test_plan` on the Story, `acceptance_test_results` on the Story) match exactly what BK-2's synced files use. No `.context/PBI/test-plans/` directory exists in this repo (that directory is reserved for Xray Test Plan container issues under Modality jira-xray) — its absence corroborates jira-native.

**Practical consequence:** the ATP body lives on the **Story's own custom field** `🧪 Acceptance Test Plan (ATP)` (`customfield_10067`), not as a separate Xray `Test Plan` issue. Likewise the ATR lives on `🧪 Acceptance Test Results (ATR)` (`customfield_10124`) on the same Story. `[TMS_TOOL]` for this project resolves to `/acli` (generic Jira field read/write), never `/xray-cli`.

---

## `[SYNC]` vs skill-authored, for this file type

- `acceptance-test-plan.md` and `acceptance-test-results.md` inside a Story/Bug/Defect/Improvement/Tech-Story/Tech-Debt folder are **`[SYNC]`** — forbidden to hand-write directly. The authoring flow is: `/sprint-testing` Stage 1 drafts the ATP body → pushes it to the Story's `acceptance_test_plan` custom field (or a `## Acceptance Test Plan (ATP)` fallback comment if the field is absent on the instance) → `bun run jira:sync-issues` materializes this file.

---

## Canonical shape (sections, in order)

```
# BK-2 — Acceptance Test Plan (QA)

> Jira field: `customfield_10067` · [View in Jira](<jira-instance>/browse/<KEY>)

# Acceptance Test Plan — <KEY>

***Story:*** <Story summary>
***Jira:*** [<KEY>](<link>)
***Epic:*** [<EPIC-KEY>](<link>) — <Epic name>
***Sprint:*** <sprint name> (active | closed, <start> → <end>)
***TMS Modality:*** `jira-native` (no Xray) — <confirmation date/note>
***Environment:*** `<local|qa|staging|production>`
***Web URL:*** `<env web url>`
***API URL:*** `<env api url>`
***Drafted on:*** <date>
***Drafter:*** <who/what drafted it, e.g. "Sprint Testing (orchestration mode, Stage 1)">
***Source ATP DRAFT:*** <pointer to shift-left-refinement.md section, if promoted from one>

---

## 1. Scope

### IN — must verify as part of <KEY>
- <bullet list, each traceable to an AC or explicit shift-left commitment>

### OUT — deferred to other Stories or follow-up polish
- <bullet list with the Story key each item is deferred to>

---

## 2. Risk + Triage verdict

***Verdict: <FORCE-FULL retest | scope-cut | ...>.*** <one-line justification>

| Trigger | Active? | Why |
|---|---|---|
| Money / billing | YES/NO | ... |
| Data integrity on core entities | YES/NO | ... |
| Auth / authorization | YES/NO | ... |
| External integration | YES/NO | ... |
| Multi-tenancy seeding | YES/NO | ... |
| State machine | YES/NO | ... |

Risk-score (informational only — veto wins): <factor breakdown> = ***<total> (LOW|MEDIUM|HIGH)***.

***Formal blocked gate:*** `formal_blocked_gate: <true|false>` per `.agents/project.yaml` — Stage 3 FAILED Story dispatches `defect_reported` (in_test → blocked) when true.

---

## 3. Test environment

| Item | Value |
|---|---|
| Env | `<env>` |
| Web URL | `<url>` |
| API base | `<url>` |
| DB MCP | `<mcp name>` |
| API MCP | `<mcp name>` |
| Credentials | Read from `.env` only — never hardcode. |

---

## 4. Test data strategy

- <how test data is minted, cleaned up, kept collision-free per run>

---

## 5. Test cases

> Grouped as Positive / Negative / Boundary. Each TC is a `#### TC-<KEY>-NN — <title>` block followed by a Field/Value table:

#### TC-<KEY>-NN — <short title>

| Field | Value |
|---|---|
| Layer | UI \| API \| DB \| UI+API \| UI+DB \| UI+API+DB |
| Priority | P1 \| P2 \| P3 |
| Source AC | pointer to the exact Gherkin scenario name in `acceptance-criteria.md` |
| Tool | `[AUTOMATION_TOOL]` / `[API_TOOL]` / `[DB_TOOL]` pseudocode, resolved per `CLAUDE.md` §6 |
| Preconditions | state required before the TC can run |
| Test data shape | what data is needed |
| Steps | numbered |
| Expected | the pass condition, cited back to the AC |
| Notes | flags, known divergences, tooling limitations |

---

## 6. Execution order

<numbered batching strategy — smoke first, fast API negatives next, slow/time-consuming TCs batched last>

---

## 7. Exit criteria

| Result | Verdict |
|---|---|
| All P1 PASS | GO |
| All P1 PASS + ≤N P2 FAIL with documented mitigation | CAUTION |
| Any P1 FAIL | NO-GO |
| P3 BLOCKED by tooling | Acceptable as KNOWN — record in ATR |

Severity classification per `.agents/jira-required.yaml` Bug fields: any FAIL of P1 = `critica`/`mayor`; FAIL of P2 = `moderada`; FAIL of P3 = `menor`/`trivial`.

---

## 8. Open questions still pending

### For PO
1. <question>

### For Dev
1. <question>

---

## 9. Traceability matrix

| TC ID | Source AC scenario | ATR results section (filled Stage 2) |
|---|---|---|
| TC-<KEY>-NN | <scenario name> | `acceptance-test-results.md` row TC-<KEY>-NN |

ATR mirror file: [`acceptance-test-results.md`](./acceptance-test-results.md) — scaffold ready; results filled by Stage 2, summary finalized by Stage 3.

---

**Single source of truth: this file. Jira mirror: customfield** `acceptance_test_plan` **on <KEY> + Stage 1 announce comment. Stage 2 reads this; Stage 3 reads the ATR.**

---
_Synced from Jira by sync-jira-issues_
```

---

## AC -> TC mapping essentials (test-design doctrine, `agentic-qa-core/references/test-design-doctrine.md`)

- Coverage = AC-conformance + risk-beyond-AC. Verifying every AC is the FLOOR, not the definition of "tested."
- One AC → multiple TCs by default (1:N). Collapsing an AC to a single TC requires a written `trivially atomic` justification.
- Technique triggers: Equivalence Partitioning always; Boundary Value Analysis on ranges/limits (BK-2 used it for the 254-char RFC 5321 boundary and the 15-minute TTL boundary); State-Transition on status fields (BK-2 used it for the magic-link token lifecycle: unused → used → expired); Decision Table on 2+ interacting conditions; Pairwise on 3+ factors.
- Never report "% of ACs verified" as a completeness metric.

---

## Gotchas specific to this project

- Because the project is `jira-native`, there is no separate Xray `Test Plan`/`Test Execution` issue to link — the ATP/ATR are the Story's own custom fields. Do not create `.context/PBI/test-plans/` or `test-executions/` container folders for a plain Story under this modality; those only appear when a Story has >1 linked Test Execution (rare, and still nested inside the Story's own folder, not the top-level `test-plans/`).
- Fields containing literal underscores/asterisks in identifiers (e.g. `auth.otp*exp`, `TOKEN*USED`) in the synced example are a Markdown-escaping artifact of the sync (underscores in `snake_case` names get interpreted as emphasis markers) — read them as `auth.otp_exp`, `TOKEN_USED` etc., not as the literal glyphs shown.
- `[TMS_TOOL]` pseudocode in this file always resolves to `/acli` for this project (Modality jira-native) — do not default to `/xray-cli` when writing new ATPs here.

---

## Discovery Gaps

- None for modality resolution — confirmed by two independent sources (BK-2's own ATP header + `.agents/jira-required.yaml` field block), both cross-checked against the absence of a `.context/PBI/test-plans/` directory.
