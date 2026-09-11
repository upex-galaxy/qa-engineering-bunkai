/**
 * KATA Framework - Type Facade: Runs Domain
 *
 * Type definitions for the Run-lifecycle endpoints (start / abort / finish /
 * mark step / read) plus the precondition-discovery reads RunsApi needs to
 * supply `startRunSuccessfully`'s inputs. These mutation endpoints belong to
 * a different feature ("TMS-Run Execution", out of scope for BK-256's own
 * ACs) — RunsApi wraps them as precondition-setup helpers for this ticket
 * (see automation-plan.md HD-T01 §Component Strategy).
 *
 * Generated from api/openapi-types.ts (`bun run api:sync`, staging spec).
 *
 * Consumed by: tests/components/api/RunsApi.ts
 */

import type { components, paths } from '@openapi';

// ============================================================================
// Schema Types (from components.schemas)
// ============================================================================

export type Run = components['schemas']['Run'];
export type RunAtc = components['schemas']['RunAtc'];
export type RunStep = components['schemas']['RunStep'];

// ============================================================================
// Endpoint Types - POST /api/v1/runs
// ============================================================================

type StartRunPath = paths['/api/v1/runs']['post'];

export type RunCreateBody = components['schemas']['RunCreateBody'];

/** `{ run: Run }` — the shared response shape across every run-mutation endpoint (start/abort/finish/mark/read). */
export type RunResponse = StartRunPath['responses']['201']['content']['application/json'];

// ============================================================================
// Endpoint Types - POST /api/v1/runs/{id}/abort
// ============================================================================

export type RunAbortBody = components['schemas']['RunAbortBody'];

// ============================================================================
// Endpoint Types - POST /api/v1/runs/{id}/finish
// ============================================================================

export type RunFinishBody = components['schemas']['RunFinishBody'];

// ============================================================================
// Endpoint Types - POST /api/v1/runs/{id}/steps/{stepId}/mark
// ============================================================================

export type RunStepMarkBody = components['schemas']['RunStepMarkBody'];

// ============================================================================
// Endpoint Types - Precondition discovery (workspace -> project -> Test/Environment)
// ============================================================================

type RecentProjectsPath = paths['/api/v1/workspaces/{id}/recent-projects']['get'];

/** GET /api/v1/workspaces/{id}/recent-projects response body. */
export type RecentProjectsResponse = RecentProjectsPath['responses']['200']['content']['application/json'];
export type RecentProject = components['schemas']['RecentProject'];

type SearchTestsPath = paths['/api/v1/tests/search']['get'];

/** GET /api/v1/tests/search response body — project-scoped (BK-620-safe). */
export type TestSearchResponse = SearchTestsPath['responses']['200']['content']['application/json'];
export type TestSearchResult = components['schemas']['TestSearchResult'];

type GetTestPath = paths['/api/v1/tests/{id}']['get'];

/** GET /api/v1/tests/{id} response body — the Test with its ATC chain + steps fully expanded. */
export type ExpandedTestResponse = GetTestPath['responses']['200']['content']['application/json'];
export type ExpandedTest = components['schemas']['ExpandedTest'];

type ListProjectEnvironmentsPath = paths['/api/v1/projects/{id}/environments']['get'];

/** GET /api/v1/projects/{id}/environments response body. */
export type ProjectEnvironmentListResponse = ListProjectEnvironmentsPath['responses']['200']['content']['application/json'];
export type ProjectEnvironment = components['schemas']['ProjectEnvironment'];

// Note: the standard `ErrorEnvelope` error shape is re-exported as
// `ApiErrorResponse` from `@schemas/home.types` — not repeated here, since
// `export type *` from the barrel (api/schemas/index.ts) would collide on
// the name if both facades exported it.
