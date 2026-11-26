/**
 * Yayımlanan paketleri ESM tüketicisi gibi kullanır: tipler `.d.ts`, kod `.js` girişinden gelir.
 * Tüketici projede `tsc` ile denetlenir ve Node.js tip silme ile çalıştırılır.
 */
import assert from 'node:assert/strict';
import {
  createCargoClient,
  createPaymentClient,
  isKopruError,
  KopruError,
  MoneySchema,
  type ChargeRequestInput,
} from '@kopru/core';
import { iyzico } from '@kopru/iyzico';
import {
  IYZICO_MOCK_API_KEY,
  IYZICO_MOCK_SECRET_KEY,
  IYZICO_MOCK_SUCCESS_CARD,
  YURTICI_MOCK_DELIVERED_KEY,
  YURTICI_MOCK_PASSWORD,
  YURTICI_MOCK_USERNAME,
  startMockServer,
} from '@kopru/mock-server';
import { yurtici } from '@kopru/yurtici';

// ESM-only alt giriş: Vitest kurulu olmadığı için yüklenmez, yalnızca çözümlenebildiği denetlenir.
assert.match(import.meta.resolve('@kopru/core/testing'), /\/dist\/testing\/index\.js$/);

assert.equal(MoneySchema.parse({ value: 100, currency: 'TRY' }).value, 100);

const server = await startMockServer();
try {
  const payments = createPaymentClient({
    provider: iyzico({
      apiKey: IYZICO_MOCK_API_KEY,
      secretKey: IYZICO_MOCK_SECRET_KEY,
      baseUrl: `${server.url}/iyzico`,
    }),
  });
  const cargo = createCargoClient({
    provider: yurtici({
      username: YURTICI_MOCK_USERNAME,
      password: YURTICI_MOCK_PASSWORD,
      baseUrl: `${server.url}/yurtici`,
    }),
  });

  const request: ChargeRequestInput = {
    orderId: 'SMOKE-ESM-1',
    amount: { value: 1_000, currency: 'TRY' },
    card: {
      holderName: 'Ada Yilmaz',
      number: IYZICO_MOCK_SUCCESS_CARD,
      expiry: '12/30',
      cvc: '123',
    },
    buyer: {
      id: 'SMOKE-BUYER',
      firstName: 'Ada',
      lastName: 'Yilmaz',
      email: 'ada@example.com',
      identityNumber: '10000000146',
      ip: '127.0.0.1',
      address: { cityCode: '06', district: 'Cankaya', addressLine: 'Ornek Caddesi No: 1' },
    },
  };
  const charged = await payments.charge(request);
  assert.ok(charged.ok, 'charge should succeed');

  // Sağlayıcı paketi hatayı core'un sınıflarıyla üretmeli (tek core kopyası).
  const declined = await payments.charge({
    ...request,
    orderId: 'SMOKE-ESM-2',
    card: { ...request.card, number: '4129111111111111' },
  });
  assert.ok(!declined.ok, 'declined card should fail');
  assert.ok(declined.error instanceof KopruError && isKopruError(declined.error));
  assert.equal(declined.error.code, 'PAYMENT_CARD_DECLINED');

  const tracked = await cargo.trackShipment({ referenceId: YURTICI_MOCK_DELIVERED_KEY });
  assert.ok(tracked.ok, 'tracking should succeed');
  assert.equal(tracked.value.status, 'delivered');
} finally {
  await server.stop();
}

console.log('esm: ok');
