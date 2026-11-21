import type { ChargeRequestInput, ThreeDSInitRequestInput } from '@kopru/core';
import {
  IYZICO_MOCK_API_KEY,
  IYZICO_MOCK_SECRET_KEY,
  IYZICO_MOCK_SUCCESS_CARD,
} from '@kopru/mock-server';
import { inject } from 'vitest';
import type { IyzicoConfigInput } from '../src/index.js';

/** Mock server'a yönlendirilmiş iyzico konfigürasyonu. */
export function mockConfig(overrides: Partial<IyzicoConfigInput> = {}): IyzicoConfigInput {
  return {
    apiKey: IYZICO_MOCK_API_KEY,
    secretKey: IYZICO_MOCK_SECRET_KEY,
    baseUrl: `${inject('mockServerUrl')}/iyzico`,
    ...overrides,
  };
}

/** Yalnızca core'un zorunlu tuttuğu alanlara sahip alıcı. */
export const baseBuyer = {
  id: 'BUYER-1',
  firstName: 'Test',
  lastName: 'Kullanıcı',
  email: 'test@example.com',
} satisfies ChargeRequestInput['buyer'];

/** Anonim test alıcısı (TCKN sentetik ve algoritmik olarak geçerlidir). */
export const buyer = {
  ...baseBuyer,
  phone: '0532 000 00 00',
  identityNumber: '10000000146',
  ip: '127.0.0.1',
  address: {
    cityCode: '34',
    district: 'Kadıköy',
    neighborhood: 'Caferağa',
    addressLine: 'Örnek Sokak No: 1',
    postalCode: '34710',
  },
} satisfies ChargeRequestInput['buyer'];

/** Verilen kartla 10,50 TL'lik tahsilat isteği. */
export function chargeInput(
  cardNumber: string = IYZICO_MOCK_SUCCESS_CARD,
  orderId = 'ORDER-1',
): ChargeRequestInput {
  return {
    orderId,
    amount: { value: 1050, currency: 'TRY' },
    card: { holderName: 'Test Kullanıcı', number: cardNumber, expiry: '12/30', cvc: '123' },
    buyer,
  };
}

/** Verilen kartla 3DS başlatma isteği. */
export function threeDSInput(
  cardNumber: string = IYZICO_MOCK_SUCCESS_CARD,
): ThreeDSInitRequestInput {
  return { ...chargeInput(cardNumber), callbackUrl: 'https://shop.example/3ds/callback' };
}
