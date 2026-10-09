/**
 * BK-1111 (regression for BK-828): billing checkout capability gate for PATs.
 *
 * A `workspace:admin` PAT bound to the owned workspace passes the gate, and
 * every rejection stays machine-distinguishable. PATs are minted from the
 * cookie session and revoked in teardown (ADR-0002). Requires
 * `config.secondaryTestUser` for the foreign-workspace legs.
 *
 * Project: integration (depends on api-setup).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-1111: Validate billing checkout capability gate for personal access tokens', { tag: ['@regression', '@security'] }, () => {
  // The smoke project applies the browser storageState to `request`; start from
  // an empty cookie jar so the identity is the one the test sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-1111: should let a workspace:admin PAT bound to the owned workspace pass the checkout capability gate and keep rejections distinguishable', async ({ api }) => {
    const secondaryUser = config.secondaryTestUser;
    test.skip(!secondaryUser, 'STAGING_USER_2_* is unset: no identity owns a foreign workspace');

    // Secondary user FIRST: both sign-ins write the same session cookie.
    const secondarySignin = await api.auth.signInWithCookieSession(secondaryUser!);
    const foreignWorkspace = (await api.home.listWorkspaces(secondarySignin.pat.token)).find(workspace => workspace.role === 'owner');
    test.skip(!foreignWorkspace, 'the secondary user owns no workspace');

    // The primary sign-in also mints a default-scope PAT (no workspace:admin)
    const primarySignin = await api.useCookieSession(config.testUser);
    const ownWorkspace = (await api.home.listWorkspaces()).find(workspace => workspace.role === 'owner');
    test.skip(!ownWorkspace, 'the test user owns no workspace');

    const [mintResponse, adminToken] = await api.tokens.mintToken({
      name: 'bk1111-workspace-admin',
      scopes: ['workspace:admin'],
      workspace_id: ownWorkspace!.id,
      expires_in_days: 1,
    });
    expect(mintResponse.status()).toBe(201);

    try {
      await api.billing.startCheckoutWithWorkspaceAdminToken({ workspaceId: ownWorkspace!.id, token: adminToken.token! });

      // A token without the scope: distinguishable capability rejection
      const [defaultResponse, defaultBody] = await api.billing.startCheckout({
        workspaceId: ownWorkspace!.id,
        body: { seat_quantity: 1 },
        token: primarySignin.pat.token,
      });
      expect(defaultResponse.status()).toBe(403);
      expect(defaultBody.error?.details).toEqual({ reason: 'missing_capability', required_capability: 'workspace:admin' });

      // A bound token used on another workspace: same answer for foreign and absent
      for (const targetWorkspaceId of [foreignWorkspace!.id, crypto.randomUUID()]) {
        const [scopedResponse, scopedBody] = await api.billing.startCheckout({
          workspaceId: targetWorkspaceId,
          body: { seat_quantity: 1 },
          token: adminToken.token!,
        });
        expect(scopedResponse.status()).toBe(403);
        expect(scopedBody.error?.message).toBe('This token is scoped to a different workspace.');
      }

      // Issuance guards: no admin token for a foreign workspace, no PAT minted by a PAT
      const [foreignMintResponse, foreignMint] = await api.tokens.mintToken({
        scopes: ['workspace:admin'],
        workspace_id: foreignWorkspace!.id,
        expires_in_days: 1,
      });
      if (foreignMint.id) {
        await api.tokens.revokeToken(foreignMint.id);
      }
      expect(foreignMintResponse.status()).toBe(403);
      expect(foreignMint.error?.message).toBe('You are not a member of the target workspace.');

      const [patMintResponse, patMint] = await api.tokens.mintToken({ scopes: ['atc:read'], expires_in_days: 1 }, primarySignin.pat.token);
      if (patMint.id) {
        await api.tokens.revokeToken(patMint.id);
      }
      expect(patMintResponse.status()).toBe(403);
      expect(patMint.error?.message).toBe('Personal access tokens cannot issue tokens. Use a browser session.');
    }
    finally {
      await api.tokens.revokeToken(adminToken.id!);
    }
  });
});
