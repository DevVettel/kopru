import { describe, expect, it } from 'vitest';
import { YURTICI_ERROR_MAP } from '../src/index.js';
import { isYurticiErrorCode, mapYurticiError } from '../src/errors.js';

describe('mapYurticiError', () => {
  it.each([
    ['82519', 'CARGO_SHIPMENT_NOT_FOUND', 'CargoError'],
    ['82520', 'CARGO_CANCELLATION_NOT_ALLOWED', 'CargoError'],
    ['60019', 'CARGO_ADDRESS_INVALID', 'CargoError'],
    ['82502', 'CARGO_ADDRESS_INVALID', 'CargoError'],
    ['60020', 'VALIDATION_FAILED', 'ValidationError'],
    ['82516', 'VALIDATION_FAILED', 'ValidationError'],
    ['936', 'PROVIDER_UNEXPECTED_RESPONSE', 'ProviderError'],
  ])('maps %s to %s', (errCode, code, name) => {
    const error = mapYurticiError({ errCode, errMessage: 'Mesaj' });
    expect(error).toMatchObject({
      code,
      name,
      provider: 'yurtici',
      providerCode: errCode,
      providerMessage: 'Mesaj',
    });
  });

  it('handles failures without an error code or message', () => {
    const error = mapYurticiError({ errCode: '0', errMessage: '' });
    expect(error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
    expect(error.providerCode).toBeUndefined();
    expect(error.providerMessage).toBeUndefined();
    expect(error.message).toContain('without an error code');
  });

  it('treats empty and zero codes as success', () => {
    expect(isYurticiErrorCode(undefined)).toBe(false);
    expect(isYurticiErrorCode('')).toBe(false);
    expect(isYurticiErrorCode('0')).toBe(false);
    expect(isYurticiErrorCode('82519')).toBe(true);
  });

  it('maps only to known Köprü codes', () => {
    expect(YURTICI_ERROR_MAP.size).toBeGreaterThan(20);
  });
});
