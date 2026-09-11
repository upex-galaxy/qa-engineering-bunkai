/**
 * KATA Framework - Type Facade: Home Domain
 *
 * Type definitions for the Home screen's "Active test runs" widget (BK-256).
 * Generated from api/openapi-types.ts (`bun run api:sync`, staging spec).
 *
 * Consumed by: tests/components/api/HomeApi.ts
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Schema Types (from components.schemas)
// ============================================================================

/** GET /api/v1/workspaces/{id}/active-runs response body. */
export type ActiveRunsResponse = components['schemas']['ActiveRuns'];

/** One row of the active-runs table — BK-256 AC1's 6 data points + the derived `state` sub-status (D2). */
export type ActiveRunRow = components['schemas']['ActiveRun'];

/** A workspace the caller belongs to, with their role, from GET /api/v1/workspaces. */
export type WorkspaceWithRole = components['schemas']['WorkspaceWithRole'];

// ============================================================================
// Endpoint Types - GET /api/v1/workspaces/{id}/active-runs
// ============================================================================

type GetActiveRunsPath = paths['/api/v1/workspaces/{id}/active-runs']['get'];

/** Query params (`limit`, 1-20, default 5). */
export type GetActiveRunsParams = GetActiveRunsPath['parameters']['query'];

// ============================================================================
// Endpoint Types - GET /api/v1/workspaces
// ============================================================================

type ListWorkspacesPath = paths['/api/v1/workspaces']['get'];

/** GET /api/v1/workspaces response body — every workspace the caller belongs to. */
export type WorkspaceListResponse = ListWorkspacesPath['responses']['200']['content']['application/json'];

type CreateWorkspacePath = paths['/api/v1/workspaces']['post'];

/**
 * POST /api/v1/workspaces request body. Used by BK-850's precondition to
 * create a throw-away, guaranteed-empty workspace (automation-plan.md
 * HD-T01 §4, row "BK-850") — no dedicated HomeApi ATC covers this, per the
 * plan's own "HomeApi/raw apiPOST" note.
 */
export type WorkspaceCreateBody = CreateWorkspacePath['requestBody']['content']['application/json'];
export type WorkspaceCreateResponse = CreateWorkspacePath['responses']['201']['content']['application/json'];

// ============================================================================
// Custom Types (not custom — the standard error envelope, re-exported for convenience)
// ============================================================================

/** Standard error envelope shared by every v1 endpoint. */
export type ApiErrorResponse = components['schemas']['ErrorEnvelope'];
