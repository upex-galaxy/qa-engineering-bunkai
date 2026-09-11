/**
 * KATA Architecture - UI Auth Setup
 *
 * Authenticates via the login page UI and intercepts the JWT token
 * using page.waitForResponse() - single authentication, no separate API call.
 *
 * This provides BOTH:
 * - Browser session (storageState) for UI tests
 * - API token (intercepted) for API calls within E2E tests
 *
 * Dependencies: global-setup
 * Dependents: e2e
 */

import type { ApiState } from '@data/types';

import { writeFileSync } from 'node:fs';
import { test as setup } from '@TestFixture';
import { attachRequestResponseToAllure } from '@utils/allure';
import { config } from '@variables';

const storageStateFile = config.auth.storageStatePath;
const apiStateFile = config.auth.apiStatePath;

/**
 * Real `POST /api/v1/auth/signin` response shape (BK-256 fix, 2026-09-11):
 * the previous `TokenResponse` type (still the pre-sync
 * `api/schemas/auth.types.ts` stub) modeled a generic top-level Bearer-JWT
 * shape this app never had. The real response carries THREE distinct
 * things (`components["schemas"]["SigninResponse"]` in
 * api/openapi-types.ts): `session` (Supabase cookie-session tokens — the
 * browser already has these via Set-Cookie, captured below by
 * `storageState()`) and `pat` (a freshly-minted Bearer Personal Access
 * Token, "so the caller can immediately authenticate subsequent requests
 * without a browser" per the endpoint doc). Standalone API-only requests
 * (no page/cookies — the `{ api }` fixture used outside a browser context)
 * need the PAT, not the session token — a raw Supabase session token is
 * not accepted as a Bearer credential by this API.
 */
interface BunkaiSigninResponse {
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    token_type?: string
  }
  pat: {
    token: string
    expires_at: string | null
  }
}

/**
 * UI Authentication Setup
 *
 * 1. Navigates to login page (via LoginPage.goto())
 * 2. Sets up response interception BEFORE triggering login
 * 3. Uses LoginPage.loginSuccessfully() ATC (triggers login + token fetch)
 * 4. Captures JWT token from intercepted response
 * 5. Saves storageState (cookies) for UI tests
 * 6. Saves api-state (token) for API integration
 */
setup('UI Setup: authenticate via UI', async ({ ui, page }) => {
  console.log('[UI Setup] Starting UI authentication...');
  console.log('[UI Setup] Target: /login');

  // Navigate to login page (outside of ATC)
  await ui.login.goto();

  // Credentials for login
  const credentials = {
    email: config.testUser.email,
    password: config.testUser.password,
  };

  // Set up response interception BEFORE triggering login
  // The login UI calls /api/auth/login after successful NextAuth sign-in
  const tokenPromise = page.waitForResponse(
    resp => resp.url().includes(config.auth.tokenEndpoint)
      && resp.request().method() === 'POST'
      && resp.status() === 200,
    { timeout: 30000 },
  );

  // Use LoginPage ATC - triggers NextAuth sign-in + token fetch
  await ui.login.loginSuccessfully(credentials);
  console.log('[UI Setup] UI login successful');

  // Capture JWT token from intercepted response
  console.log('[UI Setup] Intercepting token from login response...');
  const response = await tokenPromise;
  const tokenData = (await response.json()) as BunkaiSigninResponse;

  // Attach to Allure for debugging
  await attachRequestResponseToAllure({
    url: response.url(),
    method: 'POST',
    responseBody: tokenData,
    requestBody: { email: credentials.email, password: '***' },
  });

  // Verify a token was obtained
  if (!tokenData?.pat?.token) {
    throw new Error('Signin response missing pat.token');
  }

  console.log('[UI Setup] Token intercepted successfully');

  // Save storage state (cookies + localStorage) for UI tests — the browser
  // already holds the Supabase session cookie via Set-Cookie, so
  // tokenData.session is not needed here.
  await page.context().storageState({ path: storageStateFile });
  console.log(`[UI Setup] Storage state saved to ${storageStateFile}`);

  // Save the Bearer PAT for standalone (no-page) API calls within E2E tests
  const apiState: ApiState = {
    token: tokenData.pat.token,
    tokenType: 'bearer',
    expiresIn: 0,
    refreshToken: null,
    source: 'ui-login',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(apiStateFile, JSON.stringify(apiState, null, 2));
  console.log(`[UI Setup] API token saved to ${apiStateFile}`);

  console.log('[UI Setup] Authentication successful');
  console.log(`[UI Setup] Current URL: ${page.url()}`);
});
