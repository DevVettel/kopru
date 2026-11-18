import { z } from 'zod';
import { AddressSchema } from '../../primitives/address.js';
import { PositiveMoneySchema } from '../payment/schemas.js';
import { PhoneNumberSchema } from '../../primitives/phone.js';
import { DateTimeSchema } from '../../utils/date.js';

/** Standart gönderi durumları (bkz. GLOSSARY.md). */
export const SHIPMENT_STATUSES = [
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'cancelled',
  'unknown',
] as const;

/** Gönderi durumu şeması. */
export const ShipmentStatusSchema = z.enum(SHIPMENT_STATUSES);

/** Standart gönderi durumu. Eşlenemeyen sağlayıcı durumları `unknown` olur. */
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;

/** Gönderi tarafı (gönderen veya alıcı) şeması. */
export const ShipmentContactSchema = z.object({
  /** Kişi veya firma adı. */
  name: z.string().trim().min(2).max(200),
  phone: PhoneNumberSchema,
  email: z.email().optional(),
  address: AddressSchema,
});

/** Gönderi tarafı. */
export type ShipmentContact = z.infer<typeof ShipmentContactSchema>;

/** Gönderi oluşturma isteği şeması. */
export const CreateShipmentRequestSchema = z.object({
  /** Gönderiyi oluşturan tarafın kendi referansı (kargo anahtarı). */
  referenceId: z.string().trim().min(1).max(64),
  /** Gönderen. Verilmezse sağlayıcı hesabındaki varsayılan gönderici kullanılır. */
  sender: ShipmentContactSchema.optional(),
  recipient: ShipmentContactSchema,
  /** Koli/parça adedi. */
  pieceCount: z.number().int().min(1).max(999).default(1),
  /** Hacimsel ağırlık (desi). */
  desi: z.number().positive().max(10_000).optional(),
  /** Ağırlık (kg). */
  weightKg: z.number().positive().max(10_000).optional(),
  /** Kargo ücretini kimin ödeyeceği. */
  paymentType: z.enum(['sender', 'recipient']).default('sender'),
  /** Kapıda ödeme tutarı; verilirse `cashOnDelivery` yeteneği gerekir. */
  cashOnDelivery: PositiveMoneySchema.optional(),
  description: z.string().trim().max(500).optional(),
});

/** Doğrulanmış gönderi oluşturma isteği. */
export type CreateShipmentRequest = z.output<typeof CreateShipmentRequestSchema>;
/** Kullanıcının verdiği gönderi oluşturma isteği. */
export type CreateShipmentRequestInput = z.input<typeof CreateShipmentRequestSchema>;

/** Gönderiyi bulmak için kullanılan anahtarlar; en az biri verilmelidir. */
export const ShipmentLookupSchema = z
  .object({
    referenceId: z.string().trim().min(1).optional(),
    trackingNumber: z.string().trim().min(1).optional(),
  })
  .refine((lookup) => lookup.referenceId !== undefined || lookup.trackingNumber !== undefined, {
    message: 'Either referenceId or trackingNumber is required',
  });

/** Gönderi arama anahtarları. */
export type ShipmentLookup = z.infer<typeof ShipmentLookupSchema>;

/** Gönderi şeması. */
export const ShipmentSchema = z.object({
  referenceId: z.string().min(1),
  /** Kargo firmasının verdiği takip numarası (bazı firmalarda teslim alındıktan sonra oluşur). */
  trackingNumber: z.string().min(1).optional(),
  status: ShipmentStatusSchema,
  /** Sağlayıcının ham durum değeri. */
  providerStatus: z.string().optional(),
});

/** Gönderi. */
export type Shipment = z.infer<typeof ShipmentSchema>;

/** Tekil kargo hareketi şeması. */
export const TrackingEventSchema = z.object({
  status: ShipmentStatusSchema,
  /** Sağlayıcının ham durum değeri; eşlenemeyen durumlarda bilgi kaybını önler. */
  providerStatus: z.string(),
  description: z.string(),
  /** Hareketin gerçekleştiği şube / transfer merkezi. */
  location: z.string().optional(),
  occurredAt: DateTimeSchema,
});

/** Kargo hareketi. */
export type TrackingEvent = z.infer<typeof TrackingEventSchema>;

/** Kargo takibi sonucu şeması: gönderi + hareket geçmişi (eskiden yeniye). */
export const ShipmentTrackingSchema = ShipmentSchema.extend({
  events: z.array(TrackingEventSchema),
});

/** Kargo takibi sonucu. */
export type ShipmentTracking = z.infer<typeof ShipmentTrackingSchema>;
