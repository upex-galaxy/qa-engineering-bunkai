/**
 * KATA Architecture - Layer 3: Home API Component
 *
 * API component for the Home screen's "Active test runs" widget (BK-256).
 * Mirrors the app's own `lib/home/` module grouping (`lib/home/active-runs.ts`).
 *
 * Helpers only — this ticket's 7 ATCs are all UI-layer (HomePage). These
 * back HomePage's cross-checks and the Discover-first precondition strategy
 * (automation-plan.md HD-T01 §4).
 *
 * Endpoints:
 * - GET /api/v1/workspaces/{id}/active-runs
 * - GET /api/v1/workspaces (list workspaces the caller belongs to)
 */

import type { APIResponse } from '@playwright/test';
import type {
  ActiveRunsResponse,
  GetActiveRunsParams,
  WorkspaceListResponse,
  WorkspaceWithRole,
} from '@schemas/home.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from HomeApi
export type { ActiveRunRow, ActiveRunsResponse, WorkspaceWithRole } from '@schemas/home.types';

// ============================================
// Home API Component
// ============================================

export class HomeApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Read-only operations (no @atc)
  // ============================================

  /**
   * Helper: list the workspace's currently active runs (`status = 'running'`,
   * `blocked` included as a derived sub-state — D1/D2).
   *
   * Read-only GET — used as a verification/cross-check step for BK-853's
   * underlying-status assertion and for test-level cross-checks in
   * BK-849/BK-852/BK-854.
   */
  @step
  async getActiveRuns(
    workspaceId: string,
    params?: GetActiveRunsParams,
  ): Promise<[APIResponse, ActiveRunsResponse]> {
    return this.apiGET<ActiveRunsResponse>(
      `/v1/workspaces/${workspaceId}/active-runs`,
      params?.limit ? { params: { limit: String(params.limit) } } : {},
    );
  }

  /**
   * Discover helper: find a workspace the caller belongs to by its slug.
   *
   * Silent-fail (returns null) per typescript-patterns.md §7 — callers
   * `test.skip()` when the seeded fixture workspace is not reachable.
   */
  @step
  async findWorkspaceBySlug(slug: string): Promise<WorkspaceWithRole | null> {
    const [, body] = await this.apiGET<WorkspaceListResponse>('/v1/workspaces');
    return body.workspaces?.find(workspace => workspace.slug === slug) ?? null;
  }
}
