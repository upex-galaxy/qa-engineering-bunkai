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

import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { AuthApi } from '@api/AuthApi';
import { ExampleApi } from '@api/ExampleApi';
import { HomeApi } from '@api/HomeApi';
import { RunsApi } from '@api/RunsApi';

// ============================================
// API Fixture Class
// ============================================

export class ApiFixture extends ApiBase {
  /** Auth component - handles login and token management */
  readonly auth: AuthApi;

  /** Example component - reference only */
  readonly example: ExampleApi;

  /** Home component - BK-256 active-runs widget helpers */
  readonly home: HomeApi;

  /** Runs component - BK-256 run-lifecycle precondition helpers */
  readonly runs: RunsApi;

  constructor(options: TestContextOptions) {
    super(options);

    // All components receive the same options (same request context)
    this.auth = new AuthApi(options);
    this.example = new ExampleApi(options);
    this.home = new HomeApi(options);
    this.runs = new RunsApi(options);
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
    this.example.setAuthToken(token);
    this.home.setAuthToken(token);
    this.runs.setAuthToken(token);
  }

  /**
   * Clear authentication token from all API components.
   */
  override clearAuthToken() {
    super.clearAuthToken();
    this.auth.clearAuthToken();
    this.example.clearAuthToken();
    this.home.clearAuthToken();
    this.runs.clearAuthToken();
  }
}
