/**
 * KATA Architecture - Layer 3: Billing API Component
 *
 * API component for the self-serve upgrade checkout (BK-230) and its
 * hardening defects: BK-827 (generic processor error), BK-828 (PAT
 * capability gate), BK-829 (workspace-existence non-disclosure).
 *
 * create-checkout requires `workspace:admin` (app ADR-0006): run these with a
 * cookie session (`ApiFixture.useCookieSession()`) or an explicit
 * workspace-bound admin PAT. The server resolves an explicit Bearer before the
 * cookie, so a PAT passed per request is never shadowed by the session.
 *
 * Endpoints:
 * - POST /api/v1/workspaces/{id}/billing/checkout
 * - POST /api/v1/workspaces/{id}/billing/checkout/cancel
 * - POST /api/v1/billing/webhook
 */

import type { APIResponse } from '@playwright/test';
import type { ApiErrorEnvelope, BillingCheckoutBody, CheckoutResult, WorkspaceBillingOverview } from '@schemas/billing.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

export type { ApiErrorEnvelope, BillingCheckoutBody, CheckoutResult } from '@schemas/billing.types';

// ============================================
// Types
// ============================================

export interface StartCheckoutArgs {
  workspaceId: string
  body: BillingCheckoutBody | Record<string, unknown>
  /** `null` omits the Idempotency-Key header; default is a fresh UUID. */
  idempotencyKey?: string | null
  /** Explicit Bearer PAT; omit to authenticate with the context's session. */
  token?: string
}

export interface NonMemberCheckoutArgs {
  workspaceId: string
  body: BillingCheckoutBody | Record<string, unknown>
  withIdempotencyKey: boolean
}

export interface AdminTokenCheckoutArgs {
  workspaceId: string
  token: string
}

export interface InvalidSeatCheckoutArgs {
  workspaceId: string
  seatQuantity: unknown
  expectedCode: 'seat_quantity_invalid' | 'validation_failed'
}

export interface ValidSeatCheckoutArgs {
  workspaceId: string
  seatQuantity: number
}

export type PaymentProcessorState = 'configured' | 'unavailable' | 'unknown';

/** The one client-facing message every billing route uses for an unconfigured processor (lib/billing/stripe.ts). */
export const PAYMENT_PROCESSOR_UNAVAILABLE_MESSAGE = 'Payments are temporarily unavailable. Please try again later.';

// ============================================
// Billing API Component
// ============================================

export class BillingApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (no @atc)
  // ============================================

  /**
   * Helper: POST create-checkout with no assertions. Used for the partitions a
   * test compares itself (non-disclosure equality, token rejections).
   */
  @step
  async startCheckout(args: StartCheckoutArgs): Promise<[APIResponse, CheckoutResult]> {
    const headers: Record<string, string> = {};
    const idempotencyKey = args.idempotencyKey === undefined ? crypto.randomUUID() : args.idempotencyKey;
    if (idempotencyKey !== null) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    if (args.token) {
      headers.Authorization = `Bearer ${args.token}`;
    }
    const [response, body] = await this.apiPOST<CheckoutResult, StartCheckoutArgs['body']>(
      `/v1/workspaces/${args.workspaceId}/billing/checkout`,
      args.body,
      { headers },
    );
    return [response, body];
  }

  /** Helper: read the workspace billing overview (plan, active_seats, ...). Admin/owner only. */
  @step
  async getBillingOverview(workspaceId: string): Promise<[APIResponse, WorkspaceBillingOverview]> {
    return this.apiGET<WorkspaceBillingOverview>(`/v1/workspaces/${workspaceId}/billing`);
  }

  /**
   * Helper: release an open checkout session the test may have opened.
   * Silent-fail (returns the status) — cleanup must never mask a test result.
   */
  @step
  async cancelCheckout(workspaceId: string): Promise<number> {
    const [response] = await this.apiPOST(`/v1/workspaces/${workspaceId}/billing/checkout/cancel`, {}, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    return response.status();
  }

  /**
   * Helper: POST the webhook with a signature header that can never verify.
   * Configured processor -> 400 (bad signature); unconfigured -> 503.
   */
  @step
  async postWebhookWithInvalidSignature(): Promise<[APIResponse, ApiErrorEnvelope]> {
    const [response, body] = await this.apiPOST<ApiErrorEnvelope>('/v1/billing/webhook', {}, {
      headers: { 'stripe-signature': 't=1,v1=invalid' },
    });
    return [response, body];
  }

  /**
   * Helper: detect whether the target environment has a payment processor,
   * without side effects. Silent-fail: anything unexpected is 'unknown', so a
   * regression is never mistaken for a configured processor.
   */
  @step
  async probePaymentProcessor(): Promise<PaymentProcessorState> {
    const [response, body] = await this.postWebhookWithInvalidSignature();
    if (response.status() === 400) {
      return 'configured';
    }
    if (response.status() === 503 && body.error?.code === 'payment_processor_unavailable') {
      return 'unavailable';
    }
    return 'unknown';
  }

  // ============================================
  // ATCs - Complete Test Cases (ACTION + VERIFICATION)
  // ============================================

  /**
   * ATC: a non-member starting checkout gets the owner-only rejection (BK-829).
   *
   * The same 403 must come back whether the workspace exists or not; the
   * caller compares the returned envelopes across partitions.
   *
   * @returns The error envelope with `request_id` removed (comparable across calls)
   */
  @atc('BK-818')
  async startCheckoutAsNonMember(args: NonMemberCheckoutArgs): Promise<ApiErrorEnvelope> {
    const [response, body] = await this.startCheckout({
      workspaceId: args.workspaceId,
      body: args.body,
      idempotencyKey: args.withIdempotencyKey ? undefined : null,
    });

    expect(response.status()).toBe(403);
    expect(body.error?.code).toBe('forbidden');
    expect(body.error?.message).toBe('Only the workspace owner can start a plan upgrade.');
    expect(body.error?.details).toEqual({ reason: 'not_workspace_owner' });

    const { request_id: _requestId, ...error } = body.error!;
    return { error };
  }

  /**
   * ATC: an owner starting checkout without a payment processor gets a
   * generic 503 with no internal detail (BK-827).
   */
  @atc('BK-1110')
  async startCheckoutWithoutPaymentProcessor(workspaceId: string): Promise<ApiErrorEnvelope> {
    const [response, body] = await this.startCheckout({ workspaceId, body: { seat_quantity: 1 } });

    expect(response.status()).toBe(503);
    expect(body.error?.code).toBe('payment_processor_unavailable');
    expect(body.error?.message).toBe(PAYMENT_PROCESSOR_UNAVAILABLE_MESSAGE);
    // Case-insensitive: also rejects env var names such as STRIPE_SECRET_KEY
    expect(JSON.stringify(body)).not.toMatch(/stripe|configured/i);

    return body as ApiErrorEnvelope;
  }

  /**
   * ATC: a workspace:admin PAT bound to the owned workspace passes the
   * checkout capability gate (BK-828).
   *
   * Passing the gate means reaching the payment step: a hosted Checkout URL
   * (processor configured — the opened session is cancelled) or the
   * processor's own 503 (unconfigured). Never a 403.
   */
  @atc('BK-1111')
  async startCheckoutWithWorkspaceAdminToken(args: AdminTokenCheckoutArgs): Promise<APIResponse> {
    const [response, body] = await this.startCheckout({
      workspaceId: args.workspaceId,
      body: { seat_quantity: 1 },
      token: args.token,
    });

    expect(response.status(), JSON.stringify(body.error ?? {})).not.toBe(403);
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      expect(body.url).toContain('checkout.stripe.com');
      await this.cancelCheckout(args.workspaceId);
    }
    else {
      expect(body.error?.code).toBe('payment_processor_unavailable');
    }

    return response;
  }

  /**
   * ATC: an out-of-range or wrongly typed seat quantity is rejected and no
   * checkout starts (BK-230 TC8). Range: [active_seats, 25].
   */
  @atc('BK-814')
  async startCheckoutWithInvalidSeatQuantity(args: InvalidSeatCheckoutArgs): Promise<ApiErrorEnvelope> {
    const [response, body] = await this.startCheckout({
      workspaceId: args.workspaceId,
      body: { seat_quantity: args.seatQuantity },
    });

    expect(response.status(), `seat_quantity ${JSON.stringify(args.seatQuantity)}`).toBe(422);
    expect(body.error?.code).toBe(args.expectedCode);
    expect(body.url).toBeUndefined();

    return body as ApiErrorEnvelope;
  }

  /**
   * ATC: a seat quantity inside [active_seats, 25] passes seat validation and
   * reaches the payment step (BK-230 TC7): a hosted Checkout URL (processor
   * configured — the session is cancelled) or the processor's own 503.
   */
  @atc('BK-813')
  async startCheckoutWithValidSeatQuantity(args: ValidSeatCheckoutArgs): Promise<APIResponse> {
    const [response, body] = await this.startCheckout({
      workspaceId: args.workspaceId,
      body: { seat_quantity: args.seatQuantity },
    });

    expect(response.status(), `seat_quantity ${args.seatQuantity}: ${JSON.stringify(body.error ?? {})}`).not.toBe(422);
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      expect(body.url).toContain('checkout.stripe.com');
      await this.cancelCheckout(args.workspaceId);
    }
    else {
      expect(body.error?.code).toBe('payment_processor_unavailable');
    }

    return response;
  }

  /**
   * ATC: an admin who is not the owner cannot start checkout (BK-230 TC14).
   *
   * Precondition (set by the test): the signed-in identity is an active
   * `admin` member of the workspace.
   */
  @atc('BK-815')
  async startCheckoutAsAdminMember(workspaceId: string): Promise<ApiErrorEnvelope> {
    const [response, body] = await this.startCheckout({ workspaceId, body: { seat_quantity: 1 } });

    expect(response.status()).toBe(403);
    expect(body.error?.code).toBe('forbidden');
    expect(body.error?.details).toEqual({ reason: 'not_workspace_owner' });
    expect(body.url).toBeUndefined();

    return body as ApiErrorEnvelope;
  }
}
