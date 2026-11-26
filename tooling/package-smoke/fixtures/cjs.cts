/**
 * Yayımlanan paketleri CommonJS tüketicisi gibi kullanır: tipler `.d.cts`, kod `.cjs` girişinden
 * gelir. Tüketici projede `tsc` ile denetlenir ve Node.js tip silme ile çalıştırılır.
 */
import type * as CoreModule from '@kopru/core';
import type * as IyzicoModule from '@kopru/iyzico';
import type * as MockServerModule from '@kopru/mock-server';
import type * as YurticiModule from '@kopru/yurtici';

// Tip silme `import x = require()` sözdizimini desteklemez; `require` sonucu modül tipine bağlanır.
// `assert` tipi açıkça yazılır: TypeScript, assertion fonksiyonlarında açık tip bildirimi ister.
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const core = require('@kopru/core') as typeof CoreModule;
const { iyzico } = require('@kopru/iyzico') as typeof IyzicoModule;
const mock = require('@kopru/mock-server') as typeof MockServerModule;
const { yurtici } = require('@kopru/yurtici') as typeof YurticiModule;

// CJS girişlerinin gerçekten `.cjs` dosyaları olduğu denetlenir.
for (const name of ['@kopru/core', '@kopru/iyzico', '@kopru/yurtici', '@kopru/mock-server']) {
  assert.match(require.resolve(name), /\/dist\/index\.cjs$/);
}

async function main(): Promise<void> {
  const server = await mock.startMockServer();
  try {
    const payments = core.createPaymentClient({
      provider: iyzico({
        apiKey: mock.IYZICO_MOCK_API_KEY,
        secretKey: mock.IYZICO_MOCK_SECRET_KEY,
        baseUrl: `${server.url}/iyzico`,
      }),
    });
    const cargo = core.createCargoClient({
      provider: yurtici({
        username: mock.YURTICI_MOCK_USERNAME,
        password: mock.YURTICI_MOCK_PASSWORD,
        baseUrl: `${server.url}/yurtici`,
      }),
    });

    const declined = await payments.charge({
      orderId: 'SMOKE-CJS-1',
      amount: { value: 1_000, currency: 'TRY' },
      card: { holderName: 'Ada Yilmaz', number: '4111111111111129', expiry: '12/30', cvc: '123' },
      buyer: {
        id: 'SMOKE-BUYER',
        firstName: 'Ada',
        lastName: 'Yilmaz',
        email: 'ada@example.com',
        identityNumber: '10000000146',
        ip: '127.0.0.1',
        address: { cityCode: '06', district: 'Cankaya', addressLine: 'Ornek Caddesi No: 1' },
      },
    });
    assert.ok(!declined.ok, 'card with insufficient funds should fail');
    assert.ok(declined.error instanceof core.KopruError);
    assert.equal(declined.error.code, 'PAYMENT_INSUFFICIENT_FUNDS');

    const tracked = await cargo.trackShipment({ referenceId: mock.YURTICI_MOCK_IN_TRANSIT_KEY });
    assert.ok(tracked.ok, 'tracking should succeed');
    assert.equal(tracked.value.status, 'in_transit');
  } finally {
    await server.stop();
  }
  console.log('cjs: ok');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
