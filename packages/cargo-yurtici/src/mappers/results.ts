import {
  CargoError,
  ProviderError,
  err,
  istanbulLocalToDateTime,
  ok,
  type KopruError,
  type Result,
  type Shipment,
  type ShipmentTracking,
  type TrackingEvent,
} from '@kopru/core';
import {
  YURTICI_ALREADY_CANCELLED,
  YURTICI_PROVIDER_ID,
  isYurticiErrorCode,
  mapYurticiError,
} from '../errors.js';
import type {
  CancelShipmentResponse,
  CreateShipmentResponse,
  QueryShipmentResponse,
  YurticiEvent,
} from '../schemas/response.js';
import { mapEventStatus, mapOperationStatus, resolveShipmentStatus } from '../status-map.js';

/** Yurtiçi'nin başarılı yanıttaki `outFlag` değeri. */
const OUT_FLAG_SUCCESS = '0';

interface ResultBase {
  outFlag: string;
  outResult?: string | undefined;
  errCode?: string | undefined;
  errMessage?: string | undefined;
}

interface DetailBase {
  cargoKey?: string | undefined;
  errCode?: string | undefined;
  errMessage?: string | undefined;
}

/** Yanıttaki kayıtlar arasından istenen kargo anahtarınınkini (yoksa ilkini) seçer. */
function pickDetail<D extends DetailBase>(details: readonly D[], cargoKey: string): D | undefined {
  return details.find((detail) => detail.cargoKey === cargoKey) ?? details[0];
}

/** Üst düzey sonuç başarısızsa hatayı döner; kayıt düzeyindeki hata önceliklidir. */
function failureOf(result: ResultBase, detail: DetailBase | undefined): KopruError | undefined {
  if (detail !== undefined && isYurticiErrorCode(detail.errCode)) return mapYurticiError(detail);
  if (isYurticiErrorCode(result.errCode)) return mapYurticiError(result);
  if (result.outFlag !== OUT_FLAG_SUCCESS) {
    return mapYurticiError({ errMessage: result.errMessage ?? result.outResult });
  }
  return undefined;
}

function unexpected(message: string, details: Record<string, unknown>): ProviderError {
  return new ProviderError({
    code: 'PROVIDER_UNEXPECTED_RESPONSE',
    message,
    provider: YURTICI_PROVIDER_ID,
    details,
  });
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/**
 * `createShipment` yanıtını `Shipment`'a çevirir. Takip numarası Yurtiçi'de kargo teslim
 * alındıktan sonra oluştuğu için bu aşamada dönmez. Saf fonksiyondur.
 */
export function toCreatedShipment(
  response: CreateShipmentResponse,
  referenceId: string,
): Result<Shipment, KopruError> {
  const result = response.ShippingOrderResultVO;
  const failure = failureOf(result, pickDetail(result.shippingOrderDetailVO, referenceId));
  if (failure !== undefined) return err(failure);
  return ok({ referenceId, status: 'created' });
}

/**
 * `cancelShipment` yanıtını `Shipment`'a çevirir. Saf fonksiyondur.
 *
 * - Daha önce iptal edilmiş gönderi (`82520`) başarı sayılır; böylece iptal tekrar edilebilir.
 * - İşlem durumu iptal dışında bir değerse (örn. `IND`) `CARGO_CANCELLATION_NOT_ALLOWED` döner.
 */
export function toCancelledShipment(
  response: CancelShipmentResponse,
  referenceId: string,
): Result<Shipment, KopruError> {
  const result = response.ShippingOrderResultVO;
  const detail = pickDetail(result.shippingCancelDetailVO, referenceId);
  if (detail?.errCode === YURTICI_ALREADY_CANCELLED) {
    return ok({ referenceId, status: 'cancelled', providerStatus: 'ISC' });
  }
  const failure = failureOf(result, detail);
  if (failure !== undefined) return err(failure);
  if (detail === undefined) {
    return err(unexpected('Yurtiçi cancelShipment response contains no shipment detail', {}));
  }

  const { status, providerStatus } = mapOperationStatus(
    detail.operationStatus,
    detail.operationCode,
  );
  const trackingNumber = nonEmpty(detail.docId);
  if (status === 'cancelled') {
    return ok({
      referenceId,
      status,
      ...(providerStatus === undefined ? {} : { providerStatus }),
      ...(trackingNumber === undefined ? {} : { trackingNumber }),
    });
  }
  if (status === 'unknown') {
    return err(
      unexpected('Yurtiçi cancelShipment returned an unrecognized operation status', {
        operationStatus: providerStatus,
      }),
    );
  }
  const providerMessage = nonEmpty(detail.operationMessage);
  return err(
    new CargoError({
      code: 'CARGO_CANCELLATION_NOT_ALLOWED',
      message: `Yurtiçi shipment cannot be cancelled in status ${providerStatus ?? status}`,
      provider: YURTICI_PROVIDER_ID,
      ...(providerStatus === undefined ? {} : { providerCode: providerStatus }),
      ...(providerMessage === undefined ? {} : { providerMessage }),
      details: { status },
    }),
  );
}

/**
 * Yurtiçi hareketini `TrackingEvent`'e çevirir. Tarih ve saat İstanbul yerel saatidir.
 *
 * @returns Hareket; tarih geçersizse `undefined`
 */
export function toTrackingEvent(event: YurticiEvent): TrackingEvent | undefined {
  const date = event.eventDate;
  const time = event.eventTime.padStart(6, '0');
  const occurredAt = istanbulLocalToDateTime(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`,
  );
  if (occurredAt === undefined) return undefined;

  const reasonName = nonEmpty(event.reasonName);
  const hasProblem =
    event.reasonId !== undefined && event.reasonId !== '' && event.reasonId !== 'OK';
  const location = [nonEmpty(event.unitName), nonEmpty(event.townName), nonEmpty(event.cityName)]
    .filter((part) => part !== undefined)
    .join(', ');
  return {
    status: mapEventStatus(event.eventId),
    providerStatus: event.eventId,
    description:
      hasProblem && reasonName !== undefined
        ? `${event.eventName} (${reasonName})`
        : event.eventName,
    ...(location === '' ? {} : { location }),
    occurredAt,
  };
}

/**
 * `queryShipment` yanıtını `ShipmentTracking`'e çevirir; hareketler eskiden yeniye sıralanır.
 * Saf fonksiyondur.
 */
export function toShipmentTracking(
  response: QueryShipmentResponse,
  referenceId: string,
): Result<ShipmentTracking, KopruError> {
  const result = response.ShippingDeliveryVO;
  const detail = pickDetail(result.shippingDeliveryDetailVO, referenceId);
  const failure = failureOf(result, detail);
  if (failure !== undefined) return err(failure);
  if (detail === undefined) {
    return err(
      new CargoError({
        code: 'CARGO_SHIPMENT_NOT_FOUND',
        message: 'Yurtiçi queryShipment returned no record for the shipment',
        provider: YURTICI_PROVIDER_ID,
      }),
    );
  }

  const item = detail.shippingDeliveryItemDetailVO[0];
  const rawEvents = item?.invDocCargoVOArray ?? [];
  const events: TrackingEvent[] = [];
  for (const raw of rawEvents) {
    const event = toTrackingEvent(raw);
    if (event === undefined) {
      return err(
        unexpected('Yurtiçi returned a tracking event with an invalid date', {
          eventDate: raw.eventDate,
          eventTime: raw.eventTime,
        }),
      );
    }
    events.push(event);
  }
  // Yurtiçi sıralamayı garanti etmez; aynı saniyedeki hareketlerin sırası korunur.
  events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const operation = mapOperationStatus(detail.operationStatus, detail.operationCode);
  const status = resolveShipmentStatus(operation.status, events.at(-1)?.status, item?.returnStatus);
  const trackingNumber = nonEmpty(item?.docId);
  return ok({
    referenceId,
    status,
    ...(operation.providerStatus === undefined ? {} : { providerStatus: operation.providerStatus }),
    ...(trackingNumber === undefined ? {} : { trackingNumber }),
    events,
  });
}
