import type { CreateShipmentRequestInput } from '@kopru/core';
import { YURTICI_MOCK_PASSWORD, YURTICI_MOCK_USERNAME } from '@kopru/mock-server';
import { inject } from 'vitest';
import type { YurticiConfigInput } from '../src/index.js';

/** Mock server'a yönlendirilmiş Yurtiçi konfigürasyonu. */
export function mockConfig(overrides: Partial<YurticiConfigInput> = {}): YurticiConfigInput {
  return {
    username: YURTICI_MOCK_USERNAME,
    password: YURTICI_MOCK_PASSWORD,
    baseUrl: `${inject('mockServerUrl')}/yurtici`,
    ...overrides,
  };
}

/** Anonim test gönderisi. */
export function shipmentInput(
  referenceId = 'KOPRU-TEST-1',
  overrides: Partial<CreateShipmentRequestInput> = {},
): CreateShipmentRequestInput {
  return {
    referenceId,
    recipient: {
      name: 'Test Alıcı',
      phone: '0532 000 00 00',
      email: 'alici@example.com',
      address: {
        cityCode: '06',
        district: 'Çankaya',
        neighborhood: 'Kızılay',
        addressLine: 'Örnek Caddesi No: 1 D: 2',
      },
    },
    pieceCount: 2,
    desi: 3.5,
    weightKg: 1.25,
    description: 'Kitap',
    ...overrides,
  };
}
