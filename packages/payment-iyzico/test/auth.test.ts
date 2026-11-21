import { describe, expect, it } from 'vitest';
import { computeIyzicoSignature, createIyzicoAuthHeaders } from '../src/auth.js';

// Test vektörü `openssl dgst -sha256 -hmac` ve `openssl base64` ile bağımsız olarak üretilmiştir (NOTES.md §2).
const input = {
  path: '/payment/auth',
  body: '{"locale":"tr","conversationId":"order-1"}',
  randomKey: 'sandbox-rnd-123',
};
const credentials = { apiKey: 'sandbox-api-key', secretKey: 'sandbox-secret-key' };

describe('iyzico IYZWSv2 auth', () => {
  it('computes the HMAC-SHA256 hex signature of randomKey + path + body', () => {
    expect(computeIyzicoSignature(credentials.secretKey, input)).toBe(
      '6e89e9fd499adaa427f5eb25ba7760a76b0edb93389223e474f3d0f37b3680f3',
    );
  });

  it('builds the Authorization and x-iyzi-rnd headers', () => {
    expect(createIyzicoAuthHeaders(credentials, input)).toEqual({
      Authorization:
        'IYZWSv2 YXBpS2V5OnNhbmRib3gtYXBpLWtleSZyYW5kb21LZXk6c2FuZGJveC1ybmQtMTIzJnNpZ25hdHVyZTo2ZTg5ZTlmZDQ5OWFkYWE0MjdmNWViMjViYTc3NjBhNzZiMGVkYjkzMzg5MjIzZTQ3NGYzZDBmMzdiMzY4MGYz',
      'x-iyzi-rnd': 'sandbox-rnd-123',
    });
  });
});
