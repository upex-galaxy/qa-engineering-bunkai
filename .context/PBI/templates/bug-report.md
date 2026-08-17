# Format Reference — Bug / Defect (`bug-report.md`)

> **Reference-only.** This file documents the canonical SHAPE of a synced Jira Bug for project `BK`. It is NOT a per-ticket authoring target — per-ticket content is generated in Jira (source of truth) and materialized locally by `bun run jira:sync-issues get <KEY> --include-comments` into `.context/PBI/bugs/BUG-<KEY>-<slug>/bug.md` (standalone) or `.context/PBI/epics/.../stories/.../defects/DEFECT-<KEY>-<slug>/` when nested under a Story. Grounded in the real synced example `BUG-BK-51-bk-8-reserved-project-slugs-are-not-rejected-ac-11.../bug.md` (Jira key BK-51).

---

## `[SYNC]` vs skill-authored, for this file type

- `bug.md` (or `defect.md` for the `Defect` issue type) is **`[SYNC]`** — forbidden to hand-write. Overwritten on every sync run. To change content, write it to the Jira issue/field, then re-sync.
- Per the defect-management doctrine (`agentic-qa-core/references/defect-management-doctrine.md`), classification as Bug vs Defect vs Improvement is decided by the FEATURE's lifecycle stage (Bug = feature already live above Staging), not by where the issue was found — but the file SHAPE below is identical for both issue types.

---

## Canonical shape (sections, in order)

```
# BUG: <Story-KEY>: <one-line summary> — <optional extra context>   <- H1 title

**Jira Key:** [<KEY>](<jira-instance>/browse/<KEY>)
**Priority:** <Jira priority, auto-derived from Severity>
**Status:** <workflow status name>
**Components:** <affected product module(s), mandatory>
**Severity:** <critica | mayor | moderada | menor | trivial>
**Error Type:** <functional | visual | performance | security | crash | data | integration | content>
**Test Environment:** <local | qa | staging | production | dev | uat>
**Fix Type:** <e.g. Bugfix>

---

## Description

## Summary

<what's broken, one paragraph, cites the endpoint/route/component and the AC or contract it violates>

## Environment

<env URL> · <API base if relevant> · <date> · <auth context, e.g. "cookie-session auth as <test user>">

## Severity / Type

Severity: ***<level>*** · Error type: ***<type>*** (<one-line risk framing>).

## Steps to Reproduce

1. <numbered, precise, reproducible>

## Expected Result

<what the AC / contract says should happen — cite the AC number or the shift-left commitment it traces to>

## Actual Result

<what was observed, with concrete evidence: status codes, DB rows, screenshots>

## Root Cause (code-confirmed)          <- OPTIONAL: present when Dev/QA traced the defect to a code location

<file path + explanation>

## Impact

<business/user risk framing — who is affected, what breaks downstream>

## Evidence

<paths to screenshots/logs/DB query results/`test-session-memory.md` row references>

---

## 🔍 Root Cause                        <- separate structured field, distinct from the prose "Root Cause" above

**Category:** <Code Error | Configuration Error | Data Error | Infrastructure Error | Integration Error | Requirement Error | Third-Party Error | Working as Designed>

---

## Related Issues                       <- OPTIONAL: present when issue links exist

- is duplicated by: [<KEY>](<jira-instance>/browse/<KEY>) - <summary>

---

## Metadata

- **Created:** <d/m/yyyy>
- **Updated:** <d/m/yyyy>
- **Reporter:** <name>
- **Assignee:** <name>
- **Labels:** <comma-separated, often includes the source Story key + `sprint-defect` + wave label>

---

_Synced from Jira by sync-jira-issues_
```

---

## Severity guide

Source: `.agents/jira-fields.json` → `severity` (`customfield_10121`), option values `critica`/`mayor`/`moderada`/`menor`/`trivial`. Priority is auto-derived from Severity per the defect-management doctrine — never set independently.

| Severity | Criteria | Example |
|---|---|---|
| `critica` (Critical) | System down, data loss, security breach | Cannot sign in; workspace bootstrap corrupts data |
| `mayor` (Major) | Major feature broken, no workaround, or latent structural risk | Reserved-slug validation missing (BK-51) — routing-collision risk |
| `moderada` (Moderate) | Feature impaired, workaround exists | A filter is broken but manual search still works |
| `menor` (Minor) | Small functional gap, low user impact | Non-blocking validation message missing |
| `trivial` | Cosmetic | Typo, alignment, spacing |

## Error Type options

Source: `.agents/jira-fields.json` → `error_type` (`customfield_10147`): `functional`, `visual`, `performance`, `security`, `crash`, `data`, `integration`, `content`.

## Root Cause categories

Source: `.agents/jira-fields.json` → `root_cause` (`customfield_10049`): `code_error`, `configuration_error`, `data_error`, `infrastructure_error`, `integration_error`, `requirement_error`, `third_party_error`, `working_as_designed`.

## Test Environment options

Source: `.agents/jira-fields.json` → `test_environment` (`customfield_10095`): `dev`, `qa`, `staging`, `uat`, `production`. Canonical identifiers per `CLAUDE.md` §8 are `local`/`qa`/`staging`/`production` (lowercase, no `prod`/`stg`/`uat` abbreviations) — note this project's Jira field itself still exposes a `uat` option; when filing, prefer the closest canonical env and record any mismatch as a Discovery Gap rather than inventing a new option.

---

## Gotchas specific to this project

- The H1 title often embeds the source Story key inline (`# BUG: BK-8: ...`) even though the formal traceability link lives under `## Related Issues` / an issue-link — both can be present simultaneously; don't treat the title mention as the only traceability signal.
- `## Root Cause (code-confirmed)` (prose, inside Description) and `## 🔍 Root Cause` (structured `Category` field) are two different fields — do not merge them when reading or re-authoring content upstream in Jira.
- Duplicate bugs are common (e.g. BK-51 vs BK-54, BK-52 vs BK-55, BK-53 vs BK-56) — always check `## Related Issues` for "is duplicated by" before triaging a new-looking bug as unique.
- Per the QA-process 3-axis model (`CLAUDE.md` §9), every bug parents to the **QA Defect Management** epic (`BK-183` in this project's epic tree) — never to the product Epic the affected Story lives under. The source Story is carried by an issue-link, and the product module by `Components` — three separate axes.

---

## Discovery Gaps

- None — every field/option enumerated above is grounded in a real synced file (`BUG-BK-51-.../bug.md`) or a catalog (`.agents/jira-fields.json`). If a future Bug surfaces a Components value or Error Type option not seen yet, that is expected (open enumeration) — no template change needed unless the field SHAPE itself changes.
