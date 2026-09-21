/**
 * KATA Framework - Type Facade: Modules Domain
 *
 * Type definitions for the module-management endpoints BK-260 uses as
 * precondition-setup scaffolding (create + rename, producing a real
 * `module.renamed` activity event for BK-624's module row and BK-631's
 * Workspace-A seed event). These endpoints belong to a DIFFERENT feature
 * (module management, out of scope for BK-260's own ACs) — ModulesApi wraps
 * them as helpers only, no @atc, mirroring RunsApi's precedent
 * (automation-plan.md BK-260 §Component Strategy).
 *
 * Generated from api/openapi-types.ts (`bun run api:sync`, staging spec).
 *
 * Consumed by: tests/components/api/ModulesApi.ts
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/projects/{id}/modules
// ============================================================================

type CreateModulePath = paths['/api/v1/projects/{id}/modules']['post'];

export type ModuleCreateBody = components['schemas']['ModuleCreateBody'];

/** `{ module: Module, warning?: string }` — 201 response body. */
export type ModuleCreateResponse = CreateModulePath['responses']['201']['content']['application/json'];
export type Module = components['schemas']['Module'];

// ============================================================================
// Endpoint Types - PATCH /api/v1/modules/{id}
// ============================================================================

type UpdateModulePath = paths['/api/v1/modules/{id}']['patch'];

export type ModuleUpdateBody = components['schemas']['ModuleUpdateBody'];

/** `{ module: ModuleDetail }` — 200 response body. */
export type ModuleUpdateResponse = UpdateModulePath['responses']['200']['content']['application/json'];
export type ModuleDetail = components['schemas']['ModuleDetail'];
