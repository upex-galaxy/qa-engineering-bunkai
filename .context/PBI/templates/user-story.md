# Format Reference — Story (`user-story.md`)

> **Reference-only.** This file documents the canonical SHAPE of a synced Jira Story for project `BK`. It is NOT a per-ticket authoring target — per-ticket content is generated in Jira (source of truth) and materialized locally by `bun run jira:sync-issues get <KEY> --include-comments` into `.context/PBI/epics/EPIC-<KEY>-<slug>/stories/STORY-<KEY>-<slug>/story.md`. Grounded in the real synced example `STORY-BK-2-authentication-sign-up-and-sign-in-with-email-magi/story.md` (Jira key BK-2).

---

## `[SYNC]` vs skill-authored, for this file type

- `story.md` and its per-field siblings (`acceptance-criteria.md`, `business-rules.md`, `scope.md`, `out-of-scope.md`, `workflow.md`, `mockup.md`, `acceptance-test-plan.md`, `acceptance-test-results.md`, `comments.md`) are **`[SYNC]`** — forbidden to hand-write. They are overwritten on every sync run. If you need new/changed content in one of these, write it to the matching Jira field (or the fallback comment per `.agents/jira-required.yaml`), then re-run the sync and read the materialized file.
- `context.md`, `test-session-memory.md`, `shift-left-refinement.md`, `test-cases/`, `evidence/` living alongside `story.md` are skill-authored, non-Jira files — safe to author locally.

---

## Canonical shape (sections, in order)

```
# <Epic-area label> | <Story summary>          <- H1 title (Jira summary, often "Area | short description")

**Jira Key:** [<KEY>](<jira-instance>/browse/<KEY>)
**Epic:** [<EPIC-KEY>](<jira-instance>/browse/<EPIC-KEY>) (<Epic name>)
**Type:** Story
**Status:** <workflow status name>            <- see Workflow states below; verbatim, not normalized
**Priority:** <Jira priority>
**Story Points:** <number, or "-" if unestimated>
**Web Link:** <environment URL under test, if applicable>

---

## Overview

***Source spec:*** <traceability pointer to PRD/SRS requirement ID, if any>

## User story

As a [persona], I want to [action] so that [benefit].

## Business rules

- <bullet list of invariants/constraints the implementation must uphold>

## Workflow

1. <numbered happy-path flow, step by step>

## Definition of done

- Implementation complete
- Unit tests written
- Code reviewed
- Documentation updated

## Labels

`<label1>`, `<label2>`, ...

---

## QA Refinements (Shift-Left Analysis)          <- OPTIONAL: only present after /shift-left-testing has run

> Present only once the Story has gone through pre-sprint Shift-Left QA. Summarizes refined ACs (count + EP/BVA/state-transition/decision-table/pairwise breakdown), edge cases catalogued, clarified business rules, open questions for PO/Dev/Design, and an IN/OUT scope refinement. Full detail lives in the Jira ATP custom field + a Jira comment, not duplicated here beyond the summary.

---

## Fields

> Each rich-text field is a separate file in this folder.

- [Acceptance Criteria](./acceptance-criteria.md)
- [Business Rules](./business-rules.md)
- [Scope](./scope.md)
- [Out Of Scope](./out-of-scope.md)
- [Workflow](./workflow.md)
- [Mockup](./mockup.md)
- [Acceptance Test Plan (QA)](./acceptance-test-plan.md)
- [Acceptance Test Results (QA)](./acceptance-test-results.md)

---

## Traceability                                  <- OPTIONAL: only present when issue links exist

### Story (N)

- [<LINKED-KEY>](<jira-instance>/browse/<LINKED-KEY>): <summary> _(<status>)_

---

## Metadata

- **Created:** <d/m/yyyy>
- **Updated:** <d/m/yyyy>
- **Reporter:** <name>
- **Assignee:** <name>
- **Labels:** <comma-separated>

---

_Synced from Jira by sync-jira-issues_
```

---

## Acceptance Criteria shape (`acceptance-criteria.md`)

Field: `✅ Acceptance Criteria (Gherkin)` — `customfield_10097` (see `.agents/jira-fields.json` → `acceptance_criteria`).

- Written as Gherkin: `Background:` block + one `Scenario:` per AC, grouped by `# ---- Happy path ----`, `# ---- Negative path ----`, `# ---- Boundary / edge ----` comment headers.
- Numbered implicitly by scenario order; the ATP (see `templates/test-plan.md`) cross-references each TC to its source scenario by name, not by a bare "AC1/AC2" index — use the scenario title as the anchor.
- After a Shift-Left pass, the field is QA-refined (PO ownership returns after Estimation grooming). The file's footer states the refinement date and ownership handoff explicitly — do not strip that provenance note when reading it.

**AC checklist to enforce when refining (per `agentic-qa-core/references/test-design-doctrine.md`):**

- [ ] Specific and measurable
- [ ] Testable (can be automated)
- [ ] Independent (doesn't assume other ACs)
- [ ] Business-focused (not implementation detail)

---

## Workflow states observed for `story` (from `.agents/jira-workflows.json`, workflow `UPEX Feature (US) Workflow`)

| Status | Category |
|---|---|
| Backlog | new |
| Shift-Left QA | indeterminate |
| Estimation | indeterminate |
| Ready For Dev | new |
| In Progress | indeterminate |
| In Review | indeterminate |
| Ready For QA | new |
| In Test | indeterminate |
| BLOCKED | new |
| QA Approved | done |
| Ready For Release | done |
| Deployed to Production | done |
| ABORTED | done |

Capture status names verbatim in JQL/queries — do not abbreviate (`In Test`, not `Testing`).

---

## Gotchas specific to this project

- Story titles frequently carry an `Area |` prefix (e.g. `TMS-Workspace |`, `Authentication |`) — this is the Jira Components-derived convention, not a formatting error; preserve it when quoting a title.
- `Story Points` renders as `-` when unestimated — do not read that as zero.
- A Story can gain a `## Traceability` section listing sibling/duplicate Stories (e.g. BK-2 ↔ BK-166) — these are issue-links, not parent/child; do not confuse with the Epic relationship.
- Placeholders in this reference (`[persona]`, `[action]`, `[benefit]`, `<KEY>`, etc.) are intentionally left as tokens — never fill them in this file; per-ticket content only ever comes from the sync.

---

## Discovery Gaps

- None — every field and status name above is grounded in a real synced file (`STORY-BK-2-.../story.md`, `acceptance-criteria.md`) or a catalog (`.agents/jira-fields.json`, `.agents/jira-workflows.json`). If a future Story surfaces a custom field not enumerated here, treat it as an update trigger for this template (see `phase-4-specification.md` → "When to re-run Phase 4").
