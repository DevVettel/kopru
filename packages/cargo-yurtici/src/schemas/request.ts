import { z } from 'zod';

/**
 * Yurtiçi ham istek şemaları. Yalnızca bu paket içinde kullanılır ve dışarı export edilmez.
 * Alan uzunlukları Yurtiçi dokümanındaki sınırlardır (`NOTES.md` §3); mapper ürettiği isteği
 * bu şemayla doğrular, böylece sınır aşımları ağ isteği yapılmadan yakalanır.
 */

/** `createShipment` içindeki tek gönderi kaydı (`ShippingOrderVO`). */
export const ShippingOrderSchema = z.object({
  cargoKey: z.string().min(1).max(20),
  invoiceKey: z.string().min(1).max(20),
  receiverCustName: z.string().min(1).max(200),
  receiverAddress: z.string().min(1).max(200),
  cityName: z.string().min(1).max(40),
  townName: z.string().min(1).max(40),
  /** Başında 0 olmadan 10 hane (örn. `5320000000`). */
  receiverPhone1: z.string().regex(/^\d{10}$/, { message: 'Must be a 10-digit Turkish number' }),
  emailAddress: z.string().max(200).optional(),
  desi: z.number().positive().optional(),
  kg: z.number().positive().optional(),
  cargoCount: z.number().int().min(1).max(9999),
  description: z.string().max(255).optional(),
  taxOfficeId: z.literal(0),
  ttDocumentId: z.literal(0),
  dcSelectedCredit: z.literal(0),
  dcCreditRule: z.literal(0),
});

/** `createShipment` içindeki tek gönderi kaydı. */
export type ShippingOrder = z.infer<typeof ShippingOrderSchema>;
