# Frontend Infrastructure — Bunkai TMS

> Target repo: `upex-bunkai-tms`. Discovery scope: Phase 3 — Infrastructure, sub-step 2 (`/project-discovery`, run from `qa-engineering-bunkai`).
> Generated: 2026-08-17.
> Read-only discovery — no code, install, build, or dev commands were executed against `upex-bunkai-tms` in this pass.

---

## Runtime / Build Configuration

| Aspect | Value | Found in |
|---|---|---|
| Framework | Next.js `^15`, App Router | `package.json` (`dependencies.next`), `app/` directory (no `pages/` directory found — App Router only, no legacy `pages/` mid-migration) |
| UI library | React `^19` | `package.json` |
| Bundler | Next.js default (Webpack). **No Turbopack flag found** — `package.json` `dev` script is plain `next dev` (no `--turbo`), and `next.config.ts` has no `turbopack` key. Not independently benchmarked; inferred from absence of any Turbopack-enabling config | `package.json` §`scripts.dev`, `next.config.ts` (full 13-line file) |
| Output mode | Server-rendered (RSC) with client components — no `output: 'standalone'`, `output: 'export'`, or ISR `revalidate` config found | `next.config.ts` |
| TypeScript | `^5.9.3`, `strict: true`, `jsx: "preserve"`, target `ES2022` | `tsconfig.json` |
| TypedRoutes | Enabled (`typedRoutes: true`) — compile-time route-string checking | `next.config.ts` |
| Package manager | Bun `>= 1.0.0` | `package.json` scripts, README (Phase 1 finding) |

### `next.config.ts` (full content, reproduced verbatim)

```ts
import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  typedRoutes: true,
  images: {
    remotePatterns: [],
  },
};

export default config;
```

No `headers()`, no `rewrites()`/`redirects()`, no custom webpack function, no `images.domains` — a minimal config. `images.remotePatterns: []` means Next's `<Image>` optimizer currently allows **no** remote image hosts (only local `public/` assets can use `next/image` without erroring).

---

## Local Development Commands

```bash
# 1. Install dependencies
bun install

# 2. Set up environment (client-visible vars only need NEXT_PUBLIC_ prefix — see below)
cp .env.example .env

# 3. Start development server
bun run dev
# -> http://localhost:3000 (default Next.js port, no custom PORT found in scripts)

# 4. Production build + serve (to check build-time output, not routinely needed for UI dev)
bun run build
bun run start
```

---

## Client Environment Variables

Grep for `NEXT_PUBLIC_` across `app/`, `lib/`, `components/`, and `middleware.ts` found exactly 3 in use:

| Variable | Used in | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | app code (auth redirect / OAuth callback / email link base URL construction) | Base URL for the running app |
| `NEXT_PUBLIC_SUPABASE_URL` | `middleware.ts`, `lib/supabase/*.ts` | Supabase project URL (browser-safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `middleware.ts` | Supabase anon/public key for the browser-side client |

**Security check (per discovery doctrine)**: no secret-looking name was found under the `NEXT_PUBLIC_` prefix (e.g. no `NEXT_PUBLIC_..._SECRET_KEY` or `NEXT_PUBLIC_..._SERVICE_ROLE`). No red flag.

**Discovery Gap / naming mismatch** (same finding as `backend.md`): `NEXT_PUBLIC_SUPABASE_ANON_KEY` is read by `middleware.ts` but is **not declared in `.env.example`**, which instead documents `SUPABASE_PUBLISHABLE_KEY` (non-`NEXT_PUBLIC_`-prefixed) as the current-generation key name. Either the client-side Supabase key needs a `NEXT_PUBLIC_` alias of `SUPABASE_PUBLISHABLE_KEY` that isn't documented, or `.env.example` is stale relative to `middleware.ts`. Flagged, not resolved.

### Environment-Specific Values

| Environment | `NEXT_PUBLIC_APP_URL` (inferred) | Notes |
|---|---|---|
| Local | `http://localhost:3000` | `.env.example` default |
| Staging | `https://staging-upexbunkai.vercel.app` (inferred from `.agents/project.yaml` §`environments.staging.web_url`) | Not independently confirmed as the literal `NEXT_PUBLIC_APP_URL` value set in Vercel — no `vercel.json` to check |
| Production | `https://upexbunkai.vercel.app` (inferred from `.agents/project.yaml` §`environments.production.web_url`) | Same caveat — inferred, not confirmed |

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are presumably identical across all three environments given the single shared Supabase project (`db_project_ref: fmbpikzpkafptqximhxn` across local/staging/production per `.agents/project.yaml`) — **not independently confirmed**, since actual Vercel env-var values were not read (read-only discovery, no secret access).

---

## Static Assets

```
public/
  openapi.json          # served static copy of the generated OpenAPI spec
```

App-root metadata icon files (Next.js App Router convention, not under `public/`):

```
app/
  apple-icon.png
  icon.png
  icon.svg
```

**Discovery Gap**: no `robots.ts`/`robots.txt`, no `sitemap.ts`/`sitemap.xml`, no `manifest.ts`/`manifest.json`, and no locale files were found. Given this is an authenticated B2B SaaS tool (not a public marketing site), the absence of `robots`/`sitemap` is plausible by design rather than an oversight, but it was not confirmed either way.

### Image Handling

| Aspect | Value |
|---|---|
| Optimizer | `next/image` available (Next 15 default) but `images.remotePatterns: []` in `next.config.ts` — no remote hosts currently whitelisted |
| Formats | Not configured — Next.js defaults (AVIF/WebP negotiation) apply, no explicit `images.formats` override found |
| CDN / `assetPrefix` | None configured — no `assetPrefix` in `next.config.ts` |

---

## Code Splitting Strategy

**Discovery Gap** — no `dynamic(...)` (Next.js dynamic import) or `React.lazy` usage was targeted-grepped in this pass; App Router's default per-route code splitting applies structurally (each `app/**/page.tsx` is its own chunk), but explicit component-level lazy-loading was not confirmed or denied. Given the presence of a heavy editor dependency (`@monaco-editor/react`), it would be a reasonable candidate for dynamic import, but this was not verified.

---

## Bundle Size Notes

**Discovery Gap** — no `@next/bundle-analyzer` or equivalent dependency found in `package.json`; no bundle-size budget or CI gate exists. Cannot report a measured bundle size. Notable heavy dependencies present (by category, not measured): `@monaco-editor/react` (code editor), `shiki` (syntax highlighter), `@tanstack/react-table`, `@dnd-kit/*` (drag-and-drop), `@scalar/api-reference-react` (API docs UI).

---

## Performance Configuration

| Aspect | Value | Found in |
|---|---|---|
| Image optimization | `next/image` available, no remote hosts whitelisted (see above) | `next.config.ts` |
| Font optimization | **Discovery Gap** — no `next/font` usage or `@fontsource/*` dependency confirmed in this pass |  |
| Prefetching | Next.js App Router default `<Link>` prefetch behavior — not overridden anywhere found |  |
| Script optimization | No `next/script` usage confirmed or denied in this pass — Discovery Gap |  |
| HTTP caching | **Not implemented** — no `Cache-Control` header-setting code found (carried forward from `.context/SRS/non-functional-specs.md` NFR-PERF-002) | `lib/api/handler.ts` |

---

## SEO Configuration

**Discovery Gap** — no dedicated SEO audit was performed. No `robots.ts`/`sitemap.ts` found (see Static Assets above). Per-route `metadata` export usage in `app/**/page.tsx` was not grepped in this pass. Given the authenticated, non-public nature of the product surface, SEO is plausibly out of scope for this app, but that is an inference, not a confirmed product decision.

---

## Browser Support / Polyfills

**Discovery Gap** — no `browserslist` config found in `package.json`; no explicit polyfill package (`core-js`, etc.) in dependencies. Next.js 15 / React 19's own baseline browser support applies by default; no project-specific override was found.

---

## Routing + State + Auth Integration Points

> Consumed later by `/adapt-framework` when wiring the KATA test framework.

| Aspect | Value | Found in |
|---|---|---|
| Router | Next.js App Router — `app/(app)/*` (authenticated routes: projects, ATCs, tests, runs, bugs, milestones, metrics, traceability, settings, workspaces) and `app/(auth)/*` (login/signup). Full route tree already mapped in `.context/PRD/user-journeys.md` — not re-derived here | `.context/SRS/architecture.md` §4 (carried forward) |
| Route protection | `middleware.ts` — `PROTECTED_PREFIXES = ['/home','/projects','/onboarding','/settings','/activity']`, session-presence check only (redirects to `/login?next=<path>` if no cookie session). Does **not** resolve fine-grained capabilities — that happens per-API-route via `withApiHandler` | `middleware.ts` |
| Global state | **No dedicated state-management library** — no Zustand, Redux, Jotai, Recoil, or NgRx dependency in `package.json`. Confirmed by dependency-list grep (`zustand\|redux\|jotai\|recoil` → no matches) | `package.json` full dependency list |
| Data fetching | **No TanStack Query, SWR, Apollo, Relay, or RTK Query dependency found.** Relies on native `fetch` plus React Server Components / Server Actions patterns typical of the App Router | `package.json` full dependency list — grep for `@tanstack/react-query\|swr\|apollo\|relay\|rtk-query` returned no matches (note: `@tanstack/react-table` IS present but is a table UI library, unrelated to data fetching) |
| Realtime client | Supabase Realtime (Postgres Changes) — used for live Run/step and notification updates; status **Proposed** per ADR-0010, first use of this mechanism in the codebase | `lib/runs/realtime-run-channel.ts`, `lib/notifications/realtime-notifications-channel.ts` (carried forward from `.context/SRS/architecture.md`) |
| Auth client | Supabase Auth via `@supabase/ssr` — cookie session for browser callers, Bearer PAT (`bk_pat_*`) for headless callers. No NextAuth/Clerk/Auth0 | `middleware.ts`, `lib/supabase/{client,server}.ts` |
| Design system / component library | `shadcn/ui`-style setup — `components.json` present at repo root: style `new-york`, RSC enabled, Tailwind CSS variables, base color `neutral`, icon library `lucide`. Aliases: `components` → `@components`, `ui` → `@components/ui`, `utils` → `@lib/utils`, `hooks` → `@lib/hooks` | `components.json` (full file read) |
| Component primitives | Radix UI (`@radix-ui/react-dialog`, `-dropdown-menu`, `-tabs`, `-tooltip`), `cmdk` (command palette), `sonner` (toasts) | `package.json` |
| Notable domain UI | `@monaco-editor/react` (ATC step editor), `@tanstack/react-table` (table views), `@dnd-kit/*` (drag-and-drop) | `package.json` |
| Test IDs strategy | **`data-testid` confirmed as the project's convention** — 430 occurrences across 47 files under `components/`, spanning nearly every domain (`traceability`, `bugs`, `home`, `runs`, `settings`, `tests`, `atcs`, `milestones`, `notifications`, `layout`). No `data-cy` or other selector convention found | Grep: `data-testid` in `components/**` → 430 matches / 47 files |
| Styling | Tailwind CSS `^3.4` + `class-variance-authority` + `tailwind-merge`, config at `tailwind.config.ts`, CSS entry `app/globals.css` | `package.json`, `components.json` §`tailwind` |

---

## Discovery Gaps

- [ ] Bundler choice (Webpack vs Turbopack) inferred from absence of `--turbo`/`turbopack` config, not independently benchmarked by running `next dev`/`next build`.
- [ ] Code-splitting / dynamic-import usage not grepped — presence of `dynamic(...)` or `React.lazy` around heavy components (Monaco editor especially) not confirmed.
- [ ] Bundle size — no measurement tooling exists in-repo; cannot report actual KB figures.
- [ ] Font optimization, `next/script` usage, and SEO `metadata` export usage — not grepped in this pass.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` read by `middleware.ts` is undocumented in `.env.example` (see also `backend.md`) — naming mismatch not resolved.
- [ ] Per-environment values for `NEXT_PUBLIC_APP_URL` / Supabase client vars in staging/production Vercel deployments are inferred from `.agents/project.yaml` environment URLs, not read directly from Vercel (no `vercel.json`, no dashboard access in this session).
- [ ] `robots.ts`/`sitemap.ts`/`manifest.ts` absence — plausible-by-design for an authenticated SaaS tool, not confirmed as an intentional product decision vs. an oversight.

**Carried-forward, not re-resolved here** (see `.context/project-config.md` and `.context/SRS/architecture.md`):
- `.agents/project.yaml` environment/domain conflict between the two repos (`upexbunkai.vercel.app` vs `bunkai.io`).
- Target repo's working branch observed as `staging`, not `main` — see `backend.md` Discovery Gaps for the fuller `git_strategy` cross-reference found in this pass.
