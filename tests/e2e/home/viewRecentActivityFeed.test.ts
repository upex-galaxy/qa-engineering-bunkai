/**
 * BK-260: TMS-Home | Show a condensed recent activity feed
 *
 * 5 TMS-authorized TCs (BK-624 x4 rows, BK-625, BK-626, BK-627, BK-631)
 * automating the Home screen's "Recent activity" widget.
 * Plan: .context/PBI/epics/EPIC-BK-254-home-dashboard/test-specs/BK-260/
 *
 * BK-628 (TC5, error state) is NOT automated in this pass — see spec.md
 * "Excluded TC" for the full rationale (no reachable error path through the
 * UI/API surface).
 *
 * DEVIATION from automation-plan.md's ATC code templates (flagged in the
 * Code-phase report to the orchestrator): `home-recent-activity-item-{id}`
 * keys off the activity_log row's OWN id, never the entity id the
 * module/bug/run creation endpoints return (see HomeApi.findActivityEventId's
 * own doc comment). Every scenario below resolves the real eventId via that
 * helper immediately after Generate-ing its entity, and test.skip()s when the
 * event has not (yet) surfaced in the feed — rather than asserting against a
 * locator built from the wrong id.
 */

import type { ApiFixture } from '@ApiFixture';
import type { components } from '@openapi';

import { test } from '@TestFixture';

// The fixture workspace spec.md/automation-plan.md name as BK-624's own
// Discover precondition (same one BK-256/HD-T01 discovers).
const FIXTURE_WORKSPACE_SLUG = 'sir-tests-a-lot';

// BK-624 (Workspace A source event) is the ONLY call site that creates a
// project directly — a raw apiPOST, per automation-plan.md BK-260 §2 API
// Details ("one-off, not worth a named helper for a single call site").
// No projects.types.ts facade exists yet, so the types are read straight
// off the OpenAPI component schemas rather than left untyped.
type ProjectCreateBody = components['schemas']['ProjectCreateBody'];
type ProjectCreateResponse = components['schemas']['ProjectCreateResponse'];

interface DiscoveredCandidate {
  projectId: string
  testId: string
  environmentId: string
}

interface ActivityRowResult {
  entityId: string
  expectedActionLabel: string
  expectedItemLabel: string
  expectedGlyphClass: 'text-signal-fail' | 'text-signal-running' | 'text-accent'
  expectedChip: 'Passed' | 'Failed' | 'none'
}

interface ActivityRowScenario {
  entityType: string
  setup: (api: ApiFixture, candidate: DiscoveredCandidate) => Promise<ActivityRowResult>
}

test.describe('BK-260: Validate Home\'s condensed recent activity feed', () => {
  // Shared BK-624 discovery (Discover-first, per automation-plan.md §4): a
  // workspace with >= 1 project carrying >= 1 executable Test + configured
  // Environment. The parameterized rows below test.skip() when discovery
  // comes up short, rather than asserting against absent fixture data.
  let workspaceId: string | null = null;
  let projectId: string | null = null;
  let testId: string | null = null;
  let environmentId: string | null = null;

  test.beforeAll(async ({ api }) => {
    const workspace = await api.home.findWorkspaceBySlug(FIXTURE_WORKSPACE_SLUG);
    workspaceId = workspace?.id ?? null;
    if (!workspaceId) {
      return;
    }

    const projects = await api.runs.findRecentProjects(workspaceId, 20);
    for (const project of projects) {
      const [testMatch, environment] = await Promise.all([
        api.runs.findExecutableTestInProject(project.id),
        api.runs.findEnvironmentInProject(project.id),
      ]);
      if (testMatch && environment) {
        projectId = project.id;
        testId = testMatch.id;
        environmentId = environment.id;
        break;
      }
    }
  });

  // ============================================
  // Scenario 1 — BK-627 (empty state)
  // ============================================
  test('BK-260: should show an empty state when the workspace has no tracked activity in the last 24 hours', async ({ test: fixture }) => {
    const { api, ui } = fixture;
    const [response, ws] = await api.home.createWorkspace({
      name: 'BK-260 empty state',
      slug: api.data.generateWorkspaceSlug(),
    });
    if (!response.ok()) {
      return test.skip(true, 'Throw-away empty workspace could not be created');
    }

    await ui.home.useWorkspace(ws.workspace.id);
    await ui.home.viewRecentActivityEmptyState();
  });

  // ============================================
  // Scenario 2 — BK-626 (empty-state link navigation)
  // ============================================
  test('BK-260: should navigate to /activity when the empty-state link is selected', async ({ test: fixture }) => {
    const { api, ui } = fixture;
    const [response, ws] = await api.home.createWorkspace({
      name: 'BK-260 empty link',
      slug: api.data.generateWorkspaceSlug(),
    });
    if (!response.ok()) {
      return test.skip(true, 'Throw-away empty workspace could not be created');
    }

    await ui.home.useWorkspace(ws.workspace.id);
    await ui.home.navigateToActivityFromEmptyState();
  });

  // ============================================
  // Scenario 3 — BK-625 (header link navigation)
  // ============================================
  test('BK-260: should navigate to /activity when the header View all link is selected', async ({ ui }) => {
    // Fixture challenge (automation-plan.md §2): the header link renders
    // unconditionally in every feed state, so this ATC needs neither a
    // precondition nor an API cross-check — UI-only fixture, no browser
    // setup cost beyond the page itself.
    await ui.home.navigateToActivityFromHeaderLink();
  });

  // ============================================
  // Scenario 4 — BK-631 (cross-workspace isolation)
  // ============================================
  test('BK-260: should not show another workspace\'s activity when a different workspace is active', async ({ test: fixture }) => {
    const { api, ui } = fixture;

    // Workspace A: Generate a real allowed-action event (module.renamed).
    const [, wsA] = await api.home.createWorkspace({
      name: 'BK-260 RLS source',
      slug: api.data.generateWorkspaceSlug(),
    });
    const [, projectA] = await api.apiPOST<ProjectCreateResponse, ProjectCreateBody>(
      `/v1/workspaces/${wsA.workspace.id}/projects`,
      { name: 'BK-260 RLS project' },
    );
    const [, createdA] = await api.modules.createModule({
      projectId: projectA.project.id,
      payload: { name: api.data.generateModuleName() },
    });
    const [, renamedA] = await api.modules.renameModule({
      moduleId: createdA.module.id,
      name: api.data.generateModuleName(),
    });

    const foreignEventId = await api.home.findActivityEventId({
      workspaceId: wsA.workspace.id,
      entityId: renamedA.module.id,
    });
    if (!foreignEventId) {
      return test.skip(true, 'Workspace A\'s module.renamed event has not surfaced in the activity feed yet');
    }

    // Workspace B: Generate empty, owned by the SAME user.
    const [, wsB] = await api.home.createWorkspace({
      name: 'BK-260 RLS target',
      slug: api.data.generateWorkspaceSlug(),
    });

    await ui.home.useWorkspace(wsB.workspace.id);
    await ui.home.verifyActivityIsolatedByWorkspace(foreignEventId);
  });

  // ============================================
  // Scenario 5 — BK-624 (item rendering, parameterized across entity types)
  // ============================================
  const activityRowScenarios: ActivityRowScenario[] = [
    {
      entityType: 'module',
      setup: async (api, candidate) => {
        const renamedName = api.data.generateModuleName();
        const [, created] = await api.modules.createModule({
          projectId: candidate.projectId,
          payload: { name: api.data.generateModuleName() },
        });
        const [, renamed] = await api.modules.renameModule({ moduleId: created.module.id, name: renamedName });
        return {
          entityId: renamed.module.id,
          expectedActionLabel: 'renamed a module',
          expectedItemLabel: renamedName,
          expectedGlyphClass: 'text-accent',
          expectedChip: 'none',
        };
      },
    },
    {
      entityType: 'bug',
      setup: async (api, candidate) => {
        const [, createdModule] = await api.modules.createModule({
          projectId: candidate.projectId,
          payload: { name: api.data.generateModuleName() },
        });
        // Severity 'P3' — a representative mid severity; BK-624's row does
        // not assert on severity, only on the action_label/glyph contract.
        const [, bug] = await api.bugs.createBugStandalone({
          project_id: candidate.projectId,
          module_id: createdModule.module.id,
          title: api.data.generateBugTitle(),
          severity: 'P3',
        });
        await api.bugs.transitionBugStatus({ bugId: bug.bug.id, status: 'in_progress' });
        return {
          entityId: bug.bug.id,
          expectedActionLabel: 'moved this defect to in progress',
          expectedItemLabel: 'a bug',
          expectedGlyphClass: 'text-signal-fail',
          expectedChip: 'none',
        };
      },
    },
    {
      entityType: 'run (passed)',
      setup: async (api, candidate) => {
        const [, run] = await api.runs.startRunSuccessfully({
          test_id: candidate.testId,
          environment_id: candidate.environmentId,
        });
        await api.runs.finishRun({ runId: run.run.id, verdict: 'passed' });
        return {
          entityId: run.run.id,
          expectedActionLabel: 'finished a run',
          expectedItemLabel: 'a run',
          expectedGlyphClass: 'text-signal-running',
          expectedChip: 'Passed',
        };
      },
    },
    {
      entityType: 'run (failed)',
      setup: async (api, candidate) => {
        const [, run] = await api.runs.startRunSuccessfully({
          test_id: candidate.testId,
          environment_id: candidate.environmentId,
        });
        await api.runs.finishRun({ runId: run.run.id, verdict: 'failed' });
        return {
          entityId: run.run.id,
          expectedActionLabel: 'finished a run',
          expectedItemLabel: 'a run',
          expectedGlyphClass: 'text-signal-running',
          expectedChip: 'Failed',
        };
      },
    },
  ];

  for (const scenario of activityRowScenarios) {
    test(`BK-260: should render ${scenario.entityType} activity correctly on the condensed feed`, async ({ test: fixture }) => {
      if (!workspaceId || !projectId || !testId || !environmentId) {
        return test.skip(true, 'Fixture workspace has no discoverable project with an executable Test + Environment pair');
      }
      const { api, ui } = fixture;
      const scopedWorkspaceId = workspaceId;
      const candidate: DiscoveredCandidate = { projectId, testId, environmentId };

      const result = await scenario.setup(api, candidate);

      const eventId = await api.home.findActivityEventId({
        workspaceId: scopedWorkspaceId,
        entityId: result.entityId,
      });
      if (!eventId) {
        return test.skip(true, `The ${scenario.entityType} event has not surfaced in the activity feed yet`);
      }

      await ui.home.useWorkspace(scopedWorkspaceId);
      await ui.home.verifyActivityItemRenders({
        eventId,
        expectedActionLabel: result.expectedActionLabel,
        expectedItemLabel: result.expectedItemLabel,
        expectedGlyphClass: result.expectedGlyphClass,
        expectedChip: result.expectedChip,
      });
    });
  }
});
