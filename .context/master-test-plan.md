# Master Test Plan — Bunkai TMS

```
+---------------------------------------------------------------+
|  BUNKAI — what to test, and why it matters                    |
|  Traceability-by-construction TMS: US -> AC -> ATC -> Test ->  |
|  Run -> Bug, every link enforced by schema, not convention.   |
+---------------------------------------------------------------+
```

> Sources: `.context/business/business-data-map.md`, `.context/business/business-feature-map.md`, `.context/business/business-model.md`, `.context/PBI/epic-tree.md`, `.context/PBI/bugs/*` (33 real historical defects), `CLAUDE.md` §Project Assessment.
> Generated: 2026-08-17. Mode: CREATE.

---

## 2. Executive risk map

Bunkai's entire value proposition rests on one guarantee: an ATC is provably anchored to a User Story and at least one Acceptance Criterion, and that chain survives edits, moves, and archives without silently breaking. Everything else in the product — Runs, Bugs, Traceability reports — is downstream of that guarantee holding. The second-biggest risk cluster is tenancy: every table resolves to a `workspace_id`, and the schema's own history shows this boundary has been breached before (`0047`'s cross-project ATC-join incident, the BK-135 PAT privilege-escalation bug). The third cluster is auth — five separate historical bugs (BK-175, 176, 177, 181, 400) cluster around magic-link/OTP sign-in alone, which tells you this is a genuinely fragile integration point, not a one-off.

| Priority | Flow | Why it matters | Depends on / Affects |
|---|---|---|---|
| CRITICAL | ATC authoring + anchoring | Core differentiator — if the AC-anchor guarantee breaks, the product has no reason to exist | Test Chains, Traceability, Coverage |
| CRITICAL | Cross-workspace / cross-project isolation (RLS) | One tenant seeing another's data is a trust-destroying breach, not a bug | Every table in the schema |
| CRITICAL | PAT issuance + scope enforcement | Real privilege-escalation incident already shipped once (BK-135) | Every headless/API-driven flow |
| HIGH | Auth (magic-link / OTP / password) | Five distinct historical bugs on this one surface; locks every user out if broken | Everything gated by login |
| HIGH | Manual Run execution (start/mark/finish/abort) | The entire manual-QA value loop depends on this completing cleanly | Bug filing, Traceability, Notifications |
| HIGH | Bug filing + provenance | Native defect tracking is a named differentiator; cross-project provenance injection shipped once already | Traceability, Notifications, Metrics |
| HIGH | Module tree (create/move/archive cascade) | Depth-6 tree with a documented, unresolved edge-case gap (stranded descendants) | User Stories, ATCs, Bugs (all module-anchored) |
| MEDIUM-HIGH | Traceability & Coverage reporting | Already produced one real defect (BK-317) from a status-vocabulary mismatch across 4 grains | Release-readiness decisions made by reading this report |
| MEDIUM | Test chain building (chain ATCs into a Test) | Idempotency bug already shipped (BK-248, `POST /tests` 500) | Run Execution |
| MEDIUM | Workspace invites + role assignment | Real email-uniqueness and role-overwrite bugs shipped (BK-60/61/62) | Team access, RLS correctness |

Everything below HIGH — Milestones, Notifications, Activity Log, Home Dashboard, Metrics dashboards, API reference — is covered in §8 as a shorter pass; none of it gates the core traceability chain, and none has a documented history of data-integrity-class defects.

---

## 3. What to test first and why

### ATC Authoring (FEAT-012)

**Why it matters** — Every other artifact in the system (Tests, Runs, Bugs, Coverage) ultimately points back to an ATC. If an ATC can exist without a valid Acceptance Criterion anchor, or if that anchor can silently detach, the "traceability by construction" claim in `business-model.md` is false advertising, not a minor gap.

**What commonly breaks** — Anchoring validation lives partly in the RPC (`45020 ac_outside_user_story`) and partly in the M:N join table that carries **no `project_id`/`workspace_id` of its own** (`business-data-map.md` §2.8) — this exact class of leak already shipped once (migration `0047`'s incident). Optimistic-lock conflicts on concurrent edits (`45022 version_conflict`) are another likely-fragile edge. A confirmed historical bug (BK-96) hit the PATCH happy path directly.

**Dependencies** — Feeds Test Chain Building and every downstream Run/Bug/Traceability read.

**What an experienced QA would check**
- Attempt to create an ATC anchored to an AC that belongs to a *different* User Story than the one the ATC is anchored to — must reject, not silently accept.
- Attempt to create/duplicate an ATC across a Project boundary inside the same Workspace (the M:N join's known scope gap) — verify the cross-project chain is rejected, not just hidden in the UI.
- Two users editing the same ATC concurrently — verify `version_conflict` fires and neither edit is silently lost.
- Duplicate an ATC and verify the new slug is genuinely unique and steps/assertions/AC-bindings are deep-copied, not referenced.

### Cross-Workspace / Cross-Project Isolation (RLS)

**Why it matters** — This is a multi-tenant SaaS; one workspace seeing another's ATCs, Bugs, or Runs is the single worst thing this product can do to a customer's trust, worse than any functional bug.

**What commonly breaks** — The target repo's own `*-isolation.test.ts` naming convention (per `business-model.md` §QA Relevance) shows the dev team already treats this as first-class, which means the risk is real, not hypothetical. The RLS rewrite history (naive inline `EXISTS` → `42P17` infinite recursion → `SECURITY DEFINER STABLE` helper functions, `business-data-map.md` §4) shows this subsystem has already broken once at the architecture level.

**Dependencies** — Every table; a regression here cascades everywhere simultaneously.

**What an experienced QA would check**
- As a member of Workspace A, attempt every read/write RPC (ATC, Bug, Run, Test) against an entity ID belonging to Workspace B — every one must collapse to the same non-disclosing not-found error, never a distinct "forbidden" (per the documented non-disclosure pattern, `business-data-map.md` §4.4).
- Verify a PAT scoped to Workspace A cannot reach Workspace B's data even if the caller guesses a valid UUID.
- Re-run the full isolation matrix after any schema/RLS-touching PR — this is a regression-suite candidate, not a one-time check.

### PAT Issuance + Scope Enforcement (FEAT-002/006)

**Why it matters** — This is the one subsystem with a *confirmed* real-world security incident (BK-135: `workspace:admin`-scoped tokens issuable by non-admins). Headless/CI/agent callers depend entirely on scope checks holding.

**What commonly breaks** — Scope-check uniformity across routes is explicitly flagged as unverified in the feature map (FEAT-002 capability list). The explicit-actor pattern (`p_actor_user_id`) that lets PAT calls bypass `auth.uid()` is exactly the kind of mechanism that regresses silently when a new route forgets to wire it.

**Dependencies** — Every `/api/v1/*` route accepts a PAT as an alternative auth path — a scope-check regression is workspace-wide, not endpoint-local.

**What an experienced QA would check**
- Issue a `member`-scoped PAT, attempt every `workspace:admin`-gated action (this is the exact regression class of BK-135 — treat it as a permanent regression-suite entry, not a closed ticket).
- Verify a revoked token (`revoked_at` set) is rejected immediately, not just hidden from the list UI.
- Verify identity-spoofing is closed: an interactive session cannot pass a different user's UUID as `p_actor_user_id`.

### Auth: Magic-Link / OTP / Password (FEAT-001)

**Why it matters** — Every flow in the product is gated behind this. It also has the densest cluster of historical bugs in the whole backlog: BK-175 (no code-entry fallback), BK-177 (missing email-first step on staging), BK-181 (wrong endpoint called on resend), BK-400 (OTP exchange failure).

**What commonly breaks** — Multi-step flows (request code → enter code → exchange for session) are exactly where a wrong endpoint or a missing UI state gets introduced, per the BK-175/181 pattern. Staging-specific deployment gaps (BK-177) suggest environment-config drift is also a live risk here, not just app logic.

**Dependencies** — Gates literally everything else.

**What an experienced QA would check**
- Full sign-up → confirm → sign-in round trip on every supported method (password, magic-link, OAuth) — do not assume password-path health implies magic-link-path health; they have separately broken before.
- Resend-code action calls the correct endpoint (BK-181's exact regression).
- Staging-specific config (email-first-page presence, BK-177) — test against the actual target environment, not just local.

### Manual Run Execution (FEAT-014)

**Why it matters** — This is the entire manual-QA value loop end to end: start → mark steps → finish/abort. If this breaks, the product cannot do the one thing it exists to do.

**What commonly breaks** — The snapshot-immutability invariant (a Run never re-resolves from a since-edited Test) is easy to accidentally violate in a future change and easy to *mis-test* as a bug when it's actually correct behavior (ADR-0004) — a QA engineer needs to know this going in, or will file false-positive defects. The 3-grain-plus-derived-4th-grain status model (§3.1 in the data map) already produced one real, confirmed defect (BK-317).

**Dependencies** — Feeds Bug filing, Notifications, Traceability, Metrics.

**What an experienced QA would check**
- Mark a step, then edit the source Test — confirm the in-flight Run's checklist does NOT change (this is correct behavior, verify it stays that way).
- Drive a Run through every terminal path (`finished/passed`, `finished/failed`, `aborted`) and confirm the Traceability view's derived state renders sensibly for each — this is precisely where BK-317 was found.
- Attempt a double-finish or finish-after-abort — both must be rejected (`45206`/`45207`), not silently accepted.
- Verify the 24h idempotency replay guard on Run creation actually prevents a genuine double-start under a flaky-network retry.

### Bug Filing + Provenance (FEAT-015/016)

**Why it matters** — Native defect tracking with automatic Run/Step/ATC provenance is a named differentiator. If provenance can be spoofed or misattributed, the defect record becomes untrustworthy — which defeats the entire feature.

**What commonly breaks** — Cross-project provenance injection is a confirmed *closed* incident class (the `bunkai_bugs_check_consistency` trigger, `0046`/`0054`, exists specifically because this shipped once per an adversarial review). The forward-only status lifecycle (`open → in_progress → resolved → closed`, no skips, no backward moves) is enforced in two independent layers — a regression in either layer alone won't be caught by testing the other.

**Dependencies** — Feeds Metrics (defect heatmap, recovery-cycle), Notifications, Traceability.

**What an experienced QA would check**
- File a Bug with a `run_id`/`run_step_id`/`atc_id` that belongs to a *different* project than the Bug's own `project_id` — must reject (`45305`-`45307`).
- Attempt every illegal status transition (skip-ahead, backward, same-status no-op) — each has its own distinct error code; verify all three, not just one representative case.
- Assign a Bug to a `viewer`-role or inactive member — must reject (`45312`/`45313`).

### Module Tree (FEAT-009)

**Why it matters** — Every User Story, ATC, and module-anchored Bug lives inside this tree. A structural corruption here (an orphaned or stranded subtree) doesn't just affect the Module — it silently orphans everything nested under it.

**What commonly breaks** — There is a **documented, unresolved edge case**: the recursive archive-cascade walk can strand a live descendant module under an already-archived ancestor in rare cases (`business-data-map.md` §2.5, "Known gap" — `0068` added a defensive closer but zero orphans were measured live at authoring time, meaning it's mitigated, not proven absent). Historical bugs BK-57 (rename+move not atomic) and BK-67/68 (depth-5 toast suppression, 1-char name validation) confirm this surface has already produced real defects.

**Dependencies** — User Stories, ATCs, Bugs — everything module-anchored.

**What an experienced QA would check**
- Archive a subtree 3+ levels deep with active descendants at the deepest level — verify none survive un-archived (the documented gap).
- Move a module to create a would-be cycle (moving a parent under its own descendant) — must reject (`45001 move_cycle`).
- Push a rename+move in the same operation and verify it's atomic (BK-57's exact regression) — no intermediate state where path and parent disagree.

---

## 4. State machines that matter

### Run status — the 4-grain split

```
grain 1  run_steps.status      pending|passed|failed|blocked|skipped   (per-step, hand-marked)
grain 2  run_atcs.status       pending|passed|failed|blocked|skipped   (RECOMPUTED from grain 1 siblings)
grain 3  runs.status           running|passed|failed|aborted           (caller-chosen verdict at finish/abort)
grain 4  derived "state"       (report-layer only, NOT stored/enforced) — case-expression mix of grain 2+3
```

**Why the transitions matter** — Grain 3's vocabulary has NO `blocked`/`skipped`, and `aborted` exists ONLY at grain 3. Grain 4 (used by the Traceability view) borrows `aborted` from grain 3 and mixes it into grain-2's vocabulary. This is the confirmed, documented root cause of `DEFECT-BK-317`: the UI surfaced grain 4's `'aborted'` value where the AC literally specified only grain-2's 4 words. Low severity, closed — but the *mechanism* that produced it is structural and will produce the same class of defect again on any future change that touches status rendering.

**Transitions most likely to be broken** — Any code path that reads `run_atcs.status` or `runs.status` directly instead of going through the same derivation the Traceability report uses; any future addition to one grain's vocabulary without updating the other three.

**Terminal / forbidden states to guard** — A step can never be re-marked to `pending` (`45213`); a Run can only be finished from `running` (`45206`) and only with `passed`/`failed`, never `aborted` as a finish verdict (`45207`); a Run can only be aborted from `running` (`45204`).

**How corruption would be detected — or not** — Nothing enforces grain-4 consistency; it's computed fresh on every Traceability read, so there's no stored value to audit. The only way to catch a future mismatch is a test that asserts the *rendered* status against all 4 grains simultaneously after every terminal Run action — exactly what BK-317's root cause shows was missing.

### Bug status lifecycle

```
open --(one stage)--> in_progress --(one stage)--> resolved --(one stage)--> closed
  X  <-- any backward move (45311)         X  <-- any skip-ahead move (45310)
```

**Why it matters** — Two independent enforcement layers exist (the RPC and a DB trigger backstop) specifically because a bug status is often read by humans making triage decisions — a corrupted lifecycle misleads whoever's reading the defect heatmap.

**Transitions most likely to be broken** — Any new write path (a future bulk-triage feature, a Jira-sync write-back) that doesn't route through `bunkai_transition_bug_status` and relies on the trigger backstop alone.

**How corruption would be detected** — The trigger backstop guarantees it's *rejected*, not *silently allowed* — so this state machine fails loud, not silent. Lower ongoing risk than the Run-status split above precisely because of that.

### User Story `draft` → `ready_to_test` gate

**Why it matters** — `ready_to_test` is a signal downstream consumers (whoever picks Stories to test) trust to mean "has at least one testable AC." If the gate can be bypassed, that trust breaks silently.

**Transitions most likely to be broken** — The TOCTOU race the `FOR UPDATE` row lock was specifically added to close (concurrent last-AC-archive vs. status-set) — a regression here would only surface under concurrent load, making it easy to miss in single-user manual testing.

**How corruption would be detected** — Not automatically; requires a deliberate concurrent-request test (two near-simultaneous calls: archive-last-AC and set-ready_to_test) to exercise the race at all.

---

## 5. Silent killers — automated processes

### Jira import worker (async, Vercel `after()` background task)

**What it does** — Processes a queued `ImportJob`, pages through Jira results via `next_page_token`, updates `imported/created/updated/skipped` counts.

**What breaks if it fails** — A confirmed historical bug (BK-142) shows this has already failed instantly with a raw JQL error surfaced to the user — the *good* case, since it's at least visible. The dangerous case is a worker that dies silently mid-page: `status` stays `running` forever, blocking the "one active import per project" constraint (`import_jobs_one_active_per_project`) from ever releasing, with no client-visible error.

**How failure is detected today** — Only by polling `GET /api/v1/imports/[id]` and eyeballing whether `status` ever leaves `running`. No timeout/reaper mechanism was found in the discovery pass.

**Recommended QA strategy** — A scheduled synthetic probe: kick off a real import against a slow/large JQL query, then assert the job transitions out of `running` within a bounded time window. Treat "stuck in running forever" as a defect class, not just a slow-response class.

### Notification producer triggers (`AFTER INSERT ON activity_log`)

**What it does** — `bunkai_notify_run_event` and `bunkai_notify_bug_event` read newly-inserted `activity_log` rows and fan out to `notifications`.

**What breaks if it misses/duplicates** — A miss means a user never learns their Run finished or their Bug was reassigned — invisible unless the user happens to check manually. A duplicate is guarded by `unique(source_event_id, recipient_user_id)` (0056) — so double-notification is structurally prevented, but a *miss* has no equivalent safety net.

**How failure is detected today** — None found. `activity_log` itself has no client write path and no monitoring/alerting was located in this pass.

**Recommended QA strategy** — After every Run-finish/Bug-status-change test case, assert the corresponding `notifications` row actually exists for the expected recipient — don't just test the triggering action in isolation. This turns an invisible background process into an explicit assertion in the existing test flow at near-zero extra cost.

### ATC full-text search index refresh (`tsv` trigger)

**What it does** — A `BEFORE INSERT OR UPDATE OF title, tags` trigger refreshes the `tsvector` column backing `bunkai_search_atcs`.

**What breaks if it misses a run** — A stale search index means an ATC exists but can't be found by search — functionally invisible data loss from the user's perspective, even though the row is intact.

**How failure is detected today** — None found; there's no reconciliation job that re-derives `tsv` from source columns.

**Recommended QA strategy** — After renaming/re-tagging an ATC, immediately search for it by the new title/tag and assert it's found — a cheap regression check that would have caught a trigger regression the moment it shipped.

---

## 6. External integrations — failure points

| Service | What stops if it's down | Timeouts/retries | Acceptable degradation | Known quirks |
|---|---|---|---|---|
| Supabase (Postgres + Auth + Realtime) | Everything — this is the data layer, not an optional integration | Not traced in this pass | None — full outage | Realtime push (Run/notification live-update) may lag or drop under Supabase-side incidents; no fallback-to-poll was located |
| Atlassian Jira (hand-rolled REST client) | Import job enqueue/processing only | Not traced — `lib/jira/client.ts` not read in this pass | Everything else in the product keeps working; only Jira-provenance User Stories are unavailable | No SDK dependency — a hand-rolled client is more likely to drift from Jira API changes than a maintained SDK would be; BK-142 already shows raw upstream errors leaking to the user unfiltered |
| Resend (transactional email) | Nothing today — **not wired**: no `resend` dependency in `package.json`, only `RESEND_API_KEY` in `.env.example` | N/A | Full: `in_app` notification channel is unaffected regardless | Do not write test cases assuming email delivery works — confirm with the team whether this is mid-rollout before investing test effort here |

---

## 7. Dependency cascade between flows

```
Auth ──► Workspace/RLS ──► Module Tree ──► User Story ──► Acceptance Criterion
                                  │                              │
                                  ▼                              ▼
                                 ATC  ◄──────── anchored to ─────┘
                                  │
                                  ▼
                            Test (chain of ATCs)
                                  │
                                  ▼
                    Run (start ─► mark steps ─► finish/abort)
                            │                        │
                            ▼                        ▼
                           Bug                 Notification
                            │
                            ▼
                  Traceability / Coverage / Metrics reports
```

The two chains worth calling out explicitly:

**Auth → RLS → everything.** A regression at either of the first two links doesn't produce one broken feature — it produces every feature failing simultaneously, which is exactly why both sit at CRITICAL/HIGH in §2 regardless of how "simple" either flow looks in isolation.

**ATC → Test → Run → Bug → Traceability.** Testing Run execution in isolation (start a Run, mark a step, finish it) will not surface a corrupted ATC-anchor or a stale Test chain — those defects only become visible once you walk all the way to the Traceability report, which is precisely how BK-317 was found (a Run-status question, not an ATC-authoring question, surfaced a defect whose root cause was three links upstream in the status-derivation logic). Test the full chain at least once per release, not just each link independently.

---

## 8. Edge cases developers commonly forget

**Concurrency** — The `FOR UPDATE` row locks on User Story ready-gate and Bug/Run terminal transitions exist specifically because a naive first pass had TOCTOU races (§4). Any new mutating RPC that skips an explicit lock is a candidate for the same class of bug. Highest-risk existing spot: two workspace admins re-parenting the same Module subtree simultaneously (`bunkai_move_module`'s cycle-detection assumes no concurrent second mover).

**Data limits** — Confirmed historical bugs exist here already: BK-99/BK-100 (Markdown description 50KB/90%-capacity warning not enforced correctly). Any free-text field with a documented CHECK bound (Module description ≤500 chars, Bug title 5-200 chars, ATC tags capped) is a BVA candidate — test at the bound, one under, one over.

**Non-Latin input** — BK-53/56 confirmed CJK/Cyrillic project names were rejected. Any slug-generation code (Project, ATC `<module-slug>/atc-<hex>`) is a suspect for the same class of Unicode-handling bug — test non-Latin input on every slug-producing create flow, not just the one already fixed.

**Permission boundaries** — Every `member`+ vs `admin`+ vs `owner`-gated action deserves a negative test with a lower-privileged role, not just a positive test with the right one. BK-135 (PAT scope) and the sole-owner-cannot-leave guard (`45213`) show this class of bug reaches production when only the happy path is tested.

**Orphaned/stranded states** — The Module archive-cascade gap (§3, Module Tree) is the canonical example: a soft-delete/cascade operation that doesn't fully walk its own tree. Any future cascade-style operation (bulk archive, bulk re-parent) inherits this same risk class by default — assume it's broken until proven otherwise with a deep-nesting test.

**Idempotency** — BK-248 (`POST /tests` 500 on idempotency-key collision) confirms the pattern is fragile where it exists. Run creation's 24h idempotency window is the other place this matters — test a genuine double-submit (network retry simulation), not just a manual double-click.

**Non-disclosure error consistency** — A deliberate design choice (§4 of the data map) collapses "not found," "wrong tenant," and "no access" into identical error codes across nearly every RPC. Any NEW route that accidentally discloses a distinct error for one of these three cases is a tenant-enumeration regression, even if functionally everything else works — worth an explicit negative-test pass on every new endpoint.

---

## 9. Pre-release checklist (priority-ordered)

1. Verify no ATC can be created or edited to reference an Acceptance Criterion outside its own User Story.
2. Verify a workspace member cannot read, write, or enumerate any entity belonging to a different workspace, across ATC/Bug/Run/Test.
3. Verify a `member`-scoped PAT cannot perform any `workspace:admin`-scoped action (BK-135 regression class).
4. Verify full sign-up → confirm → sign-in round trip succeeds on password, magic-link, and OAuth paths independently.
5. Verify a Run's checklist does not change after its source Test is edited mid-flight (snapshot invariant).
6. Verify the Traceability view's displayed status is internally consistent for a Run in every terminal state (`passed`, `failed`, `aborted`) — direct BK-317 regression coverage.
7. Verify a Bug cannot carry Run/Step/ATC provenance from a different project than its own `project_id`.
8. Verify Bug status transitions reject any backward or skip-ahead move, in both the RPC and direct-write paths.
9. Verify archiving a Module subtree 3+ levels deep leaves no live descendant un-archived.
10. Verify moving a Module cannot create a parent/descendant cycle.
11. Verify a non-Latin (CJK/Cyrillic) Project or ATC name is accepted and produces a valid, unique slug.
12. Verify a genuine double-submit (not a double-click) on Run creation and Test creation does not create duplicate records.
13. Verify every `notifications` row expected from a Run-finish or Bug-status-change action actually exists for the correct recipient.
14. Verify a Jira import job cannot get permanently stuck in `running` under a slow/failing upstream query.
15. Verify the sole-active-owner-cannot-leave guard holds even when attempted via direct API call, not just the UI.

---

## 10. What is NOT in this plan

- Flow-level diagrams and state-machine transition tables (full detail) → `.context/business/business-data-map.md`
- Feature catalog, CRUD matrix, feature flags → `.context/business/business-feature-map.md`
- API endpoint inventory / request-response contracts → `.context/business/business-api-map.md`
- Detailed test case definitions and US-ATP-ATR-TC traceability → TMS (see `/test-documentation`)
- Sprint-level execution order and per-ticket QA → `.context/reports/SPRINT-{N}-TESTING.md` (see `/sprint-testing`)

---

## 11. Discovery gaps

- **Live schema drift not checked.** No `[DB_TOOL]` query was run against the actual Supabase project this pass, consistent with the same gap already flagged in `CLAUDE.md` §Project Assessment. This plan's risk scoring trusts the migration files on disk as authoritative.
- **Resend/email integration status is ambiguous** (§6) — `RESEND_API_KEY` exists only as a placeholder; `resend` is not a `package.json` dependency. Confirm with the team whether email-channel notification delivery is mid-rollout before writing test cases that assume it works.
- **`agent`/`ci` Run executor modes are schema-real but have no confirmed UI path** — this plan's Run Execution section focuses on the `human` executor mode, which is the only one independently verified end-to-end. API-driven Run creation via PAT should be scoped as a separate test surface once its actual entry point is confirmed (`business-feature-map.md` §9 flags this as unlocated).
- **Several single-resource GET/PATCH/DELETE routes were not located** in the underlying feature map (Project detail, single-ATC read, single-Bug read/edit, Workspace delete) — §9's checklist assumes the capabilities exist somewhere (server-component direct query or an unlocated route); if any are genuinely absent, several checklist items may need to be re-scoped as feature gaps rather than test targets. Cross-check against `business-api-map.md` before writing test cases against these specifically.
- **Billing/plan enforcement is explicitly out of scope** — `workspaces.plan` is modeled but no gating logic was found anywhere in the codebase (`business-model.md` §QA Relevance). Do not write test cases assuming plan-based feature restrictions exist.
- **34 real historical bug records exist under `.context/PBI/bugs/`** — this plan cites the titles/IDs surfaced by folder names only; the individual bug bodies (root cause, exact repro steps) were not read in full for this pass. Anyone acting on §3/§8's cited bugs should open the specific `BUG-BK-*` folder for full detail before writing the corresponding test case.
