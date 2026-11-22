import { xmlList } from '@kopru/core';
import { z } from 'zod';

/**
 * Yurtiçi SOAP yanıtlarının (JSON'a çevrilmiş hali) Zod şemaları. Yalnızca bu paket içinde
 * kullanılır ve dışarı export edilmez. XML'deki tüm değerler metindir; kullanılmayan alanlar
 * yok sayılır.
 */

const OptionalText = z.string().optional();

/** Tüm sonuç nesnelerinde bulunan üst düzey alanlar. */
const ResultBaseSchema = z.object({
  /** `0`: en az bir kayıt başarılı, `1`: tüm kayıtlar hatalı, `2`: beklenmeyen hata. */
  outFlag: z.string(),
  outResult: OptionalText,
  errCode: OptionalText,
  errMessage: OptionalText,
  jobId: OptionalText,
  count: OptionalText,
});

/** `createShipment` kayıt sonucu. */
const OrderDetailSchema = z.object({
  cargoKey: OptionalText,
  invoiceKey: OptionalText,
  errCode: OptionalText,
  errMessage: OptionalText,
});

/** `createShipment` yanıtı (`createShipmentResponse` elemanının içeriği). */
export const CreateShipmentResponseSchema = z.object({
  ShippingOrderResultVO: ResultBaseSchema.extend({
    shippingOrderDetailVO: xmlList(OrderDetailSchema),
  }),
});

/** `createShipment` yanıtı. */
export type CreateShipmentResponse = z.infer<typeof CreateShipmentResponseSchema>;

/** İşlem durumu taşıyan kayıtların ortak alanları. */
const OperationDetailSchema = z.object({
  cargoKey: OptionalText,
  invoiceKey: OptionalText,
  operationCode: OptionalText,
  operationStatus: OptionalText,
  operationMessage: OptionalText,
  errCode: OptionalText,
  errMessage: OptionalText,
});

/** `cancelShipment` kayıt sonucu. */
const CancelDetailSchema = OperationDetailSchema.extend({ docId: OptionalText });

/** `cancelShipment` yanıtı (`cancelShipmentResponse` elemanının içeriği). */
export const CancelShipmentResponseSchema = z.object({
  ShippingOrderResultVO: ResultBaseSchema.extend({
    shippingCancelDetailVO: xmlList(CancelDetailSchema),
  }),
});

/** `cancelShipment` yanıtı. */
export type CancelShipmentResponse = z.infer<typeof CancelShipmentResponseSchema>;

/** Kargo hareketi (`invDocCargoVOArray` öğesi). */
export const YurticiEventSchema = z.object({
  eventId: z.string().min(1),
  eventName: z.string(),
  reasonId: OptionalText,
  reasonName: OptionalText,
  /** `YYYYMMDD` (İstanbul yerel saati). */
  eventDate: z.string().regex(/^\d{8}$/),
  /** `HHMMSS`; baştaki sıfırlar eksik gelebilir (örn. `82304`). */
  eventTime: z.string().regex(/^\d{1,6}$/),
  unitName: OptionalText,
  cityName: OptionalText,
  townName: OptionalText,
});

/** Kargo hareketi. */
export type YurticiEvent = z.infer<typeof YurticiEventSchema>;

/** Gönderinin fatura/teslimat ayrıntısı (`shippingDeliveryItemDetailVO`). */
const DeliveryItemSchema = z.object({
  /** Gönderi (takip) numarası; kargo teslim alınıp faturalandıktan sonra oluşur. */
  docId: OptionalText,
  trackingUrl: OptionalText,
  returnStatus: OptionalText,
  invDocCargoVOArray: xmlList(YurticiEventSchema),
});

/** `queryShipment` kayıt sonucu. */
const DeliveryDetailSchema = OperationDetailSchema.extend({
  shippingDeliveryItemDetailVO: xmlList(DeliveryItemSchema),
});

/** `queryShipment` kayıt sonucu. */
export type YurticiDeliveryDetail = z.infer<typeof DeliveryDetailSchema>;

/** `queryShipment` yanıtı (`queryShipmentResponse` elemanının içeriği). */
export const QueryShipmentResponseSchema = z.object({
  ShippingDeliveryVO: ResultBaseSchema.extend({
    shippingDeliveryDetailVO: xmlList(DeliveryDetailSchema),
  }),
});

/** `queryShipment` yanıtı. */
export type QueryShipmentResponse = z.infer<typeof QueryShipmentResponseSchema>;
