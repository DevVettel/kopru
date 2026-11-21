import { z } from 'zod';

/**
 * iyzico ham istek şemaları. Yalnızca bu paket içinde kullanılır ve dışarı export edilmez.
 * İstekler mapper'larda üretilir; şemalar tipin tek kaynağıdır.
 */

/** Ondalık metin tutar (örn. `"10.50"`). */
const DecimalStringSchema = z.string().regex(/^\d+\.\d{2}$/);

/** iyzico dil seçeneği. */
export const IyzicoLocaleSchema = z.enum(['tr', 'en']);

/** iyzico adres şeması (fatura ve teslimat). */
export const IyzicoAddressSchema = z.object({
  contactName: z.string(),
  city: z.string(),
  country: z.string(),
  address: z.string(),
  zipCode: z.string().optional(),
});

/** iyzico alıcı şeması. */
export const IyzicoBuyerSchema = z.object({
  id: z.string(),
  name: z.string(),
  surname: z.string(),
  email: z.string(),
  identityNumber: z.string(),
  gsmNumber: z.string().optional(),
  registrationAddress: z.string(),
  city: z.string(),
  country: z.string(),
  zipCode: z.string().optional(),
  ip: z.string().optional(),
});

/** iyzico kart şeması. */
export const IyzicoPaymentCardSchema = z.object({
  cardHolderName: z.string(),
  cardNumber: z.string(),
  expireMonth: z.string(),
  expireYear: z.string(),
  cvc: z.string(),
  registerCard: z.literal(0),
});

/** iyzico sepet kalemi şeması. */
export const IyzicoBasketItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category1: z.string(),
  itemType: z.enum(['PHYSICAL', 'VIRTUAL']),
  price: DecimalStringSchema,
});

/** `POST /payment/auth` istek şeması. */
export const IyzicoPaymentRequestSchema = z.object({
  locale: IyzicoLocaleSchema,
  conversationId: z.string(),
  price: DecimalStringSchema,
  paidPrice: DecimalStringSchema,
  currency: z.string(),
  installment: z.number().int(),
  basketId: z.string(),
  paymentChannel: z.literal('WEB'),
  paymentGroup: z.literal('PRODUCT'),
  paymentCard: IyzicoPaymentCardSchema,
  buyer: IyzicoBuyerSchema,
  shippingAddress: IyzicoAddressSchema,
  billingAddress: IyzicoAddressSchema,
  basketItems: z.array(IyzicoBasketItemSchema).min(1),
});

/** `POST /payment/auth` isteği. */
export type IyzicoPaymentRequest = z.infer<typeof IyzicoPaymentRequestSchema>;

/** `POST /payment/3dsecure/initialize` istek şeması. */
export const IyzicoThreeDSInitRequestSchema = IyzicoPaymentRequestSchema.extend({
  callbackUrl: z.string(),
});

/** `POST /payment/3dsecure/initialize` isteği. */
export type IyzicoThreeDSInitRequest = z.infer<typeof IyzicoThreeDSInitRequestSchema>;

/** `POST /payment/3dsecure/auth` istek şeması. */
export const IyzicoThreeDSAuthRequestSchema = z.object({
  locale: IyzicoLocaleSchema,
  conversationId: z.string().optional(),
  paymentId: z.string(),
  conversationData: z.string().optional(),
});

/** `POST /payment/3dsecure/auth` isteği. */
export type IyzicoThreeDSAuthRequest = z.infer<typeof IyzicoThreeDSAuthRequestSchema>;

/** `POST /payment/detail` ve `POST /payment/cancel` istek şeması. */
export const IyzicoPaymentReferenceRequestSchema = z.object({
  locale: IyzicoLocaleSchema,
  paymentId: z.string(),
});

/** Yalnızca `paymentId` taşıyan istek. */
export type IyzicoPaymentReferenceRequest = z.infer<typeof IyzicoPaymentReferenceRequestSchema>;

/** `POST /v2/payment/refund` istek şeması. */
export const IyzicoRefundRequestSchema = z.object({
  locale: IyzicoLocaleSchema,
  paymentId: z.string(),
  price: DecimalStringSchema,
  currency: z.string(),
});

/** `POST /v2/payment/refund` isteği. */
export type IyzicoRefundRequest = z.infer<typeof IyzicoRefundRequestSchema>;
