/**
 * KATA Architecture - Layer 3: Runs API Component
 *
 * API component wrapping the Run-lifecycle mutation endpoints, plus the
 * precondition-discovery reads needed to supply their inputs. These
 * endpoints belong to a DIFFERENT feature ("TMS-Run Execution", explicitly
 * out of scope for BK-256's own ACs) and have no BK-* TMS Test ID of their
 * own yet, so every method here is a helper (no @atc) — precondition-setup
 * scaffolding for HomePage's 6 hybrid ATCs (automation-plan.md HD-T01
 * §Component Strategy). Expected to gain `@atc('BK-XXX')` once the Run
 * Execution epic's own TMS Tests exist and reuse these exact methods.
 *
 * Endpoints:
 * - POST /api/v1/runs
 * - POST /api/v1/runs/{id}/abort
 * - POST /api/v1/runs/{id}/finish
 * - POST /api/v1/runs/{id}/steps/{stepId}/mark
 * - GET  /api/v1/runs/{id}
 * - GET  /api/v1/workspaces/{id}/recent-projects (precondition discovery)
 * - GET  /api/v1/tests/search                    (precondition discovery, project-scoped — BK-620-safe)
 * - GET  /api/v1/projects/{id}/environments       (precondition discovery)
 */

import type { APIResponse } from '@playwright/test';
import type {
  ExpandedTestResponse,
  ProjectEnvironment,
  ProjectEnvironmentListResponse,
  RecentProject,
  RecentProjectsResponse,
  RunAbortBody,
  RunCreateBody,
  RunFinishBody,
  RunResponse,
  RunStepMarkBody,
  TestSearchResponse,
  TestSearchResult,
} from '@schemas/runs.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from RunsApi
export type { Run, RunAbortBody, RunCreateBody, RunFinishBody, RunResponse, RunStepMarkBody } from '@schemas/runs.types';

// ============================================
// Types
// ============================================

export interface MarkRunStepArgs {
  runId: string
  stepId: string
  status: 'passed' | 'failed' | 'blocked'
}

export interface FinishRunArgs {
  runId: string
  verdict: 'passed' | 'failed'
}

export interface AbortRunArgs {
  runId: string
  reason: string
}

// ============================================
// Runs API Component
// ============================================

export class RunsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Precondition discovery (no @atc, silent-fail)
  // ============================================

  /**
   * Discover helper: the workspace's most recently active projects.
   *
   * Silent-fail (returns []) — callers `test.skip()` when fewer than the
   * needed number of qualifying projects are found.
   */
  @step
  async findRecentProjects(workspaceId: string, limit = 20): Promise<RecentProject[]> {
    const [, body] = await this.apiGET<RecentProjectsResponse>(
      `/v1/workspaces/${workspaceId}/recent-projects`,
      { params: { limit: String(limit) } },
    );
    return body.projects ?? [];
  }

  /**
   * Discover helper: an executable Test scoped to one project.
   *
   * BK-620 isolation: uses the project-scoped `/tests/search` endpoint
   * (never a bare workspace-wide Test search), so a precondition built from
   * this helper cannot be satisfied by the cross-project Test leak BK-620
   * found. The search endpoint requires a non-empty `query` (empty/missing
   * is rejected 422) and there is no dedicated "list tests in project"
   * endpoint, so this tries a short list of common single-letter substrings
   * in turn — a broad heuristic standing in for "any test" — stopping at
   * the first non-empty match. Silent-fail to null when every letter comes
   * up empty, so the caller can `test.skip()`.
   */
  async findExecutableTestInProject(projectId: string): Promise<TestSearchResult | null> {
    const heuristicQueries = ['a', 'e', 'i', 'o', 's', 't', 'n', 'r'];
    for (const query of heuristicQueries) {
      const [, body] = await this.apiGET<TestSearchResponse>(
        '/v1/tests/search',
        { params: { query, project_id: projectId, limit: '5' } },
      );
      if (body.items?.[0]) {
        return body.items[0];
      }
    }
    return null;
  }

  /**
   * Discover helper: an executable Test scoped to one project whose ATC
   * chain has at least `minSteps` steps in total — used by BK-854's
   * mid-progress boundary, which needs a Test that can produce a genuine
   * `0 < done < total` split (a 1-step Test cannot). Widens the same
   * multi-letter heuristic search to inspect each candidate's real chain
   * (`GET /api/v1/tests/{id}`) instead of trusting the first match. Silent-
   * fail to null when no discoverable Test meets the threshold.
   */
  async findExecutableTestWithMinSteps(
    projectId: string,
    minSteps: number,
  ): Promise<{ id: string, stepCount: number } | null> {
    const heuristicQueries = ['a', 'e', 'i', 'o', 's', 't', 'n', 'r'];
    const seen = new Set<string>();
    for (const query of heuristicQueries) {
      const [, body] = await this.apiGET<TestSearchResponse>(
        '/v1/tests/search',
        { params: { query, project_id: projectId, limit: '10' } },
      );
      for (const candidate of body.items ?? []) {
        if (seen.has(candidate.id)) {
          continue;
        }
        seen.add(candidate.id);
        const [, expanded] = await this.apiGET<ExpandedTestResponse>(`/v1/tests/${candidate.id}`);
        const stepCount = expanded.test.atcs.reduce((sum, chainedAtc) => sum + chainedAtc.steps.length, 0);
        if (stepCount >= minSteps) {
          return { id: candidate.id, stepCount };
        }
      }
    }
    return null;
  }

  /**
   * Discover helper: a configured Environment scoped to one project.
   *
   * Silent-fail (returns null) — callers `test.skip()` when the project has
   * no configured environment.
   */
  async findEnvironmentInProject(projectId: string): Promise<ProjectEnvironment | null> {
    const [, body] = await this.apiGET<ProjectEnvironmentListResponse>(
      `/v1/projects/${projectId}/environments`,
    );
    return body.environments?.[0] ?? null;
  }

  // ============================================
  // Helpers - Run lifecycle (no @atc — see class doc)
  // ============================================

  /**
   * Helper: read a Run with its snapshot chain fully expanded. Used to
   * discover real stepIds for `markRunStep` when the start-run response is
   * not already in scope, and as a verification step for run-lifecycle
   * preconditions.
   */
  @step
  async getRunById(runId: string): Promise<[APIResponse, RunResponse]> {
    return this.apiGET<RunResponse>(`/v1/runs/${runId}`);
  }

  /**
   * Precondition-setup helper: start a Run of a Test in a chosen
   * Environment. Generates a fresh `Idempotency-Key` per call.
   */
  @step
  async startRunSuccessfully(
    payload: RunCreateBody,
  ): Promise<[APIResponse, RunResponse, RunCreateBody]> {
    return this.apiPOST<RunResponse, RunCreateBody>(
      '/v1/runs',
      payload,
      { headers: { 'Idempotency-Key': this.data.generateIdempotencyKey() } },
    );
  }

  /**
   * Precondition-setup helper: mark one Run step passed / failed / blocked.
   */
  @step
  async markRunStep(args: MarkRunStepArgs): Promise<[APIResponse, RunResponse]> {
    const [response, body] = await this.apiPOST<RunResponse, RunStepMarkBody>(
      `/v1/runs/${args.runId}/steps/${args.stepId}/mark`,
      { status: args.status },
    );
    return [response, body];
  }

  /**
   * Precondition-setup helper: finish a Run with a final verdict.
   */
  @step
  async finishRun(args: FinishRunArgs): Promise<[APIResponse, RunResponse]> {
    const [response, body] = await this.apiPOST<RunResponse, RunFinishBody>(
      `/v1/runs/${args.runId}/finish`,
      { verdict: args.verdict },
    );
    return [response, body];
  }

  /**
   * Precondition-setup helper: abort an in-progress Run with a reason.
   */
  @step
  async abortRun(args: AbortRunArgs): Promise<[APIResponse, RunResponse]> {
    const [response, body] = await this.apiPOST<RunResponse, RunAbortBody>(
      `/v1/runs/${args.runId}/abort`,
      { reason: args.reason },
    );
    return [response, body];
  }
}
