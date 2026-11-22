import {
  ValidationError,
  err,
  getCityName,
  ok,
  toValidationIssues,
  type CreateShipmentRequest,
  type KopruError,
  type Result,
  type ShipmentLookup,
  type ValidationIssue,
} from '@kopru/core';
import type { YurticiConfig } from '../config.js';
import { YURTICI_PROVIDER_ID } from '../errors.js';
import { ShippingOrderSchema, type ShippingOrder } from '../schemas/request.js';

/** Yurtiçi alanı → core alanı; doğrulama hatalarının kullanıcıya tanıdık yolla dönmesi için. */
const FIELD_PATHS: Readonly<Record<string, string>> = {
  cargoKey: 'referenceId',
  invoiceKey: 'referenceId',
  receiverCustName: 'recipient.name',
  receiverAddress: 'recipient.address',
  cityName: 'recipient.address.cityCode',
  townName: 'recipient.address.district',
  receiverPhone1: 'recipient.phone',
  emailAddress: 'recipient.email',
  desi: 'desi',
  kg: 'weightKg',
  cargoCount: 'pieceCount',
  description: 'description',
};

const TURKISH_PHONE_PREFIX = '+90';

function validationError(message: string, issues: ValidationIssue[]): ValidationError {
  return new ValidationError({
    message,
    provider: YURTICI_PROVIDER_ID,
    details: { issues },
  });
}

/** E.164 numarayı Yurtiçi'nin beklediği 10 haneye çevirir; Türkiye dışı numaralar olduğu gibi kalır. */
function toYurticiPhone(phone: string): string {
  return phone.startsWith(TURKISH_PHONE_PREFIX) ? phone.slice(TURKISH_PHONE_PREFIX.length) : phone;
}

/**
 * Core gönderi isteğini Yurtiçi `ShippingOrderVO` kaydına çevirir. Saf fonksiyondur.
 *
 * - `referenceId` hem kargo anahtarı (`cargoKey`) hem fatura anahtarı (`invoiceKey`) olur.
 * - Gönderen bilgisi Yurtiçi hesabından alındığı için `sender` gönderilmez.
 * - Hesabın ödeme tipiyle uyuşmayan `paymentType` veya Yurtiçi alan sınırlarını aşan
 *   değerler ağ isteği yapılmadan `VALIDATION_FAILED` döner.
 */
export function toShippingOrder(
  input: CreateShipmentRequest,
  config: Pick<YurticiConfig, 'paymentType'>,
): Result<ShippingOrder, KopruError> {
  if (input.paymentType !== config.paymentType) {
    return err(
      validationError(`Yurtiçi account is configured for ${config.paymentType}-paid shipments`, [
        {
          path: 'paymentType',
          code: 'custom',
          message: `Expected "${config.paymentType}" for this Yurtiçi account`,
        },
      ]),
    );
  }

  const { recipient } = input;
  const { address } = recipient;
  const order = {
    cargoKey: input.referenceId,
    invoiceKey: input.referenceId,
    receiverCustName: recipient.name,
    receiverAddress: [address.neighborhood, address.addressLine]
      .filter((part) => part !== undefined)
      .join(', '),
    cityName: getCityName(address.cityCode),
    townName: address.district,
    receiverPhone1: toYurticiPhone(recipient.phone),
    ...(recipient.email === undefined ? {} : { emailAddress: recipient.email }),
    ...(input.desi === undefined ? {} : { desi: input.desi }),
    ...(input.weightKg === undefined ? {} : { kg: input.weightKg }),
    cargoCount: input.pieceCount,
    ...(input.description === undefined ? {} : { description: input.description }),
    taxOfficeId: 0,
    ttDocumentId: 0,
    dcSelectedCredit: 0,
    dcCreditRule: 0,
  };

  const parsed = ShippingOrderSchema.safeParse(order);
  if (parsed.success) return ok(parsed.data);
  const issues = toValidationIssues(parsed.error).map((issue) => {
    const [field = '', ...rest] = issue.path.split('.');
    const mapped = FIELD_PATHS[field];
    return mapped === undefined ? issue : { ...issue, path: [mapped, ...rest].join('.') };
  });
  return err(
    validationError(
      `Shipment does not satisfy Yurtiçi field limits: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
      issues,
    ),
  );
}

/**
 * Gönderi arama anahtarından Yurtiçi kargo anahtarını (`cargoKey`) çıkarır. Yurtiçi
 * gönderileri yalnızca kargo/fatura anahtarıyla sorgulanabildiği için `referenceId` zorunludur.
 */
export function toCargoKey(lookup: ShipmentLookup): Result<string, KopruError> {
  if (lookup.referenceId !== undefined) return ok(lookup.referenceId);
  return err(
    validationError(
      'Yurtiçi lookups require referenceId (cargoKey); trackingNumber alone is not supported',
      [
        {
          path: 'referenceId',
          code: 'custom',
          message: 'Required for Yurtiçi',
        },
      ],
    ),
  );
}
