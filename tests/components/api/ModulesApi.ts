/**
 * KATA Architecture - Layer 3: Modules API Component
 *
 * API component wrapping the module-management mutation endpoints BK-260
 * needs as precondition-setup scaffolding (create + rename, producing a
 * real `module.renamed` activity event for BK-624's module row and BK-631's
 * Workspace-A seed event). These endpoints belong to a DIFFERENT feature
 * (module management, explicitly out of scope for BK-260's own ACs) and
 * have no BK-* TMS Test ID of their own yet, so every method here is a
 * helper (no @atc) — mirrors RunsApi's exact precedent from BK-256
 * (automation-plan.md BK-260 §Component Strategy). Expected to gain
 * @atc('BK-XXX') once the Module Management epic's own TMS Tests exist and
 * reuse these exact methods.
 *
 * Endpoints:
 * - POST  /api/v1/projects/{id}/modules
 * - PATCH /api/v1/modules/{id}
 */

import type { ModuleRenamePayload } from '@data/types';
import type { APIResponse } from '@playwright/test';
import type {
  ModuleCreateBody,
  ModuleCreateResponse,
  ModuleUpdateResponse,
} from '@schemas/modules.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { step } from '@utils/decorators';

// Re-export types for consumers that import from ModulesApi
export type { Module, ModuleCreateBody, ModuleDetail, ModuleUpdateBody } from '@schemas/modules.types';

// ============================================
// Types
// ============================================

export interface CreateModuleArgs {
  projectId: string
  payload: ModuleCreateBody
}

export interface RenameModuleArgs extends ModuleRenamePayload {
  moduleId: string
}

// ============================================
// Modules API Component
// ============================================

export class ModulesApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers - Precondition setup (no @atc — see class doc)
  // ============================================

  /**
   * Precondition-setup helper: create a module in a project.
   */
  @step
  async createModule(args: CreateModuleArgs): Promise<[APIResponse, ModuleCreateResponse, ModuleCreateBody]> {
    return this.apiPOST<ModuleCreateResponse, ModuleCreateBody>(
      `/v1/projects/${args.projectId}/modules`,
      args.payload,
    );
  }

  /**
   * Precondition-setup helper: rename a module. Produces the
   * `module.renamed` activity event BK-624's module row / BK-631's
   * Workspace-A seed event needs.
   */
  @step
  async renameModule(args: RenameModuleArgs): Promise<[APIResponse, ModuleUpdateResponse]> {
    const { moduleId, ...payload } = args;
    const [response, body] = await this.apiPATCH<ModuleUpdateResponse, ModuleRenamePayload>(
      `/v1/modules/${moduleId}`,
      payload,
    );
    return [response, body];
  }
}
