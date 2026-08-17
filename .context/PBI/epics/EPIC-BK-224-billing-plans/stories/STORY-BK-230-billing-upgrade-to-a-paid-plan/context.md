# BK-230: Billing | Upgrade to a paid plan
**Ticket:** BK-230 | **Module (= Epic):** BK-224 Billing & Plans | **Status:** Shift-Left QA | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)
- AC1: Owner compares tiers before choosing (Free/Team/Enterprise side by side, limits + price model, current plan marked)
- AC2: Successful upgrade from Free to Team unlocks limits immediately (4th project succeeds, receipt issued)
- AC3: Payment is declined (workspace stays Free, nothing charged, clear message, retry without re-entering plan choice)
- AC4: Enterprise is a contact path, not a checkout (no payment method entry requested)
- AC5: Only the owner can complete an upgrade (admin can view, cannot confirm)

## Team Discussion (from comments)
- Ely (2026-07-11): PO Ratification — B1 tier ladder Free/Team/Enterprise final, Enterprise stays sales-assisted. B2: Team pricing stays intentionally unpublished, per-seat billing confirmed. B3: only workspace owner completes a purchase, admins view read-only.
- Ely (2026-07-30): Mockup pointer to `.context/designs/bunkai-test-management-tool/bk-224-billing/plan-comparison-checkout.html` (file not present in this repo — confirmed absent this pass).

## Parent epic
BK-224: Billing & Plans — goal is to monetize Bunkai Cloud (open-core: Community self-hosted / Cloud per-seat / Enterprise license). Sibling BK-229 (View plan/seats/usage) is already `Ready For Dev`, 8 points, already shift-left refined (label `shift-left-reviewed`) — its ATP is real ground-truth for what plan/usage data model exists today.

## Pre-sprint status
Shift-Left refinement: in progress (started 2026-08-17)
