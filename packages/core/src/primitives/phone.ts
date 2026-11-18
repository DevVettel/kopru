import { z } from 'zod';

const SEPARATORS = /[\s\-().]/g;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const TR_E164_PATTERN = /^\+90\d{10}$/;

/**
 * Telefon numarasını E.164 formatına normalize eder. Türkiye numaralarında yaygın
 * yazımlar desteklenir: `0532 123 45 67`, `532 123 45 67`, `90532…`, `0090532…` → `+90532…`.
 *
 * @returns Normalize edilmiş numara; geçersizse `undefined`
 */
export function normalizePhoneNumber(input: string): string | undefined {
  let value = input.replace(SEPARATORS, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  else if (/^0\d{10}$/.test(value)) value = `+90${value.slice(1)}`;
  else if (/^90\d{10}$/.test(value)) value = `+${value}`;
  else if (/^[2-5]\d{9}$/.test(value)) value = `+90${value}`;

  if (!E164_PATTERN.test(value)) return undefined;
  if (value.startsWith('+90') && !TR_E164_PATTERN.test(value)) return undefined;
  return value;
}

/**
 * Telefon numarası şeması (`phone`). Girdiyi kabul edip E.164 formatında (`+905xxxxxxxxx`) döner.
 */
export const PhoneNumberSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhoneNumber(value);
  if (normalized === undefined) {
    ctx.issues.push({ code: 'custom', message: 'Invalid phone number', input: value });
    return z.NEVER;
  }
  return normalized;
});

/** E.164 formatında telefon numarası. */
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;
