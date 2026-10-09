# Test Spec: BK-230 checkout hardening (regression-driven)

> Scope: Regression-driven (Micro) x 3 Candidate TCs from `/test-documentation` (2026-10-09)
> Source bugs: BK-827, BK-828, BK-829 (Closed, retested PASSED 2026-10-09, fix PR #249)
> Environment: staging (`TEST_ENV=staging`), Stripe NOT configured

## Candidates

| TC | Bug | Verdict / ROI | Surface | What it protects |
|---|---|---|---|---|
| BK-818 | BK-829 | Candidate / 12.0 | API | Foreign and non-existent workspaces get the identical 403 `not_workspace_owner` on create-checkout (no existence oracle) |
| BK-1110 | BK-827 | Candidate / 6.0 | API + UI | Unconfigured processor answers a generic 503 (no internal detail) on checkout and webhook; upgrade page renders only the generic text |
| BK-1111 | BK-828 | Candidate / 12.0 | API | A workspace-bound `workspace:admin` PAT passes the checkout capability gate; rejections stay machine-distinguishable |

## Out of automation (explicit handoff)

- DB row assertions (`idempotency_keys`, `billing_checkout_sessions` counts): the framework has no DB layer; verified manually in the retests (BK-1114/1116/1118 runs). Revisit if a DB fixture is added.
- BK-818 latency side channel: Deferred (flaky by nature), sampled manually (459 vs 445 ms).
- BK-1110 API scenarios only run where the payment processor is NOT configured; they skip by name (never fail) when the webhook probe proves it is configured.

## Data

- Primary identity: `config.testUser` (owner of community workspaces).
- Secondary identity: `config.secondaryTestUser` (`STAGING_USER_2_*`) owns the foreign workspace; Discover its owned workspace at runtime, assert the primary user is not a member. Tests that need it skip by name when unset.
- Absent workspace: `crypto.randomUUID()` per run.
- Per-test PATs are minted from the cookie session and revoked in teardown (ADR-0002).
