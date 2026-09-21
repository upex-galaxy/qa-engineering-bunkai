/**
 * KATA Architecture - Layer 3: Home API Component
 *
 * API component for the Home screen's "Active test runs" widget (BK-256)
 * and "Recent activity" widget (BK-260). Mirrors the app's own `lib/home/`
 * module grouping (`lib/home/active-runs.ts`).
 *
 * Helpers only — every BK-256/BK-260 ATC is UI-layer (HomePage). These back
 * HomePage's cross-checks and the Discover/Generate precondition strategy
 * (automation-plan.md HD-T01 §4, BK-260 §4).
 *
 * Endpoints:
 * - GET  /api/v1/workspaces/{id}/active-runs
 * - GET  /api/v1/workspaces (list workspaces the caller belongs to)
 * - POST /api/v1/workspaces (BK-260 — create a throw-away workspace)
 * - GET  /api/v1/activity (BK-49 — used ONLY to resolve the activity_log
 *   event id for a just-Generated entity; see findActivityEventId's own doc
 *   comment for why this ticket needs it at all)
 */

import type { APIResponse } from '@playwright/test';
import type {
  ActiveRunsResponse,
  GetActiveRunsParams,
  WorkspaceCreateBody,
  WorkspaceCreateResponse,
  WorkspaceListResponse,
  WorkspaceWithRole,
} from '@schemas/home.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from HomeApi
export type { ActiveRunRow, ActiveRunsResponse, WorkspaceWithRole } from '@schemas/home.types';

// ============================================
// Types
// ============================================

/**
 * Minimal shape of GET /api/v1/activity's response this ticket needs
 * (BK-49's own domain, not BK-260's — no dedicated schema facade for a
 * single discovery helper; see findActivityEventId below for why this
 * helper exists at all).
 */
interface ActivityEventLookupResponse {
  items: {
    id: string
    item: { entity_id: string | null }
  }[]
}

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

  /**
   * Discover helper: resolve the activity_log event id for one entity's
   * most recent tracked action in a workspace.
   *
   * DEVIATION from automation-plan.md's ATC code templates (flagged in the
   * Code-phase report to the orchestrator): `home-recent-activity-item-{id}`
   * (components/home/RecentActivity.tsx) keys off the activity_log ROW's
   * own id (`ActivityRpcRow.id`, minted fresh per event), never the
   * ENTITY's own id — but `ModulesApi.createModule`/`renameModule` and
   * `BugsApi.createBugStandalone` only ever return the entity (module/bug),
   * and `RunsApi.startRunSuccessfully` only ever returns the run. Confirmed
   * by reading app/api/v1/activity/response.ts (`row.id` vs. `row.entity_id`
   * are separate SELECTed columns) and migration 0045_activity_stream.sql.
   * This helper reads the SAME feed BK-260 renders from
   * (GET /api/v1/activity, BK-49) and matches on `item.entity_id`, so a
   * caller can resolve the real eventId immediately after Generate-ing the
   * underlying entity.
   *
   * Silent-fail (returns null) per typescript-patterns.md §7 — callers
   * `test.skip()` when the just-created event has not (yet) surfaced in the
   * feed.
   */
  @step
  async findActivityEventId(args: { workspaceId: string, entityId: string }): Promise<string | null> {
    const [, body] = await this.apiGET<ActivityEventLookupResponse>(
      '/v1/activity',
      { params: { workspace_id: args.workspaceId, limit: '20' } },
    );
    return body.items?.find(item => item.item.entity_id === args.entityId)?.id ?? null;
  }

  /**
   * Precondition-setup helper: create a throw-away workspace the test user
   * owns (Generate pattern — BK-625/626/627/631 all reuse this, twice by
   * BK-631). Promoted from BK-256's own raw-apiPOST-at-test-file-level
   * pattern (viewActiveRunsTable.test.ts's own beforeAll) since BK-260 calls
   * it 3+ separate times (automation-plan.md BK-260 §2 Component Strategy).
   */
  @step
  async createWorkspace(
    payload: WorkspaceCreateBody,
  ): Promise<[APIResponse, WorkspaceCreateResponse, WorkspaceCreateBody]> {
    return this.apiPOST<WorkspaceCreateResponse, WorkspaceCreateBody>('/v1/workspaces', payload);
  }
}
