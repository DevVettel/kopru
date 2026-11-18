import { z } from 'zod';
import {
  CargoError,
  PaymentError,
  defineCargoProvider,
  definePaymentProvider,
  err,
  formatIstanbulDateTime,
  ok,
  type ChargeRequest,
  type ChargeRequestInput,
  type ChargeResult,
  type CreateShipmentRequestInput,
  type ProviderContext,
  type Shipment,
  type ShipmentLookup,
  type ThreeDSInitRequestInput,
} from '../src/index.js';

/** Sahte sağlayıcılarda başarılı sonuç veren test kartı (Luhn geçerli, sentetik). */
export const SUCCESS_CARD = '4111111111111111';
/** Sahte sağlayıcılarda kart reddi üreten test kartı (Luhn geçerli, sentetik). */
export const DECLINED_CARD = '4000000000000002';

export const chargeInput = {
  orderId: 'ORDER-1',
  amount: { value: 1050, currency: 'TRY' },
  card: { holderName: 'Test Kullanıcı', number: SUCCESS_CARD, expiry: '12/30', cvc: '123' },
  buyer: { id: 'B1', firstName: 'Test', lastName: 'Kullanıcı', email: 'test@example.com' },
} satisfies ChargeRequestInput;

export const threeDSInput = {
  ...chargeInput,
  callbackUrl: 'https://shop.example/3ds/callback',
} satisfies ThreeDSInitRequestInput;

export const shipmentInput = {
  referenceId: 'SHP-1',
  recipient: {
    name: 'Test Alıcı',
    phone: '0532 000 00 00',
    address: { cityCode: '34', district: 'Kadıköy', addressLine: 'Örnek Sok. No: 1' },
  },
} satisfies CreateShipmentRequestInput;

const ConfigSchema = z.object({ apiKey: z.string().min(1) });

function chargeResult(input: ChargeRequest, id: string, ctx: ProviderContext): ChargeResult {
  return {
    transactionId: id,
    orderId: input.orderId,
    amount: input.amount,
    installments: input.installments,
    createdAt: formatIstanbulDateTime(ctx.now()),
    cardBin: input.card.number.slice(0, 6),
    cardLastFour: input.card.number.slice(-4),
  };
}

/** Tüm yetenekleri bellek içinde uygulayan sahte ödeme sağlayıcısı. */
export const fakePay = definePaymentProvider({
  id: 'fake-pay',
  configSchema: ConfigSchema,
  capabilities: ['charge', 'threeDS', 'refund', 'refund.partial', 'installments'],
  create: () => {
    const charges = new Map<string, ChargeResult>();
    let sequence = 0;
    return {
      charge: (input, ctx) => {
        if (input.card.number === DECLINED_CARD) {
          return Promise.resolve(
            err(
              new PaymentError({
                code: 'PAYMENT_CARD_DECLINED',
                message: 'Card declined',
                provider: 'fake-pay',
                providerCode: '05',
              }),
            ),
          );
        }
        const result = chargeResult(input, `txn_${String(++sequence)}`, ctx);
        charges.set(result.transactionId, result);
        return Promise.resolve(ok(result));
      },
      initThreeDS: (input) =>
        Promise.resolve(
          ok({
            orderId: input.orderId,
            action: {
              type: 'redirect',
              url: 'https://bank.example/3ds',
              method: 'POST',
              fields: { orderId: input.orderId, returnUrl: input.callbackUrl },
            },
          }),
        ),
      completeThreeDS: (input, ctx) => {
        const { orderId, status } = input.payload;
        if (status !== 'success' || orderId === undefined) {
          return Promise.resolve(
            err(
              new PaymentError({
                code: 'PAYMENT_THREEDS_FAILED',
                message: '3DS failed',
                provider: 'fake-pay',
              }),
            ),
          );
        }
        return Promise.resolve(
          ok({
            transactionId: `txn_${String(++sequence)}`,
            orderId,
            amount: { value: 1050, currency: 'TRY' },
            installments: 1,
            createdAt: formatIstanbulDateTime(ctx.now()),
          }),
        );
      },
      refund: (input, ctx) => {
        const charge = charges.get(input.transactionId);
        if (charge === undefined) {
          return Promise.resolve(
            err(
              new PaymentError({
                code: 'PAYMENT_REFUND_FAILED',
                message: 'Unknown transaction',
                provider: 'fake-pay',
              }),
            ),
          );
        }
        return Promise.resolve(
          ok({
            refundId: `rfn_${String(++sequence)}`,
            transactionId: charge.transactionId,
            amount: input.amount ?? charge.amount,
            createdAt: formatIstanbulDateTime(ctx.now()),
          }),
        );
      },
    };
  },
});

/** Yalnızca tek çekim tahsilat destekleyen sahte ödeme sağlayıcısı. */
export const fakePayBasic = definePaymentProvider({
  id: 'fake-pay-basic',
  configSchema: ConfigSchema,
  capabilities: ['charge'],
  create: () => ({
    charge: (input, ctx) => Promise.resolve(ok(chargeResult(input, 'txn_basic', ctx))),
  }),
});

function notFound(lookup: ShipmentLookup): CargoError {
  return new CargoError({
    code: 'CARGO_SHIPMENT_NOT_FOUND',
    message: `Shipment not found: ${lookup.referenceId ?? lookup.trackingNumber ?? ''}`,
    provider: 'fake-cargo',
  });
}

/** Tüm yetenekleri bellek içinde uygulayan sahte kargo sağlayıcısı. */
export const fakeCargo = defineCargoProvider({
  id: 'fake-cargo',
  configSchema: ConfigSchema,
  capabilities: ['createShipment', 'cancelShipment', 'trackShipment', 'cashOnDelivery'],
  create: () => {
    const shipments = new Map<string, Shipment>();
    const find = (lookup: ShipmentLookup): Shipment | undefined =>
      [...shipments.values()].find(
        (s) => s.referenceId === lookup.referenceId || s.trackingNumber === lookup.trackingNumber,
      );
    return {
      createShipment: (input) => {
        const shipment: Shipment = {
          referenceId: input.referenceId,
          trackingNumber: `TRK${String(shipments.size + 1)}`,
          status: 'created',
          providerStatus: '0',
        };
        shipments.set(input.referenceId, shipment);
        return Promise.resolve(ok(shipment));
      },
      cancelShipment: (input) => {
        const shipment = find(input);
        if (shipment === undefined) return Promise.resolve(err(notFound(input)));
        const cancelled: Shipment = { ...shipment, status: 'cancelled' };
        shipments.set(shipment.referenceId, cancelled);
        return Promise.resolve(ok(cancelled));
      },
      trackShipment: (input, ctx) => {
        const shipment = find(input);
        if (shipment === undefined) return Promise.resolve(err(notFound(input)));
        return Promise.resolve(
          ok({
            ...shipment,
            events: [
              {
                status: 'created',
                providerStatus: '0',
                description: 'Shipment created',
                occurredAt: formatIstanbulDateTime(ctx.now()),
              },
            ],
          }),
        );
      },
    };
  },
});

/** Yalnızca gönderi oluşturmayı destekleyen sahte kargo sağlayıcısı. */
export const fakeCargoBasic = defineCargoProvider({
  id: 'fake-cargo-basic',
  configSchema: ConfigSchema,
  capabilities: ['createShipment'],
  create: () => ({
    createShipment: (input) =>
      Promise.resolve(ok({ referenceId: input.referenceId, status: 'created' as const })),
  }),
});
