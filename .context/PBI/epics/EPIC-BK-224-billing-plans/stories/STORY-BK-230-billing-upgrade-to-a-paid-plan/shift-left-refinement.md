# Shift-Left Refinement: BK-230 — Billing | Upgrade to a paid plan

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming, batch-of-1)
**Refined on**: 2026-08-17
**Refined by**: QA — Shift-Left batch session
**Modality**: Xray

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Mateo Silva (QA Lead / workspace owner) — wants self-serve conversion without a sales call.
- **Secondary personas**: workspace admins (view-only per AC5); Elena Vargas indirectly, as the engineer blocked by a plan limit whose block this Story is meant to lift.
- **Business value proposition**: the entire self-serve monetization path for Bunkai Cloud — this is the epic's (BK-224) primary revenue mechanism, per its goal: "Monetize Bunkai Cloud... can pay, upgrade, downgrade, or cancel without opening a support ticket."
- **KPI(s) influenced**: self-serve conversion rate, time-to-upgrade, failed-payment recovery rate.
- **User journey position**: entry points are the Billing section (BK-229/BK-87 territory) and plan-limit warnings (BK-232, still Backlog) — this Story is the checkout step at the end of both paths.

### Technical context — HEADLINE FINDING FIRST

**There is no payment processor integrated anywhere in this product today.** This is not a minor implementation detail — it is the load-bearing mechanism this entire Story depends on, and it does not exist yet:

- `business-model.md` §QA Relevance states explicitly: *"`workspaces.plan` models tiers but no billing logic gates behavior on it anywhere in the 68 migrations read."*
- `business-feature-map.md` §6 (Third-party integrations) found **zero** Stripe / Paddle / LemonSqueezy / Chargebee dependency in `package.json` — payment integration is listed as "roadmap intent, not shipped."
- `business-api-map.md` was grepped this pass for `billing|plan|checkout|stripe|payment|subscription` — **zero matches**. No billing/checkout/payment endpoint exists in the documented API surface at all.
- No payment-provider environment variable exists in `.env.example` or `.agents/project.yaml` (checked this pass).

- **Frontend**: no existing checkout/payment component family identified — this would be new UI, unlike BK-225's badge-reuse case.
- **Backend**: no existing billing/subscription table beyond `workspaces.plan` (a bare enum column, `business-data-map.md` §2.1: *"no billing logic gates behavior on it"*). No `subscriptions`, `invoices`, or `payment_methods` table found in the 31-table inventory.
- **External services**: **none integrated** — a payment processor (Stripe or equivalent) must be chosen before this Story is implementable as written. This is a vendor/architecture decision, not a coding task.
- **Integration points specific to this Story**: (1) a payment processor SDK/API — does not exist yet; (2) an Enterprise contact-path destination — undefined (see Gap #4 below); (3) whatever plan-limit enforcement AC2 implicitly assumes — see Gap #2, also unconfirmed to exist.

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | Tier ladder + owner-only gate + decline/retry state are well-specified in the ACs themselves; the ACs are not vague. |
| Integration | **High** | Zero existing payment-processor integration (headline finding above) — this is a new external dependency requiring a vendor decision, PCI-compliance approach, and sandbox credentials before a single line of checkout code can be written. |
| Data validation | Medium | No new input validation beyond standard payment-form fields (card number, seat quantity) — the payment processor's own SDK typically owns most of this. |
| UI | Medium | Three-column comparison + a checkout pane are net-new UI surfaces (no existing pill/chip reuse pattern the way BK-225 had). |

**Estimated test effort**: High — driven almost entirely by the Integration axis. Business logic and UI are estimable; the payment mechanism itself is not, until a vendor is chosen.

### Epic-level inheritance
- `EPIC-BK-224-billing-plans/epic.md` exists and was read. Epic goal, scope boundary, and Story list are inherited directly (not re-derived): in-scope explicitly includes "Self-serve upgrade to a paid plan" (this Story); out-of-scope explicitly excludes "Enterprise contracts and purchase-order invoicing" and "Tax edge-handling beyond what the standard checkout flow provides" — both consistent with this Story's own Out of Scope field.
- Epic traceability cites `business-model.md`'s Revenue Streams (open-core: Community self-hosted / Cloud per-seat / Enterprise license) as the source — confirms the tier ladder is a real, ratified business decision, not invented for this Story.
- **No epic-level answer exists for the payment-processor question.** The epic description does not name a vendor, and no ADR was found under `.context/ADR/` for a payment-integration decision (not independently re-checked this pass beyond the epic file, but nothing in the epic surfaces one).

### Sibling Story cross-check — BK-229 (real ground truth)

BK-229 ("View my workspace plan, seats, and usage") is `Ready For Dev`, 8 points, already shift-left-refined (14→17 refined scenarios, 18 outlines, `shift-left-reviewed` label). Its ATP is the closest real ground-truth for what exists today. Two findings from reading it in full:

1. **BK-229 confirmed concrete plan-limit numbers** via PO/Dev decision: *"Free plan: 3 projects, 5 seats, 30-day retention."* This matches BK-230's AC2 example exactly ("3-project limit reached") — the NUMBERS are ratified and consistent across both Stories. Good sign: no numeric contradiction.
2. **BK-229 is read-only.** Every one of its 18 outlines is about *displaying* a meter state (`warning`, `limit-reached`, `exceeded`) — none of them block or gate an action. Nothing in BK-229's ATP, ACs, or PO decisions confirms that reaching "10 of 10" or "11 of 10" actually **prevents** creating an 11th project today. This directly feeds Gap #2 below.

---

## Phase 2 — Story Quality Analysis

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|---|---|---|---|
| 1 | AC1 ("each tier shows its... price model") vs PO Ratification B2 ("Team pricing stays intentionally unpublished") | Is Team's price shown as a real number, hidden until checkout, or replaced with generic copy like "billed per seat"? AC1's literal text implies a visible number; B2 says the opposite. | Cannot write the AC1 assertion for the Team column without knowing which of three UI states renders. | Confirm exact Team-column copy: number / "billed monthly per seat, shown at checkout" / other. |
| 2 | AC3 ("retry with a different payment method without re-entering the plan choice") | Does "plan choice" alone survive the decline, or does the seat quantity Mateo already entered (per AC2's "10 seats") also survive? The AC names only "plan choice." | Determines whether a retry-flow test asserts seat count is preserved or must be re-entered. | Confirm seat quantity persists through a decline+retry, same as plan choice. |
| 3 | AC3 ("he sees a clear message that the payment was declined") | Is there one generic decline message, or does copy vary by decline reason (insufficient funds / invalid card / expired card)? Business Rules don't specify. | Cannot write the exact-string assertion (Universal question U1) without this. | Confirm: single generic string, or reason-specific copy from the payment processor. |

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
|---|---|---|---|---|
| 1 | Technical detail (headline) | **No payment processor is integrated anywhere in the codebase** (see Phase 1 headline finding — `business-model.md`, `business-feature-map.md` §6, zero `business-api-map.md` matches, no env var). The Story's ACs describe a working checkout that has no infrastructure to build on. | A payment-vendor decision (Stripe or equivalent) — ideally as an ADR per this repo's own `.context/ADR/README.md` convention for hard-to-reverse architecture calls — BEFORE this Story is estimated. | Dev cannot size the Story; any estimate given without this is a guess. This is very likely a blocker for `estimation`, not just a risk. |
| 2 | AC / technical detail | AC2 says the 4th project "now succeeds" post-upgrade, implying it was BLOCKED before. But cross-checking BK-229 (the sibling Story that already owns plan-limit **display**), nothing confirms plan limits are actually **enforced** (blocking project creation) today — BK-229 only shows meter states, never gates an action. `business-data-map.md` has no project-count CHECK constraint or RPC-level gate (confirmed via grep this pass). The Story most likely to own that enforcement, BK-232 ("See plan-limit warnings with an upgrade path"), is still **Backlog**. | Confirm explicitly whether Free-plan project-count enforcement exists today, is a prerequisite Story (BK-232), or is expected to ship bundled with BK-230. | If enforcement doesn't exist, AC2's "before/after" framing (blocked → unblocked) cannot be tested as written — there is nothing to unblock. BK-230 may implicitly depend on a SECOND unbuilt feature, not just the payment processor. |
| 3 | Business rule | Enterprise's "contact path" (AC4) has no defined destination — not a mailto, not a form, not an existing lead-capture flow, anywhere in Scope or Business Rules. | Name the destination (mailto address, dedicated contact form, existing sales-lead system). | Cannot write an assertion for AC4's "offered a contact path" beyond "some link/button exists" — too weak for a real test. |

### Edge cases not in Story

| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|---|---|---|---|
| 1 | Owner double-clicks "Confirm" during checkout (or retries a slow request) | Exactly one charge, no duplicate subscription created — the same idempotency concern already solved elsewhere in this schema for other mutating RPCs (`business-data-map.md`'s idempotency-key pattern, e.g. Run creation's 24h idempotency guard) | High | Add to AC (**NEEDS PO/DEV CONFIRMATION**) |
| 2 | Owner has a checkout pane open in two browser tabs simultaneously and confirms in both | Second confirm should be rejected or no-op, not double-charge | Medium | Add to AC (**NEEDS PO/DEV CONFIRMATION**) |
| 3 | A plain `member` or `viewer` role (not owner, not admin) somehow reaches the Billing→Upgrade path | ACs only address owner (can confirm) and admin (can view). No stated behavior for member/viewer. | Medium | Add to AC (**NEEDS PO/DEV CONFIRMATION**) — this is also Gap-adjacent (Ambiguity list didn't capture it structurally, moved here) |
| 4 | Session/auth expires mid-checkout while the owner is entering a payment method | Unclear whether the in-progress checkout is lost or resumed after re-auth | Low | Test only — don't add AC, but worth a smoke check once implemented |

### Contradictions
The closest thing to a contradiction is Ambiguity #1 above (AC1's visible "price model" language vs. the PO ratification's "Team pricing stays intentionally unpublished") — read as an underspecified interaction between two true statements rather than a direct disagreement, but it blocks writing one concrete assertion until resolved.

### Testability validation
**Verdict**: Partial

Issues:
- **Payment infrastructure gap (Gap #1) blocks writing any real integration-level assertion** — "successful payment" and "declined payment" cannot be tested against a system that has no payment processor wired in. Everything below the UI-state level (does the app *react* correctly to a success/decline signal) is currently untestable, though the UI-reaction behavior itself is fully specifiable now.
- Mockup file unreachable — exact checkout-pane field layout not independently verifiable.
- Otherwise: ACs are concrete (real seat numbers, explicit role names, explicit tier names), the persona/workflow narrative is clear, and PO Ratification comments already resolved 3 of the biggest open questions (tier ladder, pricing visibility intent, owner-only gate) before this refinement pass even started.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Owner compares tiers before choosing

#### Scenario 1.1: Should display Free, Team, and Enterprise tiers side by side with limits, price model, and current-plan marker (Type: Positive, Priority: Critical)
- **Given**: Mateo is the owner of workspace "Acme QA" on the Free plan
- **When**: he opens Billing → Upgrade
- **Then**: UI shows 3 columns (Free / Team / Enterprise), each with seats/projects/run-history-retention limits, a price indicator, and Free's column visibly marked "Current plan"

#### Scenario 1.2: Should mark Team as the current plan when the workspace is already on Team (Type: Positive, Priority: High)
- **Given**: "Acme QA" is on the Team plan
- **When**: the owner opens Billing → Upgrade
- **Then**: the Team column is marked "Current plan"; Free is not offered as a downgrade path here (downgrade is BK-233, out of scope)

#### Scenario 1.3: Should render the Team tier's price model per the unpublished-pricing decision — **NEEDS PO/DEV CONFIRMATION** (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: exact copy undecided (Ambiguity #1)
- **Given**: any workspace viewing the comparison
- **When**: the Team column renders
- **Then**: [pending PO answer — either a real per-seat number, or copy indicating price is shown at checkout]

### Original AC2 — Successful upgrade from Free to Team unlocks limits immediately

#### Scenario 2.1: Should move the workspace to the Team plan immediately on successful payment (Type: Positive, Priority: Critical)
- **Given**: "Acme QA" is on Free; Mateo selects Team, 10 seats, enters a valid payment method
- **When**: he confirms
- **Then**: `workspaces.plan` = Team immediately (no waiting period), UI reflects it without reload

#### Scenario 2.2: Should issue a confirmation receipt to the owner after a successful upgrade (Type: Positive, Priority: High)
- **Given**: scenario 2.1 completed
- **Then**: Mateo receives a receipt (channel — email per Business Rules "addressed to the owner" — TBD exact channel, likely email)

#### Scenario 2.3: Should allow a previously-blocked 4th project to be created immediately after upgrade — **NEEDS PO/DEV CONFIRMATION** (Type: Positive, Priority: Critical)
- **NEEDS PO/DEV CONFIRMATION**: depends on Gap #2 — whether project-limit enforcement exists at all today
- **Given**: Free-plan workspace at its 3-project limit, successfully upgraded to Team
- **When**: Mateo creates a 4th project
- **Then**: creation succeeds (untestable as a "before/after" story until enforcement itself is confirmed to exist)

#### Scenario 2.4: Should allow purchasing Team with the minimum supported seat count — **NEEDS PO/DEV CONFIRMATION** (Type: Boundary, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: minimum seat count not specified anywhere in the Story
- **Given**: owner selecting Team plan
- **When**: seat quantity = 1 (or whatever the true minimum is)
- **Then**: [pending PO answer]

#### Scenario 2.5: Should reject or clamp a 0-seat purchase attempt — **NEEDS PO/DEV CONFIRMATION** (Type: Boundary, Priority: Low)
- **Given**: owner attempts to set seat quantity to 0
- **Then**: [pending PO answer — block confirm, or force a minimum]

### Original AC3 — Payment is declined

#### Scenario 3.1: Should keep the workspace on Free with nothing charged when payment is declined (Type: Negative, Priority: Critical)
- **Given**: Mateo confirms Team with a card that will be declined
- **Then**: `workspaces.plan` remains Free, no partial subscription record left behind, no charge recorded

#### Scenario 3.2: Should show a clear decline message — exact copy pending — **NEEDS PO/DEV CONFIRMATION** (Type: Negative, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: Ambiguity #3 — generic vs reason-specific copy

#### Scenario 3.3: Should preserve both plan choice and seat quantity through a decline+retry — **NEEDS PO/DEV CONFIRMATION** (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: Ambiguity #2 — Story only names "plan choice"

#### Scenario 3.4: Should allow retrying with a different payment method without restarting tier selection (Type: Negative, Priority: High)
- **Given**: scenario 3.1's declined state
- **When**: Mateo enters a different (valid) card and confirms
- **Then**: upgrade succeeds per scenario 2.1, without returning to the tier-comparison screen

### Original AC4 — Enterprise is a contact path, not a checkout

#### Scenario 4.1: Should offer a contact path when Enterprise is selected (Type: Positive, Priority: High)
- **Given**: Mateo viewing the tier comparison
- **When**: he selects Enterprise
- **Then**: a contact CTA is shown, no payment form renders

#### Scenario 4.2: Should not request any payment method entry for Enterprise (Type: Positive, Priority: High)
- Restates 4.1's negative assertion explicitly — no card field ever mounts for the Enterprise path

#### Scenario 4.3: Should route the Enterprise contact action to a defined destination — **NEEDS PO/DEV CONFIRMATION** (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: Gap #3 — destination undefined

### Original AC5 — Only the owner can complete an upgrade

#### Scenario 5.1: Should allow the owner to view tiers and confirm a purchase (Type: Positive, Priority: Critical)
- Already covered structurally by 1.1/2.1 — listed here for AC-traceability completeness.

#### Scenario 5.2: Should allow an admin to view the comparison but block the confirm action (Type: Negative, Priority: Critical)
- **Given**: an admin (not owner) of "Acme QA"
- **When**: the admin opens the tier comparison and attempts to confirm a purchase
- **Then**: the confirm action is blocked (client AND server — per this repo's own UI-affordance-vs-server-enforcement doctrine, both layers required)

#### Scenario 5.3: Should tell the admin the workspace owner completes upgrades (Type: Negative, Priority: High)
- Exact copy not specified — folds into the same "exact string" gap pattern as decline messaging.

#### Scenario 5.4: Should define behavior for member/viewer roles reaching the upgrade path — **NEEDS PO/DEV CONFIRMATION** (Type: Edge, Priority: Medium)
- **NEEDS PO/DEV CONFIRMATION**: Edge case #3 above

### New scenario surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should not double-charge on a rapid double-click or retried confirm request (Type: Edge, Priority: High)
- **NEEDS PO/DEV CONFIRMATION**: behavior inferred from Universal question U5 (idempotency) and this schema's own precedent (Run creation's idempotency-key pattern) — not stated in the Story
- **Given**: Mateo double-clicks Confirm on a valid payment
- **When**: two requests reach the backend near-simultaneously
- **Then**: exactly one charge, one plan change, one receipt

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 7 | Tier display, successful upgrade, receipt, Enterprise contact path, owner access |
| Negative | 4 | Decline-keeps-Free, retry-without-restart, admin-blocked, admin-told-owner-only |
| Boundary | 2 | Minimum seat count, 0-seat attempt |
| Edge | 7 | Unpublished pricing render, post-upgrade limit unblock, decline-copy exactness, plan+seat persistence on retry, Enterprise destination, member/viewer role, double-charge guard |
| Integration | 2 | Payment-processor success callback, payment-processor timeout/error handling |
| **Total** | **22** | (drives PO estimation) |

**Rationale**: 5 ACs expand past the literal count once role (owner/admin/member) × tier (Free/Team/Enterprise) × payment outcome (success/decline/timeout) is treated as a decision table, plus boundary coverage on seat count and the idempotency edge case this schema already treats as a first-class concern elsewhere (Run creation). The Edge count is unusually high (7 of 22) because this Story has more genuinely unresolved specification gaps than a typical Story at this stage — that imbalance is itself a signal for PO, not padding.

### Outline list (NAMES ONLY)

#### Positive
- **Should display Free, Team, Enterprise tiers with limits and current-plan marker** — Pre: owner on Free plan. Expected: 3-column comparison, Free marked current.
- **Should mark Team as current plan when workspace is already Team** — Pre: workspace on Team. Expected: Team column marked current, no downgrade CTA shown.
- **Should move workspace to Team plan immediately on successful payment** — Pre: Free plan, valid payment method, 10 seats. Expected: `workspaces.plan` = Team instantly, no reload needed.
- **Should issue a confirmation receipt to the owner after successful upgrade** — Pre: upgrade just completed. Expected: receipt delivered/visible to owner.
- **Should offer a contact path when Enterprise is selected** — Pre: viewing comparison. Expected: contact CTA shown, no payment form.
- **Should not request payment method entry for Enterprise** — Pre: Enterprise selected. Expected: zero card fields rendered.
- **Should allow the owner to both view tiers and confirm a purchase** — Pre: owner role. Expected: full flow accessible end to end.

#### Negative
- **Should keep workspace on Free with nothing charged when payment is declined** — Pre: Team selected, card will decline. Expected: plan unchanged, no charge, no partial state.
- **Should allow retry with a different payment method without restarting tier selection** — Pre: prior decline. Expected: retry succeeds without returning to comparison screen.
- **Should block an admin from confirming a purchase** — Pre: admin role, viewing comparison. Expected: confirm action blocked client + server side.
- **Should tell the admin the workspace owner completes upgrades** — Pre: admin attempts confirm. Expected: explanatory message shown.

#### Boundary
- **Should allow purchasing Team at the minimum supported seat count** — Pre: owner selecting Team. Expected: [pending PO minimum-seat answer].
- **Should reject or clamp a 0-seat purchase attempt** — Pre: seat quantity set to 0. Expected: [pending PO answer].

#### Edge
- **Should render Team's price per the unpublished-pricing decision** — Pre: any viewer. Expected: [pending exact copy].
- **Should allow a previously-blocked 4th project after upgrade** — Pre: Free at 3-project limit, upgraded. Expected: creation succeeds — **contingent on Gap #2 being resolved (enforcement existing at all)**.
- **Should show decline-specific or generic error copy** — Pre: various decline reasons. Expected: [pending exact copy per reason].
- **Should preserve seat quantity (not just plan choice) through decline+retry** — Pre: decline after entering 10 seats. Expected: 10 seats still selected on retry.
- **Should route the Enterprise contact action to its destination** — Pre: Enterprise contact CTA clicked. Expected: [pending destination].
- **Should define member/viewer access to the Billing→Upgrade path** — Pre: member or viewer role. Expected: [pending PO answer — hidden entirely, or same view-only as admin].
- **Should not double-charge on a rapid double-click of Confirm** — Pre: valid payment, double-click. Expected: exactly one charge, one plan change.

#### Integration
- **Should validate a successful charge through the chosen payment processor's confirmation callback** — Pre: processor sandbox configured (processor TBD). Expected: app plan-state updates only after processor confirms success, never optimistically.
- **Should handle a payment-processor timeout without leaving the workspace in a partially-upgraded state** — Pre: processor request hangs past its timeout. Expected: workspace stays on prior plan, user sees a retryable error, no orphaned subscription record.

> **NOT included here** (deferred to in-sprint planning): parametrization tables, per-outline test-data JSON, numbered test steps, payment-processor mock/sandbox strategy. Coverage estimate IS included because PO uses it for estimation.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Two browser tabs both mid-checkout, both confirmed | No | Medium | Add to AC (PO confirm) — folds into idempotency Scenario E1's broader guard |
| 2 | Session/auth expires mid-checkout during payment entry | No | Low | Test only — don't add AC |
| 3 | Currency/locale display of tier pricing (fixed currency vs locale-aware) | No | Low | Test only — don't add AC, revisit once pricing display itself is resolved (Ambiguity #1) |
| 4 | Enterprise contact form pre-fills workspace context (name, seat need) | No | Low | Test only — nice-to-have, not a business requirement stated anywhere |

> Test-data generation strategy is NOT defined here — depends entirely on which payment processor is chosen and what its sandbox/test-card conventions are (e.g. Stripe's well-known test-card numbers). Lands in `/sprint-testing` Stage 1 once that decision exists.

---

## Story Quality Assessment

**Verdict**: Significant Issues

**Key findings**:
- The ACs themselves are well-written — concrete data, explicit roles, a clear decline/retry path, and 3 of the biggest ambiguities were already pre-resolved by a PO Ratification comment before this Story even reached Shift-Left. This is above-average Story hygiene.
- The verdict is "Significant Issues" purely on **feasibility**, not on writing quality: the Story's core mechanism (payment processing) has zero backing infrastructure anywhere in this codebase, and it may implicitly depend on a SECOND unbuilt feature (project-limit enforcement) that the sibling BK-229 Story never actually built — BK-229 only displays usage, it never gates an action.
- Until a payment-processor vendor decision exists, this Story cannot be meaningfully estimated by Dev — sizing "integrate an unspecified payment gateway" is not sizing, it's guessing.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Which payment processor will Bunkai Cloud integrate (Stripe or equivalent), and has that decision been made anywhere outside this Story?**
   - **Context**: `business-model.md`, `business-feature-map.md` §6, and `business-api-map.md` all independently confirm zero payment-processor integration exists today — no SDK dependency, no API endpoint, no env var.
   - **Impact if unanswered**: Dev cannot estimate this Story. This is very likely a hard blocker for `estimation`, not a risk to track during it.
   - **Suggested answer**: none — this is a vendor/architecture decision outside Shift-Left's scope. Recommend recording it as an ADR once decided, per this repo's own `.context/ADR/` convention for hard-to-reverse test-architecture-adjacent decisions.

2. **Does Free-plan project-limit enforcement (blocking creation at the limit) exist today, or is it itself an unbuilt dependency of this Story?**
   - **Context**: AC2 implies a currently-blocked 4th project that upgrade unblocks. Sibling BK-229 (already refined, `Ready For Dev`) only *displays* meter states — nothing in its ATP, ACs, or PO decisions confirms an actual creation block exists. BK-232 ("See plan-limit warnings with an upgrade path"), the Story that would plausibly own that gate, is still Backlog. `business-data-map.md` has no project-count CHECK constraint or RPC-level gate (confirmed by grep this pass).
   - **Impact if unanswered**: AC2's "before/after" framing may be untestable as written — there may be nothing to unblock yet.
   - **Suggested answer**: none — needs a direct answer or a look at the live product.

3. **Is Team-tier pricing shown as a real number on the comparison screen, or is it hidden until checkout per the "intentionally unpublished" ratification?**
   - **Context**: AC1's literal text ("each tier shows its... price model") reads as contradicting PO Ratification B2 ("Team pricing stays intentionally unpublished").
   - **Impact if unanswered**: cannot write the AC1 assertion for the Team column.
   - **Suggested answer**: likely "shown at checkout only, comparison screen shows a qualitative indicator" — but this is a guess, needs confirmation.

4. **What role does a plain `member` or `viewer` get when reaching the Billing → Upgrade path?**
   - **Context**: ACs specify owner (full access) and admin (view-only) but say nothing about member/viewer.
   - **Impact if unanswered**: an entire role tier has undefined behavior at a money-adjacent surface.
   - **Suggested answer**: likely "same view-only as admin, or entirely hidden from the nav" — needs confirmation.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **PCI-compliance approach** — will card entry go through the chosen processor's client-side tokenizing SDK (card data never touches the app's own servers), or another approach? Testing impact: determines whether QA can ever see/log raw card data (it should never be able to).
2. **Idempotency-key strategy for the confirm action** — this schema already has a precedent (Run creation's 24h idempotency guard, `business-data-map.md` §2.13) for exactly this class of problem. Should the same pattern apply to checkout confirm? Testing impact: without it, Scenario E1 (double-charge guard) cannot be asserted deterministically.
3. **Enterprise contact-path destination** — mailto, dedicated form, or existing lead-capture system? Testing impact: Scenario 4.3 cannot be written concretely without this.
4. **Exact decline-reason copy** — one generic string from the app, or pass-through of the processor's own decline-reason messaging? Testing impact: Scenario 3.2's assertion string is unwritable without this.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | AC2 assumes "the 4th project now succeeds" without stating what currently blocks it | Add an explicit precondition AC or a linked-dependency note pointing at whichever Story actually owns project-limit enforcement | Makes the Story's true dependency chain visible instead of implicit |
| 2 | No mention of payment-processor choice anywhere in the Story | Add a "Technical dependency" note naming the chosen processor (once decided) | Removes the single biggest estimation blocker |
| 3 | AC1 vs PO Ratification B2 disagree on Team pricing visibility | Rewrite AC1's price-model clause to match whichever behavior PO actually confirms | Removes Ambiguity #1 |
| 4 | No stated behavior for member/viewer roles | Add a 6th AC or extend AC5 to cover the full role ladder (owner / admin / member / viewer) | Closes Gap/Edge #3 before Dev has to guess mid-implementation |

---

## Data feasibility flags

**HARD risk — not soft.** Two separate, currently-unbuilt dependencies stack inside this single Story:

1. **Payment processor integration**: zero SDK dependency, zero API endpoint, zero env var, zero mention anywhere in this codebase's documented surface (`business-model.md`, `business-feature-map.md` §6, `business-api-map.md` grep — all three independently confirm absence). Required pre-work: a vendor decision (Stripe or equivalent), sandbox account + credentials, and ideally an ADR recording the choice.
2. **Free-plan project-limit enforcement**: no CHECK constraint, no RPC-level gate found in `business-data-map.md`; the Story that would plausibly build it (BK-232) is still Backlog; the sibling Story that already shipped plan-limit UI (BK-229) is display-only. Required pre-work: confirm with PO/Dev whether this exists today, ships as part of BK-230, or is a genuine prerequisite Story.

Both gaps are answerable by the team directly (not by more code-reading in this repo) — they are people-questions, not research questions.

---

## Recommended testing strategy

### Pre-implementation
- Resolve Critical Questions #1 and #2 above before Dev estimates — both change the shape of the work, not just its size.
- Once a payment processor is chosen, request sandbox/test credentials early so QA can plan around the processor's own test-card conventions (e.g. specific card numbers that simulate decline reasons).

### During implementation
- Verify the idempotency guard (Technical Question #2) as soon as the confirm endpoint exists — this is cheap to check early and expensive to discover missing in production (real financial impact, per `agentic-qa-core/references/test-design-doctrine.md`'s BVA/decision-table guidance on money-adjacent Stories).
- Cross-verify against BK-229's already-ratified numbers (Free: 3 projects / 5 seats / 30-day retention) — do not let BK-230's implementation silently drift from those already-agreed limits.

### Post-implementation (in-sprint by /sprint-testing)
- Full owner/admin/member/viewer role matrix against the Upgrade path (Decision Table per `test-design-doctrine.md`).
- Full payment-outcome matrix (success / decline / timeout / double-submit) once the processor is live in sandbox.
- Verify AC2's "before/after" project-limit claim end to end — this is the one scenario that structurally CANNOT be verified as "before/after" until Critical Question #2 is resolved.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | Story is estimated and started before a payment processor is chosen, causing mid-sprint scope thrash | Medium | High | N/A — mitigated by resolving Critical Question #1 BEFORE `estimation`, not by any outline |
| 2 | AC2's project-limit claim ships untested because the underlying enforcement doesn't exist, silently making the "before" half of the scenario false | Medium | Medium | Outline "Should allow a previously-blocked 4th project after upgrade" (Edge, contingent) |
| 3 | Double-charge on retry/double-click, given no idempotency pattern is confirmed for this flow yet | Low-Medium | High (real financial impact) | Outline "Should not double-charge on a rapid double-click of Confirm" + Integration outlines |
| 4 | Team pricing visibility ships inconsistent with the PO's "unpublished" ratification, requiring rework | Medium | Low | Outline "Should render Team's price per the unpublished-pricing decision" |

---

## Next steps

- [ ] PO answers Critical Questions #1-4 before sprint planning
- [ ] Dev answers Technical Questions #1-4 before estimation
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)
