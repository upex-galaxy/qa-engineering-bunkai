/**
 * BK-818 (regression for BK-829): billing checkout tenant non-disclosure.
 *
 * A non-member must get the identical owner rejection whether the target
 * workspace exists (owned by the secondary test user) or not — the 403 vs 422
 * split was an existence oracle. Requires `config.secondaryTestUser`.
 *
 * Project: integration (depends on api-setup). Auth: cookie session (ADR-0002).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-818: Validate billing checkout tenant non-disclosure', { tag: ['@regression', '@security'] }, () => {
  // The smoke project applies the browser storageState to `request`; start every
  // test from an empty cookie jar so the identity is the one each test sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-818: should answer the identical owner rejection for a foreign and a non-existent workspace when a non-member starts checkout', async ({ api }) => {
    const secondaryUser = config.secondaryTestUser;
    test.skip(!secondaryUser, 'STAGING_USER_2_* is unset: no identity owns a foreign workspace');

    // Sign in the secondary user FIRST: both sign-ins write the same session
    // cookie, and the primary one must be the last.
    const secondarySignin = await api.auth.signInWithCookieSession(secondaryUser!);
    const foreignWorkspace = (await api.home.listWorkspaces(secondarySignin.pat.token)).find(workspace => workspace.role === 'owner');
    test.skip(!foreignWorkspace, 'the secondary user owns no workspace');

    await api.useCookieSession(config.testUser);
    const ownWorkspaceIds = (await api.home.listWorkspaces()).map(workspace => workspace.id);
    expect(ownWorkspaceIds, 'the primary user must not be a member of the foreign workspace').not.toContain(foreignWorkspace!.id);

    const absentWorkspaceId = crypto.randomUUID();
    const partitions = [
      { body: { seat_quantity: 1 }, withIdempotencyKey: true },
      { body: { seat_quantity: 0 }, withIdempotencyKey: true }, // owner gate runs before seat validation
      { body: { seat_quantity: 1 }, withIdempotencyKey: false }, // owner gate runs before idempotency
    ];

    for (const partition of partitions) {
      const foreignError = await api.billing.startCheckoutAsNonMember({ workspaceId: foreignWorkspace!.id, ...partition });
      const absentError = await api.billing.startCheckoutAsNonMember({ workspaceId: absentWorkspaceId, ...partition });
      expect(absentError, `partition ${JSON.stringify(partition)}`).toEqual(foreignError);
    }
  });

  test('BK-818: should reject a malformed workspace id on format only when it is not a UUID', async ({ api }) => {
    await api.useCookieSession(config.testUser);

    const [response, body] = await api.billing.startCheckout({ workspaceId: 'not-a-uuid', body: { seat_quantity: 1 } });

    expect(response.status()).toBe(400);
    expect(body.error?.code).toBe('bad_request');
    expect(body.error?.message).toBe('Workspace id must be a UUID.');
  });
});
