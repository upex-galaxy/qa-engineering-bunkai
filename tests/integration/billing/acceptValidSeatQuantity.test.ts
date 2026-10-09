/**
 * BK-813 (BK-230 TC7): seat quantities inside [active_seats, 25] pass seat
 * validation and reach the payment step (Checkout URL with a processor, the
 * processor's own 503 without one).
 *
 * Project: integration (depends on api-setup). Auth: cookie session (ADR-0002).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-813: Validate seat quantity acceptance on billing checkout', { tag: ['@regression'] }, () => {
  // The smoke project applies the browser storageState to `request`; start from
  // an empty cookie jar so the identity is the one the test sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-813: should accept the seat quantity and reach the payment step when it is at each valid boundary', async ({ api }) => {
    await api.useCookieSession(config.testUser);
    const ownWorkspace = (await api.home.listWorkspaces()).find(workspace => workspace.role === 'owner' && workspace.plan === 'community');
    test.skip(!ownWorkspace, 'the test user owns no community workspace');

    const [overviewResponse, overview] = await api.billing.getBillingOverview(ownWorkspace!.id);
    expect(overviewResponse.status()).toBe(200);
    const minSeats = Math.max(1, overview.active_seats);

    // Boundaries: min, min + 1, max - 1, max (deduplicated for small workspaces)
    const boundaries = [...new Set([minSeats, minSeats + 1, 24, 25])].filter(seats => seats <= 25);
    for (const seatQuantity of boundaries) {
      await api.billing.startCheckoutWithValidSeatQuantity({ workspaceId: ownWorkspace!.id, seatQuantity });
    }
  });
});
