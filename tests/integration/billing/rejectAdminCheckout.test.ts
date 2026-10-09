/**
 * BK-815 (BK-230 TC14), API leg: an admin who is not the owner cannot start
 * checkout.
 *
 * The primary user creates a throw-away workspace and invites the secondary
 * user as admin; the secondary accepts and calls create-checkout. Teardown
 * soft-deletes the workspace (ends the membership, revokes pending invites).
 * Requires `config.secondaryTestUser`.
 *
 * Project: integration (depends on api-setup). Auth: cookie sessions (ADR-0002).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-815: Validate the owner-only gate on billing checkout', { tag: ['@regression', '@security'] }, () => {
  // The smoke project applies the browser storageState to `request`; start from
  // an empty cookie jar so the identity is the one each step sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-815: should reject a direct create-checkout call when the caller is an admin who is not the owner', async ({ api }) => {
    const secondaryUser = config.secondaryTestUser;
    test.skip(!secondaryUser, 'STAGING_USER_2_* is unset: no identity to invite as admin');

    await api.useCookieSession(config.testUser);
    const [createResponse, created] = await api.home.createWorkspace({ name: 'BK-815 admin gate', slug: api.data.generateWorkspaceSlug() });
    expect(createResponse.status()).toBe(201);
    const workspaceId = created.workspace.id;

    try {
      const [inviteResponse, invite] = await api.members.createInvite(workspaceId, { email: secondaryUser!.email, role: 'admin' });
      expect(inviteResponse.status()).toBe(201);

      // Switch the context's session to the invited admin
      await api.useCookieSession(secondaryUser!);
      const acceptResponse = await api.members.acceptInvite(invite.token!);
      expect(acceptResponse.ok()).toBe(true);

      // The admin can view billing but not start checkout
      const [overviewResponse] = await api.billing.getBillingOverview(workspaceId);
      expect(overviewResponse.status()).toBe(200);
      await api.billing.startCheckoutAsAdminMember(workspaceId);
    }
    finally {
      await api.useCookieSession(config.testUser);
      await api.home.deleteWorkspace(workspaceId);
    }
  });
});
