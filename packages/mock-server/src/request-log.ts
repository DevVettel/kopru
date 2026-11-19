import { z } from 'zod';

/**
 * Mock server'a gelen ve kayda alınan bir istek. Başlıklar, sorgu parametreleri
 * ve gövde core'un maskeleme yardımcılarından geçirilmiş haldedir; kart numarası,
 * CVC, API anahtarı ve TCKN asla açık olarak tutulmaz.
 */
export const RecordedRequestSchema = z.object({
  /** Sunucu ömrü boyunca artan sıra numarası (1'den başlar). */
  id: z.number().int().positive(),
  /** İsteğin alındığı an (ISO 8601, UTC). */
  timestamp: z.string(),
  /** İsteği karşılayan eklentinin adı; hiçbir eklenti karşılamadıysa `null`. */
  plugin: z.string().nullable(),
  method: z.string(),
  /** Sorgu dizesi hariç yol (örn. `/iyzico/payment/auth`). */
  path: z.string(),
  query: z.record(z.string(), z.string()),
  /** Küçük harfli başlık adları ve maskelenmiş değerleri. */
  headers: z.record(z.string(), z.string()),
  /** Maskelenmiş ham gövde metni; gövde yoksa boş metin. */
  body: z.string(),
  /** Mock server'ın döndüğü HTTP durum kodu. */
  status: z.number().int(),
});

/** Mock server'a gelen ve kayda alınan bir istek. */
export type RecordedRequest = z.infer<typeof RecordedRequestSchema>;

/** İstek kaydını süzmek için ölçütler; verilen tüm ölçütler sağlanmalıdır. */
export interface RequestFilter {
  /** Eklenti adı. */
  plugin?: string;
  /** HTTP metodu (büyük/küçük harf duyarsız). */
  method?: string;
  /** Tam yol veya yol kalıbı. */
  path?: string | RegExp;
}

/**
 * Kaydın süzgece uyup uymadığını belirler.
 */
export function matchesFilter(entry: RecordedRequest, filter: RequestFilter): boolean {
  if (filter.plugin !== undefined && entry.plugin !== filter.plugin) return false;
  if (filter.method !== undefined && entry.method !== filter.method.toUpperCase()) return false;
  if (filter.path !== undefined) {
    const matched =
      typeof filter.path === 'string' ? entry.path === filter.path : filter.path.test(entry.path);
    if (!matched) return false;
  }
  return true;
}

/** Bellek içi istek kaydı. */
export interface RequestLog {
  /** Kaydedilen istekleri geliş sırasıyla döner; süzgeç verilirse yalnızca uyanları. */
  readonly list: (filter?: RequestFilter) => readonly RecordedRequest[];
  /** Süzgece uyan son isteği döner. */
  readonly last: (filter?: RequestFilter) => RecordedRequest | undefined;
  /** Kaydı temizler. Sıra numarası sıfırlanmaz. */
  readonly clear: () => void;
}

/** Kayıt sahibinin (sunucu uygulamasının) kullandığı yazma arayüzü. */
export interface WritableRequestLog extends RequestLog {
  /** Yeni bir kayıt ekler; `id` ve `timestamp` otomatik atanır. */
  readonly record: (entry: Omit<RecordedRequest, 'id' | 'timestamp'>) => RecordedRequest;
}

/** Varsayılan en fazla kayıt sayısı; uzun süre açık kalan CLI sunucusunda belleği sınırlar. */
export const DEFAULT_REQUEST_LOG_LIMIT = 1000;

/**
 * Bellek içi, boyutu sınırlı bir istek kaydı oluşturur. Sınır aşıldığında en eski
 * kayıtlar atılır.
 *
 * @param limit - Tutulacak en fazla kayıt sayısı
 */
export function createRequestLog(limit: number = DEFAULT_REQUEST_LOG_LIMIT): WritableRequestLog {
  const entries: RecordedRequest[] = [];
  let nextId = 1;

  const list = (filter?: RequestFilter): readonly RecordedRequest[] =>
    filter === undefined ? [...entries] : entries.filter((entry) => matchesFilter(entry, filter));

  return {
    list,
    last: (filter) => list(filter).at(-1),
    clear: () => {
      entries.length = 0;
    },
    record: (entry) => {
      const recorded: RecordedRequest = {
        id: nextId++,
        timestamp: new Date().toISOString(),
        ...entry,
      };
      entries.push(recorded);
      if (entries.length > limit) entries.splice(0, entries.length - limit);
      return recorded;
    },
  };
}
