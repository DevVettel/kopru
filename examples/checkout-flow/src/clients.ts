import {
  createCargoClient,
  createPaymentClient,
  type CargoClient,
  type HttpClientOptions,
  type PaymentClient,
} from '@kopru/core';
import { iyzico } from '@kopru/iyzico';
import {
  IYZICO_MOCK_API_KEY,
  IYZICO_MOCK_SECRET_KEY,
  YURTICI_MOCK_PASSWORD,
  YURTICI_MOCK_USERNAME,
} from '@kopru/mock-server';
import { yurtici } from '@kopru/yurtici';

/** Akışın kullandığı istemciler. İş mantığı sağlayıcıları değil, yalnızca bunları bilir. */
export interface Clients {
  payments: PaymentClient;
  cargo: CargoClient;
}

/**
 * Mock server'a yönlendirilmiş ödeme ve kargo istemcileri oluşturur. Gerçek ortama geçmek
 * için yalnızca bu dosyadaki kimlik bilgileri ve `baseUrl` değişir (örn. `sandbox: true`).
 *
 * @param mockUrl - Mock server kök adresi
 * @param http - HTTP seçenekleri (zaman aşımı, log kancaları)
 */
export function createClients(mockUrl: string, http: HttpClientOptions = {}): Clients {
  return {
    payments: createPaymentClient({
      provider: iyzico({
        apiKey: IYZICO_MOCK_API_KEY,
        secretKey: IYZICO_MOCK_SECRET_KEY,
        baseUrl: `${mockUrl}/iyzico`,
      }),
      http,
    }),
    cargo: createCargoClient({
      provider: yurtici({
        username: YURTICI_MOCK_USERNAME,
        password: YURTICI_MOCK_PASSWORD,
        baseUrl: `${mockUrl}/yurtici`,
      }),
      http,
    }),
  };
}
