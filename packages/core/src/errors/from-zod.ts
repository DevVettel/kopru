import { z } from 'zod';
import { err, ok, type Result } from '../result/result.js';
import { ValidationError } from './kopru-error.js';

/** `ValidationError.details.issues` içindeki tek bir doğrulama sorununun yapısı. */
export const ValidationIssueSchema = z.object({
  /** Sorunlu alanın yolu (örn. `buyer.address.cityCode`, `items[0].price`). Kök için boş metin. */
  path: z.string(),
  /** Zod issue kodu (örn. `invalid_type`, `custom`). */
  code: z.string(),
  /** İngilizce açıklama. */
  message: z.string(),
});

/** Tek bir doğrulama sorunu. */
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * Zod yol dizisini okunabilir bir metne çevirir: `['items', 0, 'price']` → `items[0].price`.
 */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${String(segment)}]`;
    const key = typeof segment === 'symbol' ? segment.toString() : segment;
    return acc === '' ? key : `${acc}.${key}`;
  }, '');
}

/** `fromZodError` seçenekleri. */
export interface FromZodErrorOptions {
  /** Geliştiriciye yönelik İngilizce mesaj. */
  message?: string;
  /** Son kullanıcıya yönelik Türkçe mesaj. */
  userMessage?: string;
}

/**
 * Bir `ZodError`'ı standart `ValidationError`'a dönüştürür.
 * Zod issue'ları sadeleştirilerek `details.issues` alanında korunur; girdi değerleri
 * (hassas veri içerebileceği için) hataya kopyalanmaz.
 */
export function fromZodError(
  error: z.ZodError,
  options: FromZodErrorOptions = {},
): ValidationError {
  const issues: ValidationIssue[] = error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    code: issue.code,
    message: issue.message,
  }));
  const summary = issues.map((i) => (i.path === '' ? i.message : `${i.path}: ${i.message}`));

  return new ValidationError({
    message: options.message ?? `Validation failed: ${summary.join('; ')}`,
    ...(options.userMessage === undefined ? {} : { userMessage: options.userMessage }),
    details: { issues },
    cause: error,
  });
}

/**
 * Girdiyi verilen şema ile doğrular ve sonucu `Result` olarak döner.
 * Sınırlardaki (kullanıcı girdisi, sağlayıcı yanıtı) doğrulamalar için standart yoldur.
 *
 * @param schema - Kullanılacak Zod şeması
 * @param input - Doğrulanacak bilinmeyen veri
 */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
  options?: FromZodErrorOptions,
): Result<z.output<S>, ValidationError> {
  const parsed = schema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(fromZodError(parsed.error, options));
}
