/**
 * KATA Architecture - Layer 3: Billing Page Component
 *
 * UI component for the self-serve upgrade view (`/settings/billing/upgrade`,
 * components/billing/UpgradeView.tsx in the app — BK-230).
 *
 * The view targets the caller's active workspace (`bk_active_ws` cookie, see
 * HomePage.useWorkspace); with none set it falls back to the oldest one.
 */

import type { TestContextOptions } from '@TestContext';

import { expect } from '@playwright/test';
import { UiBase } from '@ui/UiBase';
import { atc } from '@utils/decorators';

/** The one client-facing message every billing route uses for an unconfigured processor (lib/billing/stripe.ts). */
const PAYMENT_PROCESSOR_UNAVAILABLE_MESSAGE = 'Payments are temporarily unavailable. Please try again later.';

// ============================================
// Billing Page Component
// ============================================

export class BillingPage extends UiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Navigation (Public)
  // ============================================

  /** Navigate to the upgrade view and wait for the plan comparison to resolve. */
  async goto(): Promise<void> {
    await this.page.goto(this.buildUrl('/settings/billing/upgrade'));
    await this.page.getByTestId('upgrade-comparison').waitFor();
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: an owner continuing to payment while the processor is unavailable
   * sees only the generic message and stays on the upgrade view (BK-827).
   *
   * Precondition (set by the test): the checkout response is a 503
   * `payment_processor_unavailable` — real or mocked with page.route.
   */
  @atc('BK-1110')
  async continueToPaymentShowsGenericProcessorError(): Promise<void> {
    const upgradeUrl = this.page.url();

    await this.page.getByTestId('upgrade-cta-cloud').click();
    const checkoutResponse = this.page.waitForResponse(
      response => response.url().includes('/billing/checkout') && response.request().method() === 'POST',
    );
    await this.page.getByTestId('upgrade-continue-to-payment').click();
    expect((await checkoutResponse).status()).toBe(503);

    const error = this.page.getByTestId('upgrade-checkout-error');
    await expect(error).toHaveText(PAYMENT_PROCESSOR_UNAVAILABLE_MESSAGE);
    await expect(error).not.toContainText(/stripe|configured/i);
    await expect(this.page).toHaveURL(upgradeUrl);
  }
}
