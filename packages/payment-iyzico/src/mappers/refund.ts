import { ok, toDecimalString, type KopruError, type RefundResult, type Result } from '@kopru/core';
import type { IyzicoConfig } from '../config.js';
import type { IyzicoRefundRequest } from '../schemas/request.js';
import type { IyzicoPaymentResponse, IyzicoRefundResponse } from '../schemas/response.js';
import { fromIyzicoAmount, fromIyzicoSystemTime } from './amount.js';

/**
 * Ödeme detayından tam iade isteğini (`POST /v2/payment/refund`) üretir. İade tutarı,
 * müşteriden tahsil edilen tutardır (`paidPrice`).
 */
export function toIyzicoRefundRequest(
  payment: IyzicoPaymentResponse,
  config: Pick<IyzicoConfig, 'locale'>,
): Result<IyzicoRefundRequest, KopruError> {
  const amount = fromIyzicoAmount(payment.paidPrice, payment.currency);
  if (!amount.ok) return amount;
  return ok({
    locale: config.locale,
    paymentId: payment.paymentId,
    price: toDecimalString(amount.value),
    currency: amount.value.currency,
  });
}

/**
 * Başarılı iade veya iptal yanıtını `RefundResult`'a çevirir. iyzico ayrı bir iade kimliği
 * vermediğinden banka referansı (`refundHostReference` / `cancelHostReference` /
 * `hostReference`) kullanılır; hiçbiri yoksa ödeme kimliği kullanılır.
 *
 * @param response - Doğrulanmış iade/iptal yanıtı
 * @param transactionId - İade edilen tahsilatın işlem kimliği
 * @param now - `systemTime` yoksa kullanılacak zaman
 */
export function toRefundResult(
  response: IyzicoRefundResponse,
  transactionId: string,
  now: Date,
): Result<RefundResult, KopruError> {
  const amount = fromIyzicoAmount(response.price, response.currency);
  if (!amount.ok) return amount;
  return ok({
    refundId:
      response.refundHostReference ??
      response.cancelHostReference ??
      response.hostReference ??
      response.paymentId,
    transactionId,
    amount: amount.value,
    createdAt: fromIyzicoSystemTime(response.systemTime, now),
  });
}
