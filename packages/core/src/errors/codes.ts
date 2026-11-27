import { z } from 'zod';

/** Hata kategorileri listesi. */
export const ERROR_CATEGORIES = [
  'validation',
  'payment',
  'cargo',
  'provider',
  'network',
  'config',
] as const;

/** Hata kategorisi şeması. */
export const ErrorCategorySchema = z.enum(ERROR_CATEGORIES);

/** Hatanın ait olduğu kategori. HTTP durum kodu eşlemesi buna göre yapılır. */
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

/** Standart Köprü hata kodları (`DOMAIN_MEANING` formatında). */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'CONFIG_INVALID',
  'NETWORK_TIMEOUT',
  'NETWORK_CONNECTION_FAILED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_AUTHENTICATION_FAILED',
  'PROVIDER_CAPABILITY_NOT_SUPPORTED',
  'PROVIDER_UNEXPECTED_RESPONSE',
  'PAYMENT_CARD_DECLINED',
  'PAYMENT_INSUFFICIENT_FUNDS',
  'PAYMENT_CARD_EXPIRED',
  'PAYMENT_INVALID_CARD',
  'PAYMENT_THREEDS_FAILED',
  'PAYMENT_FRAUD_SUSPECTED',
  'PAYMENT_REFUND_FAILED',
  'PAYMENT_INSTALLMENT_NOT_AVAILABLE',
  'WEBHOOK_SIGNATURE_INVALID',
  'CARGO_ADDRESS_INVALID',
  'CARGO_SHIPMENT_NOT_FOUND',
  'CARGO_CANCELLATION_NOT_ALLOWED',
] as const;

/** Hata kodu şeması. */
export const KopruErrorCodeSchema = z.enum(ERROR_CODES);

/** Standart Köprü hata kodu. */
export type KopruErrorCode = z.infer<typeof KopruErrorCodeSchema>;

/** Hata kataloğundaki tek bir kaydın yapısı. */
export interface ErrorCodeDefinition {
  /** Kodun ait olduğu kategori. */
  readonly category: ErrorCategory;
  /** Aynı isteğin tekrar denenmesinin anlamlı olup olmadığı. */
  readonly retryable: boolean;
  /** Son kullanıcıya gösterilebilecek varsayılan Türkçe mesaj. */
  readonly userMessage: string;
}

/**
 * Hata kodu kataloğu. Her kodun kategorisi, varsayılan yeniden denenebilirlik bilgisi
 * ve son kullanıcıya yönelik Türkçe mesajı burada tek bir yerde tanımlanır.
 */
export const ERROR_CATALOG = {
  VALIDATION_FAILED: {
    category: 'validation',
    retryable: false,
    userMessage: 'Gönderilen bilgiler geçersiz.',
  },
  CONFIG_INVALID: {
    category: 'config',
    retryable: false,
    userMessage: 'Sistem yapılandırması hatalı.',
  },
  NETWORK_TIMEOUT: {
    category: 'network',
    retryable: true,
    userMessage: 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
  },
  NETWORK_CONNECTION_FAILED: {
    category: 'network',
    retryable: true,
    userMessage: 'Bağlantı kurulamadı. Lütfen tekrar deneyin.',
  },
  PROVIDER_UNAVAILABLE: {
    category: 'provider',
    retryable: true,
    userMessage: 'Hizmet sağlayıcıya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.',
  },
  PROVIDER_AUTHENTICATION_FAILED: {
    category: 'provider',
    retryable: false,
    userMessage: 'Hizmet sağlayıcı ile kimlik doğrulama başarısız oldu.',
  },
  PROVIDER_CAPABILITY_NOT_SUPPORTED: {
    category: 'provider',
    retryable: false,
    userMessage: 'Bu işlem seçilen hizmet sağlayıcı tarafından desteklenmiyor.',
  },
  PROVIDER_UNEXPECTED_RESPONSE: {
    category: 'provider',
    retryable: false,
    userMessage: 'Hizmet sağlayıcıdan beklenmeyen bir yanıt alındı.',
  },
  PAYMENT_CARD_DECLINED: {
    category: 'payment',
    retryable: false,
    userMessage: 'Kartınız bankanız tarafından reddedildi.',
  },
  PAYMENT_INSUFFICIENT_FUNDS: {
    category: 'payment',
    retryable: false,
    userMessage: 'Kartınızın bakiyesi yetersiz.',
  },
  PAYMENT_CARD_EXPIRED: {
    category: 'payment',
    retryable: false,
    userMessage: 'Kartınızın son kullanma tarihi geçmiş.',
  },
  PAYMENT_INVALID_CARD: {
    category: 'payment',
    retryable: false,
    userMessage: 'Kart bilgileri geçersiz.',
  },
  PAYMENT_THREEDS_FAILED: {
    category: 'payment',
    retryable: false,
    userMessage: '3D Secure doğrulaması başarısız oldu.',
  },
  PAYMENT_FRAUD_SUSPECTED: {
    category: 'payment',
    retryable: false,
    userMessage: 'İşlem güvenlik nedeniyle onaylanmadı.',
  },
  PAYMENT_REFUND_FAILED: {
    category: 'payment',
    retryable: false,
    userMessage: 'İade işlemi gerçekleştirilemedi.',
  },
  PAYMENT_INSTALLMENT_NOT_AVAILABLE: {
    category: 'payment',
    retryable: false,
    userMessage: 'Seçilen taksit seçeneği bu kart için kullanılamıyor.',
  },
  WEBHOOK_SIGNATURE_INVALID: {
    category: 'validation',
    retryable: false,
    userMessage: 'Bildirim imzası doğrulanamadı.',
  },
  CARGO_ADDRESS_INVALID: {
    category: 'cargo',
    retryable: false,
    userMessage: 'Teslimat adresi geçersiz.',
  },
  CARGO_SHIPMENT_NOT_FOUND: {
    category: 'cargo',
    retryable: false,
    userMessage: 'Gönderi bulunamadı.',
  },
  CARGO_CANCELLATION_NOT_ALLOWED: {
    category: 'cargo',
    retryable: false,
    userMessage: 'Gönderi bu aşamada iptal edilemez.',
  },
} as const satisfies Record<KopruErrorCode, ErrorCodeDefinition>;

/** Verilen kategoriye ait hata kodları. */
export type ErrorCodeOf<C extends ErrorCategory> = {
  [K in KopruErrorCode]: (typeof ERROR_CATALOG)[K]['category'] extends C ? K : never;
}[KopruErrorCode];
