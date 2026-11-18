import { z } from 'zod';
import {
  ERROR_CATALOG,
  ErrorCategorySchema,
  KopruErrorCodeSchema,
  type ErrorCategory,
  type ErrorCodeOf,
  type KopruErrorCode,
} from './codes.js';

/**
 * `KopruError` örneğinin serileştirilmiş (JSON) hali.
 * REST katmanının hata zarfında ve loglarda bu yapı kullanılır.
 */
export const KopruErrorJSONSchema = z.object({
  name: z.string(),
  code: KopruErrorCodeSchema,
  category: ErrorCategorySchema,
  message: z.string(),
  userMessage: z.string(),
  retryable: z.boolean(),
  provider: z.string().optional(),
  providerCode: z.string().optional(),
  providerMessage: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** `KopruError` örneğinin serileştirilmiş hali. */
export type KopruErrorJSON = z.infer<typeof KopruErrorJSONSchema>;

/** `KopruError` oluşturma seçenekleri. */
export interface KopruErrorOptions<C extends KopruErrorCode = KopruErrorCode> {
  /** Standart hata kodu. */
  code: C;
  /** Geliştiriciye yönelik İngilizce açıklama. */
  message: string;
  /** Son kullanıcıya gösterilebilir Türkçe mesaj. Verilmezse katalogdaki varsayılan kullanılır. */
  userMessage?: string;
  /** Tekrar denenebilirlik. Verilmezse katalogdaki varsayılan kullanılır. */
  retryable?: boolean;
  /** Hatanın oluştuğu sağlayıcının kimliği (örn. `iyzico`). */
  provider?: string;
  /** Sağlayıcının ham hata kodu. */
  providerCode?: string;
  /** Sağlayıcının ham hata mesajı. */
  providerMessage?: string;
  /** Hataya ait ek, serileştirilebilir bilgiler. Hassas veri içermemelidir. */
  details?: Record<string, unknown>;
  /** Hataya yol açan alttaki hata. Serileştirmeye dahil edilmez. */
  cause?: unknown;
}

/** Belirli bir kategoriye ait alt sınıfların seçenekleri. */
export type CategoryErrorOptions<C extends ErrorCategory> = Omit<KopruErrorOptions, 'code'> & {
  code: ErrorCodeOf<C>;
};

/**
 * Tüm Köprü hatalarının temel sınıfı.
 * Kategori, kodun katalogdaki kaydından türetilir.
 */
export class KopruError extends Error {
  override readonly name: string = 'KopruError';
  readonly code: KopruErrorCode;
  readonly category: ErrorCategory;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly provider: string | undefined;
  readonly providerCode: string | undefined;
  readonly providerMessage: string | undefined;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(options: KopruErrorOptions) {
    super(options.message, 'cause' in options ? { cause: options.cause } : undefined);
    const definition = ERROR_CATALOG[options.code];
    this.code = options.code;
    this.category = definition.category;
    this.userMessage = options.userMessage ?? definition.userMessage;
    this.retryable = options.retryable ?? definition.retryable;
    this.provider = options.provider;
    this.providerCode = options.providerCode;
    this.providerMessage = options.providerMessage;
    this.details = options.details;
  }

  /**
   * Hatayı JSON'a dönüştürülebilir düz bir nesneye çevirir.
   * `cause` ve yığın izi (stack) bilinçli olarak dahil edilmez.
   */
  toJSON(): KopruErrorJSON {
    const json: KopruErrorJSON = {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      userMessage: this.userMessage,
      retryable: this.retryable,
    };
    if (this.provider !== undefined) json.provider = this.provider;
    if (this.providerCode !== undefined) json.providerCode = this.providerCode;
    if (this.providerMessage !== undefined) json.providerMessage = this.providerMessage;
    if (this.details !== undefined) json.details = { ...this.details };
    return json;
  }
}

/** Girdi doğrulama hatası. Zod issue'ları `details.issues` alanında taşınır. */
export class ValidationError extends KopruError {
  override readonly name: string = 'ValidationError';

  constructor(options: Partial<CategoryErrorOptions<'validation'>> & { message: string }) {
    super({ ...options, code: options.code ?? 'VALIDATION_FAILED' });
  }
}

/** Konfigürasyon hatası. Genellikle fırlatılır (programlama/kurulum hatası). */
export class ConfigurationError extends KopruError {
  override readonly name: string = 'ConfigurationError';

  constructor(options: Partial<CategoryErrorOptions<'config'>> & { message: string }) {
    super({ ...options, code: options.code ?? 'CONFIG_INVALID' });
  }
}

/** Ödeme alanındaki iş hataları (kart reddi, yetersiz bakiye vb.). */
export class PaymentError extends KopruError {
  override readonly name: string = 'PaymentError';

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Parametre tipini kategoriye ait kodlarla daraltır.
  constructor(options: CategoryErrorOptions<'payment'>) {
    super(options);
  }
}

/** Kargo alanındaki iş hataları (geçersiz adres, bulunamayan gönderi vb.). */
export class CargoError extends KopruError {
  override readonly name: string = 'CargoError';

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Parametre tipini kategoriye ait kodlarla daraltır.
  constructor(options: CategoryErrorOptions<'cargo'>) {
    super(options);
  }
}

/** Sağlayıcı kaynaklı hatalar (erişilemezlik, beklenmeyen yanıt, desteklenmeyen işlem vb.). */
export class ProviderError extends KopruError {
  override readonly name: string = 'ProviderError';

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Parametre tipini kategoriye ait kodlarla daraltır.
  constructor(options: CategoryErrorOptions<'provider'>) {
    super(options);
  }
}

/** Ağ hataları (zaman aşımı, bağlantı hatası). Varsayılan olarak tekrar denenebilir. */
export class NetworkError extends KopruError {
  override readonly name: string = 'NetworkError';

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- Parametre tipini kategoriye ait kodlarla daraltır.
  constructor(options: CategoryErrorOptions<'network'>) {
    super(options);
  }
}

/**
 * Hata kodunun verilen kategoriye ait olup olmadığını kontrol eder (tip daraltıcı).
 */
export function isErrorCodeOf<C extends ErrorCategory>(
  code: KopruErrorCode,
  category: C,
): code is ErrorCodeOf<C> {
  return ERROR_CATALOG[code].category === category;
}

/**
 * Hata koduna göre doğru alt sınıfın örneğini oluşturur.
 * Sağlayıcıların hata eşleme tablolarında kullanılması amaçlanmıştır.
 */
export function createKopruError(options: KopruErrorOptions): KopruError {
  const { code } = options;
  if (isErrorCodeOf(code, 'validation')) return new ValidationError({ ...options, code });
  if (isErrorCodeOf(code, 'config')) return new ConfigurationError({ ...options, code });
  if (isErrorCodeOf(code, 'payment')) return new PaymentError({ ...options, code });
  if (isErrorCodeOf(code, 'cargo')) return new CargoError({ ...options, code });
  if (isErrorCodeOf(code, 'provider')) return new ProviderError({ ...options, code });
  if (isErrorCodeOf(code, 'network')) return new NetworkError({ ...options, code });
  // Tüm kategoriler yukarıda karşılandığından bu satıra ulaşılmaz; yeni kategori eklenirse güvenli varsayılandır.
  /* v8 ignore next */
  return new KopruError(options);
}

/**
 * Verilen değerin bir `KopruError` olup olmadığını kontrol eder.
 */
export function isKopruError(value: unknown): value is KopruError {
  return value instanceof KopruError;
}
