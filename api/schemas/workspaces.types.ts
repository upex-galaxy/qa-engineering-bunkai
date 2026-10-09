/**
 * KATA Framework - Type Facade: Workspace administration Domain
 *
 * Projects inside a workspace and workspace membership (invites, accept,
 * leave), derived from the OpenAPI spec.
 *
 * Consumed by: tests/components/api/ProjectsApi.ts, tests/components/api/MembersApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Schema Types - POST /api/v1/workspaces/{id}/projects
// ============================================================================

export type ProjectCreateBody = components['schemas']['ProjectCreateBody'];
export type ProjectCreateResponse = components['schemas']['ProjectCreateResponse'];

// ============================================================================
// Schema Types - invites + membership
// ============================================================================

export type WorkspaceInviteCreateBody = components['schemas']['WorkspaceInviteCreateBody'];
export type WorkspaceInviteCreateResponse = components['schemas']['WorkspaceInviteCreateResponse'];
export type InviteAcceptBody = components['schemas']['InviteAcceptBody'];
