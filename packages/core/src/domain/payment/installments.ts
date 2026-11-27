import { z } from 'zod';
import { PositiveMoneySchema } from './schemas.js';

/** Kart tipleri. */
export const CARD_TYPES = ['credit', 'debit', 'prepaid'] as const;

/** Kart tipi şeması. */
export const CardTypeSchema = z.enum(CARD_TYPES);

/** Kart tipi: kredi, banka (debit) veya ön ödemeli kart. */
export type CardType = z.infer<typeof CardTypeSchema>;

/** Kart şemaları (kart kuruluşları). */
export const CARD_SCHEMES = ['visa', 'mastercard', 'amex', 'troy', 'other'] as const;

/** Kart şeması (kuruluşu) şeması. */
export const CardSchemeSchema = z.enum(CARD_SCHEMES);

/** Kartın bağlı olduğu kart kuruluşu (Visa, Mastercard, Troy …). */
export type CardScheme = z.infer<typeof CardSchemeSchema>;

/** BIN bazlı taksit sorgusu isteği şeması. */
export const InstallmentQueryRequestSchema = z.object({
  /** Kartın ilk 6–8 hanesi. Boşluklar temizlenir. */
  bin: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6,8}$/, 'BIN must be 6 to 8 digits')),
  /** Taksitlendirilecek tutar. */
  amount: PositiveMoneySchema,
});

/** Doğrulanmış taksit sorgusu isteği. */
export type InstallmentQueryRequest = z.output<typeof InstallmentQueryRequestSchema>;
/** Kullanıcının verdiği taksit sorgusu isteği. */
export type InstallmentQueryRequestInput = z.input<typeof InstallmentQueryRequestSchema>;

/** Tek bir taksit seçeneğinin şeması. */
export const InstallmentOptionSchema = z.object({
  /** Taksit sayısı (tek çekim = `1`). */
  installments: z.number().int().min(1).max(36),
  /** Aylık taksit tutarı. */
  installmentAmount: PositiveMoneySchema,
  /** Vade farkı dahil toplam tutar. */
  totalAmount: PositiveMoneySchema,
});

/** Tek bir taksit seçeneği. */
export type InstallmentOption = z.infer<typeof InstallmentOptionSchema>;

/** Taksit sorgusu sonucu şeması. */
export const InstallmentQueryResultSchema = z
  .object({
    /** Sorgulanan BIN. */
    bin: z.string().regex(/^\d{6,8}$/),
    bankName: z.string().min(1).optional(),
    bankCode: z.string().min(1).optional(),
    cardType: CardTypeSchema.optional(),
    cardScheme: CardSchemeSchema.optional(),
    /** Kart ailesi (Bonus, World, Maximum, Axess …). */
    cardFamily: z.string().min(1).optional(),
    /** Ticari (kurumsal) kart mı? */
    commercial: z.boolean().optional(),
    /** Kullanılabilir taksit seçenekleri; taksit sayısına göre artan sırada ve tekil. */
    options: z.array(InstallmentOptionSchema).min(1),
  })
  .superRefine((result, ctx) => {
    result.options.forEach((option, index) => {
      const previous = index === 0 ? undefined : result.options[index - 1];
      if (previous !== undefined && option.installments <= previous.installments) {
        ctx.addIssue({
          code: 'custom',
          message: 'Options must be sorted by installments in ascending order without duplicates',
          path: ['options', index, 'installments'],
        });
      }
      const currencies = [option.installmentAmount.currency, option.totalAmount.currency];
      if (currencies.some((currency) => currency !== result.options[0]?.totalAmount.currency)) {
        ctx.addIssue({
          code: 'custom',
          message: 'All option amounts must use the same currency',
          path: ['options', index],
        });
      }
    });
  });

/** Taksit sorgusu sonucu. */
export type InstallmentQueryResult = z.infer<typeof InstallmentQueryResultSchema>;
