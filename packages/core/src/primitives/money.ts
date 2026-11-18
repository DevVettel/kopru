import { z } from 'zod';
import { err, ok, type Result } from '../result/result.js';
import { ValidationError } from '../errors/kopru-error.js';

/** Desteklenen para birimleri (ISO 4217). */
export const CURRENCIES = ['TRY', 'USD', 'EUR'] as const;

/** Para birimi şeması. */
export const CurrencySchema = z.enum(CURRENCIES);

/** Para birimi. */
export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Para tutarı şeması. `value` her zaman kuruş (minor unit) cinsinden,
 * negatif olmayan güvenli bir tam sayıdır. Ondalık para hesabı yapılmaz.
 */
export const MoneySchema = z.object({
  value: z.number().int().nonnegative(),
  currency: CurrencySchema,
});

/** Kuruş cinsinden para tutarı. */
export type Money = z.infer<typeof MoneySchema>;

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * Kuruş cinsinden tutarı sağlayıcıların beklediği ondalık metne çevirir: `{ value: 1050 }` → `"10.50"`.
 * Yalnızca mapper'larda kullanılmalıdır.
 */
export function toDecimalString(money: Money): string {
  const digits = money.value.toString().padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/**
 * Ondalık metin tutarı kuruş cinsinden `Money` değerine çevirir: `"10.5"` → `{ value: 1050 }`.
 * Kayan nokta aritmetiği kullanılmaz; metin üzerinden dönüştürülür. İkiden fazla
 * ondalık hane yalnızca sıfırsa kabul edilir (örn. `"10.5000"`).
 *
 * @param input - Nokta ayraçlı ondalık tutar
 * @param currency - Para birimi
 */
export function fromDecimalString(
  input: string,
  currency: Currency,
): Result<Money, ValidationError> {
  const match = DECIMAL_PATTERN.exec(input.trim());
  const whole = match?.[1];
  const fraction = match?.[2] ?? '';
  const significantFraction = fraction.slice(0, 2);
  const extraFraction = fraction.slice(2);

  const value =
    whole === undefined
      ? Number.NaN
      : Number(whole) * 100 + Number(significantFraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(value) || /[^0]/.test(extraFraction)) {
    return err(
      new ValidationError({
        message: `Invalid decimal amount: "${input}"`,
        details: {
          issues: [{ path: '', code: 'invalid_format', message: 'Invalid decimal amount' }],
        },
      }),
    );
  }

  return ok({ value, currency });
}
