import { base64Decode, base64Encode, hmac, safeEqual } from '@kopru/core';
import type { Context } from 'hono';
import { z } from 'zod';
import { defineMockPlugin } from '../../plugin.js';
import { renderAutoPostPage } from '../../three-ds.js';
import {
  IYZICO_MOCK_FAILURE_CARDS,
  IYZICO_MOCK_NON_REFUNDABLE_CARD,
  IYZICO_MOCK_SETTLED_CARD,
  IYZICO_MOCK_SUCCESS_CARD,
  IYZICO_MOCK_THREEDS_INIT_FAIL_CARD,
  IYZICO_MOCK_THREEDS_MD0_CARD,
  IYZICO_MOCK_THREEDS_MD4_CARD,
  IYZICO_MOCK_TIMEOUT_CARD,
  IYZICO_MOCK_TIMEOUT_DELAY_MS,
  type IyzicoMockFailure,
} from './cards.js';

export * from './cards.js';

/** Mock iyzico'nun kabul ettiği API anahtarı. */
export const IYZICO_MOCK_API_KEY = 'sandbox-kopru-mock-api-key';

/** Mock iyzico'nun imza doğrulamasında kullandığı gizli anahtar. */
export const IYZICO_MOCK_SECRET_KEY = 'sandbox-kopru-mock-secret-key';

const BASE_PATH = '/iyzico';

const PriceSchema = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().positive());
const IdSchema = z.union([z.string().min(1), z.number()]).transform(String);

const PaymentRequestSchema = z.object({
  locale: z.string().optional(),
  conversationId: z.string().optional(),
  price: PriceSchema,
  paidPrice: PriceSchema,
  currency: z.string().default('TRY'),
  installment: z.number().int().min(1).default(1),
  basketId: z.string().optional(),
  paymentCard: z.object({ cardNumber: z.string().min(12) }),
  buyer: z.object({ identityNumber: z.string().min(1) }),
  billingAddress: z.object({ address: z.string().min(1) }),
  basketItems: z.array(z.object({ price: PriceSchema })).min(1),
});

const ThreeDSInitRequestSchema = PaymentRequestSchema.extend({ callbackUrl: z.url() });
const PaymentReferenceSchema = z.object({ paymentId: IdSchema });
const RefundRequestSchema = z.object({ paymentId: IdSchema, price: PriceSchema });

type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

/** Mock'un bellekte tuttuğu ödeme kaydı. */
interface MockPayment {
  paymentId: string;
  conversationId: string | undefined;
  basketId: string | undefined;
  price: number;
  paidPrice: number;
  currency: string;
  installment: number;
  cardNumber: string;
  status: 'pending-3ds' | 'paid' | 'refunded' | 'cancelled';
  /** 3DS bekleyen ödemelerde bankanın döneceği `mdStatus`. */
  mdStatus: string;
}

const failure = (f: IyzicoMockFailure) => ({ status: 'failure', ...f });

const AUTH_FAILURE = failure({
  errorCode: '1000',
  errorGroup: 'INVALID_SIGNATURE',
  errorMessage: 'Geçersiz imza',
});
const INVALID_REQUEST = failure({
  errorCode: '11',
  errorGroup: 'INVALID_REQUEST',
  errorMessage: 'Geçersiz istek',
});
const BASKET_MISMATCH = failure({
  errorCode: '5062',
  errorGroup: 'BASKET_ITEMS_NOT_MATCH',
  errorMessage: 'Gönderilen tutar tüm kırılımların toplam tutarına eşit olmalıdır',
});
const PAYMENT_NOT_FOUND = failure({
  errorCode: '5087',
  errorGroup: 'PAYMENT_NOT_FOUND',
  errorMessage: 'Üye İşyerine Ait Ödeme Kaydı Bulunamadı',
});
const REQUIRES_DAY_END = failure({
  errorCode: '10223',
  errorGroup: 'REQUIRES_DAY_END',
  errorMessage: 'Gün sonu yapılmalı',
});
const GENERAL_ERROR = failure({
  errorCode: '10202',
  errorGroup: 'UNKNOWN',
  errorMessage: 'Ödeme işlemi esnasında genel bir hata oluştu',
});

/**
 * IYZWSv2 `Authorization` başlığını mock kimlik bilgileriyle doğrular. Sağlayıcı paketinden
 * bağımsız yazılmıştır; böylece imzalama uygulaması gerçekten sınanır.
 */
export function verifyIyzicoAuthorization(
  authorization: string | undefined,
  randomKey: string | undefined,
  path: string,
  body: string,
): boolean {
  if (authorization?.startsWith('IYZWSv2 ') !== true || randomKey === undefined) return false;
  const decoded = base64Decode(authorization.slice('IYZWSv2 '.length));
  const fields = new Map(
    decoded.split('&').map((part) => {
      const index = part.indexOf(':');
      return [part.slice(0, index), part.slice(index + 1)] as const;
    }),
  );
  const expected = hmac('sha256', IYZICO_MOCK_SECRET_KEY, `${randomKey}${path}${body}`, 'hex');
  return (
    fields.get('apiKey') === IYZICO_MOCK_API_KEY &&
    fields.get('randomKey') === randomKey &&
    safeEqual(fields.get('signature') ?? '', expected)
  );
}

function sumMatches(request: PaymentRequest): boolean {
  const toKurus = (value: number): number => Math.round(value * 100);
  const total = request.basketItems.reduce((sum, item) => sum + toKurus(item.price), 0);
  return total === toKurus(request.price);
}

function paymentBody(payment: MockPayment, now: number) {
  return {
    status: 'success',
    locale: 'tr',
    systemTime: now,
    conversationId: payment.conversationId,
    paymentId: payment.paymentId,
    price: payment.price,
    paidPrice: payment.paidPrice,
    installment: payment.installment,
    currency: payment.currency,
    basketId: payment.basketId,
    fraudStatus: 1,
    binNumber: payment.cardNumber.slice(0, 6),
    lastFourDigits: payment.cardNumber.slice(-4),
    cardFamily: 'Mock Family',
    cardType: 'CREDIT_CARD',
    cardAssociation: 'MASTER_CARD',
  };
}

/**
 * iyzico API taklidi. Non-3DS tahsilat, 3DS başlatma/tamamlama, ödeme detayı, tutar bazlı
 * iade ve iptal uç noktalarını; IYZWSv2 imza doğrulamasıyla birlikte sunar.
 * Kimlik bilgileri: {@link IYZICO_MOCK_API_KEY} / {@link IYZICO_MOCK_SECRET_KEY}.
 */
export const iyzicoPlugin = defineMockPlugin({
  name: 'iyzico',
  basePath: BASE_PATH,
  description:
    'iyzico ödeme API taklidi: non-3DS tahsilat, 3D Secure, ödeme detayı, iade ve iptal (IYZWSv2 imza doğrulamalı).',
  scenarios: [
    {
      id: 'charge-success',
      description: 'Başarılı tahsilat. Aynı gün iade edilirse 10223 döner, iptal başarılı olur.',
      trigger: `cardNumber=${IYZICO_MOCK_SUCCESS_CARD}`,
    },
    {
      id: 'charge-success-settled',
      description: 'Başarılı tahsilat; gün sonu yapılmış sayılır, tutar bazlı iade başarılı olur.',
      trigger: `cardNumber=${IYZICO_MOCK_SETTLED_CARD}`,
    },
    {
      id: 'charge-non-refundable',
      description: 'Başarılı tahsilat; iade ve iptal 10202 ile başarısız olur.',
      trigger: `cardNumber=${IYZICO_MOCK_NON_REFUNDABLE_CARD}`,
    },
    ...[...IYZICO_MOCK_FAILURE_CARDS].map(([card, f]) => ({
      id: `charge-${f.errorGroup.toLowerCase().replaceAll('_', '-')}`,
      description: `Tahsilat veya 3DS tamamlama ${f.errorCode} (${f.errorGroup}) hatasıyla başarısız olur.`,
      trigger: `cardNumber=${card}`,
    })),
    {
      id: 'timeout',
      description: `Yanıt ${String(IYZICO_MOCK_TIMEOUT_DELAY_MS)} ms gecikir; istemci zaman aşımı testleri için.`,
      trigger: `cardNumber=${IYZICO_MOCK_TIMEOUT_CARD}`,
    },
    {
      id: 'three-ds-success',
      description:
        '3DS başlatma, callbackUrl adresine status=success ve mdStatus=1 POST eden sayfa döner.',
      trigger: `POST /payment/3dsecure/initialize, cardNumber=${IYZICO_MOCK_SUCCESS_CARD}`,
    },
    {
      id: 'three-ds-md-status-0',
      description: '3DS doğrulaması başarısız: callback status=failure, mdStatus=0.',
      trigger: `cardNumber=${IYZICO_MOCK_THREEDS_MD0_CARD}`,
    },
    {
      id: 'three-ds-md-status-4',
      description: '3DS doğrulama denemesi: callback status=failure, mdStatus=4.',
      trigger: `cardNumber=${IYZICO_MOCK_THREEDS_MD4_CARD}`,
    },
    {
      id: 'three-ds-init-failure',
      description: '3DS başlatma 10202 hatasıyla başarısız olur.',
      trigger: `cardNumber=${IYZICO_MOCK_THREEDS_INIT_FAIL_CARD}`,
    },
    {
      id: 'invalid-signature',
      description: 'İmza veya API anahtarı hatalıysa 1000 (Geçersiz imza) döner.',
      trigger: 'Authorization başlığı hatalı',
    },
  ],
  register: (app) => {
    const payments = new Map<string, MockPayment>();
    let nextPaymentId = 10_000_001;

    /** İmzayı doğrular, gövdeyi şemayla çözer; başarısızsa iyzico hata yanıtı döner. */
    async function readBody<S extends z.ZodType>(
      c: Context,
      schema: S,
    ): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
      const body = await c.req.text();
      const path = c.req.path.slice(BASE_PATH.length);
      if (
        !verifyIyzicoAuthorization(
          c.req.header('authorization'),
          c.req.header('x-iyzi-rnd'),
          path,
          body,
        )
      ) {
        return { ok: false, response: c.json(AUTH_FAILURE, 401) };
      }
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        return { ok: false, response: c.json(INVALID_REQUEST) };
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) return { ok: false, response: c.json(INVALID_REQUEST) };
      return { ok: true, data: parsed.data };
    }

    async function delayIfTimeoutCard(cardNumber: string): Promise<void> {
      if (cardNumber === IYZICO_MOCK_TIMEOUT_CARD) {
        await new Promise((resolve) => setTimeout(resolve, IYZICO_MOCK_TIMEOUT_DELAY_MS));
      }
    }

    function createPayment(request: PaymentRequest, status: MockPayment['status']): MockPayment {
      const cardNumber = request.paymentCard.cardNumber;
      const mdStatus =
        cardNumber === IYZICO_MOCK_THREEDS_MD0_CARD
          ? '0'
          : cardNumber === IYZICO_MOCK_THREEDS_MD4_CARD
            ? '4'
            : '1';
      const payment: MockPayment = {
        paymentId: String(nextPaymentId++),
        conversationId: request.conversationId,
        basketId: request.basketId,
        price: request.price,
        paidPrice: request.paidPrice,
        currency: request.currency,
        installment: request.installment,
        cardNumber,
        status,
        mdStatus,
      };
      payments.set(payment.paymentId, payment);
      return payment;
    }

    app.post('/payment/auth', async (c) => {
      const read = await readBody(c, PaymentRequestSchema);
      if (!read.ok) return read.response;
      const request = read.data;
      if (!sumMatches(request)) return c.json(BASKET_MISMATCH);
      await delayIfTimeoutCard(request.paymentCard.cardNumber);
      const cardFailure = IYZICO_MOCK_FAILURE_CARDS.get(request.paymentCard.cardNumber);
      if (cardFailure !== undefined) return c.json(failure(cardFailure));
      return c.json(paymentBody(createPayment(request, 'paid'), Date.now()));
    });

    app.post('/payment/3dsecure/initialize', async (c) => {
      const read = await readBody(c, ThreeDSInitRequestSchema);
      if (!read.ok) return read.response;
      const request = read.data;
      if (!sumMatches(request)) return c.json(BASKET_MISMATCH);
      await delayIfTimeoutCard(request.paymentCard.cardNumber);
      if (request.paymentCard.cardNumber === IYZICO_MOCK_THREEDS_INIT_FAIL_CARD) {
        return c.json(GENERAL_ERROR);
      }
      const payment = createPayment(request, 'pending-3ds');
      const html = renderAutoPostPage({
        action: request.callbackUrl,
        title: 'iyzico 3D Secure (Köprü Mock)',
        fields: {
          status: payment.mdStatus === '1' ? 'success' : 'failure',
          paymentId: payment.paymentId,
          conversationData: '',
          conversationId: payment.conversationId ?? '',
          mdStatus: payment.mdStatus,
        },
      });
      return c.json({
        status: 'success',
        locale: 'tr',
        systemTime: Date.now(),
        conversationId: payment.conversationId,
        paymentId: payment.paymentId,
        threeDSHtmlContent: base64Encode(html),
      });
    });

    app.post('/payment/3dsecure/auth', async (c) => {
      const read = await readBody(c, PaymentReferenceSchema);
      if (!read.ok) return read.response;
      const payment = payments.get(read.data.paymentId);
      if (payment?.status !== 'pending-3ds') return c.json(PAYMENT_NOT_FOUND);
      if (payment.mdStatus !== '1') {
        payments.delete(payment.paymentId);
        return c.json({ ...GENERAL_ERROR, mdStatus: Number(payment.mdStatus) });
      }
      const cardFailure = IYZICO_MOCK_FAILURE_CARDS.get(payment.cardNumber);
      if (cardFailure !== undefined) {
        payments.delete(payment.paymentId);
        return c.json(failure(cardFailure));
      }
      payment.status = 'paid';
      return c.json({ ...paymentBody(payment, Date.now()), mdStatus: 1 });
    });

    app.post('/payment/detail', async (c) => {
      const read = await readBody(c, PaymentReferenceSchema);
      if (!read.ok) return read.response;
      const payment = payments.get(read.data.paymentId);
      if (payment === undefined || payment.status === 'pending-3ds') {
        return c.json(PAYMENT_NOT_FOUND);
      }
      return c.json(paymentBody(payment, Date.now()));
    });

    app.post('/v2/payment/refund', async (c) => {
      const read = await readBody(c, RefundRequestSchema);
      if (!read.ok) return read.response;
      const payment = payments.get(read.data.paymentId);
      if (payment?.status !== 'paid') return c.json(PAYMENT_NOT_FOUND);
      if (payment.cardNumber === IYZICO_MOCK_NON_REFUNDABLE_CARD) return c.json(GENERAL_ERROR);
      if (payment.cardNumber !== IYZICO_MOCK_SETTLED_CARD) return c.json(REQUIRES_DAY_END);
      if (read.data.price > payment.paidPrice) {
        return c.json(
          failure({
            errorCode: '10232',
            errorGroup: 'INVALID_AMOUNT',
            errorMessage: 'Geçersiz tutar',
          }),
        );
      }
      payment.status = 'refunded';
      return c.json({
        status: 'success',
        locale: 'tr',
        systemTime: Date.now(),
        paymentId: payment.paymentId,
        price: read.data.price,
        currency: payment.currency,
        hostReference: `mock-host-${payment.paymentId}`,
        refundHostReference: `mock-refund-${payment.paymentId}`,
      });
    });

    app.post('/payment/cancel', async (c) => {
      const read = await readBody(c, PaymentReferenceSchema);
      if (!read.ok) return read.response;
      const payment = payments.get(read.data.paymentId);
      if (payment?.status !== 'paid') return c.json(PAYMENT_NOT_FOUND);
      if (
        payment.cardNumber === IYZICO_MOCK_NON_REFUNDABLE_CARD ||
        payment.cardNumber === IYZICO_MOCK_SETTLED_CARD
      ) {
        return c.json(GENERAL_ERROR);
      }
      payment.status = 'cancelled';
      return c.json({
        status: 'success',
        locale: 'tr',
        systemTime: Date.now(),
        paymentId: payment.paymentId,
        price: payment.paidPrice,
        currency: payment.currency,
        hostReference: `mock-host-${payment.paymentId}`,
        cancelHostReference: `mock-cancel-${payment.paymentId}`,
      });
    });
  },
});
