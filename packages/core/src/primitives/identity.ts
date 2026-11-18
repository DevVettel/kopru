import { z } from 'zod';

function toDigits(value: string): number[] {
  return Array.from(value, Number);
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}

/**
 * T.C. Kimlik Numarasının algoritmik geçerliliğini kontrol eder.
 * 11 hane, ilk hane sıfır olamaz; 10. ve 11. haneler kontrol haneleridir.
 */
export function isValidTCKN(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = toDigits(value);
  const firstNine = d.slice(0, 9);
  const odd = sum(firstNine.filter((_, i) => i % 2 === 0));
  const even = sum(firstNine.filter((_, i) => i % 2 === 1));
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = sum(d.slice(0, 10)) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

/**
 * Vergi Kimlik Numarasının algoritmik geçerliliğini kontrol eder (10 hane, son hane kontrol hanesi).
 */
export function isValidVKN(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const d = toDigits(value);
  const total = d.slice(0, 9).reduce((acc, digit, i) => {
    const shifted = (digit + 9 - i) % 10;
    const weighted = (shifted * 2 ** (9 - i)) % 9;
    return acc + (shifted !== 0 && weighted === 0 ? 9 : weighted);
  }, 0);
  return d[9] === (10 - (total % 10)) % 10;
}

/**
 * T.C. Kimlik Numarası şeması (`identityNumber`). Baştaki/sondaki boşluklar kırpılır.
 * Not: Bu değer hassas veridir ve asla loglanmamalıdır.
 */
export const TCKNSchema = z
  .string()
  .trim()
  .refine(isValidTCKN, { message: 'Invalid Turkish identity number (TCKN)' });

/** T.C. Kimlik Numarası. */
export type TCKN = z.infer<typeof TCKNSchema>;

/** Vergi Kimlik Numarası şeması (`taxNumber`). Baştaki/sondaki boşluklar kırpılır. */
export const VKNSchema = z
  .string()
  .trim()
  .refine(isValidVKN, { message: 'Invalid Turkish tax number (VKN)' });

/** Vergi Kimlik Numarası. */
export type VKN = z.infer<typeof VKNSchema>;
