import {
  ProviderError,
  definePaymentProvider,
  err,
  type ChargeResult,
  type KopruError,
  type ProviderContext,
  type RefundResult,
  type Result,
} from '@kopru/core';
import { callIyzico, dropEnvelope } from './api.js';
import { IyzicoConfigSchema, type IyzicoConfig } from './config.js';
import { IYZICO_PROVIDER_ID, IYZICO_REQUIRES_DAY_END } from './errors.js';
import {
  toChargeResult,
  toIyzicoPaymentRequest,
  toIyzicoThreeDSInitRequest,
  toThreeDSInitResult,
} from './mappers/payment.js';
import { toIyzicoRefundRequest, toRefundResult } from './mappers/refund.js';
import { toThreeDSCompletion } from './mappers/three-ds.js';
import {
  IyzicoPaymentResponseSchema,
  IyzicoRefundResponseSchema,
  IyzicoThreeDSInitResponseSchema,
} from './schemas/response.js';

/** iyzico uç noktaları. */
export const IYZICO_PATHS = {
  payment: '/payment/auth',
  threeDSInitialize: '/payment/3dsecure/initialize',
  threeDSAuth: '/payment/3dsecure/auth',
  paymentDetail: '/payment/detail',
  refund: '/v2/payment/refund',
  cancel: '/payment/cancel',
} as const;

/**
 * Tam iade: ödeme detayından tahsil edilen tutar alınır ve `/v2/payment/refund` çağrılır.
 * Ödeme henüz gün sonundan geçmediyse (`10223`) aynı gün iptali (`/payment/cancel`) yapılır.
 */
async function refundPayment(
  config: IyzicoConfig,
  ctx: ProviderContext,
  paymentId: string,
): Promise<Result<RefundResult, KopruError>> {
  const detail = await callIyzico(config, ctx, {
    path: IYZICO_PATHS.paymentDetail,
    body: { locale: config.locale, paymentId },
    responseSchema: IyzicoPaymentResponseSchema,
    operation: 'refund',
    idempotent: true,
  });
  if (!detail.ok) return dropEnvelope(detail);

  const request = toIyzicoRefundRequest(detail.value, config);
  if (!request.ok) return request;

  const refunded = await callIyzico(config, ctx, {
    path: IYZICO_PATHS.refund,
    body: request.value,
    responseSchema: IyzicoRefundResponseSchema,
    operation: 'refund',
  });
  if (refunded.ok) return toRefundResult(refunded.value, paymentId, ctx.now());
  if (refunded.error.envelope?.errorCode !== IYZICO_REQUIRES_DAY_END) {
    return err(refunded.error.error);
  }

  const cancelled = await callIyzico(config, ctx, {
    path: IYZICO_PATHS.cancel,
    body: { locale: config.locale, paymentId },
    responseSchema: IyzicoRefundResponseSchema,
    operation: 'refund',
  });
  if (!cancelled.ok) return dropEnvelope(cancelled);
  return toRefundResult(cancelled.value, paymentId, ctx.now());
}

function missingOrderId(paymentId: string): Result<ChargeResult, KopruError> {
  return err(
    new ProviderError({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      message: 'iyzico 3DS response does not contain the order id (conversationId)',
      provider: IYZICO_PROVIDER_ID,
      details: { paymentId },
    }),
  );
}

/**
 * iyzico ödeme sağlayıcısı fabrikası. Konfigürasyon geçersizse `ConfigurationError` fırlatır.
 *
 * Yetenekler: `charge` (non-3DS), `threeDS`, `refund` (tam iade), `installments`.
 *
 * @example
 * const payments = createPaymentClient({
 *   provider: iyzico({ apiKey: '…', secretKey: '…', sandbox: true }),
 * });
 */
export const iyzico = definePaymentProvider({
  id: IYZICO_PROVIDER_ID,
  configSchema: IyzicoConfigSchema,
  capabilities: ['charge', 'threeDS', 'refund', 'installments'],
  create: (config) => ({
    async charge(input, ctx) {
      const request = toIyzicoPaymentRequest(input, config);
      if (!request.ok) return request;
      const response = await callIyzico(config, ctx, {
        path: IYZICO_PATHS.payment,
        body: request.value,
        responseSchema: IyzicoPaymentResponseSchema,
        operation: 'payment',
      });
      if (!response.ok) return dropEnvelope(response);
      return toChargeResult(response.value, input.orderId, ctx.now());
    },

    async initThreeDS(input, ctx) {
      const request = toIyzicoThreeDSInitRequest(input, config);
      if (!request.ok) return request;
      const response = await callIyzico(config, ctx, {
        path: IYZICO_PATHS.threeDSInitialize,
        body: request.value,
        responseSchema: IyzicoThreeDSInitResponseSchema,
        operation: 'payment',
      });
      if (!response.ok) return dropEnvelope(response);
      return toThreeDSInitResult(response.value, input.orderId);
    },

    async completeThreeDS(input, ctx) {
      const completion = toThreeDSCompletion(input, config);
      if (!completion.ok) return completion;
      const response = await callIyzico(config, ctx, {
        path: IYZICO_PATHS.threeDSAuth,
        body: completion.value.request,
        responseSchema: IyzicoPaymentResponseSchema,
        operation: 'payment',
      });
      if (!response.ok) return dropEnvelope(response);
      const orderId =
        completion.value.orderId ?? response.value.conversationId ?? response.value.basketId;
      if (orderId === undefined || orderId === '') return missingOrderId(response.value.paymentId);
      return toChargeResult(response.value, orderId, ctx.now());
    },

    refund(input, ctx) {
      return refundPayment(config, ctx, input.transactionId);
    },
  }),
});
