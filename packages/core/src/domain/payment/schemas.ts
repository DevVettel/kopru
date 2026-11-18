import { z } from 'zod';
import { AddressSchema } from '../../primitives/address.js';
import { TCKNSchema } from '../../primitives/identity.js';
import { MoneySchema } from '../../primitives/money.js';
import { PhoneNumberSchema } from '../../primitives/phone.js';
import { DateTimeSchema } from '../../utils/date.js';

/**
 * Kart numarasının Luhn (mod-10) kontrolünü yapar.
 */
export function passesLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
  }
  return total % 10 === 0;
}

/** Sıfırdan büyük para tutarı (tahsilat ve iade tutarları için). */
export const PositiveMoneySchema = MoneySchema.refine((money) => money.value > 0, {
  message: 'Amount must be greater than zero',
  path: ['value'],
});

/**
 * Kart bilgisi şeması. Kart numarasındaki boşluk ve tireler temizlenir.
 * Not: Kart numarası ve CVC asla loglanmaz ve saklanmaz.
 */
export const CardSchema = z.object({
  /** Kart üzerindeki isim. */
  holderName: z.string().trim().min(2).max(100),
  /** Kart numarası (12–19 hane, Luhn kontrollü). */
  number: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, ''))
    .refine((value) => /^\d{12,19}$/.test(value) && passesLuhn(value), {
      message: 'Invalid card number',
    }),
  /** Son kullanma tarihi, `MM/YY` formatında. */
  expiry: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'Expiry must be in MM/YY format' }),
  /** Güvenlik kodu (3–4 hane). */
  cvc: z.string().regex(/^\d{3,4}$/, { message: 'Invalid CVC' }),
});

/** Kart bilgisi. */
export type Card = z.infer<typeof CardSchema>;

/**
 * `MM/YY` formatındaki son kullanma tarihini ay ve dört haneli yıla ayırır.
 * Sağlayıcı mapper'larında kullanılır.
 */
export function parseCardExpiry(expiry: Card['expiry']): { month: string; year: string } {
  const [month = '', year = ''] = expiry.split('/');
  return { month, year: `20${year}` };
}

/** Alıcı (ödemeyi yapan son kullanıcı) şeması. */
export const BuyerSchema = z.object({
  /** Mağazanın alıcıya verdiği kimlik. */
  id: z.string().trim().min(1).max(64),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email(),
  phone: PhoneNumberSchema.optional(),
  /** T.C. Kimlik Numarası. Bazı sağlayıcılar zorunlu tutar. */
  identityNumber: TCKNSchema.optional(),
  /** Alıcının IP adresi. */
  ip: z.union([z.ipv4(), z.ipv6()]).optional(),
  address: AddressSchema.optional(),
});

/** Alıcı. */
export type Buyer = z.infer<typeof BuyerSchema>;

/** Sepet kalemi şeması. */
export const BasketItemSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  price: PositiveMoneySchema,
});

/** Sepet kalemi. */
export type BasketItem = z.infer<typeof BasketItemSchema>;

/** Tahsilat (tek adımlı satış) isteği şeması. */
export const ChargeRequestSchema = z
  .object({
    /** Mağazanın sipariş numarası; idempotency için kullanılır. */
    orderId: z.string().trim().min(1).max(64),
    amount: PositiveMoneySchema,
    /** Taksit sayısı; tek çekim için `1`. */
    installments: z.number().int().min(1).max(36).default(1),
    card: CardSchema,
    buyer: BuyerSchema,
    billingAddress: AddressSchema.optional(),
    /** Sepet kalemleri. Verilirse toplamı `amount` ile eşit olmalıdır. */
    items: z.array(BasketItemSchema).min(1).optional(),
    description: z.string().trim().max(255).optional(),
  })
  .superRefine((request, ctx) => {
    if (request.items === undefined) return;
    const total = request.items.reduce((sum, item) => sum + item.price.value, 0);
    if (total !== request.amount.value) {
      ctx.addIssue({
        code: 'custom',
        message: 'Sum of item prices must equal amount',
        path: ['items'],
      });
    }
    if (request.items.some((item) => item.price.currency !== request.amount.currency)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Item currency must match amount currency',
        path: ['items'],
      });
    }
  });

/** Doğrulanmış tahsilat isteği. */
export type ChargeRequest = z.output<typeof ChargeRequestSchema>;
/** Kullanıcının verdiği (henüz doğrulanmamış) tahsilat isteği. */
export type ChargeRequestInput = z.input<typeof ChargeRequestSchema>;

/** Başarılı tahsilat sonucu şeması. */
export const ChargeResultSchema = z.object({
  /** Sağlayıcı tarafındaki işlem kimliği. */
  transactionId: z.string().min(1),
  orderId: z.string().min(1),
  amount: PositiveMoneySchema,
  installments: z.number().int().min(1),
  /** İşlem zamanı (saat dilimi farkıyla). */
  createdAt: DateTimeSchema,
  /** Kartın ilk 6–8 hanesi. */
  cardBin: z
    .string()
    .regex(/^\d{6,8}$/)
    .optional(),
  /** Kartın son 4 hanesi. */
  cardLastFour: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  cardFamily: z.string().optional(),
});

/** Başarılı tahsilat sonucu. */
export type ChargeResult = z.infer<typeof ChargeResultSchema>;

/** 3D Secure başlatma isteği şeması: tahsilat isteği + bankanın döneceği adres. */
export const ThreeDSInitRequestSchema = ChargeRequestSchema.safeExtend({
  /** 3D doğrulama sonrası bankanın kullanıcıyı yönlendireceği (POST) adres. */
  callbackUrl: z.url({ protocol: /^https?$/ }),
});

/** Doğrulanmış 3D Secure başlatma isteği. */
export type ThreeDSInitRequest = z.output<typeof ThreeDSInitRequestSchema>;
/** Kullanıcının verdiği 3D Secure başlatma isteği. */
export type ThreeDSInitRequestInput = z.input<typeof ThreeDSInitRequestSchema>;

/**
 * Kullanıcıyı 3D doğrulamaya götürmek için yapılması gereken işlem:
 * ya sağlayıcının verdiği HTML sayfası gösterilir ya da verilen adrese yönlendirilir.
 */
export const ThreeDSActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('html'), html: z.string().min(1) }),
  z.object({
    type: z.literal('redirect'),
    url: z.url(),
    method: z.enum(['GET', 'POST']),
    fields: z.record(z.string(), z.string()),
  }),
]);

/** 3D doğrulama yönlendirmesi. */
export type ThreeDSAction = z.infer<typeof ThreeDSActionSchema>;

/** 3D Secure başlatma sonucu şeması. */
export const ThreeDSInitResultSchema = z.object({
  orderId: z.string().min(1),
  /** Sağlayıcı başlatma aşamasında işlem kimliği verdiyse. */
  transactionId: z.string().min(1).optional(),
  action: ThreeDSActionSchema,
});

/** 3D Secure başlatma sonucu. */
export type ThreeDSInitResult = z.infer<typeof ThreeDSInitResultSchema>;

/**
 * 3D doğrulama sonrası bankanın `callbackUrl`'e gönderdiği verinin şeması.
 * İçerik sağlayıcıya özgüdür ve sağlayıcı paketinde ayrıca doğrulanır.
 */
export const ThreeDSCallbackSchema = z.object({
  /** Callback'e gelen form/sorgu alanları. */
  payload: z.record(z.string(), z.string()),
});

/** 3D Secure callback verisi. */
export type ThreeDSCallback = z.infer<typeof ThreeDSCallbackSchema>;

/** İade isteği şeması. */
export const RefundRequestSchema = z.object({
  /** İade edilecek tahsilatın işlem kimliği. */
  transactionId: z.string().trim().min(1),
  /** İade tutarı. Verilmezse tam iade yapılır; verilirse `refund.partial` yeteneği gerekir. */
  amount: PositiveMoneySchema.optional(),
  reason: z.string().trim().max(255).optional(),
});

/** Doğrulanmış iade isteği. */
export type RefundRequest = z.output<typeof RefundRequestSchema>;
/** Kullanıcının verdiği iade isteği. */
export type RefundRequestInput = z.input<typeof RefundRequestSchema>;

/** Başarılı iade sonucu şeması. */
export const RefundResultSchema = z.object({
  refundId: z.string().min(1),
  transactionId: z.string().min(1),
  amount: PositiveMoneySchema,
  createdAt: DateTimeSchema,
});

/** Başarılı iade sonucu. */
export type RefundResult = z.infer<typeof RefundResultSchema>;
