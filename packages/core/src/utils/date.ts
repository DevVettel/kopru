import { z } from 'zod';

/** Köprü'nün varsayılan saat dilimi. */
export const DEFAULT_TIME_ZONE = 'Europe/Istanbul';

/**
 * Saat dilimi farkı içeren ISO 8601 tarih-saat şeması (örn. `2026-11-18T13:00:00+03:00`).
 * Saat dilimi bilgisi olmayan değerler kabul edilmez.
 */
export const DateTimeSchema = z.iso.datetime({ offset: true });

// `sv-SE` yerel ayarı tarihi ISO 8601'e yakın biçimde (`2026-11-18 13:00:00`) üretir.
const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: DEFAULT_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * Verilen anı `Europe/Istanbul` saat diliminde, farkı açıkça belirtilmiş
 * ISO 8601 metnine çevirir: `2026-11-18T10:00:00Z` → `2026-11-18T13:00:00+03:00`.
 */
export function formatIstanbulDateTime(date: Date): string {
  const local = formatter.format(date).replace(' ', 'T');
  const wallClockAsUtc = Date.parse(`${local}Z`);
  const offsetMinutes = Math.round((wallClockAsUtc - date.getTime()) / 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${local}${offset}`;
}
