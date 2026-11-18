import { describe, expect, it } from 'vitest';
import {
  CardSchema,
  ChargeRequestSchema,
  CreateShipmentRequestSchema,
  RefundRequestSchema,
  ShipmentLookupSchema,
  ThreeDSActionSchema,
  ThreeDSInitRequestSchema,
  TrackingEventSchema,
  parseCardExpiry,
  passesLuhn,
} from '../src/index.js';
import { DECLINED_CARD, SUCCESS_CARD, chargeInput, shipmentInput, threeDSInput } from './fakes.js';

describe('kart', () => {
  it('Luhn kontrolü yapar', () => {
    expect(passesLuhn(SUCCESS_CARD)).toBe(true);
    expect(passesLuhn(DECLINED_CARD)).toBe(true);
    expect(passesLuhn('4111111111111112')).toBe(false);
    expect(passesLuhn('41x1')).toBe(false);
  });

  it('kart numarasını normalize eder ve son kullanma tarihini ayrıştırır', () => {
    const card = CardSchema.parse({ ...chargeInput.card, number: '4111 1111-1111 1111' });
    expect(card.number).toBe(SUCCESS_CARD);
    expect(parseCardExpiry(card.expiry)).toEqual({ month: '12', year: '2030' });
  });

  it.each([
    { number: '4111111111111112' },
    { number: '41111' },
    { expiry: '13/30' },
    { expiry: '1/30' },
    { cvc: '12' },
    { holderName: 'A' },
  ])('geçersiz kartı reddeder: %o', (override) => {
    expect(CardSchema.safeParse({ ...chargeInput.card, ...override }).success).toBe(false);
  });
});

describe('ChargeRequestSchema', () => {
  it('varsayılan taksit sayısını uygular', () => {
    expect(ChargeRequestSchema.parse(chargeInput).installments).toBe(1);
  });

  it('sıfır tutarı ve geçersiz e-postayı reddeder', () => {
    expect(
      ChargeRequestSchema.safeParse({ ...chargeInput, amount: { value: 0, currency: 'TRY' } })
        .success,
    ).toBe(false);
    expect(
      ChargeRequestSchema.safeParse({
        ...chargeInput,
        buyer: { ...chargeInput.buyer, email: 'nope' },
      }).success,
    ).toBe(false);
  });

  it('sepet toplamının ve para biriminin tutarla tutarlı olmasını ister', () => {
    const item = (value: number, currency = 'TRY') => ({
      id: 'I1',
      name: 'Ürün',
      category: 'Genel',
      price: { value, currency },
    });
    expect(ChargeRequestSchema.safeParse({ ...chargeInput, items: [item(1050)] }).success).toBe(
      true,
    );
    expect(ChargeRequestSchema.safeParse({ ...chargeInput, items: [item(1000)] }).success).toBe(
      false,
    );
    expect(
      ChargeRequestSchema.safeParse({ ...chargeInput, items: [item(1050, 'USD')] }).success,
    ).toBe(false);
  });

  it('opsiyonel alıcı alanlarını doğrular', () => {
    const parsed = ChargeRequestSchema.parse({
      ...chargeInput,
      buyer: {
        ...chargeInput.buyer,
        phone: '0532 000 00 00',
        identityNumber: '10000000146',
        ip: '203.0.113.5',
      },
    });
    expect(parsed.buyer.phone).toBe('+905320000000');
  });
});

describe('3D Secure', () => {
  it('callbackUrl yalnızca http(s) olabilir', () => {
    expect(ThreeDSInitRequestSchema.safeParse(threeDSInput).success).toBe(true);
    expect(
      ThreeDSInitRequestSchema.safeParse({ ...threeDSInput, callbackUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false);
  });

  it('action türlerini ayırt eder', () => {
    expect(ThreeDSActionSchema.safeParse({ type: 'html', html: '<form/>' }).success).toBe(true);
    expect(ThreeDSActionSchema.safeParse({ type: 'redirect', url: 'x' }).success).toBe(false);
  });
});

describe('RefundRequestSchema', () => {
  it('tutarsız iadeyi tam iade sayar, sıfır tutarı reddeder', () => {
    expect(RefundRequestSchema.parse({ transactionId: 't' }).amount).toBeUndefined();
    expect(
      RefundRequestSchema.safeParse({ transactionId: 't', amount: { value: 0, currency: 'TRY' } })
        .success,
    ).toBe(false);
  });
});

describe('kargo şemaları', () => {
  it('varsayılanları uygular ve telefonu normalize eder', () => {
    const parsed = CreateShipmentRequestSchema.parse(shipmentInput);
    expect(parsed.pieceCount).toBe(1);
    expect(parsed.paymentType).toBe('sender');
    expect(parsed.recipient.phone).toBe('+905320000000');
  });

  it('en az bir arama anahtarı ister', () => {
    expect(ShipmentLookupSchema.safeParse({ trackingNumber: 'T1' }).success).toBe(true);
    expect(ShipmentLookupSchema.safeParse({}).success).toBe(false);
  });

  it('hareket zamanında saat dilimi farkı ister', () => {
    const event = {
      status: 'in_transit',
      providerStatus: '3',
      description: 'Transfer',
      occurredAt: '2026-11-18T13:00:00+03:00',
    };
    expect(TrackingEventSchema.safeParse(event).success).toBe(true);
    expect(
      TrackingEventSchema.safeParse({ ...event, occurredAt: '2026-11-18 13:00' }).success,
    ).toBe(false);
    expect(TrackingEventSchema.safeParse({ ...event, status: 'lost' }).success).toBe(false);
  });
});
