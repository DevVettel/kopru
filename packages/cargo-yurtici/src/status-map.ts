import type { ShipmentStatus } from '@kopru/core';

/**
 * Yurtiçi gönderi işlem durumu (`operationStatus`) → standart durum. Kaynak ve
 * gerekçeler için `NOTES.md` §5.
 */
export const YURTICI_OPERATION_STATUS_MAP: ReadonlyMap<string, ShipmentStatus> = new Map([
  ['NOP', 'created'],
  ['ISR', 'picked_up'],
  ['IND', 'in_transit'],
  ['DLV', 'delivered'],
  ['CNL', 'cancelled'],
  ['ISC', 'cancelled'],
  ['BI', 'cancelled'],
]);

/** Sayısal işlem kodu (`operationCode`) → işlem durumu; `operationStatus` boşsa kullanılır. */
export const YURTICI_OPERATION_CODES: ReadonlyMap<string, string> = new Map([
  ['0', 'NOP'],
  ['1', 'IND'],
  ['2', 'ISR'],
  ['3', 'CNL'],
  ['4', 'ISC'],
  ['5', 'DLV'],
  ['6', 'BI'],
]);

/** Kargo hareketi kodu (`eventId`) → standart durum. */
export const YURTICI_EVENT_STATUS_MAP: ReadonlyMap<string, ShipmentStatus> = new Map([
  ['GT', 'picked_up'],
  ['IN', 'in_transit'],
  ['YK', 'in_transit'],
  ['DG', 'out_for_delivery'],
  ['TS', 'delivered'],
  ['TE', 'delivered'],
  ['IA', 'returned'],
]);

/** Ham işlem durumu ve onun standart karşılığı. */
export interface YurticiOperationState {
  /** Ham değer (`NOP`, `IND` …); hiçbiri yoksa `undefined`. */
  providerStatus: string | undefined;
  status: ShipmentStatus;
}

/**
 * `operationStatus` (yoksa `operationCode`) değerini standart duruma çevirir.
 * Eşlenemeyen değerler `unknown` olur; ham değer korunur.
 */
export function mapOperationStatus(
  operationStatus: string | undefined,
  operationCode: string | undefined,
): YurticiOperationState {
  const raw =
    operationStatus !== undefined && operationStatus !== ''
      ? operationStatus.toUpperCase()
      : operationCode === undefined
        ? undefined
        : (YURTICI_OPERATION_CODES.get(operationCode) ?? operationCode);
  return {
    providerStatus: raw,
    status: (raw === undefined ? undefined : YURTICI_OPERATION_STATUS_MAP.get(raw)) ?? 'unknown',
  };
}

/** Hareket kodunu standart duruma çevirir; eşlenemeyen kodlar `unknown` olur. */
export function mapEventStatus(eventId: string): ShipmentStatus {
  return YURTICI_EVENT_STATUS_MAP.get(eventId.toUpperCase()) ?? 'unknown';
}

/** Gönderi "yolda" sayılırken son hareketin durumu daha kesin bilgi verebilir. */
const REFINABLE: ReadonlySet<ShipmentStatus> = new Set(['picked_up', 'in_transit']);
const REFINING: ReadonlySet<ShipmentStatus> = new Set(['out_for_delivery', 'returned']);

/** Yurtiçi `returnStatus` değeri: gönderi göndericiye iade edildi. */
const RETURNED_TO_SENDER = '3';

/**
 * Gönderinin genel durumunu belirler. `IND` ("teslimatta") faturalamadan teslimata kadar
 * tüm süreci kapsadığından; son hareket dağıtıma çıkışı veya iadeyi gösteriyorsa o durum,
 * `returnStatus = 3` ise `returned` kullanılır.
 */
export function resolveShipmentStatus(
  base: ShipmentStatus,
  lastEventStatus: ShipmentStatus | undefined,
  returnStatus: string | undefined,
): ShipmentStatus {
  if (returnStatus === RETURNED_TO_SENDER) return 'returned';
  if (REFINABLE.has(base) && lastEventStatus !== undefined && REFINING.has(lastEventStatus)) {
    return lastEventStatus;
  }
  return base;
}
