import type { KopruError } from '../../errors/kopru-error.js';
import type { ProviderContext } from '../../provider/context.js';
import type { Result } from '../../result/result.js';
import type { InstallmentQueryRequest, InstallmentQueryResult } from './installments.js';
import type { NotificationRequest, PaymentNotificationResult } from './notifications.js';
import type {
  ChargeRequest,
  ChargeResult,
  RefundRequest,
  RefundResult,
  ThreeDSCallback,
  ThreeDSInitRequest,
  ThreeDSInitResult,
} from './schemas.js';

/** Ödeme sağlayıcısı yetenekleri. */
export const PAYMENT_CAPABILITIES = [
  'charge',
  'threeDS',
  'refund',
  'refund.partial',
  'installments',
  'installments.query',
  'notifications',
] as const;

/** Ödeme sağlayıcısı yeteneği. */
export type PaymentCapability = (typeof PAYMENT_CAPABILITIES)[number];

/**
 * Ödeme sağlayıcısının uyguladığı işlemler. Bir metot, ilgili yetenek
 * bildirildiyse zorunludur (bkz. `definePaymentProvider`).
 */
export interface PaymentOperations {
  charge?: (
    input: ChargeRequest,
    ctx: ProviderContext,
  ) => Promise<Result<ChargeResult, KopruError>>;
  initThreeDS?: (
    input: ThreeDSInitRequest,
    ctx: ProviderContext,
  ) => Promise<Result<ThreeDSInitResult, KopruError>>;
  completeThreeDS?: (
    input: ThreeDSCallback,
    ctx: ProviderContext,
  ) => Promise<Result<ChargeResult, KopruError>>;
  refund?: (
    input: RefundRequest,
    ctx: ProviderContext,
  ) => Promise<Result<RefundResult, KopruError>>;
  queryInstallments?: (
    input: InstallmentQueryRequest,
    ctx: ProviderContext,
  ) => Promise<Result<InstallmentQueryResult, KopruError>>;
  parseNotification?: (
    input: NotificationRequest,
    ctx: ProviderContext,
  ) => Promise<Result<PaymentNotificationResult, KopruError>>;
}

/**
 * Ödeme sağlayıcısı sözleşmesi. Sağlayıcı paketleri bunu `definePaymentProvider`
 * ile üretir; kullanıcılar doğrudan değil `createPaymentClient` üzerinden kullanır.
 */
export interface PaymentProvider extends PaymentOperations {
  readonly kind: 'payment';
  /** Sağlayıcı kimliği (örn. `iyzico`). */
  readonly id: string;
  readonly capabilities: ReadonlySet<PaymentCapability>;
}
