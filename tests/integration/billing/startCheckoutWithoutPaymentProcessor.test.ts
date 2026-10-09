/**
 * BK-1110 (regression for BK-827): generic 503 when the payment processor is
 * not configured — API leg.
 *
 * Only reproducible on an environment WITHOUT a payment processor. The test
 * probes the webhook first and skips by name when the processor is
 * configured; any other unexpected answer still runs (and fails) the ATC.
 *
 * Project: integration (depends on api-setup). Auth: cookie session (ADR-0002).
 */

import { config, expect, test } from '@TestFixture';

test.describe('BK-1110: Validate billing checkout error handling when the payment processor is unavailable', { tag: ['@regression'] }, () => {
  // The smoke project applies the browser storageState to `request`; start from
  // an empty cookie jar so the identity is the one the test sets.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('BK-1110: should answer a generic 503 on checkout and webhook when the payment processor is not configured', { tag: ['@requires-no-payment-processor'] }, async ({ api }) => {
    const processorState = await api.billing.probePaymentProcessor();
    test.skip(processorState === 'configured', 'payment processor is configured here: the unconfigured path is not reproducible');

    await api.useCookieSession(config.testUser);
    const ownWorkspace = (await api.home.listWorkspaces()).find(workspace => workspace.role === 'owner' && workspace.plan === 'community');
    test.skip(!ownWorkspace, 'the test user owns no community workspace');

    const checkoutError = await api.billing.startCheckoutWithoutPaymentProcessor(ownWorkspace!.id);

    // Same root condition, same answer on the webhook route
    const [webhookResponse, webhookBody] = await api.billing.postWebhookWithInvalidSignature();
    expect(webhookResponse.status()).toBe(503);
    expect(webhookBody.error.code).toBe(checkoutError.error.code);
    expect(webhookBody.error.message).toBe(checkoutError.error.message);
  });
});
