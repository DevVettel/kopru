import {
  createHttpClient,
  createPaymentClient,
  ok,
  type HttpClient,
  type HttpResponse,
} from '@kopru/core';
import {
  IYZICO_MOCK_NON_REFUNDABLE_CARD,
  IYZICO_MOCK_SETTLED_CARD,
  IYZICO_MOCK_THREEDS_INIT_FAIL_CARD,
  IYZICO_MOCK_THREEDS_MD0_CARD,
  IYZICO_MOCK_TIMEOUT_CARD,
} from '@kopru/mock-server';
import { describe, expect, it } from 'vitest';
import { iyzico } from '../src/index.js';
import { baseBuyer, buyer, chargeInput, mockConfig, threeDSInput } from './fixtures.js';

const client = (overrides: Parameters<typeof mockConfig>[0] = {}) =>
  createPaymentClient({ provider: iyzico(mockConfig(overrides)) });

/** Mock 3DS sayfasındaki gizli form alanlarını callback verisine çevirir (tarayıcının yapacağı POST). */
function callbackFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/name="([^"]+)" value="([^"]*)"/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) fields[name] = value;
  }
  return fields;
}

/** Her isteğe aynı yanıtı veren sahte HTTP istemcisi. */
function stubHttp(response: HttpResponse): HttpClient & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    request(request) {
      paths.push(new URL(request.url).pathname);
      return Promise.resolve(ok(response));
    },
  };
}

describe('iyzico provider against the mock server', () => {
  it('charges a card (non-3DS)', async () => {
    const result = await client().charge(chargeInput());
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      orderId: 'ORDER-1',
      amount: { value: 1050, currency: 'TRY' },
      installments: 1,
      cardBin: '552879',
      cardLastFour: '0008',
    });
  });

  it.each([
    ['4111111111111129', 'PAYMENT_INSUFFICIENT_FUNDS', '10051'],
    ['4129111111111111', 'PAYMENT_CARD_DECLINED', '10005'],
    ['4125111111111115', 'PAYMENT_CARD_EXPIRED', '10054'],
    ['4124111111111116', 'PAYMENT_INVALID_CARD', '10084'],
    ['4121111111111119', 'PAYMENT_FRAUD_SUSPECTED', '10034'],
  ])('maps the failure card %s to %s', async (card, code, providerCode) => {
    const result = await client().charge(chargeInput(card));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ code, providerCode, provider: 'iyzico' });
  });

  it('supports installments', async () => {
    const result = await client().charge({ ...chargeInput(), installments: 3 });
    expect(result.ok && result.value.installments).toBe(3);
  });

  it('returns VALIDATION_FAILED without a network call when iyzico-required fields are missing', async () => {
    const http = stubHttp({ status: 200, headers: {}, body: '{}' });
    const payments = createPaymentClient({ provider: iyzico(mockConfig()), http });
    const result = await payments.charge({
      ...chargeInput(),
      buyer: { ...baseBuyer, address: buyer.address },
    });
    expect(!result.ok && result.error.code).toBe('VALIDATION_FAILED');
    expect(http.paths).toHaveLength(0);
  });

  it('fails with PROVIDER_AUTHENTICATION_FAILED for wrong credentials', async () => {
    const result = await client({ secretKey: 'wrong' }).charge(chargeInput());
    expect(!result.ok && result.error.code).toBe('PROVIDER_AUTHENTICATION_FAILED');
  });

  it('times out with NETWORK_TIMEOUT', async () => {
    const payments = createPaymentClient({
      provider: iyzico(mockConfig()),
      http: { timeoutMs: 200 },
    });
    const result = await payments.charge(chargeInput(IYZICO_MOCK_TIMEOUT_CARD));
    expect(!result.ok && result.error.code).toBe('NETWORK_TIMEOUT');
  });

  describe('3D Secure', () => {
    it('initializes, then completes with the callback payload', async () => {
      const payments = client();
      const init = await payments.initThreeDS(threeDSInput());
      expect(init.ok, init.ok ? '' : init.error.message).toBe(true);
      if (!init.ok || init.value.action.type !== 'html') return;
      expect(init.value.transactionId).toBeDefined();

      const payload = callbackFields(init.value.action.html);
      expect(payload).toMatchObject({ status: 'success', mdStatus: '1' });
      const completed = await payments.completeThreeDS({ payload });
      expect(completed.ok, completed.ok ? '' : completed.error.message).toBe(true);
      if (!completed.ok) return;
      expect(completed.value).toMatchObject({
        transactionId: init.value.transactionId,
        orderId: 'ORDER-1',
        amount: { value: 1050, currency: 'TRY' },
      });
    });

    it('fails with PAYMENT_THREEDS_FAILED when mdStatus is not 1 (no auth call)', async () => {
      const payments = client();
      const init = await payments.initThreeDS(threeDSInput(IYZICO_MOCK_THREEDS_MD0_CARD));
      if (!init.ok || init.value.action.type !== 'html') throw new Error('init failed');
      const result = await payments.completeThreeDS({
        payload: callbackFields(init.value.action.html),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatchObject({ code: 'PAYMENT_THREEDS_FAILED', providerCode: '0' });
    });

    it('maps card errors returned by the 3DS auth call', async () => {
      const payments = client();
      const init = await payments.initThreeDS(threeDSInput('4111111111111129'));
      if (!init.ok || init.value.action.type !== 'html') throw new Error('init failed');
      const result = await payments.completeThreeDS({
        payload: callbackFields(init.value.action.html),
      });
      expect(!result.ok && result.error.code).toBe('PAYMENT_INSUFFICIENT_FUNDS');
    });

    it('returns the initialization failure', async () => {
      const result = await client().initThreeDS(threeDSInput(IYZICO_MOCK_THREEDS_INIT_FAIL_CARD));
      expect(!result.ok && result.error.providerCode).toBe('10202');
    });

    it('fails when neither the callback nor the response carries the order id', async () => {
      const http = stubHttp({
        status: 200,
        headers: {},
        body: JSON.stringify({
          status: 'success',
          paymentId: '1',
          price: 1,
          paidPrice: 1,
          currency: 'TRY',
          installment: 1,
        }),
      });
      const payments = createPaymentClient({ provider: iyzico(mockConfig()), http });
      const result = await payments.completeThreeDS({
        payload: { status: 'success', paymentId: '1', mdStatus: '1' },
      });
      expect(!result.ok && result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
      expect(http.paths).toEqual(['/iyzico/payment/3dsecure/auth']);
    });
  });

  describe('refund', () => {
    it('cancels a same-day payment after the refund endpoint asks for day end', async () => {
      const payments = client();
      const charged = await payments.charge(chargeInput());
      if (!charged.ok) throw new Error(charged.error.message);
      const refunded = await payments.refund({ transactionId: charged.value.transactionId });
      expect(refunded.ok, refunded.ok ? '' : refunded.error.message).toBe(true);
      if (!refunded.ok) return;
      expect(refunded.value).toMatchObject({
        refundId: `mock-cancel-${charged.value.transactionId}`,
        transactionId: charged.value.transactionId,
        amount: { value: 1050, currency: 'TRY' },
      });
    });

    it('refunds a settled payment with the amount-based refund endpoint', async () => {
      const payments = client();
      const charged = await payments.charge(chargeInput(IYZICO_MOCK_SETTLED_CARD));
      if (!charged.ok) throw new Error(charged.error.message);
      const refunded = await payments.refund({ transactionId: charged.value.transactionId });
      expect(refunded.ok && refunded.value.refundId).toBe(
        `mock-refund-${charged.value.transactionId}`,
      );
      const again = await payments.refund({ transactionId: charged.value.transactionId });
      expect(!again.ok && again.error.code).toBe('PAYMENT_REFUND_FAILED');
    });

    it('fails with PAYMENT_REFUND_FAILED for unknown or non-refundable payments', async () => {
      const payments = client();
      const unknown = await payments.refund({ transactionId: '1' });
      expect(!unknown.ok && unknown.error).toMatchObject({
        code: 'PAYMENT_REFUND_FAILED',
        providerCode: '5087',
      });

      const charged = await payments.charge(chargeInput(IYZICO_MOCK_NON_REFUNDABLE_CARD));
      if (!charged.ok) throw new Error(charged.error.message);
      const refunded = await payments.refund({ transactionId: charged.value.transactionId });
      expect(!refunded.ok && refunded.error.code).toBe('PAYMENT_REFUND_FAILED');
    });

    it('stops when the cancel fallback fails', async () => {
      const responses = [
        {
          status: 'success',
          paymentId: '1',
          price: 1,
          paidPrice: 1,
          currency: 'TRY',
          installment: 1,
        },
        { status: 'failure', errorCode: '10223' },
        { status: 'failure', errorCode: '10202' },
      ];
      const http: HttpClient = {
        request: () =>
          Promise.resolve(
            ok({ status: 200, headers: {}, body: JSON.stringify(responses.shift()) }),
          ),
      };
      const payments = createPaymentClient({ provider: iyzico(mockConfig()), http });
      const result = await payments.refund({ transactionId: '1' });
      expect(!result.ok && result.error).toMatchObject({
        code: 'PAYMENT_REFUND_FAILED',
        providerCode: '10202',
      });
    });

    it('rejects payment details in an unsupported currency', async () => {
      const http = stubHttp({
        status: 200,
        headers: {},
        body: JSON.stringify({
          status: 'success',
          paymentId: '1',
          price: 1,
          paidPrice: 1,
          currency: 'GBP',
          installment: 1,
        }),
      });
      const payments = createPaymentClient({ provider: iyzico(mockConfig()), http });
      const result = await payments.refund({ transactionId: '1' });
      expect(!result.ok && result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
      expect(http.paths).toEqual(['/iyzico/payment/detail']);
    });
  });

  describe('response handling', () => {
    const chargeWith = (response: HttpResponse) =>
      createPaymentClient({ provider: iyzico(mockConfig()), http: stubHttp(response) }).charge(
        chargeInput(),
      );

    it('maps non-JSON 5xx responses to PROVIDER_UNAVAILABLE', async () => {
      const result = await chargeWith({ status: 503, headers: {}, body: '<html>down</html>' });
      expect(!result.ok && result.error.code).toBe('PROVIDER_UNAVAILABLE');
    });

    it('maps unrecognized responses to PROVIDER_UNEXPECTED_RESPONSE', async () => {
      const result = await chargeWith({ status: 200, headers: {}, body: '{"foo":1}' });
      expect(!result.ok && result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
    });

    it('maps successful responses that miss required fields to PROVIDER_UNEXPECTED_RESPONSE', async () => {
      const result = await chargeWith({ status: 200, headers: {}, body: '{"status":"success"}' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
      expect(JSON.stringify(result.error.details)).toContain('"path":"paymentId"');
    });

    it('sends a signed JSON request and never logs card data or secrets', async () => {
      const logged: string[] = [];
      const http = createHttpClient({
        hooks: {
          onRequest: (event) => {
            logged.push(JSON.stringify(event));
          },
        },
      });
      const payments = createPaymentClient({ provider: iyzico(mockConfig()), http });
      await payments.charge(chargeInput());
      const log = logged.join('\n');
      expect(log).toContain('/iyzico/payment/auth');
      expect(log).not.toContain('5528790000000008');
      expect(log).not.toContain('10000000146');
      expect(log).not.toMatch(/IYZWSv2 [A-Za-z0-9+/=]{20,}/);
      expect(log).not.toContain('"cvc":"123"');
    });
  });
});
