/**
 * BK-812 (BK-230 TC5): the community plan caps a workspace at 3 projects.
 *
 * Generates a throw-away community workspace with exactly 3 projects and
 * soft-deletes it in teardown. The cloud leg (cap lifted after an upgrade)
 * needs a real upgrade and is skipped by name until a payment processor is
 * configured.
 *
 * Project: integration (depends on api-setup). Auth: cookie session (ADR-0002).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-812: Validate project-limit enforcement by plan tier', { tag: ['@regression'] }, () => {
  // The smoke project applies the browser storageState to `request`; start from
  // an empty cookie jar so the identity is the one the test sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-812: should block the 4th project when the workspace is on community with 3 projects', async ({ api }) => {
    await api.useCookieSession(config.testUser);
    const [createResponse, created] = await api.home.createWorkspace({ name: 'BK-812 project cap', slug: api.data.generateWorkspaceSlug() });
    expect(createResponse.status()).toBe(201);
    const workspaceId = created.workspace.id;

    try {
      for (let index = 1; index <= 3; index++) {
        const [projectResponse] = await api.projects.createProject({ workspaceId, name: `Cap project ${index}` });
        expect(projectResponse.status(), `project ${index} of 3`).toBe(201);
      }
      const [, overview] = await api.billing.getBillingOverview(workspaceId);
      expect(overview.plan).toBe('community');
      expect(overview.project_count).toBe(3);

      await api.projects.createProjectBeyondCommunityLimit(workspaceId);

      const [, after] = await api.billing.getBillingOverview(workspaceId);
      expect(after.project_count).toBe(3);
    }
    finally {
      await api.home.deleteWorkspace(workspaceId);
    }
  });

  test('BK-812: should allow a project beyond the community cap after the upgrade to cloud', { tag: ['@requires-payment-processor'] }, async () => {
    test.skip(true, 'needs a real cloud upgrade (Stripe test mode) or a plan-flip fixture; not available on this environment');
  });
});
