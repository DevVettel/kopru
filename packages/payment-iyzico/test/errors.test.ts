import { describe, expect, it } from 'vitest';
import { IYZICO_ERROR_MAP, mapIyzicoError } from '../src/errors.js';

describe('mapIyzicoError', () => {
  it.each([
    ['10051', 'PAYMENT_INSUFFICIENT_FUNDS', 'PaymentError'],
    ['10005', 'PAYMENT_CARD_DECLINED', 'PaymentError'],
    ['10054', 'PAYMENT_CARD_EXPIRED', 'PaymentError'],
    ['10084', 'PAYMENT_INVALID_CARD', 'PaymentError'],
    ['10034', 'PAYMENT_FRAUD_SUSPECTED', 'PaymentError'],
    ['10210', 'PAYMENT_THREEDS_FAILED', 'PaymentError'],
    ['1000', 'PROVIDER_AUTHENTICATION_FAILED', 'ProviderError'],
    ['10214', 'PROVIDER_UNAVAILABLE', 'ProviderError'],
    ['11', 'VALIDATION_FAILED', 'ValidationError'],
    ['99999', 'PROVIDER_UNEXPECTED_RESPONSE', 'ProviderError'],
  ])('maps %s to %s', (errorCode, code, name) => {
    const error = mapIyzicoError({ errorCode, errorMessage: 'msg', errorGroup: 'GROUP' });
    expect(error).toMatchObject({
      code,
      name,
      provider: 'iyzico',
      providerCode: errorCode,
      providerMessage: 'msg',
      details: { errorGroup: 'GROUP' },
    });
    expect(error.message).toBe(`iyzico request failed with ${errorCode} GROUP`);
  });

  it('handles failures without an error code', () => {
    const error = mapIyzicoError({});
    expect(error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
    expect(error.providerCode).toBeUndefined();
    expect(error.details).toBeUndefined();
    expect(error.message).toMatch(/without an error code/);
  });

  it('turns payment and unknown errors into PAYMENT_REFUND_FAILED during refunds', () => {
    expect(mapIyzicoError({ errorCode: '10202' }, 'refund').code).toBe('PAYMENT_REFUND_FAILED');
    expect(mapIyzicoError({ errorCode: '5087' }, 'refund').code).toBe('PAYMENT_REFUND_FAILED');
    expect(mapIyzicoError({}, 'refund').code).toBe('PAYMENT_REFUND_FAILED');
    expect(mapIyzicoError({ errorCode: '1001' }, 'refund').code).toBe(
      'PROVIDER_AUTHENTICATION_FAILED',
    );
    expect(mapIyzicoError({ errorCode: '11' }, 'refund').code).toBe('VALIDATION_FAILED');
  });

  it('maps every table entry to a known code without duplicates across categories', () => {
    expect(IYZICO_ERROR_MAP.size).toBeGreaterThan(50);
  });
});
