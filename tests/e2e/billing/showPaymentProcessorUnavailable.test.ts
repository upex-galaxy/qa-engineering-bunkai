/**
 * BK-1110 (regression for BK-827): upgrade page renders only the generic
 * processor message — UI leg.
 *
 * The 503 is mocked at the browser network layer, so this runs on any
 * environment regardless of the payment processor configuration. The real
 * server answer is covered by the API leg
 * (tests/integration/billing/startCheckoutWithoutPaymentProcessor.test.ts).
 *
 * Project: e2e (depends on ui-setup; the test user owns its default workspace).
 */

import { test } from '@TestFixture';

const PROCESSOR_UNAVAILABLE_BODY = {
  error: {
    code: 'payment_processor_unavailable',
    message: 'Payments are temporarily unavailable. Please try again later.',
  },
};

test.describe('BK-1110: Validate the upgrade page when the payment processor is unavailable', { tag: ['@regression'] }, () => {
  test('BK-1110: should render only the generic message on the upgrade page when create-checkout answers 503', async ({ ui, page }) => {
    await page.route('**/api/v1/workspaces/*/billing/checkout', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(PROCESSOR_UNAVAILABLE_BODY) });
    });

    await ui.billing.goto();
    await ui.billing.continueToPaymentShowsGenericProcessorError();
  });
});
