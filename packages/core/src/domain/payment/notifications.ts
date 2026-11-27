import { z } from 'zod';
import { KopruErrorCodeSchema } from '../../errors/codes.js';
import { DateTimeSchema } from '../../utils/date.js';
import { PositiveMoneySchema } from './schemas.js';

/**
 * Sağlayıcının bildirim (webhook) adresine gönderdiği isteğin şeması.
 * Gövde ham metin olarak verilir; imza doğrulaması ham gövde üzerinden yapılabilir.
 * Başlık isimleri küçük harfe çevrilir.
 */
export const NotificationRequestSchema = z.object({
  headers: z
    .record(z.string(), z.string())
    .default({})
    .transform((headers) =>
      Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
      ),
    ),
  /** Ayrıştırılmamış istek gövdesi (JSON veya `application/x-www-form-urlencoded`). */
  body: z.string(),
});

/** Doğrulanmış bildirim isteği (başlık isimleri küçük harf). */
export type NotificationRequest = z.output<typeof NotificationRequestSchema>;
/** Kullanıcının (veya sunucunun) verdiği bildirim isteği. */
export type NotificationRequestInput = z.input<typeof NotificationRequestSchema>;

/** Bildirimdeki ödeme durumları. */
export const PAYMENT_NOTIFICATION_STATUSES = ['succeeded', 'failed', 'pending'] as const;

/** Bildirimdeki ödeme durumu şeması. */
export const PaymentNotificationStatusSchema = z.enum(PAYMENT_NOTIFICATION_STATUSES);

/**
 * Bildirimdeki ödeme durumu: `succeeded` (tahsil edildi), `failed` (başarısız),
 * `pending` (ara adım; örn. 3DS başlatıldı).
 */
export type PaymentNotificationStatus = z.infer<typeof PaymentNotificationStatusSchema>;

/** Başarısız ödeme bildiriminin hata bilgisi şeması. */
export const PaymentNotificationFailureSchema = z.object({
  /** Standart Köprü hata kodu. */
  code: KopruErrorCodeSchema,
  providerCode: z.string().optional(),
  providerMessage: z.string().optional(),
});

/** Sağlayıcıdan bağımsız ödeme bildirimi şeması. */
export const PaymentNotificationSchema = z
  .object({
    /** Mağazanın sipariş numarası. */
    orderId: z.string().min(1),
    /** Sağlayıcı tarafındaki işlem kimliği (varsa). */
    transactionId: z.string().min(1).optional(),
    status: PaymentNotificationStatusSchema,
    /** Sağlayıcının ham durum değeri. */
    providerStatus: z.string().min(1),
    /** İşlem tutarı; sağlayıcı bildirimde göndermiyorsa yoktur. */
    amount: PositiveMoneySchema.optional(),
    /** Olay zamanı (saat dilimi farkıyla), sağlayıcı gönderiyorsa. */
    occurredAt: DateTimeSchema.optional(),
    /** Yalnızca `status: 'failed'` iken. */
    failure: PaymentNotificationFailureSchema.optional(),
  })
  .refine(
    (notification) => notification.failure === undefined || notification.status === 'failed',
    {
      message: 'failure is only allowed when status is "failed"',
      path: ['failure'],
    },
  );

/** Sağlayıcıdan bağımsız ödeme bildirimi. */
export type PaymentNotification = z.infer<typeof PaymentNotificationSchema>;

/** Bildirimi gönderen sağlayıcıya dönülecek yanıtın şeması. */
export const NotificationAcknowledgementSchema = z.object({
  /** HTTP durum kodu (2xx). */
  status: z.number().int().min(200).max(299),
  contentType: z.string().min(1),
  body: z.string(),
});

/**
 * Sağlayıcıya dönülecek yanıt. Sunucu bunu aynen döner (örn. PayTR düz metin `OK` bekler).
 */
export type NotificationAcknowledgement = z.infer<typeof NotificationAcknowledgementSchema>;

/** `parseNotification` sonucu şeması. */
export const PaymentNotificationResultSchema = z.object({
  notification: PaymentNotificationSchema,
  acknowledgement: NotificationAcknowledgementSchema,
});

/** `parseNotification` sonucu: doğrulanmış bildirim ve sağlayıcıya dönülecek yanıt. */
export type PaymentNotificationResult = z.infer<typeof PaymentNotificationResultSchema>;
