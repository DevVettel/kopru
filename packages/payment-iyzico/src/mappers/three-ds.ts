import {
  PaymentError,
  ProviderError,
  err,
  ok,
  toValidationIssues,
  type KopruError,
  type Result,
  type ThreeDSCallback,
} from '@kopru/core';
import type { IyzicoConfig } from '../config.js';
import { IYZICO_PROVIDER_ID } from '../errors.js';
import type { IyzicoThreeDSAuthRequest } from '../schemas/request.js';
import { IyzicoThreeDSCallbackSchema } from '../schemas/response.js';

/** Başarılı 3DS doğrulamasını gösteren `mdStatus` değeri. */
export const IYZICO_MD_STATUS_SUCCESS = '1';

/** Callback'ten çözümlenen ve tahsilatı tamamlamak için gereken bilgiler. */
export interface ThreeDSCompletion {
  request: IyzicoThreeDSAuthRequest;
  /** Mağazanın sipariş numarası (`conversationId` olarak gönderilmişti). */
  orderId: string | undefined;
}

/**
 * Bankanın callback verisini doğrular ve `POST /payment/3dsecure/auth` isteğine çevirir.
 *
 * - Veri iyzico callback formatında değilse `PROVIDER_UNEXPECTED_RESPONSE`.
 * - `status` başarılı değilse veya `mdStatus` `1` değilse `PAYMENT_THREEDS_FAILED`
 *   (`providerCode` olarak `mdStatus` taşınır).
 */
export function toThreeDSCompletion(
  callback: ThreeDSCallback,
  config: Pick<IyzicoConfig, 'locale'>,
): Result<ThreeDSCompletion, KopruError> {
  const parsed = IyzicoThreeDSCallbackSchema.safeParse(callback.payload);
  if (!parsed.success) {
    return err(
      new ProviderError({
        code: 'PROVIDER_UNEXPECTED_RESPONSE',
        message: 'Invalid iyzico 3DS callback payload',
        provider: IYZICO_PROVIDER_ID,
        details: { issues: toValidationIssues(parsed.error) },
      }),
    );
  }

  const { status, paymentId, mdStatus, conversationId, conversationData } = parsed.data;
  if (status !== 'success' || mdStatus !== IYZICO_MD_STATUS_SUCCESS || paymentId === undefined) {
    return err(
      new PaymentError({
        code: 'PAYMENT_THREEDS_FAILED',
        message: `iyzico 3DS verification failed (status: ${status}, mdStatus: ${mdStatus ?? 'none'})`,
        provider: IYZICO_PROVIDER_ID,
        ...(mdStatus === undefined ? {} : { providerCode: mdStatus }),
        ...(paymentId === undefined ? {} : { details: { paymentId } }),
      }),
    );
  }

  const orderId =
    conversationId === undefined || conversationId === '' ? undefined : conversationId;
  return ok({
    orderId,
    request: {
      locale: config.locale,
      ...(orderId === undefined ? {} : { conversationId: orderId }),
      paymentId,
      ...(conversationData === undefined || conversationData === '' ? {} : { conversationData }),
    },
  });
}
