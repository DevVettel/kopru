import {
  CurrencySchema,
  ProviderError,
  err,
  formatIstanbulDateTime,
  fromDecimalString,
  ok,
  type Money,
  type Result,
} from '@kopru/core';
import { IYZICO_PROVIDER_ID } from '../errors.js';

/**
 * iyzico yanıtındaki sayı tutarı (örn. `10.5`) kuruş cinsinden `Money` değerine çevirir.
 * Sayı önce metne çevrilip core'un metin tabanlı dönüştürücüsünden geçirilir; kayan nokta
 * aritmetiği yapılmaz.
 *
 * @returns Geçersiz tutar veya desteklenmeyen para biriminde `PROVIDER_UNEXPECTED_RESPONSE`
 */
export function fromIyzicoAmount(amount: number, currency: string): Result<Money, ProviderError> {
  const parsedCurrency = CurrencySchema.safeParse(currency);
  const money = parsedCurrency.success
    ? fromDecimalString(String(amount), parsedCurrency.data)
    : undefined;
  if (money?.ok === true) return ok(money.value);
  return err(
    new ProviderError({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      message: `iyzico returned an unsupported amount or currency: ${String(amount)} ${currency}`,
      provider: IYZICO_PROVIDER_ID,
    }),
  );
}

/**
 * iyzico `systemTime` (epoch ms) değerini `Europe/Istanbul` saat dilimli ISO metnine çevirir.
 * Değer yoksa verilen yedek zaman kullanılır.
 */
export function fromIyzicoSystemTime(systemTime: number | undefined, fallback: Date): string {
  return formatIstanbulDateTime(systemTime === undefined ? fallback : new Date(systemTime));
}
