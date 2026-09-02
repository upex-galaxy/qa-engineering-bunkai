# Comments for BK-230

[View in Jira](https://jira.upexgalaxy.com/browse/BK-230)

---

### Ely - 11/7/2026, 11:52:50

## PO Ratification — 2026-07-11

- B1 ratified: tier ladder Free / Team / Enterprise is final; Enterprise stays sales-assisted.
- B2 note: Team pricing stays intentionally unpublished; per-seat billing confirmed.
- B3 confirmed: only the workspace owner completes a purchase; admins view the comparison read-only.

---

### Ely - 30/7/2026, 12:30:20

Mockup — Billing — plan comparison + checkout. Source: .context/designs/bunkai-test-management-tool/bk-224-billing/plan-comparison-checkout.html · spec: master-design-plan §4.15



---

### Carlos C - 17/8/2026, 19:13:54

Waiting for PO and Dev input before proceeding.

---

### Carlos C - 17/8/2026, 19:23:44

## PO/Dev Ratification — 2026-08-17

Answers to the 4 Critical Questions + 4 Technical Questions raised by Shift-Left QA (see `Acceptance Test Plan (ATP)` field and comment above). This unblocks `estimation` — the two hard feasibility blockers QA flagged are resolved below.

### Critical Questions (PO)

***Q1 — Payment processor****: ****Stripe Checkout (hosted)****, not Stripe Elements embedded. Rationale: zero PCI scope for the app (card data never touches our servers), well-documented sandbox/test-card conventions for QA, and it reduces "build a checkout" to "integrate a redirect + webhook." ****This changes the flow design***: Confirm moves from an in-app modal action to a redirect to Stripe → webhook-driven plan activation. AC2/AC3 need a rewrite pass by Dev during implementation planning to reflect the redirect + async webhook instead of a synchronous in-app confirm. Recording this as an ADR.

***Q2 — Free-plan project-limit enforcement****: ****Does not exist today — build it as part of BK-230***, do not wait on [https://jira.upexgalaxy.com/browse/BK-232#icft=BK-232](https://jira.upexgalaxy.com/browse/BK-232#icft=BK-232). It is a small, necessary precondition (a CHECK/RPC-level gate on project count vs. `workspaces.plan` limit) — without it, AC2's "before/after" claim has nothing to unblock. [https://jira.upexgalaxy.com/browse/BK-232#icft=BK-232](https://jira.upexgalaxy.com/browse/BK-232#icft=BK-232) remains a separate Story, scoped to the plan-limit-warning UI only, not the enforcement itself.

***Q3 — Team-tier pricing visibility****: ****Hidden on the comparison screen***, consistent with PO Ratification B2. Team's column shows a qualitative indicator ("From $X/seat — see checkout for your rate" or similar), with the real number revealed at Stripe Checkout. AC1's "price model" wording will be corrected to match this at implementation time.

***Q4 — member/viewer role behavior****: ****Same as admin — can view the comparison, cannot confirm.*** No role below owner can purchase. Full nav-hiding was considered and rejected — it generates "where is Billing?" support tickets for no security benefit, since plan/limit information isn't sensitive.

### Technical Questions (Dev)

***T1 — PCI approach***: resolved by Q1 — Stripe Checkout hosted means no PCI scope on our side at all.

***T2 — Idempotency***: same pattern as Run creation's existing 24h idempotency-key guard. Client generates an idempotency key when opening checkout; it's passed through to Stripe's Payment Intent / Checkout Session.

***T3 — Enterprise contact destination***: `mailto:` to a sales alias for v1. A dedicated form or lead-capture system is premature without real volume — revisit once we have data.

***T4 — Decline-reason copy***: pass through Stripe's own `decline*code` (insufficient*funds, card*declined, expired*card, etc.), mapped to friendly copy per reason — not one generic string. A specific reason produces fewer support tickets than a vague one.

---

Dev: please re-pass Phase 3's refined ACs (in the `acceptance_criteria` field) once implementation planning starts, incorporating the Stripe-redirect flow change from Q1. QA's outline coverage (22 outlines in the ATP DRAFT) stays valid at the behavior level; only the payment-integration outlines' exact mechanics change from "in-app confirm" to "redirect + webhook callback."

---

### Ely - 27/8/2026, 02:56:39

## AI Tech Lead — Decision: How is the Stripe integration provisioned, and what closes the remaining shift-left scenarios?

Re-passing the refined ACs per this ticket's own 2026-08-17 ratification instruction, now that implementation planning has started. Full reasoning lives in `implementation-plan.md` (this Story's Spec Implementation Plan field) and ADR-0014; this comment records the scored decisions.

### Q — Provisioning: Vercel Marketplace-claimed Stripe, or direct SDK + env vars?

***Candidates scored*** (product value / consistency with precedent / implementation cost / reversibility / risk):

| ***Option**** | ****Product value**** | ****Precedent fit**** | ****Cost**** | ****Reversibility**** | ****Risk*** |
| --- | --- | --- | --- | --- | --- |
| A. Vercel Marketplace `vercel integration add stripe` | Same end state | Breaks precedent — Resend (`RESEND*API*KEY`) is env-var-only, no Marketplace claim anywhere in this repo | Low CLI cost, but the "claim" step needs a human at a dashboard/browser — this worker session is headless and unattended | High (Marketplace-managed vars) | ***Blocking***: cannot complete unattended, stalls the story |
| B. `stripe` npm SDK, direct env vars (`STRIPE*SECRET*KEY`/`STRIPE*WEBHOOK*SECRET`/`STRIPE*CLOUD*PRICE_ID`) | Same end state | Matches the Resend precedent exactly | Low | High (plain env vars, swappable later) | Low — code is the real integration; only live credentials are deferred to a human step |

***Chosen:**** ****B.*** Real Stripe Checkout + webhook code, wired via `.env` / Vercel env vars, same pattern as every other external service already in this boilerplate. This is not a mock or stub — a human supplies live/test API keys before it processes a real payment (non-blocking for merge, flagged in the PR). Vercel Marketplace provisioning remains available later without a code change (it would still land as the same env var names).

### Scenario 2.4/2.5 — minimum/zero seat quantity (AI Product Owner)

***Chosen:*** minimum purchasable seats = the workspace's current `active_seats` count; 0-seat and below-current-usage attempts are rejected. Maximum stays the already-ratified Cloud `seatLimit` (25) — this story does not introduce a variable ceiling, only a variable purchased quantity beneath the ratified cap.

***Reasoning:*** this story has no seat-reduction path (that's [https://jira.upexgalaxy.com/browse/BK-233#icft=BK-233](https://jira.upexgalaxy.com/browse/BK-233#icft=BK-233), downgrade, explicitly out of scope) — selling fewer seats than are already occupied would misrepresent the workspace's own membership the moment the purchase completes.

### Scenario 3.3 — seat quantity through decline+retry

***Resolved by the Q1 hosted-redirect decision itself, no new build needed:*** the seat quantity is fixed as the Stripe Checkout Session's line-item quantity before redirect; Stripe's own hosted decline/retry never leaves that session, so there is nothing for our app to preserve.

### Scenario E1 — two tabs, both confirmed

***Chosen:**** a DB-enforced partial unique index allows at most one ****open*** `billing*checkout*sessions` row per workspace. A second concurrent checkout attempt gets back the same Stripe Checkout URL, or a 409 if it loses the insert race — never a second Stripe session, never a double charge.

### New gap the ratification didn't cover — abandoned checkout

Landing back on the upgrade screen from Stripe's cancel URL now expires the Stripe session server-side and releases the one-open-session lock immediately, rather than stranding the owner for Stripe's default 24h session TTL. Belt-and-braces: the Checkout Session itself is created with an explicit 30-minute expiry, and Stripe's `checkout.session.expired` webhook releases the lock even if the owner never clicks back.

---

Dev: proceeding to implementation against this plan. `public/openapi.json` / `api/openapi-types.ts` will be regenerated in the same PR (two new workspace-scoped routes). Migration `0077` is reserved for this Story.

---

### Ely - 27/8/2026, 12:15:02

## AI Product Owner — Decision: purchased-seats fix now, invite-time enforcement deferred

Conductor review on PR #208 (item 5, MAJOR) found that `seat*quantity` chosen at checkout was write-only — nothing ever read it back, so the seat ceiling stayed the flat `PLAN*TIERS.cloud.seatLimit` (25) regardless of what a workspace actually purchased.

### Candidates scored

| ***Option**** | ****Product value**** | ****Precedent fit**** | ****Cost**** | ****Reversibility**** | ****Risk*** |
| --- | --- | --- | --- | --- | --- |
| A. Fix display/storage only (record `purchased_seats`, meter reads it) | Closes the honesty gap immediately | No precedent needed — additive column + read | Low | High | Low |
| B. Fix display/storage AND build hard invite-time enforcement now | Fully closes the revenue leak | ***No existing seat-limit enforcement mechanism anywhere in this codebase to extend*** — unlike the project-limit trigger (which reused an existing direct-insert route), this needs a new gate designed from scratch (workspace_members-insert trigger, or an RPC-level check in the invite-accept flow, with pending-vs-active status semantics to get right) | High — separate-story-sized | High | Medium — building an auth-adjacent gate inline during a review response, untested against the invite-accept flow's edge cases, is itself a risk |
| C. Do nothing | None | — | None | — | High — leaves the review finding open |

***Chosen:**** ****A now, B deferred as a filed follow-up (BK-636, linked to this ticket).***

### Reasoning

- `workspaces.purchased_seats` (migration 0077) is populated on webhook completion; `lib/billing/plan-tiers.ts`'s new `effectiveSeatLimit()` makes the Billing Overview seat meter show the workspace's REAL cap, not the tier's maximum purchasable quantity. This is shipped in PR #208.
- Hard enforcement (blocking an invite once `purchased_seats` is reached) is a genuinely separate scope: this codebase has zero existing seat-limit enforcement to extend — the project-limit trigger I built for AC2 could reuse `POST /api/v1/workspaces/{id}/projects`'s existing plain-insert shape; seats have no analogous mechanism anywhere, and inventing one (trigger vs RPC gate, pending/active status handling, the interaction with BK-232's plan-limit-warning UI) deserves its own design pass, not a same-session addition to an already-large review response.
- Filed as ***BK-636*** (Tech Story, linked Relates to [https://jira.upexgalaxy.com/browse/BK-230#icft=BK-230](https://jira.upexgalaxy.com/browse/BK-230#icft=BK-230)).

Dev: proceeding with the display/storage fix in this same PR; [https://jira.upexgalaxy.com/browse/BK-636#icft=BK-636](https://jira.upexgalaxy.com/browse/BK-636#icft=BK-636) is unscoped/unscheduled pending refinement.

---

### Automation for Jira - 27/8/2026, 16:06:43

✅ Pull Request is successfully MERGED and DEPLOYED on QA. 
It's Ready for Testing Phase! 
Dev Task is Done.

---


_Synced from Jira by sync-jira-issues_
