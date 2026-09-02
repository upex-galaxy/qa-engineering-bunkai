# BK-230: Billing | Upgrade to a paid plan — Session Start picture

**Ticket:** BK-230 | **Module (= Epic):** BK-224 Billing & Plans | **Type:** Story
**Status:** Ready For QA | **Sprint:** none (no Sprint field on the synced Story — single-issue QA)
**Target env:** staging (`https://staging-upexbunkai.vercel.app`) | **TMS modality:** jira-xray
**PR:** #208 (merged + deployed to QA per Automation-for-Jira comment 2026-08-27) | **Migration:** 0077 | **ADR:** ADR-0014 (Stripe integration — NOT present in local checkout)

> This file is [LOCAL] tier — hand-authored session notes, not a Jira mirror.

---

## Plan-name mapping (ACs vs schema) — USE SCHEMA NAMES IN TESTS/BUGS

| Story / UI label | DB `workspaces.plan` value | Project limit (live trigger) |
| --- | --- | --- |
| Free | `community` | 3 |
| Team | `cloud` | 50 |
| Enterprise | `enterprise` | unlimited (NULL) |

`workspaces.plan` CHECK in (`community`,`cloud`,`enterprise`), default `community`.
`billing_checkout_sessions.target_plan` CHECK = `'cloud'` only (self-serve buys Cloud/Team; Enterprise is sales-assisted).

---

## What shipped (verified against staging DB + Jira ratification comments)

### Migration 0077 — CONFIRMED applied on staging
- `workspaces.purchased_seats int NULL` — new column; populated on webhook completion with the checkout seat quantity. Currently NULL on every staging workspace (0 upgrades ever).
- `billing_checkout_sessions` table (13 cols): `id`, `workspace_id` (FK workspaces ON DELETE CASCADE), `created_by_user_id` (FK auth.users ON DELETE RESTRICT), `target_plan`, `seat_quantity`, `stripe_checkout_session_id`, `status` (default `'open'`), `idempotency_key`, `expires_at`, `created_at`, `completed_at`, `stripe_customer_id`, `stripe_subscription_id`.
  - CHECKs: `seat_quantity > 0`; `status IN ('open','completed','expired','canceled')`; `target_plan = 'cloud'`.
  - Indexes: **partial unique `billing_checkout_sessions_one_open_per_workspace ON (workspace_id) WHERE status='open'`** (the E1 double-tab / one-open-session lock); unique `stripe_checkout_session_id`; plain index on `workspace_id`.
- `stripe_webhook_events` table: `id text PK` (= Stripe event id — dedup ledger), `type`, `received_at`. 199 rows on staging, **ALL synthetic** (`bk230-checkout-isolation-<ts>-<rand>-evt-{completed,unpaid,late,locally-expired}`, dated 2026-08-27..08-31) — dev integration-test fixtures, not real Stripe deliveries.
- `bunkai_enforce_project_limit()` + `BEFORE INSERT` trigger `bunkai_enforce_project_limit_trigger` on `public.projects`. Limits: community=3, cloud=50, enterprise=unlimited, unknown-plan=-1 (blocks all). Raises `project_limit_reached` with SQLSTATE `45700` when `count(projects for workspace) >= limit`. Counts ALL rows in `projects` for the workspace (no soft-delete filter observed).
- `bunkai_apply_billing_checkout_webhook_event(p_stripe_event_id, p_stripe_event_type, p_stripe_checkout_session_id, p_client_reference_id, p_payment_status, p_stripe_customer_id, p_stripe_subscription_id)` — `SECURITY DEFINER`, returns jsonb. Webhook-driven plan activation:
  - Locates the session row by `id = client_reference_id::uuid` OR `stripe_checkout_session_id` match, `FOR UPDATE`.
  - Idempotency: status already `completed` → `already_processed`; `INSERT ... ON CONFLICT (id) DO NOTHING` into `stripe_webhook_events`, 0 rows inserted → `duplicate`.
  - On `checkout.session.completed` / `checkout.session.async_payment_succeeded` with `payment_status='paid'`: `UPDATE workspaces SET plan=target_plan, purchased_seats=seat_quantity`; session → `completed`, `completed_at=now()`; inserts `activity_log` row `action='workspace.plan_upgraded'`. Returns `applied`.
  - `payment_status <> 'paid'` on a completed event → `awaiting_payment` (no plan change).
  - `async_payment_failed` / `checkout.session.expired` → session → `expired` (only if currently `open`).
  - Known nuance (Conductor re-review comment in the function body): a row this app flips to `expired`/`canceled` LOCALLY can still receive a genuinely paid `completed`/`async_payment_succeeded` event and it is still applied — deliberate, but an edge worth a targeted test.
- `bunkai_workspace_billing_overview(p_workspace_id)` — extended to also return `purchased_seats` alongside `plan`, `active_seats` (count of `workspace_members` status=`active`), `project_count`, `oldest_run_age_days`. Admin-gated via `bunkai_is_workspace_admin`.

### App layer — NOT inspectable this session
Local `../upex-bunkai-tms` checkout is stale: branch `staging` at PR #156 merge, migrations stop at 0068, no `lib/billing/`, no Stripe code, `.context/ADR/` stops at ADR-0012. Everything below is from the Jira ratification comments, not code:
- `lib/billing/plan-tiers.ts` — `PLAN_TIERS` + `effectiveSeatLimit()` (Billing Overview seat meter shows `min(purchased_seats, tier max)` = the workspace's REAL cap, not the tier ceiling).
- `lib/billing/checkout.ts` — `reuseOpenCheckoutSession` (returns the same Stripe URL / 409 on a second concurrent attempt), one-open-session lock, explicit 30-min Checkout Session expiry, cancel-URL handler that expires the session server-side + releases the lock (`checkout.ts:203-213` backfill is deliberately non-fatal).
- Two new workspace-scoped API routes (checkout-create + Stripe webhook receiver). Exact paths unverified — search `app/api/**` for `checkout` / `billing` / `stripe` / `webhook` once a current checkout is available. `public/openapi.json` / `api/openapi-types.ts` regenerated in the same PR.
- Tier-comparison + checkout-entry UI. Mockup route: `/settings/billing/upgrade` (Settings > Billing > Upgrade).
- Stripe wiring: direct `stripe` npm SDK + env vars `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CLOUD_PRICE_ID` (ADR-0014 chose this over Vercel Marketplace). AI Tech Lead comment: "a human supplies live/test API keys before it processes a real payment (non-blocking for merge, flagged in the PR)".

### Deferred (NOT in PR #208)
- BK-636 (Tech Story, To Do) — hard invite-time seat-count enforcement. PR #208 shipped display/storage of `purchased_seats` only; nothing blocks an invite when `purchased_seats` is reached.

---

## AC -> implemented behavior map

| AC | Behavior | Where implemented | Gap / risk for QA |
| --- | --- | --- | --- |
| **AC1** Owner compares tiers before choosing | 3-column Free/Team/Enterprise comparison, current-plan marker, Team price hidden on comparison (qualitative indicator), real number at Stripe Checkout | Frontend `/settings/billing/upgrade` (not inspectable). Design intent: `.context/designs/.../bk-224-billing/plan-comparison-checkout.html` (stale — pre-Stripe-redirect, shows in-app modal + saved cards) | Mockup shows a real `$12/seat` number for Team and `2 projects` for Free / `unlimited` for Team — CONTRADICTS ratification Q3 (Team price hidden) and the live trigger (community=3, cloud=50). Treat mockup numbers as stale; live trigger + ratification win. |
| **AC2** Successful upgrade Free->Team unlocks limits immediately | Webhook `checkout.session.completed`+`paid` -> `bunkai_apply_billing_checkout_webhook_event` sets `plan='cloud'`, `purchased_seats`. Project limit lifts because trigger reads `cloud`=50. 4th project then inserts OK. | `bunkai_apply_billing_checkout_webhook_event` + `bunkai_enforce_project_limit` (both live on staging) | Activation is async/webhook-driven, NOT the synchronous in-app confirm the ACs describe (Q1 redirect rewrite). "Immediately / no reload" depends on the frontend polling / realtime after redirect-back. No staging workspace is at the 3-project limit today (max = 2) and none on `cloud` — test data must be seeded. |
| **AC2.2** Confirmation receipt to owner | Hosted Stripe Checkout issues its own receipt/email. App writes `activity_log` `workspace.plan_upgraded` only. | Stripe (hosted) | Channel unconfirmed — likely Stripe's receipt email, not an app-generated one. No app email infra seen. |
| **AC3** Payment declined -> nothing changes, retry | Decline happens entirely inside Stripe hosted checkout — never reaches our app, so `workspaces.plan` stays `community`, no `billing_checkout_sessions` row transitions to `completed`. Friendly copy mapped from Stripe `decline_code` (Q4/T4). | Stripe hosted + frontend decline-code -> copy map | Decline + retry cannot be driven end-to-end without Stripe test keys. Seat quantity is fixed as the Checkout Session line-item before redirect (Q/3.3) so there is nothing app-side to preserve on retry. |
| **AC4** Enterprise = contact path, no checkout | Enterprise column CTA is a `mailto:` sales alias; no card fields, no checkout pane. `target_plan` CHECK = `'cloud'` structurally forbids an Enterprise checkout session. | Frontend + DB CHECK | Exact `mailto:` address: mockup uses `sales@bunkai.dev`; comment T3 says "a sales alias". Confirm the shipped value. |
| **AC5** Only the owner can complete an upgrade | Checkout-create route gated to owner (server-side, via `bunkai_is_workspace_owner`). Admin/member/viewer: can view comparison, cannot confirm; shown "the workspace owner completes upgrades" (Q4). | Checkout-create API route + frontend role gate | `bunkai_is_workspace_owner(ws_id)` helper confirmed to exist on staging. Only ONE admin membership exists on all of staging (BK-337 fixture). Need the test login user to actually hold a non-owner role somewhere to exercise 5.2 / 5.4. |
| **E1** Two tabs / double-confirm | Partial unique index `one_open_per_workspace WHERE status='open'` -> at most one open session per workspace; second attempt gets the same URL or 409. Webhook event-id dedup + session status guard -> one plan change, one activity_log row. | DB index + `checkout.ts` + webhook RPC | Testable at API/DB level (the insert race) even without Stripe keys. |

---

## Test-data findings (staging DB, read-only — DBHub `staging-dbhub` as `qa_inspector_rw`)

- Cannot resolve `STAGING_USER_EMAIL` (`bunkai-staging-user@delsimi.resend.app`) -> user UUID: `auth` schema access denied, no public `users`/`profiles` table with email. The specific workspace(s) owned by the test login user must be identified in Stage 1 via the app UI or an app-authenticated API call.
- Workspaces by plan: **community 518, enterprise 8, cloud 0**. No workspace has ever been upgraded through this flow.
- `billing_checkout_sessions`: **0 rows, ever.** No checkout has been initiated on staging.
- `workspaces.purchased_seats`: NULL on all workspaces.
- `stripe_webhook_events`: 199 rows, all synthetic dev-test fixtures (see above) — proves the RPC was integration-tested, not that a live redirect works.
- Community workspaces (non-deleted) by project count: 0 projects -> 242 ws, 1 -> 109, 2 -> 167. **None at 3 (the enforcement limit).** AC2 "blocked before" state requires seeding a community workspace with exactly 3 projects.
- Roles across ALL of staging: `owner` active 512 / suspended 2; `member` active 14; `viewer` active 6; **`admin` active 1** — user `a2fe4e10-aa95-422f-bb32-f1d813e3cdf4` in workspace `10000000-0000-4000-8000-000000000041` ("BK-337 Admin Role (QA fixture)", community). Same user is `viewer` in `10000000-0000-4000-8000-000000000051`. If the staging login user IS `a2fe4e10-…`, these two fixtures cover AC5.2 (admin) and 5.4 (viewer); otherwise a non-owner membership must be created.

### Missing for full coverage
- **AC2 before/after:** a `community` workspace owned by the test user with exactly 3 projects (to see creation blocked), then a path to `cloud` (real upgrade if Stripe keys exist, else a seeded/manual plan flip — a DB write, decided in Stage 1).
- **AC5.2 / 5.4:** the test user holding `admin` (and `member`/`viewer`) role on a workspace they do not own.
- **AC3 / AC2 payment legs:** Stripe test-mode keys on the staging Vercel deployment (see below).

---

## Stripe test-mode readiness on staging: LIKELY NOT WIRED / UNVERIFIED

Evidence it is NOT wired / not exercised:
- `billing_checkout_sessions` has 0 rows ever; 0 workspaces on `cloud`; 0 `purchased_seats` set.
- The 199 `stripe_webhook_events` are all `bk230-checkout-isolation-*` test fixtures, never a real `evt_*` Stripe id.
- AI Tech Lead comment (2026-08-27): live/test keys are "deferred to a human step", "non-blocking for merge, flagged in the PR".
- Local `.env.example` (stale checkout) declares no `STRIPE_*` var — weak evidence (predates PR #208).

Cannot confirm the Vercel staging env vars from here (no dashboard access).

**How to confirm in Stage 1:** log in to staging as a workspace owner, open `/settings/billing/upgrade`, choose Team, click Confirm. Wired -> HTTP 3xx / client redirect to `https://checkout.stripe.com/...`. Not wired -> 500 / error toast at the create-checkout call, no `billing_checkout_sessions` row (or an `open` row with NULL `stripe_checkout_session_id` left behind). Also ask the team / check Vercel for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CLOUD_PRICE_ID` on the staging deployment.

---

## Open risks / questions for QA planning

1. **Stripe test keys probably absent on staging** -> the true payment-success (AC2) and decline+retry (AC3) legs may be un-executable end-to-end. Testable without keys: tier-comparison UI (AC1), Enterprise contact path (AC4), owner-only gate on the create route (AC5), the one-open-session lock, the project-limit trigger, and the webhook RPC via simulated events / Stripe CLI. Resolve this FIRST in Stage 1 — it determines the whole execution plan.
2. **Plan naming:** ACs say Free/Team; schema + trigger + CHECK use `community`/`cloud`. All test artifacts and bug reports use schema names; confirm the UI "Team" label maps to `cloud`.
3. **Project-limit number disagreement:** live trigger community=3 / cloud=50; mockup Free=2 / Team=unlimited; shift-left + BK-229 ratified "Free = 3 projects". Live trigger is authoritative. Is `cloud=50` intended vs. "unlimited"? Flag mockup as stale.
4. **AC2 test data:** no staging workspace is at the 3-project limit and none on `cloud`. Seeding required; the plan flip to `cloud` without a real Stripe payment is a DB write — out of scope for read-only Session Start, decide in Stage 1.
5. **Non-owner role coverage (AC5.2, 5.4):** only one admin membership exists on staging; needs the test user in a non-owner seat, or use the BK-337 fixtures if the login user is `a2fe4e10-…`.
6. **Seat bounds are app-layer:** DB only enforces `seat_quantity > 0`. Min = current `active_seats` and max = 25 live in `lib/billing/`. Test both layers (API seat_quantity=0 -> app 4xx + DB CHECK backstop; seat_quantity < active_seats -> app 4xx only; seat_quantity > 25 -> app 4xx).
7. **Webhook idempotency / replay + the locally-expired-row nuance** (Conductor comment in `bunkai_apply_billing_checkout_webhook_event`) — needs a targeted test: replay the same event id (expect `duplicate`), and a paid `completed` event against a locally-`expired` row (expect it still applies). Use Stripe CLI `stripe events resend` if keys exist, else call the RPC directly.
8. **One-open-session lock** — two concurrent create-checkout calls: expect one `open` row + one URL, the other gets the same URL or 409. Directly testable at API/DB level.
9. **Cancel / abandon path** — landing on Stripe's cancel URL should expire the session server-side + release the lock immediately; 30-min TTL + `checkout.session.expired` webhook are the backstop. Needs the app route.
10. **`bunkai_enforce_project_limit` counts all `projects` rows** with no soft-delete filter — if `projects` has `deleted_at`, deleted projects still consume the quota. Verify intent.
11. **Receipt channel (AC2.2)** — appears to be Stripe's own hosted receipt, not app-generated. Confirm.
12. **Enterprise `mailto:` target** — mockup `sales@bunkai.dev` vs comment "a sales alias". Confirm the shipped address.

---

## Context docs status
- Present + read: story.md, acceptance-criteria.md (5 ACs -> 22 scenarios), acceptance-test-plan.md (shift-left DRAFT, 22 outlines), comments.md (3 ratification comments — all shift-left blockers resolved), scope.md, out-of-scope.md, workflow.md, business-rules.md, mockup.md (pointer only), epic.md, shift-left-refinement.md, business-data-map.md / business-model.md (plan model).
- **Absent locally:** `implementation-plan.md` (Story "Spec Implementation Plan" field — never synced), `feature-implementation-plan.md` / `feature-test-plan.md` (epic dir), **ADR-0014** (referenced by comments; `.context/ADR/` has only template + README). Full "what shipped" was reconstructed from comments.md + the live staging DB + the design mockup.
