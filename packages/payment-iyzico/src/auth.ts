import { base64Encode, hmac } from '@kopru/core';

/** İmzalama için gereken kimlik bilgileri. */
export interface IyzicoCredentials {
  apiKey: string;
  secretKey: string;
}

/** İmzalanacak isteğin bilgileri. */
export interface IyzicoSignInput {
  /** Sorgu metni içermeyen istek yolu (örn. `/payment/auth`). */
  path: string;
  /** Gönderilecek JSON gövdesinin birebir metni. */
  body: string;
  /** İsteğe özgü rastgele metin; `x-iyzi-rnd` başlığında da gönderilir. */
  randomKey: string;
}

/**
 * IYZWSv2 imzasını hesaplar: `hex(HMAC-SHA256(secretKey, randomKey + path + body))`.
 */
export function computeIyzicoSignature(secretKey: string, input: IyzicoSignInput): string {
  return hmac('sha256', secretKey, `${input.randomKey}${input.path}${input.body}`, 'hex');
}

/**
 * iyzico isteği için `Authorization` ve `x-iyzi-rnd` başlıklarını üretir. Saf fonksiyondur;
 * rastgele değer dışarıdan verilir.
 *
 * @example
 * createIyzicoAuthHeaders(credentials, { path: '/payment/auth', body, randomKey })
 * // → { Authorization: 'IYZWSv2 YXBpS2V5Oi…', 'x-iyzi-rnd': randomKey }
 */
export function createIyzicoAuthHeaders(
  credentials: IyzicoCredentials,
  input: IyzicoSignInput,
): Record<string, string> {
  const signature = computeIyzicoSignature(credentials.secretKey, input);
  const authString = `apiKey:${credentials.apiKey}&randomKey:${input.randomKey}&signature:${signature}`;
  return {
    Authorization: `IYZWSv2 ${base64Encode(authString)}`,
    'x-iyzi-rnd': input.randomKey,
  };
}
