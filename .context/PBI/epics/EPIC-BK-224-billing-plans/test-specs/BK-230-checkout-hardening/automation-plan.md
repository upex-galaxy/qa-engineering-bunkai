# Test Automation Plan: BK-230 checkout hardening

> Tickets: BK-818 (BK-829), BK-1110 (BK-827), BK-1111 (BK-828) — regression-driven
> Type: integration (`{ api }`) x 3 + e2e (`{ ui }`) x 1
> Created: 2026-10-09

## 0. Anti-duplication pre-flight (Critical Rule #12)

`kata-manifest.json` (clean per `kata:manifest:check`) has no `Billing*` / `Tokens*` component and none of
BK-818 / BK-1110 / BK-1111 among `components.*.atcs[].id`. `HomeApi` exists and is extended with one helper.

## 1. Architecture decisions

| Decision | Value | Rationale |
|---|---|---|
| Auth | `api.useCookieSession(...)` (ADR-0002) for every test | create-checkout needs `workspace:admin`; the default sign-in PAT lacks it, the cookie holds every capability |
| PAT probing | explicit `Authorization: Bearer` header per request | server resolves Bearer before cookie (`lib/api/principal.ts` "Bearer first"), so a PAT is never shadowed by the context cookie |
| Secondary identity order | sign in user 2 FIRST (read its PAT + owned workspace), then `useCookieSession(user 1)` | both signins write the same `sb-*-auth-token` cookie; the last one wins |
| New API components | `BillingApi` (checkout + webhook), `TokensApi` (PAT mint/revoke) | one resource per component |
| New UI component | `BillingPage` (upgrade view) | first billing UI ATC |
| Schema facade | `api/schemas/billing.types.ts` from `@openapi` | `ErrorEnvelope.code` widened to `string`: the spec enum lacks `payment_processor_unavailable` (doc drift, reported) |
| Steps module | none | no chain repeated across 3+ files |
| ADR | none new (ADR-0002 covers auth) | |

## 2. Components

### `tests/components/api/BillingApi.ts` (new)
- helper `startCheckout({ workspaceId, body, idempotencyKey?, token? })` -> `[APIResponse, CheckoutResult]` (no assertions; `idempotencyKey: null` omits the header)
- helper `postWebhookWithSignature()` -> `[APIResponse, ErrorEnvelope]`
- helper `probePaymentProcessor()` -> `'configured' | 'unavailable' | 'unknown'` (webhook 400 / 503 / other)
- helper `cancelCheckout(workspaceId)`
- `@atc('BK-818') startCheckoutAsNonMember({ workspaceId, body, withIdempotencyKey })` -> asserts 403 `forbidden`, message, `details.reason = not_workspace_owner`; returns the envelope without `request_id`
- `@atc('BK-1110') startCheckoutWithoutPaymentProcessor(workspaceId)` -> asserts 503 `payment_processor_unavailable`, generic message, no `Stripe` / `configured` / `STRIPE_` leak
- `@atc('BK-1111') startCheckoutWithWorkspaceAdminToken({ workspaceId, token })` -> asserts the response is not a 403 and is 200 (checkout url) or 503; cancels an opened checkout on 200

### `tests/components/api/TokensApi.ts` (new)
- helpers `mintToken(body)` -> `[APIResponse, CreateTokenResponse | ErrorEnvelope]`, `revokeToken(id)`

### `tests/components/api/HomeApi.ts` (extend)
- helper `listWorkspaces(token?)` -> `WorkspaceWithRole[]` (explicit Bearer when given)

### `tests/components/ui/BillingPage.ts` (new)
- `goto()` -> `/settings/billing/upgrade`, waits for `upgrade-view`
- `@atc('BK-1110') continueToPaymentShowsGenericProcessorError()` -> `upgrade-cta-cloud` -> `upgrade-continue-to-payment`, expects `upgrade-checkout-error` = generic text, URL unchanged

Fixtures: register `billing`, `tokens` in `ApiFixture` (incl. token propagation) and `billing` in `UiFixture`.

## 3. Test files

| File | Fixture | TC |
|---|---|---|
| `tests/integration/billing/rejectNonMemberCheckout.test.ts` | `{ api }` | BK-818: 3 partitions x {foreign, absent} compared for equality + malformed id 400 |
| `tests/integration/billing/startCheckoutWithoutPaymentProcessor.test.ts` | `{ api }` | BK-1110 API: checkout 503 + webhook identical code/message; skip when probe = configured |
| `tests/integration/billing/authorizeCheckoutTokens.test.ts` | `{ api }` | BK-1111: admin PAT passes; default PAT 403 missing_capability; bound PAT on foreign/absent 403 scoped; mint for foreign 403 not member; PAT cannot mint PAT; revoke in finally |
| `tests/e2e/billing/showPaymentProcessorUnavailable.test.ts` | `{ ui }` + `page.route` 503 mock | BK-1110 UI |

## 4. Verification

`bun run test` on each file (staging) -> `types:check` -> `lint:check` -> `kata:manifest` + check.
TMS after green: link automated -> manual via `test_automation`, Candidate -> In Automation -> Pull Request -> AUTOMATED (solo-main: direct push = merged), labels `+automated -automation-candidate`.
