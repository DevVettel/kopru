import { base64Decode, base64Encode, hmac } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  IYZICO_MOCK_API_KEY,
  IYZICO_MOCK_NON_REFUNDABLE_CARD,
  IYZICO_MOCK_SECRET_KEY,
  IYZICO_MOCK_SETTLED_CARD,
  IYZICO_MOCK_SUCCESS_CARD,
  IYZICO_MOCK_THREEDS_INIT_FAIL_CARD,
  IYZICO_MOCK_THREEDS_MD0_CARD,
  createMockApp,
  iyzicoPlugin,
  verifyIyzicoAuthorization,
} from '../src/index.js';

function sign(path: string, body: string, secret = IYZICO_MOCK_SECRET_KEY) {
  const randomKey = 'rnd-1';
  const signature = hmac('sha256', secret, `${randomKey}${path}${body}`, 'hex');
  const auth = base64Encode(
    `apiKey:${IYZICO_MOCK_API_KEY}&randomKey:${randomKey}&signature:${signature}`,
  );
  return { Authorization: `IYZWSv2 ${auth}`, 'x-iyzi-rnd': randomKey };
}

function setup() {
  const { app } = createMockApp({ plugins: [iyzicoPlugin] });
  return async (path: string, payload: unknown, secret?: string) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const response = await app.request(`/iyzico${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sign(path, body, secret) },
      body,
    });
    const json = z.record(z.string(), z.unknown()).parse(await response.json());
    return { status: response.status, json };
  };
}

const payment = (cardNumber: string, extra: Record<string, unknown> = {}) => ({
  locale: 'tr',
  conversationId: 'ORDER-1',
  price: '10.50',
  paidPrice: '10.50',
  currency: 'TRY',
  installment: 1,
  basketId: 'ORDER-1',
  paymentCard: { cardNumber },
  buyer: { identityNumber: '10000000146' },
  billingAddress: { address: 'Adres' },
  basketItems: [{ price: '10.50' }],
  ...extra,
});

describe('verifyIyzicoAuthorization', () => {
  it('accepts a valid signature and rejects tampering', () => {
    const headers = sign('/payment/auth', '{}');
    expect(verifyIyzicoAuthorization(headers.Authorization, 'rnd-1', '/payment/auth', '{}')).toBe(
      true,
    );
    expect(
      verifyIyzicoAuthorization(headers.Authorization, 'rnd-1', '/payment/auth', '{"a":1}'),
    ).toBe(false);
    expect(verifyIyzicoAuthorization(undefined, 'rnd-1', '/payment/auth', '{}')).toBe(false);
    expect(verifyIyzicoAuthorization('Bearer x', 'rnd-1', '/payment/auth', '{}')).toBe(false);
  });
});

describe('iyzicoPlugin', () => {
  it('rejects an invalid signature with 1000', async () => {
    const call = setup();
    const result = await call('/payment/auth', payment(IYZICO_MOCK_SUCCESS_CARD), 'wrong');
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ status: 'failure', errorCode: '1000' });
  });

  it('rejects malformed bodies with 11 and basket mismatches with 5062', async () => {
    const call = setup();
    expect((await call('/payment/auth', 'not-json')).json).toMatchObject({ errorCode: '11' });
    expect((await call('/payment/auth', { price: 1 })).json).toMatchObject({ errorCode: '11' });
    const mismatch = payment(IYZICO_MOCK_SUCCESS_CARD, { basketItems: [{ price: '1.00' }] });
    expect((await call('/payment/auth', mismatch)).json).toMatchObject({ errorCode: '5062' });
  });

  it('charges successfully and exposes the payment through detail', async () => {
    const call = setup();
    const charged = await call('/payment/auth', payment(IYZICO_MOCK_SUCCESS_CARD));
    expect(charged.json).toMatchObject({
      status: 'success',
      paymentId: '10000001',
      paidPrice: 10.5,
      conversationId: 'ORDER-1',
      binNumber: '552879',
      lastFourDigits: '0008',
    });
    const detail = await call('/payment/detail', { paymentId: '10000001' });
    expect(detail.json).toMatchObject({ status: 'success', paidPrice: 10.5 });
    expect((await call('/payment/detail', { paymentId: '1' })).json).toMatchObject({
      errorCode: '5087',
    });
  });

  it('returns the card-specific error for failure cards', async () => {
    const call = setup();
    const result = await call('/payment/auth', payment('4111111111111129'));
    expect(result.json).toMatchObject({ status: 'failure', errorCode: '10051' });
  });

  it('cancels same-day payments and refunds settled ones', async () => {
    const call = setup();
    await call('/payment/auth', payment(IYZICO_MOCK_SUCCESS_CARD));
    await call('/payment/auth', payment(IYZICO_MOCK_SETTLED_CARD));
    await call('/payment/auth', payment(IYZICO_MOCK_NON_REFUNDABLE_CARD));

    const sameDay = await call('/v2/payment/refund', { paymentId: '10000001', price: '10.50' });
    expect(sameDay.json).toMatchObject({ errorCode: '10223' });
    const cancelled = await call('/payment/cancel', { paymentId: '10000001' });
    expect(cancelled.json).toMatchObject({ status: 'success', price: 10.5 });
    expect((await call('/payment/cancel', { paymentId: '10000001' })).json).toMatchObject({
      errorCode: '5087',
    });

    const tooMuch = await call('/v2/payment/refund', { paymentId: '10000002', price: '99.00' });
    expect(tooMuch.json).toMatchObject({ errorCode: '10232' });
    expect((await call('/payment/cancel', { paymentId: '10000002' })).json).toMatchObject({
      errorCode: '10202',
    });
    const refunded = await call('/v2/payment/refund', { paymentId: '10000002', price: '10.50' });
    expect(refunded.json).toMatchObject({
      status: 'success',
      refundHostReference: 'mock-refund-10000002',
    });

    expect(
      (await call('/v2/payment/refund', { paymentId: '10000003', price: '10.50' })).json,
    ).toMatchObject({ errorCode: '10202' });
    expect((await call('/payment/cancel', { paymentId: '10000003' })).json).toMatchObject({
      errorCode: '10202',
    });
  });

  it('runs the 3DS flow: initialize page posts the callback fields, auth completes it', async () => {
    const call = setup();
    const init = await call(
      '/payment/3dsecure/initialize',
      payment(IYZICO_MOCK_SUCCESS_CARD, { callbackUrl: 'https://shop.example/cb' }),
    );
    expect(init.json).toMatchObject({ status: 'success', paymentId: '10000001' });
    const html = base64Decode(String(init.json.threeDSHtmlContent));
    expect(html).toContain('action="https://shop.example/cb"');
    expect(html).toContain('name="mdStatus" value="1"');
    expect(html).toContain('name="status" value="success"');

    expect((await call('/payment/detail', { paymentId: '10000001' })).json).toMatchObject({
      errorCode: '5087',
    });
    const auth = await call('/payment/3dsecure/auth', { paymentId: '10000001' });
    expect(auth.json).toMatchObject({ status: 'success', mdStatus: 1, paymentId: '10000001' });
    expect((await call('/payment/3dsecure/auth', { paymentId: '10000001' })).json).toMatchObject({
      errorCode: '5087',
    });
  });

  it('simulates failed 3DS verification and initialization', async () => {
    const call = setup();
    const init = await call(
      '/payment/3dsecure/initialize',
      payment(IYZICO_MOCK_THREEDS_MD0_CARD, { callbackUrl: 'https://shop.example/cb' }),
    );
    const html = base64Decode(String(init.json.threeDSHtmlContent));
    expect(html).toContain('name="status" value="failure"');
    expect(html).toContain('name="mdStatus" value="0"');
    const auth = await call('/payment/3dsecure/auth', { paymentId: '10000001' });
    expect(auth.json).toMatchObject({ status: 'failure', mdStatus: 0 });

    const failedInit = await call(
      '/payment/3dsecure/initialize',
      payment(IYZICO_MOCK_THREEDS_INIT_FAIL_CARD, { callbackUrl: 'https://shop.example/cb' }),
    );
    expect(failedInit.json).toMatchObject({ status: 'failure', errorCode: '10202' });
  });

  it('fails 3DS completion with the card error for failure cards', async () => {
    const call = setup();
    await call(
      '/payment/3dsecure/initialize',
      payment('4129111111111111', { callbackUrl: 'https://shop.example/cb' }),
    );
    const auth = await call('/payment/3dsecure/auth', { paymentId: '10000001' });
    expect(auth.json).toMatchObject({ status: 'failure', errorCode: '10005' });
  });
});
