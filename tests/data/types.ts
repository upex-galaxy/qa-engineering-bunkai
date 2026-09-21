/**
 * KATA Architecture - Test Data Types
 *
 * Types for test data generation and fixture state.
 * These are TEST-ONLY concepts — NOT API contract types.
 *
 * API contract types (request/response schemas) belong in:
 *   api/schemas/{domain}.types.ts → import from '@schemas/{domain}.types'
 */

// ============================================
// Generic Types
// ============================================

export interface TestUser {
  email: string
  password: string
  name: string
  firstName?: string
  lastName?: string
}

export interface TestCredentials {
  email: string
  password: string
}

// ============================================
// Project-Specific Types (example structure)
// ============================================

export interface TestHotel {
  name: string
  organizationId?: number
  invoiceCap?: number
}

export interface TestBooking {
  confirmationNumber: string
  hotelId: number
  stayValue: number
  checkInDate: string
  emailHash?: string
}

// ============================================
// BK-256 — Run lifecycle test data (RunsApi preconditions)
// ============================================

/**
 * Intent to start a Run, as constructed by test preconditions from
 * discovered Test/Environment ids (see automation-plan.md HD-T01 §4).
 * Field names mirror the real `RunCreateBody` API contract
 * (api/schemas/runs.types.ts) — `executor_mode`, not `actor`, since cookie
 * sessions always run as `human` regardless (D3).
 */
export interface RunCreatePayload {
  test_id: string
  environment_id: string
  executor_mode?: 'human' | 'agent' | 'ci'
}

// ============================================
// BK-260 — Recent-activity precondition test data
// ============================================

/**
 * PATCH /api/v1/modules/{id} rename intent (ModulesApi.renameModule) —
 * produces the `module.renamed` activity event BK-624's module row / BK-631's
 * Workspace-A seed event need. Test-only concept, not the full
 * `ModuleUpdateBody` API contract (which also allows description/move) —
 * see api/schemas/modules.types.ts for that.
 */
export interface ModuleRenamePayload {
  name: string
}

// ============================================
// Auth/Fixture State Types
// ============================================

/**
 * Stored API state for test fixtures
 * Used by setup files and TestFixture for token propagation
 */
export interface ApiState {
  token: string
  tokenType: string
  expiresIn: number
  refreshToken: string | null
  source: 'ui-login' | 'api-login'
  createdAt: string
}
