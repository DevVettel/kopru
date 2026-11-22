import { createCargoClient } from '@kopru/core';
import {
  YURTICI_MOCK_DELIVERED_KEY,
  YURTICI_MOCK_EXISTING_KEY,
  YURTICI_MOCK_INVALID_ADDRESS_MARKER,
  YURTICI_MOCK_IN_TRANSIT_KEY,
  YURTICI_MOCK_OUT_FOR_DELIVERY_KEY,
  YURTICI_MOCK_RETURNED_KEY,
  YURTICI_MOCK_TIMEOUT_KEY,
} from '@kopru/mock-server';
import { describe, expect, it } from 'vitest';
import { yurtici } from '../src/index.js';
import { mockConfig, shipmentInput } from './fixtures.js';

const client = (overrides: Parameters<typeof mockConfig>[0] = {}) =>
  createCargoClient({ provider: yurtici(mockConfig(overrides)) });

describe('yurtici provider against the mock server', () => {
  it('creates, tracks and cancels a shipment', async () => {
    const cargo = client();
    const created = await cargo.createShipment(shipmentInput('KOPRU-FLOW-1'));
    expect(created).toEqual({
      ok: true,
      value: { referenceId: 'KOPRU-FLOW-1', status: 'created' },
    });

    const tracked = await cargo.trackShipment({ referenceId: 'KOPRU-FLOW-1' });
    expect(tracked).toEqual({
      ok: true,
      value: { referenceId: 'KOPRU-FLOW-1', status: 'created', providerStatus: 'NOP', events: [] },
    });

    const cancelled = await cargo.cancelShipment({ referenceId: 'KOPRU-FLOW-1' });
    expect(cancelled.ok && cancelled.value).toMatchObject({
      status: 'cancelled',
      providerStatus: 'CNL',
    });

    // İptal tekrar edilebilir: Yurtiçi'nin 82520 yanıtı başarı sayılır.
    const again = await cargo.cancelShipment({ referenceId: 'KOPRU-FLOW-1' });
    expect(again.ok && again.value.status).toBe('cancelled');

    const afterCancel = await cargo.trackShipment({ referenceId: 'KOPRU-FLOW-1' });
    expect(afterCancel.ok && afterCancel.value.status).toBe('cancelled');
  });

  it('returns a multi-step delivered history in chronological order', async () => {
    const result = await client().trackShipment({ referenceId: YURTICI_MOCK_DELIVERED_KEY });
    expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      status: 'delivered',
      providerStatus: 'DLV',
      trackingNumber: '700000000001',
    });
    expect(result.value.events.map((e) => e.status)).toEqual([
      'picked_up',
      'in_transit',
      'in_transit',
      'out_for_delivery',
      'delivered',
    ]);
    expect(result.value.events[0]).toEqual({
      status: 'picked_up',
      providerStatus: 'GT',
      description: 'Kargo Teslim Alındı',
      location: 'Kadıköy Şube, Kadıköy, İstanbul',
      occurredAt: '2026-11-16T14:30:05+03:00',
    });
  });

  it.each([
    [YURTICI_MOCK_IN_TRANSIT_KEY, 'in_transit'],
    [YURTICI_MOCK_OUT_FOR_DELIVERY_KEY, 'out_for_delivery'],
    [YURTICI_MOCK_RETURNED_KEY, 'returned'],
  ])('tracks %s as %s', async (referenceId, status) => {
    const result = await client().trackShipment({ referenceId });
    expect(result.ok && result.value.status).toBe(status);
  });

  it('describes failed delivery attempts with the reason', async () => {
    const result = await client().trackShipment({ referenceId: YURTICI_MOCK_RETURNED_KEY });
    expect(result.ok && result.value.events.map((e) => e.description)).toContain(
      'Dağıtıma Çıkarıldı (Alıcı Adreste Yok)',
    );
  });

  it.each([
    [
      'invalid address',
      shipmentInput('KOPRU-ADDR', {
        recipient: {
          name: 'Test Alıcı',
          phone: '05320000000',
          address: {
            cityCode: '06',
            district: 'Çankaya',
            addressLine: YURTICI_MOCK_INVALID_ADDRESS_MARKER,
          },
        },
      }),
      'CARGO_ADDRESS_INVALID',
      '60019',
    ],
    ['duplicate key', shipmentInput(YURTICI_MOCK_EXISTING_KEY), 'VALIDATION_FAILED', '60020'],
  ])('maps creation failures: %s', async (_, input, code, providerCode) => {
    const result = await client().createShipment(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code, providerCode, provider: 'yurtici' });
  });

  it('refuses to cancel a shipment that is already on its way', async () => {
    const result = await client().cancelShipment({ referenceId: YURTICI_MOCK_IN_TRANSIT_KEY });
    expect(result.ok || result.error).toMatchObject({
      code: 'CARGO_CANCELLATION_NOT_ALLOWED',
      providerCode: 'IND',
    });
  });

  it('returns CARGO_SHIPMENT_NOT_FOUND for unknown shipments', async () => {
    const result = await client().cancelShipment({ referenceId: 'KOPRU-NOPE' });
    expect(result.ok || result.error.code).toBe('CARGO_SHIPMENT_NOT_FOUND');
  });

  it('requires referenceId for lookups and the account payment type for creation', async () => {
    const tracked = await client().trackShipment({ trackingNumber: '700000000001' });
    expect(tracked.ok || tracked.error.code).toBe('VALIDATION_FAILED');
    const recipientPaid = await client().createShipment(
      shipmentInput('KOPRU-RCPT', { paymentType: 'recipient' }),
    );
    expect(recipientPaid.ok || recipientPaid.error.code).toBe('VALIDATION_FAILED');
    const recipientAccount = await client({ paymentType: 'recipient' }).createShipment(
      shipmentInput('KOPRU-RCPT', { paymentType: 'recipient' }),
    );
    expect(recipientAccount.ok).toBe(true);
  });

  it('surfaces invalid credentials as a provider error', async () => {
    const result = await client({ password: 'wrong' }).trackShipment({ referenceId: 'X' });
    expect(result.ok || result.error).toMatchObject({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      provider: 'yurtici',
      providerMessage: 'Kullanıcı adı veya şifre hatalı.',
    });
  });

  it('times out on slow responses', async () => {
    const cargo = createCargoClient({
      provider: yurtici(mockConfig()),
      http: { timeoutMs: 200, retry: { retries: 0 } },
    });
    const result = await cargo.trackShipment({ referenceId: YURTICI_MOCK_TIMEOUT_KEY });
    expect(result.ok || result.error.code).toBe('NETWORK_TIMEOUT');
  });
});
