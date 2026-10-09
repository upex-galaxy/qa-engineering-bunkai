/**
 * KATA Framework - Type Facade: Billing + Tokens Domain
 *
 * Types for the self-serve upgrade checkout (BK-230) and personal access
 * tokens (ADR-0005 / ADR-0006 in the app), derived from the OpenAPI spec.
 *
 * Consumed by: tests/components/api/BillingApi.ts, tests/components/api/TokensApi.ts
 */

import type { components } from '@openapi';

// ============================================================================
// Schema Types - POST /api/v1/workspaces/{id}/billing/checkout
// ============================================================================

export type BillingCheckoutBody = components['schemas']['BillingCheckoutBody'];
export type BillingCheckoutResponse = components['schemas']['BillingCheckoutResponse'];

// ============================================================================
// Schema Types - GET /api/v1/workspaces/{id}/billing
// ============================================================================

export type WorkspaceBillingOverview = components['schemas']['WorkspaceBillingOverview'];

// ============================================================================
// Schema Types - POST /api/v1/tokens
// ============================================================================

export type CreateTokenBody = components['schemas']['CreateTokenBody'];
export type CreateTokenResponse = components['schemas']['CreateTokenResponse'];

// ============================================================================
// Error envelope
// ============================================================================

/**
 * The API error envelope with `code` widened to `string`.
 *
 * The spec's `ErrorEnvelope.code` enum omits `payment_processor_unavailable`,
 * which the billing routes do return (lib/billing/stripe.ts) — documentation
 * drift found while automating BK-1110, so the facade cannot narrow it.
 */
export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    request_id?: string
  }
}

/** A checkout call answers either the hosted Checkout URL or an error envelope. */
export type CheckoutResult = Partial<BillingCheckoutResponse> & Partial<ApiErrorEnvelope>;

/** A token mint answers either the created token or an error envelope. */
export type CreateTokenResult = Partial<CreateTokenResponse> & Partial<ApiErrorEnvelope>;
