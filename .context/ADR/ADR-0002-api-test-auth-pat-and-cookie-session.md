# ADR-0002 — API tests authenticate with the signin PAT by default and a per-test cookie session for cookie-only routes

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** QA framework owner
- **Tags:** auth-in-tests, fixtures, integration
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The `integration` Playwright project depends on `api-setup`, which called a generic boilerplate login
(`AuthApi.authenticateSuccessfully`, PROJ-101) expecting an OAuth-style `{ access_token, token_type, expires_in }`
body. Bunkai's real `POST /api/v1/auth/signin` returns `{ user, session, pat, warning }`
(`components['schemas']['SigninResponse']`), so the setup failed on every run and no integration test could
execute (verified 2026-10-09 on staging).

Bunkai has two authentication mechanisms with different powers:

- **Bearer PAT**: the signin response mints one with default scopes (`atc:read`, `atc:write`, `run:execute`),
  never `workspace:admin` (app ADR-0005). Most read and run routes accept it.
- **Cookie session** (`sb-<ref>-auth-token`, set by the same signin response): holds every capability, and some
  routes accept ONLY it. `POST /api/v1/tokens` (minting a workspace-bound `workspace:admin` PAT, app ADR-0006)
  is cookie-only by design.

The BK-818 / BK-1111 regression Tests need both: a cookie-session principal, and per-test PATs minted from it.

## Decision

We will authenticate API tests in two tiers:

1. **Default (fixture-level):** `api-setup` signs in once via `POST /api/v1/auth/signin` and persists `pat.token`
   to `.auth/api-state.json`. The `{ api }` fixture keeps injecting it as `Authorization: Bearer`. The setup
   requests `pat_expires_in_days: 1` so setup runs do not accumulate long-lived tokens.
2. **Cookie principal (test-level, opt-in):** a test that needs cookie auth calls the AuthApi cookie-session helper,
   which signs in inside the test's own `APIRequestContext` (Playwright stores the `Set-Cookie`) and clears the
   bearer on every API component, so requests authenticate by cookie only.

Invariants:

- A test that asserts cookie-session behavior MUST clear the bearer (via the helper), never rely on precedence.
- Any PAT a test mints (`POST /api/v1/tokens`) MUST be revoked in the same test's teardown
  (`DELETE /api/v1/tokens/{id}`).

## Consequences

- **Positive:** the `integration` project runs again; cookie-only routes become testable without opening a browser
  (KATA fixture selection stays `{ api }`); token-scope behavior (ADR-0005/0006) can be asserted directly.
- **Negative / trade-offs:** every signin (setup and each cookie-session test) mints a PAT on the server; mitigated by
  1-day expiry and teardown revocation, but the staging user's token list grows during a run. Cookie tests pay one
  extra signin round-trip each.
- **Neutral / follow-ups:** `ui-auth.setup.ts` keeps its own local signin interface; it can migrate to the shared
  `@schemas/auth.types` facade later. Revisit if the app adds a non-minting session endpoint.

## Alternatives considered

- **Run cookie tests in the `e2e` project via `{ test }` and `page.request`** — rejected: opens a browser for API-only
  tests (KATA fixture-selection anti-pattern), still sends the injected bearer, and leaves the integration layer broken.
- **Reuse the signin `session.access_token` as a bearer** — rejected: the API does not accept a raw Supabase session
  token as a Bearer credential (documented in `ui-auth.setup.ts`).
- **Share one cookie session across tests via storage state** — rejected: couples tests through shared auth state and
  breaks per-test isolation; one signin per cookie test is cheap.

## References

- `api/openapi-types.ts` → `SigninBody`, `SigninResponse`
- upex-bunkai-tms `app/api/v1/tokens/route.ts` (cookie-only issuance), app ADR-0005, ADR-0006
- BK-828 retest (2026-10-09): PAT capability behavior; Tests BK-818, BK-1111
