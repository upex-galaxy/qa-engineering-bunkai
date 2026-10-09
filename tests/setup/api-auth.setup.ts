/**
 * KATA Architecture - API Auth Setup (Project)
 *
 * Authenticates via API directly using AuthApi.authenticateSuccessfully() ATC.
 * Persists the Bearer PAT minted by POST /api/v1/auth/signin for use by
 * Integration tests (ADR-0002).
 *
 * Dependencies: global-setup
 * Dependents: integration
 */

import type { ApiState } from '@data/types';

import { writeFileSync } from 'node:fs';
import { test as setup } from '@TestFixture';
import { attachRequestResponseToAllure } from '@utils/allure';
import { config } from '@variables';

const apiStateFile = config.auth.apiStatePath;

/**
 * API Authentication Setup
 *
 * 1. Uses AuthApi.authenticateSuccessfully() ATC
 * 2. Saves the minted PAT to api-state.json for integration tests
 */
setup('API Setup: authenticate via API', async ({ api }) => {
  console.log('[API Setup] Starting API authentication...');
  console.log(`[API Setup] Target: ${config.apiUrl}${config.auth.loginEndpoint}`);

  // Short-lived PAT: every setup run mints a new one, so do not let them pile up
  const credentials = {
    email: config.testUser.email,
    password: config.testUser.password,
    pat_expires_in_days: 1,
  };
  const [response, signinData] = await api.auth.authenticateSuccessfully(credentials);

  // Attach to Allure for debugging (secrets masked)
  await attachRequestResponseToAllure({
    url: response.url(),
    method: 'POST',
    responseBody: { user: signinData.user, pat: { ...signinData.pat, token: '***' } },
    requestBody: { email: credentials.email, password: '***' },
  });

  console.log('[API Setup] Authentication successful');
  console.log(`[API Setup] PAT scopes: ${signinData.pat.scopes.join(', ')}`);
  console.log(`[API Setup] PAT expires at: ${signinData.pat.expires_at ?? 'never'}`);

  // Save the PAT to file for use by integration tests
  const expiresIn = signinData.pat.expires_at
    ? Math.max(0, Math.floor((Date.parse(signinData.pat.expires_at) - Date.now()) / 1000))
    : 0;
  const apiState: ApiState = {
    token: signinData.pat.token,
    tokenType: 'bearer',
    expiresIn,
    refreshToken: null,
    source: 'api-login',
    createdAt: new Date().toISOString(),
  };

  writeFileSync(apiStateFile, JSON.stringify(apiState, null, 2));
  console.log(`[API Setup] Token saved to ${apiStateFile}`);
});
