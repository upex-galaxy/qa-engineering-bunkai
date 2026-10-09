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
// Types
// ============================================

export type PlanKey = 'community' | 'cloud' | 'enterprise';

export interface TierExpectation {
  plan: PlanKey
  seats: string
  projects: string
  retention: string
}

export interface SeatBounds {
  min: number
  max: number
}

// ============================================
// Billing Page Component
// ============================================

export class BillingPage extends UiBase {
  // Shared locators (used in 2+ ATCs)
  private readonly tierCard = (plan: PlanKey) => this.page.getByTestId(`upgrade-tier-${plan}`);
  private readonly upgradeToCloudButton = () => this.page.getByTestId('upgrade-cta-cloud');

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

    await this.upgradeToCloudButton().click();
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

  /**
   * ATC: an owner on community sees the three tiers with their limits, only
   * community marked current, and a qualitative cloud price (BK-230 TC1 + TC3).
   */
  @atc('BK-800')
  async viewTierComparison(expectedTiers: TierExpectation[]): Promise<void> {
    for (const tier of expectedTiers) {
      const card = this.tierCard(tier.plan);
      await expect(card).toContainText(`Seats ${tier.seats}`);
      await expect(card).toContainText(`Projects ${tier.projects}`);
      await expect(card).toContainText(`History retention ${tier.retention}`);
      await expect(card).toHaveAttribute('data-current', String(tier.plan === 'community'));
    }

    const cloudCard = this.tierCard('cloud');
    await expect(cloudCard).toContainText('See your exact rate on the next screen (Stripe Checkout).');
    await expect(cloudCard).not.toContainText(/[$€£]\s?\d|\d+\s?(?:USD|EUR)|\/\s?(?:mo|month|seat)\b/i);
    await expect(this.upgradeToCloudButton()).toBeVisible();
    await expect(this.tierCard('enterprise').getByTestId('upgrade-contact-sales')).toBeVisible();
  }

  /**
   * ATC: the Enterprise tier offers only a sales mailto contact; no payment
   * field is mounted and no checkout request is sent (BK-230 TC12).
   */
  @atc('BK-806')
  async viewEnterpriseContactPath(): Promise<void> {
    const checkoutRequests: string[] = [];
    this.page.on('request', (request) => {
      if (request.url().includes('/billing/checkout')) {
        checkoutRequests.push(request.url());
      }
    });

    const enterpriseCard = this.tierCard('enterprise');
    const contact = enterpriseCard.getByTestId('upgrade-contact-sales');
    await expect(contact).toHaveText('Contact sales');
    await expect(contact).toHaveAttribute('href', /^mailto:[^@\s]+@[^@\s]+$/);
    await expect(enterpriseCard).toContainText('Sales-assisted. No self-serve checkout');
    await expect(enterpriseCard.getByRole('button')).toHaveCount(0);

    await expect(this.page.locator('input[autocomplete^="cc-"], iframe[src*="stripe"]')).toHaveCount(0);
    expect(checkoutRequests).toEqual([]);
  }

  /**
   * ATC: the seat stepper never leaves [min, max] — minus at the minimum and
   * plus at the maximum keep the value (BK-230 TC8, UI leg).
   *
   * @param bounds - min = the workspace's active_seats, max = the Cloud seat cap (25)
   */
  @atc('BK-814')
  async clampSeatQuantityToBounds(bounds: SeatBounds): Promise<void> {
    await this.upgradeToCloudButton().click();
    const count = this.page.getByTestId('upgrade-seat-count');
    const minus = this.page.getByTestId('upgrade-seat-minus');
    const plus = this.page.getByTestId('upgrade-seat-plus');

    await expect(count).toHaveText(String(bounds.min));
    await minus.click({ force: true });
    await expect(count).toHaveText(String(bounds.min));

    for (let seats = bounds.min; seats < bounds.max; seats++) {
      await plus.click();
    }
    await expect(count).toHaveText(String(bounds.max));
    await plus.click({ force: true });
    await expect(count).toHaveText(String(bounds.max));
  }

  /**
   * ATC: a non-owner sees the comparison but no upgrade action — the owner-only
   * note replaces "Upgrade to Cloud" (BK-230 TC14, UI leg).
   */
  @atc('BK-815')
  async viewUpgradeAsNonOwner(): Promise<void> {
    await expect(this.page.getByTestId('upgrade-comparison')).toBeVisible();
    await expect(this.upgradeToCloudButton()).toHaveCount(0);
    await expect(this.page.getByTestId('upgrade-owner-only-note')).toContainText('Only the workspace owner can upgrade the plan.');
  }
}
