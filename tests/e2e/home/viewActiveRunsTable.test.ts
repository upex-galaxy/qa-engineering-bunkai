/**
 * BK-256: TMS-Home | Show active test runs summary and table
 *
 * 7 TMS-authorized TCs (BK-849, BK-850, BK-851, BK-852 x2 rows, BK-853,
 * BK-854, BK-855) automating the Home screen's "Active test runs" widget.
 * Plan: .context/PBI/epics/EPIC-BK-254-home-dashboard/test-specs/HD-T01-active-runs-table/
 *
 * Precondition discovery (Discover-first, per automation-plan.md §4):
 * a workspace with >= 2 projects, each carrying >= 1 executable Test and
 * >= 1 configured Environment. Every hybrid scenario `test.skip()`s when
 * discovery comes up short, rather than asserting against absent fixture
 * data — see FIXTURE_WORKSPACE_SLUG below.
 */

import type { ApiFixture } from '@ApiFixture';
import type { WorkspaceCreateBody, WorkspaceCreateResponse } from '@schemas/home.types';

import { expect, test } from '@TestFixture';

// The fixture workspace spec.md names as this scope's precondition. If the
// active staging environment does not have it, every hybrid scenario
// test.skip()s (Discover pattern) rather than failing on missing data.
const FIXTURE_WORKSPACE_SLUG = 'sir-tests-a-lot';

interface RunCandidate {
  projectId: string
  projectSlug: string
  testId: string
  environmentId: string
}

test.describe('BK-256: Validate the Home active-runs table', () => {
  let workspaceId: string | null = null;
  let emptyWorkspaceId: string | null = null;
  const candidates: RunCandidate[] = [];

  test.beforeAll(async ({ api }) => {
    // DISCOVER — no assertions (see test-data-management.md). Each test
    // guards with test.skip() below.
    const workspace = await api.home.findWorkspaceBySlug(FIXTURE_WORKSPACE_SLUG);
    workspaceId = workspace?.id ?? null;

    if (workspaceId) {
      const projects = await api.runs.findRecentProjects(workspaceId, 20);
      for (const project of projects) {
        const [testMatch, environment] = await Promise.all([
          api.runs.findExecutableTestInProject(project.id),
          api.runs.findEnvironmentInProject(project.id),
        ]);
        if (testMatch && environment) {
          candidates.push({
            projectId: project.id,
            projectSlug: project.slug,
            testId: testMatch.id,
            environmentId: environment.id,
          });
        }
      }
    }

    // BK-850 precondition: a brand-new, guaranteed-empty workspace — safer
    // than Modify-ing the shared fixture workspace, which would race
    // against every other scenario in this file (automation-plan.md §4).
    // No dedicated HomeApi ATC covers workspace creation for this ticket;
    // the plan's own Test Data Strategy names "HomeApi/raw apiPOST" for it.
    const [emptyResponse, emptyBody] = await api.apiPOST<WorkspaceCreateResponse, WorkspaceCreateBody>(
      '/v1/workspaces',
      { name: 'BK-256 empty state', slug: `bk256-empty-${Date.now()}` },
    );
    emptyWorkspaceId = emptyResponse.ok() ? emptyBody.workspace.id : null;
  });

  // ============================================
  // Scenario 1 — BK-849 (multi-project table)
  // ============================================
  test('BK-256: should list every active run across 2+ projects with run id, project, mode, status, progress and executor', async ({ test: fixture }) => {
    if (candidates.length < 2 || !workspaceId) {
      return test.skip(true, 'Fixture workspace does not have 2+ projects with a discoverable Test + Environment pair');
    }
    const { api, ui } = fixture;
    const scopedWorkspaceId = workspaceId;
    const [projectA, projectB] = candidates;

    const [, runABody] = await api.runs.startRunSuccessfully({
      test_id: projectA.testId,
      environment_id: projectA.environmentId,
    });
    const [, runBBody] = await api.runs.startRunSuccessfully({
      test_id: projectB.testId,
      environment_id: projectB.environmentId,
    });

    await ui.home.useWorkspace(scopedWorkspaceId);
    await ui.home.viewActiveRunsAcrossProjects([runABody.run.id, runBBody.run.id]);

    // Test-level: the API cross-check includes both runs, matched to the
    // right project (not swapped) — see atc/BK-849-*.md §4.
    const [, active] = await api.home.getActiveRuns(scopedWorkspaceId, { limit: 20 });
    const rowA = active.runs.find(row => row.id === runABody.run.id);
    const rowB = active.runs.find(row => row.id === runBBody.run.id);
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(rowA?.project_slug).toBe(projectA.projectSlug);
    expect(rowB?.project_slug).toBe(projectB.projectSlug);
  });

  // ============================================
  // Scenario 2 — BK-850 (empty state)
  // ============================================
  test('BK-256: should show the empty state when no run in the workspace is active', async ({ ui }) => {
    if (!emptyWorkspaceId) {
      return test.skip(true, 'Throw-away empty workspace could not be created');
    }
    await ui.home.useWorkspace(emptyWorkspaceId);
    await ui.home.viewActiveRunsEmptyState();
  });

  // ============================================
  // Scenario 3 — BK-851 (resume, generic)
  // ============================================
  test('BK-256: should resume the most recently active run directly from Home', async ({ test: fixture }) => {
    if (candidates.length === 0 || !workspaceId) {
      return test.skip(true, 'Fixture workspace has no discoverable Test + Environment pair');
    }
    const { api, ui } = fixture;
    const scopedWorkspaceId = workspaceId;
    const [project] = candidates;

    await api.runs.startRunSuccessfully({
      test_id: project.testId,
      environment_id: project.environmentId,
    });

    await ui.home.useWorkspace(scopedWorkspaceId);
    await ui.home.resumeMostRecentActiveRunSuccessfully();
  });

  // ============================================
  // Scenario 4 — BK-855 (resume, exact target)
  // ============================================
  test('BK-256: should navigate to the correct run\'s execution screen when Resume is clicked', async ({ test: fixture }) => {
    if (candidates.length === 0 || !workspaceId) {
      return test.skip(true, 'Fixture workspace has no discoverable Test + Environment pair');
    }
    const { api, ui } = fixture;
    const scopedWorkspaceId = workspaceId;
    const [project] = candidates;

    // D6 recency construction (atc/BK-855-*.md §7): run A, mark one of its
    // steps (bumps its last_activity_at), THEN create run B — sequential
    // awaited calls give run B an unambiguous later last_activity_at.
    const [, runABody] = await api.runs.startRunSuccessfully({
      test_id: project.testId,
      environment_id: project.environmentId,
    });
    const firstStepId = runABody.run.atcs[0]?.steps[0]?.id;
    if (!firstStepId) {
      return test.skip(true, 'Discovered Test has no steps to mark for the recency gap');
    }
    await api.runs.markRunStep({ runId: runABody.run.id, stepId: firstStepId, status: 'passed' });

    const [, runBBody] = await api.runs.startRunSuccessfully({
      test_id: project.testId,
      environment_id: project.environmentId,
    });

    await ui.home.useWorkspace(scopedWorkspaceId);
    await ui.home.resumeNavigatesToTargetRun({
      expectedProjectSlug: project.projectSlug,
      expectedRunId: runBBody.run.id,
    });
  });

  // ============================================
  // Scenario 5 — BK-852 (state-transition, parameterized 2 rows)
  // ============================================
  const exclusionScenarios: {
    label: string
    transition: (args: { api: ApiFixture, runId: string }) => Promise<void>
  }[] = [
    {
      label: 'Finished',
      transition: async ({ api, runId }) => {
        await api.runs.finishRun({ runId, verdict: 'passed' });
      },
    },
    {
      label: 'Aborted',
      transition: async ({ api, runId }) => {
        await api.runs.abortRun({ runId, reason: api.data.generateAbortReason() });
      },
    },
  ];

  for (const scenario of exclusionScenarios) {
    test(`BK-256: should exclude a run from the active table once its status becomes ${scenario.label}`, async ({ test: fixture }) => {
      if (candidates.length === 0 || !workspaceId) {
        return test.skip(true, 'Fixture workspace has no discoverable Test + Environment pair');
      }
      const { api, ui } = fixture;
      const scopedWorkspaceId = workspaceId;
      const [project] = candidates;

      const [, runBody] = await api.runs.startRunSuccessfully({
        test_id: project.testId,
        environment_id: project.environmentId,
      });
      const [, before] = await api.home.getActiveRuns(scopedWorkspaceId, { limit: 20 });

      await scenario.transition({ api, runId: runBody.run.id });

      await ui.home.useWorkspace(scopedWorkspaceId);
      await ui.home.verifyRunExcludedFromActiveTable(runBody.run.id);

      const [, after] = await api.home.getActiveRuns(scopedWorkspaceId, { limit: 20 });
      expect(after.active_count).toBe(before.active_count - 1);
    });
  }

  // ============================================
  // Scenario 6 — BK-853 (blocked chip)
  // ============================================
  test('BK-256: should show a run as blocked when one of its steps is blocked', async ({ test: fixture }) => {
    if (candidates.length === 0 || !workspaceId) {
      return test.skip(true, 'Fixture workspace has no discoverable Test + Environment pair');
    }
    const { api, ui } = fixture;
    const scopedWorkspaceId = workspaceId;
    const [project] = candidates;

    const [, runBody] = await api.runs.startRunSuccessfully({
      test_id: project.testId,
      environment_id: project.environmentId,
    });
    const firstStepId = runBody.run.atcs[0]?.steps[0]?.id;
    if (!firstStepId) {
      return test.skip(true, 'Discovered Test has no steps to block');
    }
    await api.runs.markRunStep({ runId: runBody.run.id, stepId: firstStepId, status: 'blocked' });

    await ui.home.useWorkspace(scopedWorkspaceId);
    await ui.home.verifyRunShowsBlockedChip(runBody.run.id);

    // Test-level (D2): presence in getActiveRuns at all — with state
    // 'blocked' — is itself the proof the underlying runs.status stayed
    // 'running' (the endpoint only ever returns running runs; 'blocked' is
    // a display sub-state, never a runs.status value — see ActiveRun.state's
    // own doc comment in api/openapi-types.ts). The ATC signature (runId
    // only, no workspaceId) keeps this cross-check here rather than inside
    // HomePage — see deviations_from_plan.
    const [, active] = await api.home.getActiveRuns(scopedWorkspaceId, { limit: 20 });
    const row = active.runs.find(r => r.id === runBody.run.id);
    expect(row?.state).toBe('blocked');
  });

  // ============================================
  // Scenario 7 — BK-854 (mid-progress boundary)
  // ============================================
  test('BK-256: should render a non-zero mid-progress value while a run is still active', async ({ test: fixture }) => {
    if (candidates.length === 0 || !workspaceId) {
      return test.skip(true, 'Fixture workspace has no discoverable Test + Environment pair');
    }
    const { api, ui } = fixture;
    const scopedWorkspaceId = workspaceId;

    // This boundary needs a Test whose ATC chain has >= 2 steps (a 1-step
    // Test cannot produce a genuine 0 < done < total split) — search every
    // discovered candidate project rather than assuming candidates[0]'s Test
    // qualifies (automation-plan.md §4, row "BK-854").
    let multiStepTest: { id: string, stepCount: number } | null = null;
    let multiStepProject: RunCandidate | null = null;
    for (const project of candidates) {
      const found = await api.runs.findExecutableTestWithMinSteps(project.projectId, 2);
      if (found) {
        multiStepTest = found;
        multiStepProject = project;
        break;
      }
    }
    if (!multiStepTest || !multiStepProject) {
      return test.skip(true, 'No discoverable Test in the fixture workspace has >= 2 steps');
    }

    const [, runBody] = await api.runs.startRunSuccessfully({
      test_id: multiStepTest.id,
      environment_id: multiStepProject.environmentId,
    });
    const allSteps = runBody.run.atcs.flatMap(runAtc => runAtc.steps);
    if (allSteps.length < 2) {
      return test.skip(true, 'Discovered Test has fewer than 2 steps — cannot construct a strict mid-progress boundary');
    }

    // Mark a strict subset passed, leaving the rest pending.
    await api.runs.markRunStep({ runId: runBody.run.id, stepId: allSteps[0].id, status: 'passed' });

    await ui.home.useWorkspace(scopedWorkspaceId);
    await ui.home.verifyRunProgressRendersValue({
      runId: runBody.run.id,
      doneSteps: 1,
      totalSteps: allSteps.length,
    });

    // Test-level (doctrine-required edge, same TC's own Expected Results):
    // mark the remaining steps and confirm the run STAYS listed as active
    // at done==total while status is still running.
    for (const remainingStep of allSteps.slice(1)) {
      await api.runs.markRunStep({ runId: runBody.run.id, stepId: remainingStep.id, status: 'passed' });
    }
    const [, active] = await api.home.getActiveRuns(scopedWorkspaceId, { limit: 20 });
    const row = active.runs.find(r => r.id === runBody.run.id);
    expect(row).toBeDefined();
    expect(row?.done_steps).toBe(allSteps.length);
  });
});
