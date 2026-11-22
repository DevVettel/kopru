import { ConfigurationError } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import {
  YURTICI_PRODUCTION_BASE_URL,
  YURTICI_SERVICE_PATH,
  YURTICI_TEST_BASE_URL,
  YurticiConfigSchema,
  yurtici,
} from '../src/index.js';

describe('YurticiConfigSchema', () => {
  it('resolves the service endpoint from sandbox, production or a custom base URL', () => {
    const base = { username: 'u', password: 'p' };
    expect(YurticiConfigSchema.parse(base)).toEqual({
      username: 'u',
      password: 'p',
      paymentType: 'sender',
      language: 'TR',
      endpoint: `${YURTICI_PRODUCTION_BASE_URL}${YURTICI_SERVICE_PATH}`,
    });
    expect(YurticiConfigSchema.parse({ ...base, sandbox: true }).endpoint).toBe(
      `${YURTICI_TEST_BASE_URL}${YURTICI_SERVICE_PATH}`,
    );
    expect(
      YurticiConfigSchema.parse({
        ...base,
        sandbox: true,
        baseUrl: 'http://127.0.0.1:4010/yurtici/',
      }).endpoint,
    ).toBe(`http://127.0.0.1:4010/yurtici${YURTICI_SERVICE_PATH}`);
  });

  it('throws ConfigurationError for invalid configuration without leaking the password', () => {
    expect(() => yurtici({ username: '', password: 'secret-value' })).toThrow(ConfigurationError);
    try {
      yurtici({ username: 'u', password: 'secret-value', baseUrl: 'ftp://x' });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(JSON.stringify(error)).not.toContain('secret-value');
    }
  });
});
