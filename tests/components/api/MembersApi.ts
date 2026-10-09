/**
 * KATA Architecture - Layer 3: Members API Component
 *
 * Workspace membership: invite and accept. Helpers only — used as
 * precondition setup to give a test a real admin who is not the owner
 * (BK-230 TC14). No BK-* Test covers membership management itself yet.
 *
 * Invite creation needs `workspace:admin` (cookie session or bound PAT);
 * accepting is done as the invited identity's session. Tests invite into a
 * throw-away workspace and soft-delete it in teardown, which also ends the
 * membership and revokes pending invites.
 *
 * Endpoints:
 * - POST /api/v1/workspaces/{id}/invites
 * - POST /api/v1/invites/accept
 */

import type { APIResponse } from '@playwright/test';
import type { ApiErrorEnvelope } from '@schemas/billing.types';
import type { InviteAcceptBody, WorkspaceInviteCreateBody, WorkspaceInviteCreateResponse } from '@schemas/workspaces.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

export type { WorkspaceInviteCreateBody, WorkspaceInviteCreateResponse } from '@schemas/workspaces.types';

export type CreateInviteResult = Partial<WorkspaceInviteCreateResponse> & Partial<ApiErrorEnvelope>;

// ============================================
// Members API Component
// ============================================

export class MembersApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Precondition setup (no @atc)
  // ============================================

  /** Helper: invite an email into a workspace with a role. Returns the raw token once. */
  @step
  async createInvite(workspaceId: string, body: WorkspaceInviteCreateBody): Promise<[APIResponse, CreateInviteResult]> {
    const [response, result] = await this.apiPOST<CreateInviteResult, WorkspaceInviteCreateBody>(
      `/v1/workspaces/${workspaceId}/invites`,
      body,
    );
    return [response, result];
  }

  /** Helper: accept an invite as the signed-in identity (its email must match the invite). */
  @step
  async acceptInvite(token: string): Promise<APIResponse> {
    const [response] = await this.apiPOST<Record<string, unknown>, InviteAcceptBody>('/v1/invites/accept', { token });
    return response;
  }
}
