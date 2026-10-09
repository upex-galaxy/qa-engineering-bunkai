/**
 * KATA Architecture - Layer 3: Tokens API Component
 *
 * Personal access token (PAT) management, used as precondition setup by the
 * checkout capability tests (BK-1111). Helpers only — no BK-* Test covers
 * token issuance itself yet.
 *
 * POST /api/v1/tokens is cookie-only by design (a PAT cannot mint a PAT), so
 * callers mint from a cookie session (`ApiFixture.useCookieSession()`) and
 * revoke every minted token in teardown (ADR-0002).
 *
 * Endpoints:
 * - POST   /api/v1/tokens       - mint a PAT (secret returned once)
 * - DELETE /api/v1/tokens/{id}  - revoke a PAT
 */

import type { APIResponse } from '@playwright/test';
import type { CreateTokenBody, CreateTokenResult } from '@schemas/billing.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

export type { CreateTokenBody, CreateTokenResult } from '@schemas/billing.types';

// ============================================
// Tokens API Component
// ============================================

export class TokensApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Precondition setup (no @atc)
  // ============================================

  /**
   * Helper: mint a PAT. No assertions — callers assert the outcome they
   * expect (201 for setup, 403 for issuance guards).
   *
   * @param body - Token scopes, optional workspace binding, TTL
   * @param bearer - Optional explicit Bearer (to probe the PAT-cannot-mint-PAT guard)
   */
  @step
  async mintToken(body: CreateTokenBody, bearer?: string): Promise<[APIResponse, CreateTokenResult]> {
    const options = bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {};
    const [response, result] = await this.apiPOST<CreateTokenResult, CreateTokenBody>('/v1/tokens', body, options);
    return [response, result];
  }

  /**
   * Helper: revoke a PAT. Silent-fail (returns the status) so teardown never
   * masks the test's own failure.
   */
  @step
  async revokeToken(tokenId: string): Promise<number> {
    const [response] = await this.apiDELETE(`/v1/tokens/${tokenId}`);
    return response.status();
  }
}
