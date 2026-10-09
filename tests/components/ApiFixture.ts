/**
 * KATA Architecture - Layer 4: API Fixture
 *
 * Dependency Injection container for all API components.
 * Provides unified access to API testing capabilities.
 *
 * All API components share the same request context from TestContext,
 * ensuring consistent authentication and request configuration.
 *
 * HOW TO ADD NEW API COMPONENTS:
 * 1. Create your component in tests/components/api/YourApi.ts
 * 2. Import it here
 * 3. Add as readonly property
 * 4. Initialize in constructor passing the options
 */

import type { SigninBody, SigninResponse } from '@schemas/auth.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { AuthApi } from '@api/AuthApi';
import { BillingApi } from '@api/BillingApi';
import { BugsApi } from '@api/BugsApi';
import { ExampleApi } from '@api/ExampleApi';
import { HomeApi } from '@api/HomeApi';
import { ModulesApi } from '@api/ModulesApi';
import { RunsApi } from '@api/RunsApi';
import { TokensApi } from '@api/TokensApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** Auth component - handles login and token management */
  readonly auth: AuthApi;

  /** Billing component - BK-230 checkout hardening (BK-818 / BK-1110 / BK-1111) */
  readonly billing: BillingApi;

  /** Bugs component - BK-260 bug-triage precondition helpers */
  readonly bugs: BugsApi;

  /** Example component - reference only */
  readonly example: ExampleApi;

  /** Home component - BK-256 active-runs widget + BK-260 recent-activity widget helpers */
  readonly home: HomeApi;

  /** Modules component - BK-260 module-management precondition helpers */
  readonly modules: ModulesApi;

  /** Runs component - BK-256 run-lifecycle precondition helpers */
  readonly runs: RunsApi;

  /** Tokens component - PAT mint/revoke precondition helpers (ADR-0002) */
  readonly tokens: TokensApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.auth = new AuthApi(options);
    this.billing = new BillingApi(options);
    this.bugs = new BugsApi(options);
    this.example = new ExampleApi(options);
    this.home = new HomeApi(options);
    this.modules = new ModulesApi(options);
    this.runs = new RunsApi(options);
    this.tokens = new TokensApi(options);
  }

  // ============================================
  // Token Propagation to Child Components
  // ============================================

  /**
   * Set authentication token for all API components.
   * This ensures all components use the same token for authenticated requests.
   */
  override setAuthToken(token: string) {
    super.setAuthToken(token);
    this.auth.setAuthToken(token);
    this.billing.setAuthToken(token);
    this.bugs.setAuthToken(token);
    this.example.setAuthToken(token);
    this.home.setAuthToken(token);
    this.modules.setAuthToken(token);
    this.runs.setAuthToken(token);
    this.tokens.setAuthToken(token);
  }

  /**
   * Switch every API component to cookie-session auth (ADR-0002).
   *
   * Signs in (the session cookie lands in the shared APIRequestContext) and
   * drops the Bearer PAT injected from `.auth/api-state.json`, so requests
   * authenticate by cookie only. Required for cookie-only routes such as
   * POST /api/v1/tokens and for tests asserting cookie-session behavior.
   */
  async useCookieSession(credentials: SigninBody): Promise<SigninResponse> {
    const body = await this.auth.signInWithCookieSession(credentials);
    this.clearAuthToken();
    return body;
  }

  /**
   * Clear authentication token from all API components.
   */
  override clearAuthToken() {
    super.clearAuthToken();
    this.auth.clearAuthToken();
    this.billing.clearAuthToken();
    this.bugs.clearAuthToken();
    this.example.clearAuthToken();
    this.home.clearAuthToken();
    this.modules.clearAuthToken();
    this.runs.clearAuthToken();
    this.tokens.clearAuthToken();
  }
}
