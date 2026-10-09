/**
 * BK-815 (BK-230 TC14), UI leg: an admin who is not the owner sees the tier
 * comparison but no upgrade action.
 *
 * `{ test }` shares one browser context between the API side (page.request)
 * and the UI, so each API sign-in switches the browser identity too: owner
 * first (create workspace + invite), admin last (accept + view). Teardown
 * signs the owner back in and soft-deletes the throw-away workspace.
 * Requires `config.secondaryTestUser`.
 *
 * Project: e2e (depends on ui-setup).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-815: Validate the owner-only upgrade view', { tag: ['@regression', '@security'] }, () => {
  test('BK-815: should show the owner-only note instead of the upgrade action when the viewer is an admin who is not the owner', async ({ test: fixture }) => {
    const secondaryUser = config.secondaryTestUser;
    test.skip(!secondaryUser, 'STAGING_USER_2_* is unset: no identity to invite as admin');
    const { api, ui } = fixture;

    await api.useCookieSession(config.testUser);
    const [createResponse, created] = await api.home.createWorkspace({ name: 'BK-815 admin view', slug: api.data.generateWorkspaceSlug() });
    expect(createResponse.status()).toBe(201);
    const workspaceId = created.workspace.id;

    try {
      const [inviteResponse, invite] = await api.members.createInvite(workspaceId, { email: secondaryUser!.email, role: 'admin' });
      expect(inviteResponse.status()).toBe(201);

      await api.useCookieSession(secondaryUser!);
      const acceptResponse = await api.members.acceptInvite(invite.token!);
      expect(acceptResponse.ok()).toBe(true);

      await ui.home.useWorkspace(workspaceId);
      await ui.billing.goto();
      await ui.billing.viewUpgradeAsNonOwner();
    }
    finally {
      await api.useCookieSession(config.testUser);
      await api.home.deleteWorkspace(workspaceId);
    }
  });
});
