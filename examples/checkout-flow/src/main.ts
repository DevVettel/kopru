import type { Card } from '@kopru/core';
import {
  IYZICO_MOCK_SUCCESS_CARD,
  YURTICI_MOCK_DELIVERED_KEY,
  startMockServer,
} from '@kopru/mock-server';
import { runCheckout } from './checkout.ts';
import { createClients } from './clients.ts';

/** Mock server'ın yetersiz bakiye (`10051`) döndürdüğü kart. */
const INSUFFICIENT_FUNDS_CARD = '4111111111111129';

const card = (number: string): Card => ({
  holderName: 'Ada Yilmaz',
  number,
  expiry: '12/30',
  cvc: '123',
});

const server = await startMockServer();
try {
  // `--verbose`: sağlayıcılara giden istekler. Kancalara gelen veri önceden maskelenmiştir.
  const verbose = process.argv.includes('--verbose');
  const clients = createClients(server.url, {
    hooks: verbose
      ? {
          onRequest: ({ method, url, body }) => {
            console.log(`   → ${method} ${url}\n     ${body ?? ''}`);
          },
        }
      : {},
  });

  const result = await runCheckout(
    clients,
    {
      orderId: 'KPR-2026-0001',
      declinedCard: card(INSUFFICIENT_FUNDS_CARD),
      card: card(IYZICO_MOCK_SUCCESS_CARD),
      shippedReferenceId: YURTICI_MOCK_DELIVERED_KEY,
    },
    console.log,
  );

  if (result.ok) {
    console.log('\nAkış tamamlandı.');
  } else {
    console.error('\nAkış durdu:', result.error.toJSON());
    process.exitCode = 1;
  }
} finally {
  await server.stop();
}
