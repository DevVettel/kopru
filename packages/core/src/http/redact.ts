import { isValidTCKN } from '../primitives/identity.js';
import { passesLuhn } from '../domain/payment/schemas.js';

/** Maskelenmiş değerin yerine yazılan metin. */
export const REDACTED = '[REDACTED]';

/**
 * Değeri her durumda maskelenen anahtar adları. Karşılaştırma büyük/küçük harf,
 * `_` ve `-` farkı gözetmeden yapılır (örn. `api_key`, `apiKey`, `API-KEY` aynıdır).
 */
export const SENSITIVE_KEYS: readonly string[] = [
  'cardnumber',
  'number',
  'pan',
  'cvc',
  'cvv',
  'cvc2',
  'cvv2',
  'securitycode',
  'apikey',
  'secret',
  'secretkey',
  'clientsecret',
  'password',
  'pass',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'setcookie',
  'identitynumber',
  'tckn',
];

/**
 * Bu soneklerle biten anahtarlar da hassas sayılır (örn. `wsPassword`, `userPassword`,
 * `clientSecret`). Sağlayıcıların alan adlarını tek tek listelemeye gerek kalmaz.
 */
export const SENSITIVE_KEY_SUFFIXES: readonly string[] = ['password', 'secret'];

/** Maskeleme seçenekleri. */
export interface RedactOptions {
  /** Varsayılan listeye eklenecek, sağlayıcıya özgü hassas anahtar adları. */
  extraKeys?: readonly string[];
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

function createKeyMatcher(options: RedactOptions): (key: string) => boolean {
  const keys = new Set([...SENSITIVE_KEYS, ...(options.extraKeys ?? []).map(normalizeKey)]);
  return (key) => {
    const normalized = normalizeKey(key);
    return keys.has(normalized) || SENSITIVE_KEY_SUFFIXES.some((s) => normalized.endsWith(s));
  };
}

/**
 * Metin içindeki kart numarası (Luhn geçerli 13–19 hane) ve TCKN görünümlü
 * sayıları maskeler. Kart numaralarının yalnızca son 4 hanesi bırakılır.
 */
export function redactSensitiveNumbers(text: string): string {
  return text.replace(/\d{11,19}/g, (match) => {
    if (match.length >= 13 && passesLuhn(match)) return `****${match.slice(-4)}`;
    if (match.length === 11 && isValidTCKN(match)) return REDACTED;
    return match;
  });
}

/**
 * Nesne, dizi veya metin içindeki hassas verileri maskeleyerek **yeni** bir değer döner.
 * Hassas anahtarların değeri tamamen maskelenir; diğer metinlerde kart numarası ve
 * TCKN görünümlü sayılar maskelenir. Girdi değiştirilmez.
 */
export function redact(value: unknown, options: RedactOptions = {}): unknown {
  const isSensitive = createKeyMatcher(options);

  const walk = (current: unknown): unknown => {
    if (typeof current === 'string') return redactSensitiveNumbers(current);
    if (Array.isArray(current)) return current.map(walk);
    if (current !== null && typeof current === 'object') {
      return Object.fromEntries(
        Object.entries(current).map(([key, inner]) => [
          key,
          isSensitive(key) ? REDACTED : walk(inner),
        ]),
      );
    }
    return current;
  };

  return walk(value);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HTTP gövdesi gibi serbest metni maskeler. JSON ise yapısal olarak, değilse
 * XML etiketleri (`<CardNumber>…</CardNumber>`) ve form alanları (`cvc=123`)
 * üzerinden anahtar bazlı maskeleme yapılır.
 */
export function redactText(text: string, options: RedactOptions = {}): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object')
      return JSON.stringify(redact(parsed, options));
  } catch {
    // JSON değil; metin bazlı maskelemeye devam edilir.
  }

  const keys = [...SENSITIVE_KEYS, ...(options.extraKeys ?? []).map(normalizeKey)];
  // Sonek kalıpları: `wsPassword`, `ws_password` gibi adları da yakalar.
  const names = [
    ...keys.map(escapeRegExp),
    ...SENSITIVE_KEY_SUFFIXES.map((suffix) => `[\\w.-]*${escapeRegExp(suffix)}`),
  ];
  let result = text;
  for (const name of names) {
    const xmlTag = new RegExp(`(<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>)([^<]*)(</)`, 'gi');
    const formField = new RegExp(`((?:^|[?&])${name}=)([^&]*)`, 'gi');
    result = result.replace(xmlTag, `$1${REDACTED}$3`).replace(formField, `$1${REDACTED}`);
  }
  return redactSensitiveNumbers(result);
}

/**
 * HTTP başlıklarını maskeler (örn. `Authorization`, `Cookie`).
 */
export function redactHeaders(
  headers: Readonly<Record<string, string>>,
  options: RedactOptions = {},
): Record<string, string> {
  const isSensitive = createKeyMatcher(options);
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, isSensitive(key) ? REDACTED : value]),
  );
}

/**
 * URL'nin sorgu parametrelerindeki hassas değerleri maskeler.
 */
export function redactUrl(url: string, options: RedactOptions = {}): string {
  const isSensitive = createKeyMatcher(options);
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (isSensitive(key)) parsed.searchParams.set(key, REDACTED);
    }
    return redactSensitiveNumbers(parsed.toString());
  } catch {
    return redactText(url, options);
  }
}
