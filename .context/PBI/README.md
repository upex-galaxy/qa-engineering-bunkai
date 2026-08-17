# Product Backlog Items (PBI)

Per-epic and per-story QA workspace shared by `/shift-left-testing`, `/sprint-testing`, `/test-documentation`, and `/test-automation`.

> **This tree is OWNED by `scripts/sync-jira-issues.ts`.** Module = Epic (1:1). **Jira is the source of truth; every `[SYNC]` `.md` here is a read-only cache.** NEVER hand-write a Jira-mirrored file — generate the content, push it to the Jira field (or fallback comment), run the sync, then read the materialized file back. Authoritative tree + ownership rules live in `CLAUDE.md` §9.

## Layout (canonical, Epic-centric)

```
.context/PBI/
  epic-tree.md                                   [SYNC] master index
  epics/EPIC-<KEY>-<slug>/
    epic.md                                       [SYNC]
    feature-implementation-plan.md                [SYNC ← Jira field / stub]
    feature-test-plan.md                          [SYNC ← Jira field / stub]
    module-context.md                             [skill — non-Jira, OK]
    test-specs/                                   [skill — non-Jira, EPIC level]
      ROADMAP.md  PROGRESS.md
      <ID>/ spec.md  automation-plan.md  atc/*.md
    stories/STORY-<KEY>-<slug>/
      story.md                                    [SYNC]
      acceptance-criteria.md  business-rules.md  scope.md  out-of-scope.md
      workflow.md  mockup.md  implementation-plan.md        [SYNC ← Jira fields / stub]
      acceptance-test-plan.md  acceptance-test-results.md   [SYNC ← Jira fields / stub]
      comments.md                                 [SYNC, --include-comments]
      context.md  test-session-memory.md          [skill — non-Jira, OK]
      shift-left-refinement.md                    [skill — non-Jira, OK]
      test-cases/  evidence/                       [skill — non-Jira, OK]
      acceptance-test-plan.md  acceptance-test-results.md   [SYNC ← Xray Test Plan/Execution desc OVERRIDES Story field, else field, else stub]
      test-executions/                             [SYNC — only when >1 Execution linked]
      defects/<PREFIX>-<KEY>-<slug>/               [SYNC — linked defects nested as coverable folders]
  bugs/BUG-<KEY>-<slug>/                          [SYNC — coverable folder: bug.md + ATP + ATR + test-executions/ + defects/]
  improvements/IMPROVEMENT-<KEY>-<slug>/          [SYNC — coverable folder: improvement.md + ATP + ATR + …]
  tech-stories/TECHSTORY-<KEY>-<slug>/            [SYNC — coverable folder: tech-story.md + ATP + ATR + …]
  tech-debts/TECHDEBT-<KEY>-<slug>/               [SYNC — coverable folder: tech-debt.md + ATP + ATR + …]
  defects/ tests/                                 [SYNC — standalone defect / test issues]
  test-plans/ test-executions/ test-sets/ preconditions/   [SYNC — Xray container issues (jira-xray); description holds the ATP/ATR body]
```

Folder naming follows Jira IDs verbatim — `<KEY>` is the Jira issue key, `<slug>` is `kebab-case` from the summary. Epic and Story folders are prefixed `EPIC-` / `STORY-`. Every Story lives under its Epic's `stories/` (Module = Epic, 1:1).

**Default `pull` scope = Epics + Stories + Bugs** (plus optional types via `--types` / `JIRA_SYNC_TYPES`). **Coverable** issues — Story, Bug, Defect, Improvement, Tech Story, Tech Debt — each get their OWN folder containing the issue body (`story.md` / `bug.md` / `improvement.md` / `tech-story.md` / `tech-debt.md` / `defect.md`), `acceptance-test-plan.md` (ATP), `acceptance-test-results.md` (ATR), a `test-executions/` subfolder (only when >1 execution is linked), and a `defects/` subfolder (linked defects nested as coverable folders). Standalone coverable folders live at `bugs/`, `improvements/`, `tech-stories/`, `tech-debts/`. **ATP/ATR source precedence:** a linked Xray Test Plan description (ATP) / Test Execution / Re-Test Execution description (ATR, newest wins) **OVERRIDES** the Story custom-field copy; absent that, the issue custom field; absent that, a Jira comment only with `--include-comments`; otherwise silent. The sync also emits end-of-run **traceability WARNINGS** for ATP/ATR linked via the wrong link type, atypical Defect links, and orphan Defects with no coverable parent.

## `[SYNC]` vs skill-authored

- **`[SYNC]` files = forbidden to hand-write.** They are overwritten on every sync — **NO file is hard-protected.** A file that mirrors a Jira/Xray field → read the synced copy, never author it locally.
- **Skill-authored, non-Jira files** (`module-context.md`, `test-specs/`, `context.md`, `test-session-memory.md`, `shift-left-refinement.md`, `test-cases/`, `evidence/`) hold info that is NOT in Jira → author them locally as usual.

## Jira-first generation contract

Every `[SYNC]` file's content originates in Jira. The flow is always **generate → push to Jira field (or fallback comment) → `jira:sync-issues` → read**:

1. `/shift-left-testing` refines ACs and the ATP DRAFT, writes them to the Story's custom fields (`{{jira.acceptance_criteria}}`, `{{jira.acceptance_test_plan}}`), then syncs.
2. `/sprint-testing` authors the ATP/ATR and pushes them to the Story fields (jira-native) or the Xray `Test Plan` / `Test Execution` description (jira-xray), then materializes the read-only cache per modality (story-folder `acceptance-test-*.md`, or `.context/PBI/test-plans/` / `test-executions/`).
3. If a custom field is absent on the instance, the skill writes the content as a structured Jira comment (`## <label>`, per `.agents/jira-required.yaml` → `fallback:`); the sync then emits a pointer stub for that field's `.md`. Never block on a missing field.

The **test-specs/** subtree (EPIC level) is `/test-automation`'s own non-Jira working area: `spec.md` (business-level TCs in Gherkin), `automation-plan.md` (KATA components, fixtures, architecture), and `atc/*.md` (per-ATC contracts for complex ATCs). These are authored locally — they are NOT Jira-mirrored.

## Detailed reads go through the sync

Custom-field content (ACs, ATP/ATR, scope, business rules, comments) is **only** read via the sync — `acli view` returns null for `customfield_*`:

- `bun run jira:sync-issues get <KEY> --include-comments` → one issue, ALL custom fields + comments → read the generated `.md`.
- `bun run jira:sync-issues jql "<query>"` → batch. `pull --epic <KEY>` / `--story <KEY>` → scoped. `pull --sprint <active|closed|>=N|7,8,10>` → sprint-scoped; `pull --types <csv>` → add optional coverable types; `pull --no-defects` → skip defect discovery; `pull --project <KEY>` → override project key.
- Traceability link-graph (Story↔ATP↔ATR↔TC) + Xray run status stay on `acli` / `xray-cli` — the script only mirrors field content.

## Conventions

- **Prefix**: Jira project key — `{{PROJECT_KEY}}-` (declared in `.agents/project.yaml`).
- **Names**: kebab-case for file names; `EPIC-` / `STORY-` / `DEFECT-` prefixes on folders per the canonical tree.
- **Evidence**: `evidence/` holds ephemeral screenshots/logs (gitignored).

## Issue Tracker Connection

- **Tool:** Jira Cloud.
- **Project key:** `BK`.
- **Instance:** `jira.upexgalaxy.com` — every synced `.md` in this tree links back via `https://jira.upexgalaxy.com/browse/<KEY>`. `.agents/project.yaml` → `issue_tracker.atlassian_url` records the underlying Atlassian site as `https://upexgalaxy71.atlassian.net/` (same tenant, custom domain — `ATLASSIAN_URL` in `.env` is the credential source of truth).
- **TMS Modality:** `jira-native` (no Xray). Confirmed directly in a synced ATP header (`STORY-BK-2-.../acceptance-test-plan.md`: `TMS Modality: jira-native (no Xray) — user-confirmed 2026-05-27`) and corroborated by the "TMS Modality jira-native fields (no Xray)" block in `.agents/jira-required.yaml`. ATP/ATR live as Story/Bug custom fields (`✅ Acceptance Criteria (Gherkin)` = `customfield_10097`, `🧪 Acceptance Test Plan (ATP)` = `customfield_10067`, `🧪 Acceptance Test Results (ATR)` = `customfield_10124`) — not separate Xray Test Plan / Test Execution issues. `[TMS_TOOL]` resolves to `/acli` for this project, never `/xray-cli`.
- **Access method:** primary `/acli` skill (CLI) for issue reads/writes/transitions/links; detailed custom-field content (ACs, ATP/ATR, business rules, comments) via `bun run jira:sync-issues get <KEY> --include-comments` — `acli view` returns `null` for `customfield_*`.
- **Credentials:** `.env` → `ATLASSIAN_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`. No `JIRA_*` aliases exist for this project. Never paste tokens in markdown.
- **Sync tooling:** `scripts/sync-jira-issues.ts`, invoked as `bun run jira:sync-issues get <KEY> --include-comments`, `bun run jira:sync-issues jql "<query>"`, or `bun run jira:sync-issues pull --epic <KEY>` (see flags in `CLAUDE.md` §9 — `--sprint`, `--types`, `--no-defects`, `--project`).

## Common Queries

Status names below are verbatim from `.agents/jira-workflows.json` (workflow `UPEX Feature (US) Workflow` for Story, `UPEX BUG/DEFECT LIFE CYCLE` for Bug) — do not abbreviate or normalize them.

| Need | JQL |
|---|---|
| Active-sprint Stories ready for QA | `project = BK AND type = Story AND sprint in openSprints() AND status = "Ready For QA"` |
| Backlog Stories for shift-left grooming | `project = BK AND type = Story AND status = "Backlog"` |
| Open bugs (excludes Closed / Cannot Reproduce / ABORTED) | `project = BK AND type = Bug AND status not in ("Closed", "Cannot Reproduce", "ABORTED") ORDER BY priority DESC` |
| My Stories currently in testing | `project = BK AND type = Story AND status = "In Test" AND assignee = currentUser()` |
| Recently updated (any type, last 24h) | `project = BK AND updated >= -1d ORDER BY updated DESC` |

Resolve via `[ISSUE_TRACKER_TOOL]` (`/acli`) for issue-level results; for full custom-field content on the matched issues, follow up with `bun run jira:sync-issues jql "<query>"`.

## Discovery Gaps

- None for the connection recipe or query set above — project key, instance domain, TMS modality, and all status names are grounded in real synced files (`STORY-BK-2-.../story.md`, `.../acceptance-test-plan.md`) or committed catalogs (`.agents/project.yaml`, `.agents/jira-fields.json`, `.agents/jira-workflows.json`). If a future workflow change renames or adds a status, update the table above and re-verify against `.agents/jira-workflows.json` rather than guessing.
