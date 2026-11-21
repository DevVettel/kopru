import {
  PaymentError,
  ProviderError,
  ValidationError,
  base64Decode,
  err,
  getCityName,
  ok,
  parseCardExpiry,
  toDecimalString,
  type Address,
  type ChargeRequest,
  type ChargeResult,
  type KopruError,
  type Result,
  type ThreeDSInitRequest,
  type ThreeDSInitResult,
  type ValidationIssue,
} from '@kopru/core';
import type { IyzicoConfig } from '../config.js';
import { IYZICO_PROVIDER_ID } from '../errors.js';
import type {
  IyzicoAddressSchema,
  IyzicoPaymentRequest,
  IyzicoThreeDSInitRequest,
} from '../schemas/request.js';
import type { IyzicoPaymentResponse, IyzicoThreeDSInitResponse } from '../schemas/response.js';
import type { z } from 'zod';
import { fromIyzicoAmount, fromIyzicoSystemTime } from './amount.js';

/** iyzico'ya gönderilen ülke adı. Faz 1 adres modeli yalnızca Türkiye adreslerini kapsar. */
const COUNTRY = 'Turkey';

type IyzicoAddress = z.infer<typeof IyzicoAddressSchema>;

/** Mapper'ın ihtiyaç duyduğu konfigürasyon alanları. */
export type PaymentMapperConfig = Pick<
  IyzicoConfig,
  'locale' | 'basketItemType' | 'defaultItemCategory'
>;

/** Adresi iyzico'nun beklediği tek satırlık açık adrese çevirir. */
export function formatAddressLine(address: Address): string {
  return [address.addressLine, address.neighborhood, address.district]
    .filter((part) => part !== undefined)
    .join(', ');
}

function toIyzicoAddress(address: Address, contactName: string): IyzicoAddress {
  return {
    contactName,
    city: getCityName(address.cityCode),
    country: COUNTRY,
    address: formatAddressLine(address),
    ...(address.postalCode === undefined ? {} : { zipCode: address.postalCode }),
  };
}

function missingFields(issues: ValidationIssue[]): ValidationError {
  return new ValidationError({
    message: `iyzico requires additional fields: ${issues.map((i) => i.path).join(', ')}`,
    provider: IYZICO_PROVIDER_ID,
    details: { issues },
  });
}

/**
 * Core tahsilat isteğini `POST /payment/auth` isteğine çevirir.
 *
 * iyzico'nun zorunlu tuttuğu ama core'da opsiyonel olan alanlar (`buyer.identityNumber`,
 * alıcı veya fatura adresi) eksikse ağ isteği yapılmadan `VALIDATION_FAILED` döner.
 * Fatura adresi verilmezse alıcı adresi kullanılır (ve tersi). `items` verilmezse sipariş
 * tek kalemlik sepet olarak gönderilir.
 */
export function toIyzicoPaymentRequest(
  input: ChargeRequest,
  config: PaymentMapperConfig,
): Result<IyzicoPaymentRequest, ValidationError> {
  const { buyer, card } = input;
  const registrationAddress = buyer.address ?? input.billingAddress;
  const billingAddress = input.billingAddress ?? buyer.address;

  const issues: ValidationIssue[] = [];
  if (buyer.identityNumber === undefined) {
    issues.push({
      path: 'buyer.identityNumber',
      code: 'custom',
      message: 'iyzico requires the buyer identity number',
    });
  }
  if (registrationAddress === undefined || billingAddress === undefined) {
    issues.push({
      path: 'buyer.address',
      code: 'custom',
      message: 'iyzico requires a buyer address or a billing address',
    });
  }
  if (
    buyer.identityNumber === undefined ||
    registrationAddress === undefined ||
    billingAddress === undefined
  ) {
    return err(missingFields(issues));
  }

  const contactName = `${buyer.firstName} ${buyer.lastName}`;
  const iyzicoBillingAddress = toIyzicoAddress(billingAddress, contactName);
  const { month, year } = parseCardExpiry(card.expiry);
  const price = toDecimalString(input.amount);

  return ok({
    locale: config.locale,
    conversationId: input.orderId,
    price,
    paidPrice: price,
    currency: input.amount.currency,
    installment: input.installments,
    basketId: input.orderId,
    paymentChannel: 'WEB',
    paymentGroup: 'PRODUCT',
    paymentCard: {
      cardHolderName: card.holderName,
      cardNumber: card.number,
      expireMonth: month,
      expireYear: year,
      cvc: card.cvc,
      registerCard: 0,
    },
    buyer: {
      id: buyer.id,
      name: buyer.firstName,
      surname: buyer.lastName,
      email: buyer.email,
      identityNumber: buyer.identityNumber,
      ...(buyer.phone === undefined ? {} : { gsmNumber: buyer.phone }),
      registrationAddress: formatAddressLine(registrationAddress),
      city: getCityName(registrationAddress.cityCode),
      country: COUNTRY,
      ...(registrationAddress.postalCode === undefined
        ? {}
        : { zipCode: registrationAddress.postalCode }),
      ...(buyer.ip === undefined ? {} : { ip: buyer.ip }),
    },
    shippingAddress: iyzicoBillingAddress,
    billingAddress: iyzicoBillingAddress,
    basketItems: (
      input.items ?? [
        {
          id: input.orderId,
          name: input.description ?? input.orderId,
          category: config.defaultItemCategory,
          price: input.amount,
        },
      ]
    ).map((item) => ({
      id: item.id,
      name: item.name,
      category1: item.category,
      itemType: config.basketItemType,
      price: toDecimalString(item.price),
    })),
  });
}

/**
 * Core 3DS başlatma isteğini `POST /payment/3dsecure/initialize` isteğine çevirir.
 * Kurallar `toIyzicoPaymentRequest` ile aynıdır.
 */
export function toIyzicoThreeDSInitRequest(
  input: ThreeDSInitRequest,
  config: PaymentMapperConfig,
): Result<IyzicoThreeDSInitRequest, ValidationError> {
  const payment = toIyzicoPaymentRequest(input, config);
  if (!payment.ok) return payment;
  return ok({ ...payment.value, callbackUrl: input.callbackUrl });
}

/**
 * Başarılı iyzico ödeme yanıtını `ChargeResult`'a çevirir. `fraudStatus = -1` olan
 * yanıtlar başarılı sayılmaz.
 *
 * @param response - Doğrulanmış iyzico ödeme yanıtı
 * @param orderId - Mağazanın sipariş numarası
 * @param now - `systemTime` yoksa kullanılacak zaman
 */
export function toChargeResult(
  response: IyzicoPaymentResponse,
  orderId: string,
  now: Date,
): Result<ChargeResult, KopruError> {
  if (response.fraudStatus === -1) {
    return err(
      new PaymentError({
        code: 'PAYMENT_FRAUD_SUSPECTED',
        message: 'iyzico rejected the payment in fraud review',
        provider: IYZICO_PROVIDER_ID,
        details: { paymentId: response.paymentId },
      }),
    );
  }

  const amount = fromIyzicoAmount(response.paidPrice, response.currency);
  if (!amount.ok) return amount;

  return ok({
    transactionId: response.paymentId,
    orderId,
    amount: amount.value,
    installments: response.installment,
    createdAt: fromIyzicoSystemTime(response.systemTime, now),
    ...(response.binNumber === undefined ? {} : { cardBin: response.binNumber }),
    ...(response.lastFourDigits === undefined ? {} : { cardLastFour: response.lastFourDigits }),
    ...(response.cardFamily === undefined ? {} : { cardFamily: response.cardFamily }),
  });
}

/**
 * Başarılı 3DS başlatma yanıtını `ThreeDSInitResult`'a çevirir. iyzico doğrulama sayfasını
 * Base64 kodlu HTML olarak döndüğünden eylem tipi her zaman `html`'dir.
 */
export function toThreeDSInitResult(
  response: IyzicoThreeDSInitResponse,
  orderId: string,
): Result<ThreeDSInitResult, ProviderError> {
  const html = base64Decode(response.threeDSHtmlContent);
  if (html.trim() === '') {
    return err(
      new ProviderError({
        code: 'PROVIDER_UNEXPECTED_RESPONSE',
        message: 'iyzico returned an empty 3DS page',
        provider: IYZICO_PROVIDER_ID,
      }),
    );
  }
  return ok({
    orderId,
    ...(response.paymentId === undefined ? {} : { transactionId: response.paymentId }),
    action: { type: 'html', html },
  });
}
