/**
 * BK-630 (BK-260 TC7): the Home recent activity feed caps at its row limit
 * (HOME_ACTIVITY_FEED_LIMIT = 6, lib/home/constants.ts), newest first.
 *
 * Generates a throw-away workspace with more tracked events than the cap
 * (one module renamed 7 times) and soft-deletes it in teardown.
 *
 * Project: e2e (depends on ui-setup). `{ test }` shares the browser session
 * between the API side and the UI.
 */

import { config, expect, test } from '@TestFixture';

const FEED_LIMIT = 6;
const TRACKED_EVENTS_TO_CREATE = FEED_LIMIT + 1;

test.describe('BK-260: Validate the Home recent activity feed row cap', { tag: ['@regression'] }, () => {
  test('BK-630: should show only the newest events up to the feed limit when the workspace has more tracked events than the limit', async ({ test: fixture }) => {
    const { api, ui } = fixture;
    const [createResponse, created] = await api.home.createWorkspace({ name: 'BK-630 feed cap', slug: api.data.generateWorkspaceSlug() });
    expect(createResponse.status()).toBe(201);
    const workspaceId = created.workspace.id;

    try {
      // Only allowlisted actions reach the feed (lib/activity/constants.ts):
      // `module.created` does not, `module.renamed` does — rename one module N times.
      const [projectResponse, project] = await api.projects.createProject({ workspaceId, name: 'Feed cap project' });
      expect(projectResponse.status()).toBe(201);
      const [moduleResponse, created] = await api.modules.createModule({ projectId: project.project!.id, payload: { name: api.data.generateModuleName() } });
      expect(moduleResponse.status()).toBe(201);
      for (let index = 1; index <= TRACKED_EVENTS_TO_CREATE; index++) {
        const [renameResponse] = await api.modules.renameModule({ moduleId: created.module.id, name: api.data.generateModuleName() });
        expect(renameResponse.ok(), `rename ${index}`).toBe(true);
      }

      const newestEventIds = await api.home.listActivityEventIds(workspaceId, FEED_LIMIT + 1);
      expect(newestEventIds.length, 'more tracked events than the feed limit').toBeGreaterThan(FEED_LIMIT);

      await ui.home.useWorkspace(workspaceId);
      await ui.home.viewActivityFeedCappedAtLimit(newestEventIds.slice(0, FEED_LIMIT));
    }
    finally {
      // Workspace delete is session-only: drop the injected Bearer first
      await api.useCookieSession(config.testUser);
      await api.home.deleteWorkspace(workspaceId);
    }
  });
});
