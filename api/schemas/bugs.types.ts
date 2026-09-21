/**
 * KATA Framework - Type Facade: Bugs Domain
 *
 * Type definitions for the bug-triage endpoints BK-260 uses as
 * precondition-setup scaffolding (standalone create + one status
 * transition, producing a real `bug.status_changed` activity event for
 * BK-624's bug row). These endpoints belong to a DIFFERENT feature (bug
 * triage, out of scope for BK-260's own ACs) — BugsApi wraps them as
 * helpers only, no @atc, mirroring RunsApi's / ModulesApi's precedent
 * (automation-plan.md BK-260 §Component Strategy).
 *
 * Generated from api/openapi-types.ts (`bun run api:sync`, staging spec).
 *
 * Consumed by: tests/components/api/BugsApi.ts
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Endpoint Types - POST /api/v1/bugs (standalone path)
// ============================================================================

type CreateBugPath = paths['/api/v1/bugs']['post'];

export type BugStandaloneCreateBody = components['schemas']['BugStandaloneCreateBody'];

/** `{ bug: BugDetail }` — 201 response body (shared with the run-linked path; not a named schema in the spec, so it is read off the path's own response content). */
export type BugCreateResponse = CreateBugPath['responses']['201']['content']['application/json'];
export type BugDetail = components['schemas']['BugDetail'];

// ============================================================================
// Endpoint Types - POST /api/v1/bugs/{id}/status
// ============================================================================

type TransitionBugStatusPath = paths['/api/v1/bugs/{id}/status']['post'];

export type BugStatusTransitionBody = components['schemas']['BugStatusTransitionBody'];

/** `{ bug: BugDetail }` — 200 response body. */
export type BugStatusTransitionResponse = TransitionBugStatusPath['responses']['200']['content']['application/json'];
