import { z } from 'zod';

const TR_IBAN_PATTERN = /^TR\d{24}$/;

/**
 * IBAN'ın ISO 13616 mod-97 kontrolünü yapar. Girdinin normalize edilmiş
 * (boşluksuz, büyük harf) olduğu varsayılır.
 */
function passesMod97(iban: string): boolean {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * IBAN'ı boşluklarından arındırıp büyük harfe çevirir.
 */
export function normalizeIBAN(input: string): string {
  return input.replace(/\s/g, '').toUpperCase();
}

/**
 * Türkiye IBAN'ının (TR + 24 hane, mod-97) geçerliliğini kontrol eder.
 */
export function isValidTRIBAN(input: string): boolean {
  const iban = normalizeIBAN(input);
  return TR_IBAN_PATTERN.test(iban) && passesMod97(iban);
}

/**
 * Türkiye IBAN şeması (`iban`). Girdiyi normalize edilmiş halde (`TR…`, 26 karakter) döner.
 */
export const IBANSchema = z
  .string()
  .transform(normalizeIBAN)
  .refine(isValidTRIBAN, { message: 'Invalid Turkish IBAN' });

/** Normalize edilmiş Türkiye IBAN'ı. */
export type IBAN = z.infer<typeof IBANSchema>;
