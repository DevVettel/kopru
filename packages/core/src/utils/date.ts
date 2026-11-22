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

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * `Europe/Istanbul` saat dilimindeki yerel tarih-saati (`2026-11-18T13:00:00`), farkı
 * açıkça belirtilmiş ISO 8601 metnine çevirir (`2026-11-18T13:00:00+03:00`). Sağlayıcıların
 * saat dilimi bilgisi olmadan döndüğü tarihler için kullanılır.
 *
 * @param local - `YYYY-MM-DDTHH:mm:ss` biçiminde yerel tarih-saat
 * @returns ISO 8601 metni; tarih geçersizse (örn. `2026-02-30`) `undefined`
 */
export function istanbulLocalToDateTime(local: string): string | undefined {
  if (!LOCAL_DATE_TIME.test(local)) return undefined;
  const wallClockAsUtc = Date.parse(`${local}Z`);
  if (Number.isNaN(wallClockAsUtc)) return undefined;
  // Duvar saati UTC gibi yorumlanır, o andaki İstanbul farkı kadar geri kaydırılır.
  const probe = formatIstanbulDateTime(new Date(wallClockAsUtc));
  const probeOffsetMs = Date.parse(`${probe.slice(0, 19)}Z`) - wallClockAsUtc;
  const result = formatIstanbulDateTime(new Date(wallClockAsUtc - probeOffsetMs));
  // Takvimde olmayan tarihler (`Date.parse` bunları ileri taşır) ve gün içi sınır dışı değerler elenir.
  return result.slice(0, 19) === local ? result : undefined;
}
