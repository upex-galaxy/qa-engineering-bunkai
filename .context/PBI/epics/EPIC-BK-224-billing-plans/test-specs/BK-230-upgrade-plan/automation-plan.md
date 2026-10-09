# Test Automation Plan: BK-230 upgrade plan (ticket-driven)

> Ticket: BK-230 — Billing | Upgrade to a paid plan (Story BLOCKED by missing Stripe keys on staging)
> Candidates: BK-814 (TC8), BK-806 (TC12), BK-800 (TC1+TC3), BK-813 (TC7), BK-812 (TC5), BK-815 (TC14) — Stage 4 2026-10-09
> Type: integration (`{ api }`) x 4 + e2e x 3
> Created: 2026-10-09

## 0. Anti-duplication pre-flight (Critical Rule #12)

`kata-manifest.json` (clean): `BillingApi`, `TokensApi`, `BillingPage`, `HomeApi` exist (BK-230 checkout hardening, commit 40b023e) and are EXTENDED. None of the six ids is registered. No `ProjectsApi` / `MembersApi` exists.

## 1. Architecture decisions

| Decision | Value | Rationale |
|---|---|---|
| Auth | `api.useCookieSession(...)` (ADR-0002) | checkout, workspace delete, invite create/accept and leave need `workspace:admin` or a session |
| Seat partitions | resolved at runtime from `GET /v1/workspaces/{id}/billing` -> `active_seats` | min = active_seats, max = 25 |
| BK-812 data | Generate a throwaway community workspace + 3 projects, soft-delete it in teardown (`DELETE /v1/workspaces/{id}`, 30-day grace) | a fresh workspace is the only reliable "exactly 3 projects" state; the cloud leg is skipped by name (`@requires-payment-processor`) |
| BK-815 data | owner invites `config.secondaryTestUser` as `admin` (`POST /v1/workspaces/{id}/invites` -> raw token), secondary accepts (`POST /v1/invites/accept`), secondary leaves in teardown (`DELETE /v1/workspaces/{id}/membership`) | real admin-not-owner principal, no DB seeding; skips by name when the secondary user is unset |
| BK-815 UI identity | `{ test }` with an empty storageState: the API signs in through `page.request`, so the browser shares the session cookie; `HomePage.useWorkspace()` targets the invited workspace | one context, two identities in order (owner first, admin last) |
| BK-814 UI leg | the seat stepper CLAMPS to [active_seats, 25] (`UpgradeView.tsx` `Math.min/Math.max`); an out-of-range value is unreachable from the UI | Gherkin refined: assert the clamp, not an inline error |
| BK-806 mailto | assert `href` starts with `mailto:` and has an address, never a hardcoded alias | |
| New components | `ProjectsApi` (create project), `MembersApi` (invite / accept / leave) | one resource per component |

## 2. Components

### `BillingApi` (extend)
- helper `getBillingOverview(workspaceId)`
- `@atc('BK-814') startCheckoutWithInvalidSeatQuantity({ workspaceId, seatQuantity, expectedCode })` -> 422 + code, no checkout url
- `@atc('BK-813') startCheckoutWithValidSeatQuantity({ workspaceId, seatQuantity })` -> not 422; 200 (cancel) or 503 `payment_processor_unavailable`
- `@atc('BK-815') startCheckoutAsAdminMember(workspaceId)` -> 403 `not_workspace_owner`

### `ProjectsApi` (new)
- helper `createProject({ workspaceId, name })`
- `@atc('BK-812') createProjectBeyondCommunityLimit(workspaceId)` -> 422 `project_limit_reached`

### `MembersApi` (new) — helpers `createInvite`, `acceptInvite`, `leaveWorkspace`
### `HomeApi` (extend) — helper `deleteWorkspace(workspaceId)` (silent-fail teardown)

### `BillingPage` (extend)
- `@atc('BK-800') viewTierComparison(expectedTiers)` -> 3 tier cards with limits, only community `data-current`, qualitative cloud copy, CTAs
- `@atc('BK-806') viewEnterpriseContactPath()` -> `Contact sales` mailto, no upgrade button in the enterprise card, no payment input, no checkout request
- `@atc('BK-814') clampSeatQuantityToBounds({ min, max })` -> minus at min stays at min, plus up to max stays at max
- `@atc('BK-815') viewUpgradeAsNonOwner()` -> owner-only note instead of `Upgrade to Cloud`

Fixtures: register `projects`, `members` in `ApiFixture`.

## 3. Test files

| File | Fixture | TC |
|---|---|---|
| `tests/integration/billing/rejectInvalidSeatQuantity.test.ts` | `{ api }` | BK-814 API (range + type partitions) |
| `tests/integration/billing/acceptValidSeatQuantity.test.ts` | `{ api }` | BK-813 |
| `tests/integration/billing/enforceCommunityProjectLimit.test.ts` | `{ api }` | BK-812 (community leg) |
| `tests/integration/billing/rejectAdminCheckout.test.ts` | `{ api }` | BK-815 API |
| `tests/e2e/billing/viewUpgradeTiers.test.ts` | `{ ui }` | BK-800, BK-806, BK-814 UI |
| `tests/e2e/billing/blockAdminUpgrade.test.ts` | `{ test }` | BK-815 UI |

## 4. Verification

Each file on staging -> full suite -> `types:check` -> `lint:check` -> `kata:manifest`. Teardown verified: throwaway workspace soft-deleted, secondary membership removed.
TMS after merge: Candidate -> In Automation -> Pull Request -> AUTOMATED, labels `+automated -automation-candidate`; BK-814 Gherkin UI scenario refined (clamp).
