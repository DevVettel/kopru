import { z } from 'zod';

/**
 * iyzico ham yanıt şemaları. Yalnızca kullanılan alanlar doğrulanır; bilinmeyen
 * alanlar yok sayılır. Bu paket dışına export edilmez.
 */

/** Sayı veya metin olarak gelebilen kimlik/kod alanlarını metne çevirir. */
const IdSchema = z.union([z.string().min(1), z.number()]).transform(String);

/** Tüm yanıtların ortak zarfı. Başarısız yanıtlarda hata alanları dolu gelir. */
export const IyzicoEnvelopeSchema = z.object({
  status: z.enum(['success', 'failure']),
  errorCode: IdSchema.optional(),
  errorMessage: z.string().optional(),
  errorGroup: z.string().optional(),
  systemTime: z.number().int().optional(),
  conversationId: z.string().optional(),
});

/** iyzico yanıt zarfı. */
export type IyzicoEnvelope = z.infer<typeof IyzicoEnvelopeSchema>;

/** Başarılı ödeme yanıtı şeması (`/payment/auth`, `/payment/3dsecure/auth`, `/payment/detail`). */
export const IyzicoPaymentResponseSchema = IyzicoEnvelopeSchema.extend({
  status: z.literal('success'),
  paymentId: IdSchema,
  price: z.number().nonnegative(),
  paidPrice: z.number().nonnegative(),
  currency: z.string(),
  installment: z.number().int().min(1),
  basketId: z.string().optional(),
  /** `1` onaylı, `0` inceleme, `-1` red. */
  fraudStatus: z.number().int().optional(),
  binNumber: z.string().optional(),
  lastFourDigits: z.string().optional(),
  cardFamily: z.string().optional(),
});

/** Başarılı ödeme yanıtı. */
export type IyzicoPaymentResponse = z.infer<typeof IyzicoPaymentResponseSchema>;

/** Başarılı 3DS başlatma yanıtı şeması. */
export const IyzicoThreeDSInitResponseSchema = IyzicoEnvelopeSchema.extend({
  status: z.literal('success'),
  /** Base64 kodlu banka doğrulama sayfası. */
  threeDSHtmlContent: z.string().min(1),
  paymentId: IdSchema.optional(),
});

/** Başarılı 3DS başlatma yanıtı. */
export type IyzicoThreeDSInitResponse = z.infer<typeof IyzicoThreeDSInitResponseSchema>;

/** Başarılı iade (`/v2/payment/refund`) ve iptal (`/payment/cancel`) yanıtı şeması. */
export const IyzicoRefundResponseSchema = IyzicoEnvelopeSchema.extend({
  status: z.literal('success'),
  paymentId: IdSchema,
  price: z.number().positive(),
  currency: z.string(),
  hostReference: IdSchema.optional(),
  refundHostReference: IdSchema.optional(),
  cancelHostReference: IdSchema.optional(),
});

/** Başarılı iade veya iptal yanıtı. */
export type IyzicoRefundResponse = z.infer<typeof IyzicoRefundResponseSchema>;

/**
 * Bankanın 3DS doğrulaması sonrası `callbackUrl`'e form-post ettiği alanların şeması.
 * Bu veri kullanıcının tarayıcısından geçtiği için yalnızca yönlendirme amaçlı kullanılır;
 * tahsilat `/payment/3dsecure/auth` yanıtıyla kesinleşir.
 */
export const IyzicoThreeDSCallbackSchema = z.object({
  status: z.string(),
  paymentId: z.string().optional(),
  conversationData: z.string().optional(),
  conversationId: z.string().optional(),
  mdStatus: z.string().optional(),
});

/** 3DS callback verisi. */
export type IyzicoThreeDSCallback = z.infer<typeof IyzicoThreeDSCallbackSchema>;
