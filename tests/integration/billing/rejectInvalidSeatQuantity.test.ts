/**
 * BK-814 (BK-230 TC8): out-of-range or wrongly typed seat quantities are
 * rejected and no checkout starts. Range: [active_seats, 25].
 *
 * Project: integration (depends on api-setup). Auth: cookie session (ADR-0002).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-814: Validate seat quantity rejection on billing checkout', { tag: ['@regression'] }, () => {
  // The smoke project applies the browser storageState to `request`; start from
  // an empty cookie jar so the identity is the one the test sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-814: should reject the seat quantity with a validation error and create no checkout when it is out of range or not a whole number', async ({ api }) => {
    await api.useCookieSession(config.testUser);
    const ownWorkspace = (await api.home.listWorkspaces()).find(workspace => workspace.role === 'owner' && workspace.plan === 'community');
    test.skip(!ownWorkspace, 'the test user owns no community workspace');

    const [overviewResponse, overview] = await api.billing.getBillingOverview(ownWorkspace!.id);
    expect(overviewResponse.status()).toBe(200);
    const minSeats = Math.max(1, overview.active_seats);

    const outOfRange: unknown[] = [0, -1, 26, 1000];
    if (minSeats > 1) {
      outOfRange.push(minSeats - 1);
    }
    for (const seatQuantity of outOfRange) {
      await api.billing.startCheckoutWithInvalidSeatQuantity({ workspaceId: ownWorkspace!.id, seatQuantity, expectedCode: 'seat_quantity_invalid' });
    }

    for (const seatQuantity of [1.5, '5', null]) {
      await api.billing.startCheckoutWithInvalidSeatQuantity({ workspaceId: ownWorkspace!.id, seatQuantity, expectedCode: 'validation_failed' });
    }
  });
});
