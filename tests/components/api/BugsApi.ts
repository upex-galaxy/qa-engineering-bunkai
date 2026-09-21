/**
 * KATA Architecture - Layer 3: Bugs API Component
 *
 * API component wrapping the bug-triage mutation endpoints BK-260 needs as
 * precondition-setup scaffolding (standalone create + one status
 * transition, producing a real `bug.status_changed` activity event for
 * BK-624's bug row). These endpoints belong to a DIFFERENT feature (bug
 * triage, explicitly out of scope for BK-260's own ACs) and have no BK-*
 * TMS Test ID of their own yet, so every method here is a helper (no @atc)
 * — mirrors RunsApi's / ModulesApi's exact precedent
 * (automation-plan.md BK-260 §Component Strategy). Expected to gain
 * @atc('BK-XXX') once the Defect Triage epic's own TMS Tests exist and
 * reuse these exact methods.
 *
 * Endpoints:
 * - POST /api/v1/bugs (standalone path — project_id + module_id in body)
 * - POST /api/v1/bugs/{id}/status
 */

import type { APIResponse } from '@playwright/test';
import type {
  BugCreateResponse,
  BugStandaloneCreateBody,
  BugStatusTransitionBody,
  BugStatusTransitionResponse,
} from '@schemas/bugs.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from BugsApi
export type { BugDetail, BugStandaloneCreateBody, BugStatusTransitionBody } from '@schemas/bugs.types';

// ============================================
// Types
// ============================================

export interface TransitionBugStatusArgs {
  bugId: string
  status: 'in_progress' | 'resolved' | 'closed'
}

// ============================================
// Bugs API Component
// ============================================

export class BugsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Precondition setup (no @atc — see class doc)
  // ============================================

  /**
   * Precondition-setup helper: file a standalone bug (no source run/step —
   * `project_id` + `module_id` supplied directly). Always creates status
   * `open`.
   */
  @step
  async createBugStandalone(
    payload: BugStandaloneCreateBody,
  ): Promise<[APIResponse, BugCreateResponse, BugStandaloneCreateBody]> {
    return this.apiPOST<BugCreateResponse, BugStandaloneCreateBody>('/v1/bugs', payload);
  }

  /**
   * Precondition-setup helper: advance a bug's status one lifecycle stage
   * (open -> in_progress -> resolved -> closed, never backward, never
   * skipping a stage). Produces the `bug.status_changed` activity event
   * BK-624's bug row needs (`open -> in_progress`, the first legal
   * adjacency — no assignee-resolution helper required).
   */
  @step
  async transitionBugStatus(args: TransitionBugStatusArgs): Promise<[APIResponse, BugStatusTransitionResponse]> {
    const payload: BugStatusTransitionBody = { status: args.status };
    const [response, body] = await this.apiPOST<BugStatusTransitionResponse, BugStatusTransitionBody>(
      `/v1/bugs/${args.bugId}/status`,
      payload,
    );
    return [response, body];
  }
}
