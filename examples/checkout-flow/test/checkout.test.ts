import type { Card, ChargeResult } from '@kopru/core';
import {
  IYZICO_MOCK_SECRET_KEY,
  IYZICO_MOCK_SUCCESS_CARD,
  IYZICO_MOCK_THREEDS_MD0_CARD,
  YURTICI_MOCK_DELIVERED_KEY,
  YURTICI_MOCK_PASSWORD,
  startMockServer,
  type RunningMockServer,
} from '@kopru/mock-server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { matchesOrder, runCheckout, type CheckoutInput } from '../src/checkout.ts';
import { createClients } from '../src/clients.ts';
import { createOrder, SAMPLE_BUYER } from '../src/order.ts';

const INSUFFICIENT_FUNDS_CARD = '4111111111111129';

const card = (number: string): Card => ({
  holderName: 'Ada Yilmaz',
  number,
  expiry: '12/30',
  cvc: '987',
});

const input = (cardNumber = IYZICO_MOCK_SUCCESS_CARD): CheckoutInput => ({
  orderId: 'KPR-TEST-1',
  declinedCard: card(INSUFFICIENT_FUNDS_CARD),
  card: card(cardNumber),
  shippedReferenceId: YURTICI_MOCK_DELIVERED_KEY,
});

describe('checkout flow', () => {
  let server: RunningMockServer;

  beforeEach(async () => {
    server = await startMockServer();
  });
  afterEach(() => server.stop());

  it('pays with 3DS, ships, tracks, cancels and refunds end to end', async () => {
    const result = await runCheckout(createClients(server.url), input(), () => undefined);

    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
    if (!result.ok) return;
    const { order, declineCode, payment, shipment, history, refund } = result.value;
    expect(order).toMatchObject({ status: 'refunded', transactionId: payment.transactionId });
    expect(declineCode).toBe('PAYMENT_INSUFFICIENT_FUNDS');
    expect(payment).toMatchObject({ orderId: 'KPR-TEST-1', amount: order.amount });
    expect(shipment).toMatchObject({ referenceId: 'KPR-TEST-1', status: 'created' });
    expect(history.status).toBe('delivered');
    expect(history.events.map((event) => event.status)).toEqual([
      'picked_up',
      'in_transit',
      'in_transit',
      'out_for_delivery',
      'delivered',
    ]);
    expect(refund.amount).toEqual(order.amount);
  });

  it('stops without shipping when 3DS verification fails', async () => {
    const result = await runCheckout(
      createClients(server.url),
      input(IYZICO_MOCK_THREEDS_MD0_CARD),
      () => undefined,
    );

    expect(!result.ok && result.error.code).toBe('PAYMENT_THREEDS_FAILED');
    expect(server.requests.list({ plugin: 'yurtici' })).toHaveLength(0);
  });

  it('never exposes sensitive data in logs, HTTP hooks or the request log', async () => {
    const output: string[] = [];
    const record = (entry: unknown) => {
      output.push(typeof entry === 'string' ? entry : JSON.stringify(entry));
    };
    const clients = createClients(server.url, {
      hooks: { onRequest: record, onResponse: record },
    });

    const result = await runCheckout(clients, input(), record);
    expect(result.ok).toBe(true);
    server.requests.list().forEach(record);

    const log = output.join('\n');
    // Boş bir kayıt üzerinde yanlışlıkla geçmediğinden emin ol.
    expect(log).toContain('/iyzico/payment/3dsecure/auth');
    expect(log).toContain('/yurtici/');
    for (const secret of [
      IYZICO_MOCK_SUCCESS_CARD,
      INSUFFICIENT_FUNDS_CARD,
      SAMPLE_BUYER.identityNumber,
      IYZICO_MOCK_SECRET_KEY,
      YURTICI_MOCK_PASSWORD,
    ]) {
      expect(log).not.toContain(secret);
    }
    expect(log).not.toMatch(/cvc[^,}]*987/i);
    expect(log).not.toMatch(/IYZWSv2 [A-Za-z0-9+/=]{20,}/);
  });
});

describe('matchesOrder', () => {
  const order = createOrder('KPR-TEST-2');
  const payment: ChargeResult = {
    transactionId: '1',
    orderId: order.id,
    amount: order.amount,
    installments: 1,
    createdAt: '2026-11-25T12:00:00+03:00',
  };

  it('accepts only the same order and amount', () => {
    expect(matchesOrder(order, payment)).toBe(true);
    expect(matchesOrder(order, { ...payment, orderId: 'ANOTHER' })).toBe(false);
    expect(matchesOrder(order, { ...payment, amount: { value: 1, currency: 'TRY' } })).toBe(false);
    expect(matchesOrder(order, { ...payment, amount: { ...order.amount, currency: 'USD' } })).toBe(
      false,
    );
  });
});
