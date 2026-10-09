/**
 * KATA Architecture - Layer 3: Projects API Component
 *
 * Project creation inside a workspace, including the plan-tier project cap
 * enforced by the `bunkai_enforce_project_limit` trigger (BK-230: community
 * = 3, cloud = 50, enterprise = unlimited). A capped insert answers 422
 * `project_limit_reached`.
 *
 * Endpoints:
 * - POST /api/v1/workspaces/{id}/projects
 */

import type { APIResponse } from '@playwright/test';
import type { ApiErrorEnvelope } from '@schemas/billing.types';
import type { ProjectCreateBody, ProjectCreateResponse } from '@schemas/workspaces.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export type { ProjectCreateBody, ProjectCreateResponse } from '@schemas/workspaces.types';

// ============================================
// Types
// ============================================

export interface CreateProjectArgs {
  workspaceId: string
  name: string
}

export type CreateProjectResult = Partial<ProjectCreateResponse> & Partial<ApiErrorEnvelope>;

// ============================================
// Projects API Component
// ============================================

export class ProjectsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (no @atc)
  // ============================================

  /** Helper: create a project in a workspace. No assertions (precondition setup). */
  @step
  async createProject(args: CreateProjectArgs): Promise<[APIResponse, CreateProjectResult]> {
    const [response, body] = await this.apiPOST<CreateProjectResult, ProjectCreateBody>(
      `/v1/workspaces/${args.workspaceId}/projects`,
      { name: args.name },
    );
    return [response, body];
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: a project beyond the community cap is rejected (BK-230 TC5).
   *
   * Precondition (set by the test): the workspace is on `community` and
   * already holds exactly 3 projects.
   */
  @atc('BK-812')
  async createProjectBeyondCommunityLimit(workspaceId: string): Promise<ApiErrorEnvelope> {
    const [response, body] = await this.createProject({ workspaceId, name: `Over the cap ${Date.now()}` });

    expect(response.status()).toBe(422);
    expect(body.error?.code).toBe('project_limit_reached');
    expect(body.project).toBeUndefined();

    return body as ApiErrorEnvelope;
  }
}
