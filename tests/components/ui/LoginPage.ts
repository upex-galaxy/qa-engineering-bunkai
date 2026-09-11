/**
 * KATA Architecture - Layer 3: Login Page Component
 *
 * UI component for authentication via the login page.
 * Handles login flows for E2E tests.
 *
 * TODO: Replace 'PROJ' in @atc IDs with your Jira project key (e.g., @atc('UPEX-101'))
 *
 * Page: /login (UPEX Dojo)
 * Locators (data-testid):
 * - Email: [data-testid="login-email-input"]
 * - Password: [data-testid="login-password-input"]
 * - Submit: [data-testid="login-submit-button"]
 * - Error: [data-testid="login-error"]
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc, step } from '@utils/decorators';

// ============================================
// Types - Login data structures
// ============================================

/**
 * Login credentials for UI authentication
 * Note: UPEX Dojo uses 'email' field instead of 'username'
 */
export interface LoginCredentials {
  email: string
  password: string
}

// ============================================
// Login Page Component
// ============================================

export class LoginPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /**
   * Fill login form and submit
   * Helper that combines fill + submit actions
   *
   * BK-256 FIX (2026-09-11): the real Bunkai login is an email-first,
   * 2-step flow (app/(auth)/login/email-first-form.tsx) — fill email,
   * click Continue, THEN the password field renders and Sign in submits.
   * There is no single-step form / no `*-input`/`*-submit-button` testids;
   * this component's locators never matched the live app (still the
   * generic scaffold). Corrected to the real testids/steps so ui-auth.setup.ts
   * — and every e2e test depending on it — can authenticate at all.
   */
  private async fillAndSubmitLoginForm(credentials: LoginCredentials): Promise<void> {
    await this.page.locator('[data-testid="login-email"]').fill(credentials.email);
    await this.page.locator('[data-testid="login-continue"]').click();
    const passwordInput = this.page.locator('[data-testid="login-password"]');
    await passwordInput.waitFor();
    await passwordInput.fill(credentials.password);
    await this.page.locator('[data-testid="login-signin"]').click();
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /**
   * Navigate to the login page
   * Call this BEFORE using login ATCs
   */
  @step
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/login'));
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: Login with valid credentials - expects success
   *
   * IMPORTANT: Call goto() before this ATC.
   * Fills credentials, submits, and verifies redirect away from login page.
   *
   * @param credentials - Email and password
   */
  @atc('PROJ-101')
  async loginSuccessfully(credentials: LoginCredentials): Promise<void> {
    await this.fillAndSubmitLoginForm(credentials);

    // Wait for authentication to complete and redirect
    await this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    await expect(this.page).not.toHaveURL(/.*\/login.*/);
  }

  /**
   * ATC: Login with invalid credentials - expects error
   *
   * IMPORTANT: Call goto() before this ATC.
   * Fills invalid credentials, submits, and verifies error message.
   *
   * @param credentials - Invalid email or password
   */
  @atc('PROJ-102')
  async loginWithInvalidCredentials(credentials: LoginCredentials): Promise<void> {
    await this.fillAndSubmitLoginForm(credentials);

    // Fixed assertion - error should be visible (UPEX Dojo uses data-testid="login-error")
    const errorIndicator = this.page.locator('[data-testid="login-error"]');
    await expect(errorIndicator).toBeVisible({ timeout: 5000 });
    await expect(this.page).toHaveURL(/.*\/login.*/);
  }
}
