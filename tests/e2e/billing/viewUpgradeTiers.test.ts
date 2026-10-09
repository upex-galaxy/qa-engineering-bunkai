/**
 * BK-230 upgrade view, owner on community: tier comparison (BK-800), the
 * Enterprise contact path (BK-806) and the seat stepper bounds (BK-814, UI leg).
 *
 * Project: e2e (depends on ui-setup). The API side of `{ test }` shares the
 * browser session (page.request), so it reads the same workspace the UI shows.
 */

import type { TierExpectation } from '@ui/BillingPage';

import { expect, test } from '@TestFixture';

// lib/billing/plan-tiers.ts
const EXPECTED_TIERS: TierExpectation[] = [
  { plan: 'community', seats: '5', projects: '3', retention: '30d' },
  { plan: 'cloud', seats: '25', projects: '50', retention: '90d' },
  { plan: 'enterprise', seats: 'unlimited', projects: 'unlimited', retention: 'unlimited' },
];

test.describe('BK-230: Validate the billing upgrade view for a community owner', { tag: ['@regression'] }, () => {
  test.beforeEach(async ({ test: fixture }) => {
    const ownWorkspace = (await fixture.api.home.listWorkspaces()).find(workspace => workspace.role === 'owner' && workspace.plan === 'community');
    test.skip(!ownWorkspace, 'the test user owns no community workspace');
    await fixture.ui.home.useWorkspace(ownWorkspace!.id);
    await fixture.ui.billing.goto();
  });

  test('BK-800: should display the three tiers with their limits, mark the current plan and show no numeric cloud price when the owner is on community', async ({ test: fixture }) => {
    await fixture.ui.billing.viewTierComparison(EXPECTED_TIERS);
  });

  test('BK-806: should offer only a sales mailto contact and mount no payment fields when the owner looks at the Enterprise tier', async ({ test: fixture }) => {
    await fixture.ui.billing.viewEnterpriseContactPath();
  });

  test('BK-814: should keep the seat quantity within the allowed range when the owner uses the seat stepper', async ({ test: fixture }) => {
    const ownWorkspace = (await fixture.api.home.listWorkspaces()).find(workspace => workspace.role === 'owner' && workspace.plan === 'community');
    const [overviewResponse, overview] = await fixture.api.billing.getBillingOverview(ownWorkspace!.id);
    expect(overviewResponse.status()).toBe(200);

    await fixture.ui.billing.clampSeatQuantityToBounds({ min: Math.max(1, overview.active_seats), max: 25 });
  });
});
