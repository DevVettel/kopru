import { ConfigurationError } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import {
  IYZICO_PRODUCTION_BASE_URL,
  IYZICO_SANDBOX_BASE_URL,
  IyzicoConfigSchema,
  iyzico,
} from '../src/index.js';

const keys = { apiKey: 'k', secretKey: 's' };

describe('IyzicoConfigSchema', () => {
  it('defaults to production with Turkish locale and physical items', () => {
    expect(IyzicoConfigSchema.parse(keys)).toEqual({
      ...keys,
      baseUrl: IYZICO_PRODUCTION_BASE_URL,
      locale: 'tr',
      basketItemType: 'PHYSICAL',
      defaultItemCategory: 'Genel',
    });
  });

  it('resolves the sandbox URL and lets baseUrl override it (trailing slash removed)', () => {
    expect(IyzicoConfigSchema.parse({ ...keys, sandbox: true }).baseUrl).toBe(
      IYZICO_SANDBOX_BASE_URL,
    );
    expect(
      IyzicoConfigSchema.parse({ ...keys, sandbox: true, baseUrl: 'http://127.0.0.1:1/iyzico/' })
        .baseUrl,
    ).toBe('http://127.0.0.1:1/iyzico');
  });

  it('makes the provider factory throw ConfigurationError for invalid config', () => {
    expect(() => iyzico({ apiKey: '', secretKey: 's' })).toThrow(ConfigurationError);
  });

  it('declares its capabilities', () => {
    const provider = iyzico(keys);
    expect(provider.id).toBe('iyzico');
    expect([...provider.capabilities]).toEqual(['charge', 'threeDS', 'refund', 'installments']);
  });
});
