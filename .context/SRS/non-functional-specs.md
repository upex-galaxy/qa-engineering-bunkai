# Non-Functional Specification — Bunkai TMS

> Target repo: `upex-bunkai-tms`. Discovery scope: Phase 2 — SRS, sub-step 3.
> Generated: 2026-08-17.
> **Mindset**: every entry below is either evidenced with a code/config path or explicitly marked "Not implemented" / "Needs Review" / "Discovery Gap." The target's own `.context/SRS/non-functional-specs.md` states quantified MVP targets (LCP < 2.0s, API p95 < 200ms, 99.5% uptime, etc.) — these are **planning targets from before implementation**, not measured facts. No load-test, APM, or telemetry evidence exists anywhere in this codebase to confirm any of them are currently met or even monitored. This document does not restate those numbers as current NFRs; each category below states what is actually built, and flags the absence of measurement as the gap it is.

---

## NFR Summary

| Category | Implemented | Maturity |
|---|---|---|
| Performance | Partial — targeted indexes exist for 3 dashboard queries; no caching, no measured budgets | Low — no telemetry to verify anything |
| Security | Substantial — layered auth (cookie+PAT unification), RLS everywhere, capability gating, idempotency, CSRF-hardened OAuth | Medium-High for authZ/authN; Low for headers/rate-limiting/PII-disclosure controls |
| Reliability | Minimal — structured logs only, no retry/circuit-breaker, no health-check depth beyond a static 200 | Low |
| Scalability | Structural (stateless serverless API) but unverified at load; no queue, no read replica, no explicit pool config found | Low-Medium |
| Observability | Logs only (stdout JSON) — no APM, no metrics, no tracing, no alerting | Low |

---

## 1. Performance

### NFR-PERF-001: Dashboard query indexing

| Aspect | Value |
|---|---|
| **Target** | Not quantified — no numeric budget found in code |
| **Implementation** | Three dedicated migrations add indexes specifically for home-dashboard queries |
| **Evidence** | `supabase/migrations/0059_home_recent_projects_indexes.sql`, `0060_home_active_runs_index.sql`, `0061_home_open_bugs_index.sql` |

This is the only direct evidence in the codebase of performance-motivated schema work. No accompanying benchmark, EXPLAIN output, or numeric target was found alongside these migrations.

### NFR-PERF-002: HTTP caching

| Aspect | Value |
|---|---|
| **Target** | None found |
| **Implementation** | No `Cache-Control` header-setting code found in any route handler; no Next.js `revalidate`/ISR configuration traced in the App Router pages read this pass |
| **Evidence** | Absence confirmed by reading `lib/api/handler.ts` (the universal response wrapper — sets only `x-request-id`) and `next.config.ts` (no `headers()` function) |

**Discovery Gap**: the target's own non-functional-specs.md prescribes `Cache-Control: private, max-age=60, stale-while-revalidate=300` for read endpoints — this is **not implemented**, not a confirmed current behavior.

### NFR-PERF-003: Connection pooling

| Aspect | Value |
|---|---|
| **Target** | Not found |
| **Implementation** | Not independently verified — no Supavisor/pool-size configuration file located in this pass |
| **Evidence** | — |

**Discovery Gap.**

### NFR-PERF-004: Idempotency-store TTL as a de facto write-latency bound

| Aspect | Value |
|---|---|
| **Target** | 24h replay window (not a latency target, a correctness window) |
| **Implementation** | `idempotency_keys` rows expire after 24h; replay within the window returns the stored snapshot with no second write |
| **Evidence** | `lib/api/idempotency.ts:1-30`, ADR-0002 |

### Frontend performance budgets

**Discovery Gap** — no bundle-size budget enforcement (no `next/bundle-analyzer`, no CI bundle-size gate) was found; the target's own planning doc states a 300KB gzipped JS budget and specific LCP/TTI numbers, none of which are independently measurable from this codebase (no `.github/workflows/`, no Lighthouse CI config, no `vercel.json`).

---

## 2. Security

### NFR-SEC-001: Unified authentication (cookie + PAT parity)

| Aspect | Value |
|---|---|
| **Target** | Every `/api/v1/*` route requires authentication by default; a route is public only via an explicit, reviewable opt-out |
| **Implementation** | `withApiHandler({ auth: 'required' })` is the default; `resolveIdentity()` normalizes cookie session OR Bearer PAT into one `Principal` before the handler runs |
| **Evidence** | `lib/api/handler.ts:61-110`, `lib/api/principal.ts`, ADR-0001 |

This closed a real, shipped incident class (BK-17: 4 of ~33 handlers accepted a PAT, the rest silently 401'd it) by making auth a structural default rather than a per-handler convention, with a CI-enforced lint ban on the raw bypass (`createClient().auth.getUser()` inside `app/api/**`).

### NFR-SEC-002: Authorization — dual-layer (RLS + capability gate)

| Aspect | Value |
|---|---|
| **Target** | RLS is the single source of data-isolation truth for both auth methods; capability scopes are enforced separately in TypeScript for PAT callers |
| **Implementation** | RLS policies call `SECURITY DEFINER` helpers (`bunkai_is_workspace_member`, `bunkai_can_write_workspace`, etc.); PAT callers get a 60-second user-scoped impersonation JWT so `auth.uid()` resolves identically to a cookie session |
| **Evidence** | `supabase/migrations/0005_rls_helpers.sql:19-84`, `lib/api/user-jwt.ts`, ADR-0001 §"Path B" |

### NFR-SEC-003: RPC authorization invariant (actor bind + result scoping)

| Aspect | Value |
|---|---|
| **Target** | Every `SECURITY DEFINER` function taking a caller-supplied identity/scope parameter must bind it to `auth.uid()` and separately scope every returned row |
| **Implementation** | Partial. A 2026-08-01 audit (ADR-0012) found 24 live functions take `p_actor_user_id`; only 2 carry the bind; **22 do not**. All 22 are known, tracked debt — explicitly NOT retrofitted inline per the ADR's own decision (bundling risk). New functions must not add to the count. |
| **Evidence** | ADR-0012, `0039_run_history_actor_guard.sql` (the one retrofit), `0041_run_project_report.sql` |

Blast radius stated in the ADR itself: none of the 22 lets a caller cross a workspace boundary (each still asserts the parameter's own membership) — the exposure is a co-member with write access attributing a write to another co-member's identity. Not a cross-tenant leak; still a real identity-integrity defect and a legitimate negative-test target.

### NFR-SEC-004: PAT scope model + admin-scope gating

| Aspect | Value |
|---|---|
| **Target** | `workspace:admin` scope only mintable by an admin/owner, only bound to a specific workspace; never mintable via headless auth flows |
| **Implementation** | Enforced at issuance (ADR-0005, closing a real privilege-escalation incident — BK-135, 136 live over-scoped tokens found in the shared staging/prod project) and at consumption (ADR-0006 — capability gate + `assertWorkspaceContext`) |
| **Evidence** | ADR-0005, ADR-0006, `0008_access_tokens.sql` |

### NFR-SEC-005: Account verification (no public auto-confirm)

| Aspect | Value |
|---|---|
| **Target** | No account gets a session or PAT without proving control of its email inbox, on either the browser or headless rail |
| **Implementation** | Mandatory 6-digit email OTP on sign-up (`supabase.auth.verifyOtp`); the prior admin `email_confirm: true` auto-confirm backdoor is deleted from the public surface |
| **Evidence** | ADR-0007 |

Accepted trade-off: `POST /api/v1/auth/check-email` is a deliberate user-enumeration surface (reveals whether an email is registered and confirmed), required to route the email-first UX before a password is collected. Mitigation is Supabase's built-in GoTrue throttling only — this specific route bypasses GoTrue entirely (direct service-role `auth.users` read), so **its actual abuse ceiling is whatever the app puts in front of it, which today is nothing** (ADR-0007 §Follow-ups explicitly names a dedicated app-level rate limiter as an unbuilt, deferred item).

### NFR-SEC-006: OAuth CSRF protection

| Aspect | Value |
|---|---|
| **Target** | Literal server-side `403 OAUTH_STATE_MISMATCH` on CSRF-state mismatch (contractual AC requirement) |
| **Implementation** | An independent, server-issued, httpOnly, `SameSite=Lax`, 10-minute-TTL `state` cookie layered on top of Supabase's own PKCE flow (PKCE alone cannot surface the literal error code required) |
| **Evidence** | ADR-0008 |

### NFR-SEC-007: PII disclosure — activity-feed actor resolution

| Aspect | Value |
|---|---|
| **Target** | N/A — this is a recorded, deliberate posture widening, not a target |
| **Implementation** | `bunkai_resolve_activity_actors` is the first function in this codebase reachable directly by any signed-in workspace member (including `viewer`) that resolves another user's email from `auth.users`, via a `SECURITY DEFINER` RPC grantable to `authenticated` |
| **Evidence** | ADR-0011 |

Explicitly flagged in the ADR itself as "a strictly broader disclosure surface" than every prior precedent in the codebase (which were all `service_role`-only or self-only). No opt-out exists for a user to hide their email from co-members. Legitimate QA test target: confirm the RPC never resolves a non-co-member's email.

### NFR-SEC-008: Rate limiting

| Aspect | Value |
|---|---|
| **Target** | None documented as an application-wide control |
| **Implementation** | `rate_limited` exists as an error code, but it is **only** a passthrough mapping of Supabase Auth's own `429` response, wired into exactly 5 auth routes (`signup`, `magic-link`, `resend`, `check-email`, `confirm`). No application-level limiter exists for the general `/api/v1/*` write surface (ATCs, Tests, Runs, Bugs, Milestones, etc.) |
| **Evidence** | `grep rate_limited` → `lib/openapi/registry.ts:40`, `lib/api/error-envelope.ts:27`, 5 auth route files; ADR-0007 §Follow-ups names this gap explicitly |

**Needs Review** — this is a materially different posture than the target's own planning doc, which specifies "100 req/min/token for writes, 600 req/min for reads." That policy is not implemented anywhere in the current codebase.

### NFR-SEC-009: Data encryption

| Aspect | Value |
|---|---|
| **Target** | Not independently verifiable from application code — this is a platform-managed control |
| **Implementation** | TLS in transit is a Vercel/Supabase platform default (no in-app TLS config to inspect); at-rest encryption is Supabase-managed (Postgres). Neither is independently confirmable from this repo's own code |
| **Evidence** | Absence of any in-repo TLS/encryption configuration — inferred platform behavior, not evidenced |

### NFR-SEC-010: Security headers / CSP

| Aspect | Value |
|---|---|
| **Target** | None found |
| **Implementation** | Not implemented — `next.config.ts` has no `headers()` function; no CSP, no `X-Frame-Options`, no `Strict-Transport-Security` configured in application code |
| **Evidence** | `next.config.ts` full read (6 lines of config: `reactStrictMode`, `outputFileTracingRoot`, `typedRoutes`, `images.remotePatterns`) |

**Needs Review** — the target's own planning doc specifies a strict CSP; not implemented.

### NFR-SEC-011: Input sanitization

| Aspect | Value |
|---|---|
| **Target** | User-generated Markdown (US/AC/ATC bodies) must not execute scripts on render |
| **Implementation** | `react-markdown` + `rehype-sanitize` pipeline |
| **Evidence** | `package.json` dependencies |

### OWASP Top 10 — evidenced posture (not a checklist claim)

| Risk | Status |
|---|---|
| A01 Broken access control | Substantially addressed — RLS + capability gate + ADR-0012's ongoing remediation of the 22 unbound functions |
| A02 Cryptographic failures | Platform-managed (Supabase/Vercel); not independently auditable from this repo |
| A03 Injection | Parameterized via Supabase client + Zod validation at every write path read this pass |
| A05 Security misconfiguration | **Weak** — no security headers, no CSP (NFR-SEC-010) |
| A07 Identification/auth failures | Addressed via ADR-0007 (mandatory OTP) and Supabase's built-in throttling, but the app has no rate limiter of its own beyond that |
| A09 Logging/monitoring failures | **Weak** — structured stdout logs exist (see §5 Observability) but no APM, no alerting, no error-tracking SDK |

---

## 3. Reliability

### NFR-REL-001: Structured error envelope

| Aspect | Value |
|---|---|
| **Target** | Every API error returns a consistent `{ error: { code, message, details? } }` shape with a request id |
| **Implementation** | `withApiHandler`'s catch block maps `ApiError`, `ZodError`, and unknown exceptions into one envelope; every response carries `x-request-id` | 
| **Evidence** | `lib/api/handler.ts:93-125` |

### NFR-REL-002: Health check

| Aspect | Value |
|---|---|
| **Target** | Not specified |
| **Implementation** | `GET /api/v1/health` returns a static `{ ok: true, service, env, ts }` — no dependency check (no DB ping, no Supabase Auth reachability check) |
| **Evidence** | `app/api/v1/health/route.ts:1-13` |

This is a liveness check, not a readiness check — it cannot detect a Supabase outage.

### NFR-REL-003: Migration discipline

| Aspect | Value |
|---|---|
| **Target** | Not stated in code, but observed as a consistent pattern |
| **Implementation** | 68 sequentially numbered, additive migrations; several later migrations explicitly extend earlier functions via `create or replace` rather than destructive rewrites (e.g. `0039` retrofits `0038`'s function; `0054`'s trigger extends `0046`'s, "0046 untouched") |
| **Evidence** | Migration file naming/content pattern; ADR-0012 explicitly cites this as precedent |

### NFR-REL-004: Retry / circuit-breaker logic

| Aspect | Value |
|---|---|
| **Target** | None found |
| **Implementation** | Not implemented — no retry/backoff wrapper around external calls (Jira import, Resend) was traced in this pass |
| **Evidence** | Absence — **Discovery Gap**, not exhaustively grepped across `lib/jira/` |

### NFR-REL-005: Backups / disaster recovery

| Aspect | Value |
|---|---|
| **Target** | Not found in application code — platform-level Supabase concern |
| **Implementation** | Not independently verifiable from this repo |
| **Evidence** | — |

**Needs Review.**

---

## 4. Scalability

### NFR-SCALE-001: Stateless API

| Aspect | Value |
|---|---|
| **Target** | Horizontal scale-out without sticky sessions |
| **Implementation** | API routes are Next.js Route Handlers on Vercel's serverless/edge runtime; no in-memory session state found (auth state lives in the JWT cookie or the Bearer token, not server memory) |
| **Evidence** | `middleware.ts` (stateless cookie read per-request), `lib/api/handler.ts` (no module-level mutable state) |

### NFR-SCALE-002: Realtime fan-out

| Aspect | Value |
|---|---|
| **Target** | Live Run/step updates push to connected clients without polling |
| **Implementation** | Supabase Realtime (Postgres Changes on `run_steps`/`runs`), scoped by existing RLS so a subscriber only receives changes for data they can already read — **status Proposed at time of this discovery**, first use of this mechanism in the codebase |
| **Evidence** | ADR-0010 |

Flagged risk in the ADR itself: no existing test/mocking pattern for this mechanism yet; reconnect/reconciliation behavior is a real implementation detail not yet fully accounted for.

### NFR-SCALE-003: Background job processing

| Aspect | Value |
|---|---|
| **Target** | Not found |
| **Implementation** | No queue dependency (`bullmq`, `pg-boss`, etc.) in `package.json`. `import_jobs` table exists (`0019_import_jobs.sql`) but its execution model (cron? synchronous? on-demand?) was not traced in this pass |
| **Evidence** | `package.json` absence check; `0019_import_jobs.sql` existence |

**Discovery Gap.**

### NFR-SCALE-004: Database scaling

| Aspect | Value |
|---|---|
| **Target** | Not found |
| **Implementation** | Single Supabase Postgres project, shared across local/staging/production (Phase 1 finding — same `db_project_ref`). No read replica, no sharding, no partitioning found |
| **Evidence** | Phase 1 `.context/project-config.md` §Database |

---

## 5. Observability

### NFR-OBS-001: Structured request logging

| Aspect | Value |
|---|---|
| **Target** | Every API request/response logged with a correlation id |
| **Implementation** | Single-line JSON logs to stdout (Vercel-indexable), emitted by every `withApiHandler`-wrapped route: `{ level, ts, component: 'api', request_id, method, path, status, duration_ms, error_code?, message? }` |
| **Evidence** | `lib/api/logging.ts:1-34`, `lib/api/handler.ts:83-107` |

This is the **entire** observability stack found in this codebase.

### NFR-OBS-002: Application Performance Monitoring (APM)

| Aspect | Value |
|---|---|
| **Target** | Not found |
| **Implementation** | **Not implemented** — no `@sentry/*`, `@datadog/*`, `newrelic`, or `@opentelemetry/*` dependency in `package.json` (confirmed independently in this pass, corroborating Phase 1's `project-config.md` finding) |
| **Evidence** | `package.json` full dependency list |

### NFR-OBS-003: Product analytics

| Aspect | Value |
|---|---|
| **Target** | Not found |
| **Implementation** | **Not implemented** — no `posthog-js` or equivalent dependency |
| **Evidence** | `package.json` |

### NFR-OBS-004: Alerting

| Aspect | Value |
|---|---|
| **Target** | Not found |
| **Implementation** | **Not implemented** — no alerting mechanism found; nothing consumes the stdout logs beyond whatever Vercel's own log retention provides |
| **Evidence** | Absence |

This directly confirms and does not contradict the Phase 2 PRD's own finding (`executive-summary.md` §3): "No analytics/telemetry SDK call site was located... any metric is therefore Inferred, not Tracked."

---

## 6. Compliance

| Framework | Status |
|---|---|
| SOC 2 | Needs Review — no audit-log/control-mapping artifact found; `activity_log`/`0045_activity_stream.sql` exists as a partial audit trail but was not evaluated against SOC 2 control requirements in this pass |
| GDPR | Needs Review — no data-export or account-deletion endpoint was found in the `app/api/v1/` route listing; the target's own planning doc claims "workspace owners can request data export + deletion via Settings" but no corresponding route (`/settings/*` DELETE or export endpoint) was located in this pass |
| HIPAA / PCI-DSS | Not applicable — no health or payment data handled by this product's domain model (Workspace/Project/ATC/Test/Run/Bug/Milestone) |

**All compliance claims here are "Needs Review," not "Compliant" or "Non-compliant"** — this is a discovery limitation (no policy document, no DPA, no audit artifact found in-repo), not a security finding.

---

## Discovery Gaps

- [ ] No load-testing evidence exists anywhere — every performance number in the target's own planning doc is an aspiration, not a measurement. QA should treat performance NFRs as **unverified** until a dedicated load-test pass (k6/Artillery) establishes a baseline.
- [ ] Connection pooling configuration (Supavisor / direct connection limits) not found in this pass.
- [ ] `import_jobs` execution model (sync/cron/queue) not traced.
- [ ] GDPR data-export/deletion endpoint not located — either unbuilt or not discovered in this pass; needs direct confirmation before treating it as a testable feature.
- [ ] Backup/DR posture is entirely platform-delegated (Supabase) and not independently verifiable from this repo.
- [ ] Retry/backoff behavior around the Jira import and Resend email integrations not traced.
- [ ] 22 of 24 unbound `SECURITY DEFINER` functions (NFR-SEC-003) — known, tracked debt; material to security test planning but explicitly out of scope for inline remediation per ADR-0012.

## QA Relevance

| NFR | Testable? | Suggested approach |
|---|---|---|
| NFR-SEC-001/002 (auth unification, RLS+capability) | Yes | Cookie-vs-PAT parity test matrix per route; cross-workspace negative tests |
| NFR-SEC-003 (RPC actor bind) | Yes, narrowly | Identity-spoofing negative test against the 22 unbound functions listed in ADR-0012 (low severity, real) |
| NFR-SEC-005 (OTP verification) | Yes | Attempt session/PAT issuance without completing OTP — must fail on both rails |
| NFR-SEC-007 (activity-feed PII) | Yes | Confirm `bunkai_resolve_activity_actors` never resolves a non-co-member's email |
| NFR-SEC-008 (rate limiting) | Yes, and worth prioritizing | The 5 auth routes rely entirely on Supabase's platform throttling; `check-email` specifically bypasses GoTrue — a targeted brute-force/enumeration test against `check-email` is high-value given the documented, unmitigated gap |
| NFR-PERF-* | Not yet — no environment/tooling exists in-repo | Load testing (k6/Artillery) is a prerequisite before any performance NFR can move from "target" to "verified" |
| NFR-OBS-* | Not directly testable via UI/API | Confirm the `x-request-id` header round-trips through error responses (the one observability contract that IS testable end-to-end) |
| NFR-SCALE-002 (Realtime) | Yes, and flagged as untested by the ADR itself | Reconnect/reconciliation behavior on a dropped Realtime channel during an active Run — no existing test pattern per ADR-0010 |

## Sources Used

- `upex-bunkai-tms/lib/api/{handler,logging,idempotency,principal,user-jwt}.ts`
- `upex-bunkai-tms/next.config.ts`, `upex-bunkai-tms/package.json`
- `upex-bunkai-tms/app/api/v1/health/route.ts`
- `upex-bunkai-tms/supabase/migrations/{0005,0008,0009,0059,0060,0061}*.sql`
- `upex-bunkai-tms/.context/ADR/ADR-0001, 0002, 0005, 0006, 0007, 0008, 0010, 0011, 0012`
- `upex-bunkai-tms/.context/SRS/non-functional-specs.md` (read as accelerant, treated as pre-implementation planning narrative — see note above)
- Phase 1 (this repo): `.context/project-config.md` §Infrastructure (no CI/CD, no Sentry/PostHog dependency — corroborated independently in this pass)
- Phase 2 PRD (this repo): `.context/PRD/executive-summary.md` §3 (no telemetry finding — corroborated)
