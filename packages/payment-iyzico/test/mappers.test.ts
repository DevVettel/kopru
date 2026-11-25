import { ChargeRequestSchema, ThreeDSInitRequestSchema } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import { IyzicoConfigSchema } from '../src/config.js';
import { fromIyzicoAmount, fromIyzicoSystemTime } from '../src/mappers/amount.js';
import {
  formatAddressLine,
  toChargeResult,
  toIyzicoPaymentRequest,
  toIyzicoThreeDSInitRequest,
  toThreeDSInitResult,
} from '../src/mappers/payment.js';
import { toIyzicoRefundRequest, toRefundResult } from '../src/mappers/refund.js';
import { toThreeDSCompletion } from '../src/mappers/three-ds.js';
import { baseBuyer, buyer, chargeInput, threeDSInput } from './fixtures.js';

const config = IyzicoConfigSchema.parse({ apiKey: 'k', secretKey: 's' });
const NOW = new Date('2026-11-21T10:00:00Z');
const charge = (overrides: Record<string, unknown> = {}) =>
  ChargeRequestSchema.parse({ ...chargeInput('5528790000000008'), ...overrides });

const paymentResponse = {
  status: 'success' as const,
  paymentId: '42',
  price: 10.5,
  paidPrice: 10.5,
  currency: 'TRY',
  installment: 1,
  systemTime: Date.parse('2026-11-21T09:00:00Z'),
};

describe('toIyzicoPaymentRequest', () => {
  it('maps a charge request to the iyzico payment request', () => {
    const result = toIyzicoPaymentRequest(charge(), config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const address = {
      contactName: 'Test Kullanıcı',
      city: 'İstanbul',
      country: 'Turkey',
      address: 'Örnek Sokak No: 1, Caferağa, Kadıköy',
      zipCode: '34710',
    };
    expect(result.value).toEqual({
      locale: 'tr',
      conversationId: 'ORDER-1',
      price: '10.50',
      paidPrice: '10.50',
      currency: 'TRY',
      installment: 1,
      basketId: 'ORDER-1',
      paymentChannel: 'WEB',
      paymentGroup: 'PRODUCT',
      paymentCard: {
        cardHolderName: 'Test Kullanıcı',
        cardNumber: '5528790000000008',
        expireMonth: '12',
        expireYear: '2030',
        cvc: '123',
        registerCard: 0,
      },
      buyer: {
        id: 'BUYER-1',
        name: 'Test',
        surname: 'Kullanıcı',
        email: 'test@example.com',
        identityNumber: '10000000146',
        gsmNumber: '+905320000000',
        registrationAddress: 'Örnek Sokak No: 1, Caferağa, Kadıköy',
        city: 'İstanbul',
        country: 'Turkey',
        zipCode: '34710',
        ip: '127.0.0.1',
      },
      shippingAddress: address,
      billingAddress: address,
      basketItems: [
        {
          id: 'ORDER-1',
          name: 'ORDER-1',
          category1: 'Genel',
          itemType: 'PHYSICAL',
          price: '10.50',
        },
      ],
    });
  });

  it('uses explicit items, description-less defaults and the billing address fallback', () => {
    const result = toIyzicoPaymentRequest(
      charge({
        buyer: { ...baseBuyer, identityNumber: buyer.identityNumber },
        billingAddress: { cityCode: '06', district: 'Çankaya', addressLine: 'Cadde 2' },
        items: [
          { id: 'A', name: 'Kitap', category: 'Kitap', price: { value: 50, currency: 'TRY' } },
          {
            id: 'B',
            name: 'Kalem',
            category: 'Kırtasiye',
            price: { value: 1000, currency: 'TRY' },
          },
        ],
      }),
      { ...config, basketItemType: 'VIRTUAL' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.buyer).not.toHaveProperty('gsmNumber');
    expect(result.value.buyer).not.toHaveProperty('ip');
    expect(result.value.buyer).not.toHaveProperty('zipCode');
    expect(result.value.buyer.city).toBe('Ankara');
    expect(result.value.billingAddress).toEqual({
      contactName: 'Test Kullanıcı',
      city: 'Ankara',
      country: 'Turkey',
      address: 'Cadde 2, Çankaya',
    });
    expect(result.value.basketItems).toEqual([
      { id: 'A', name: 'Kitap', category1: 'Kitap', itemType: 'VIRTUAL', price: '0.50' },
      { id: 'B', name: 'Kalem', category1: 'Kırtasiye', itemType: 'VIRTUAL', price: '10.00' },
    ]);
  });

  it('uses the description as the single basket item name', () => {
    const result = toIyzicoPaymentRequest(charge({ description: 'Sipariş' }), config);
    expect(result.ok && result.value.basketItems[0]?.name).toBe('Sipariş');
  });

  it('returns VALIDATION_FAILED when iyzico-required buyer fields are missing', () => {
    const result = toIyzicoPaymentRequest(charge({ buyer: baseBuyer }), config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.details).toEqual({
      issues: [
        expect.objectContaining({ path: 'buyer.identityNumber' }),
        expect.objectContaining({ path: 'buyer.address' }),
      ],
    });
  });

  it('adds the callback URL for 3DS initialization and propagates validation errors', () => {
    const ok = toIyzicoThreeDSInitRequest(ThreeDSInitRequestSchema.parse(threeDSInput()), config);
    expect(ok.ok && ok.value.callbackUrl).toBe('https://shop.example/3ds/callback');
    const failed = toIyzicoThreeDSInitRequest(
      ThreeDSInitRequestSchema.parse({
        ...threeDSInput(),
        buyer: { ...baseBuyer, address: buyer.address },
      }),
      config,
    );
    expect(failed.ok).toBe(false);
  });

  it('formats an address without neighborhood', () => {
    expect(formatAddressLine({ cityCode: '35', district: 'Konak', addressLine: 'Sokak 3' })).toBe(
      'Sokak 3, Konak',
    );
  });
});

describe('response mappers', () => {
  it('maps a payment response to ChargeResult', () => {
    const result = toChargeResult(
      { ...paymentResponse, binNumber: '552879', lastFourDigits: '0008', cardFamily: 'Bonus' },
      'ORDER-1',
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        transactionId: '42',
        orderId: 'ORDER-1',
        amount: { value: 1050, currency: 'TRY' },
        installments: 1,
        createdAt: '2026-11-21T12:00:00+03:00',
        cardBin: '552879',
        cardLastFour: '0008',
        cardFamily: 'Bonus',
      },
    });
  });

  it('rejects fraud-rejected payments and unsupported currencies', () => {
    const fraud = toChargeResult({ ...paymentResponse, fraudStatus: -1 }, 'ORDER-1', NOW);
    expect(!fraud.ok && fraud.error.code).toBe('PAYMENT_FRAUD_SUSPECTED');
    const gbp = toChargeResult({ ...paymentResponse, currency: 'GBP' }, 'ORDER-1', NOW);
    expect(!gbp.ok && gbp.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
  });

  it('converts amounts without floating point arithmetic', () => {
    expect(fromIyzicoAmount(0.1, 'TRY')).toEqual({
      ok: true,
      value: { value: 10, currency: 'TRY' },
    });
    expect(fromIyzicoAmount(1234.56, 'EUR')).toEqual({
      ok: true,
      value: { value: 123456, currency: 'EUR' },
    });
    expect(fromIyzicoAmount(1.005, 'TRY').ok).toBe(false);
  });

  it('falls back to the injected clock when systemTime is missing', () => {
    expect(fromIyzicoSystemTime(undefined, NOW)).toBe('2026-11-21T13:00:00+03:00');
  });

  it('decodes the 3DS page', () => {
    const html = '<form>3ds</form>';
    const result = toThreeDSInitResult(
      {
        status: 'success',
        threeDSHtmlContent: Buffer.from(html).toString('base64'),
        paymentId: '7',
      },
      'ORDER-1',
    );
    expect(result).toEqual({
      ok: true,
      value: { orderId: 'ORDER-1', transactionId: '7', action: { type: 'html', html } },
    });
    const withoutId = toThreeDSInitResult(
      { status: 'success', threeDSHtmlContent: Buffer.from(html).toString('base64') },
      'ORDER-1',
    );
    expect(withoutId.ok && withoutId.value).not.toHaveProperty('transactionId');
    const empty = toThreeDSInitResult({ status: 'success', threeDSHtmlContent: 'ICAg' }, 'O');
    expect(!empty.ok && empty.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
  });

  it('builds refund requests and results', () => {
    expect(toIyzicoRefundRequest({ ...paymentResponse, paidPrice: 12 }, config)).toEqual({
      ok: true,
      value: { locale: 'tr', paymentId: '42', price: '12.00', currency: 'TRY' },
    });
    expect(toIyzicoRefundRequest({ ...paymentResponse, currency: 'XXX' }, config).ok).toBe(false);

    const base = { status: 'success' as const, paymentId: '42', price: 10.5, currency: 'TRY' };
    const refunded = toRefundResult(
      { ...base, refundHostReference: 'R', hostReference: 'H' },
      '42',
      NOW,
    );
    expect(refunded.ok && refunded.value).toEqual({
      refundId: 'R',
      transactionId: '42',
      amount: { value: 1050, currency: 'TRY' },
      createdAt: '2026-11-21T13:00:00+03:00',
    });
    const cancelled = toRefundResult({ ...base, cancelHostReference: 'C' }, '42', NOW);
    expect(cancelled.ok && cancelled.value.refundId).toBe('C');
    const host = toRefundResult({ ...base, hostReference: 'H' }, '42', NOW);
    expect(host.ok && host.value.refundId).toBe('H');
    const bare = toRefundResult(base, '42', NOW);
    expect(bare.ok && bare.value.refundId).toBe('42');
    expect(toRefundResult({ ...base, currency: 'XXX' }, '42', NOW).ok).toBe(false);
  });
});

describe('toThreeDSCompletion', () => {
  const payload = {
    status: 'success',
    paymentId: '42',
    conversationId: 'ORDER-1',
    conversationData: '',
    mdStatus: '1',
  };

  it('builds the 3DS auth request from a successful callback', () => {
    expect(toThreeDSCompletion({ payload }, config)).toEqual({
      ok: true,
      value: {
        callbackOrderId: 'ORDER-1',
        request: { locale: 'tr', conversationId: 'ORDER-1', paymentId: '42' },
      },
    });
    const withData = toThreeDSCompletion(
      { payload: { ...payload, conversationData: 'abc', conversationId: '' } },
      config,
    );
    expect(withData).toEqual({
      ok: true,
      value: {
        callbackOrderId: undefined,
        request: { locale: 'tr', paymentId: '42', conversationData: 'abc' },
      },
    });
  });

  it.each([
    [{ ...payload, mdStatus: '0' }, '0'],
    [{ ...payload, status: 'failure', mdStatus: '4' }, '4'],
    [{ status: 'failure' }, undefined],
  ])('returns PAYMENT_THREEDS_FAILED for %o', (failed, providerCode) => {
    const result = toThreeDSCompletion({ payload: failed }, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PAYMENT_THREEDS_FAILED');
    expect(result.error.providerCode).toBe(providerCode);
  });

  it('rejects payloads that are not iyzico callbacks', () => {
    const result = toThreeDSCompletion({ payload: {} }, config);
    expect(!result.ok && result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
  });
});
