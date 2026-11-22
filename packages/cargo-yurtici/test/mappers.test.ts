import { CreateShipmentRequestSchema, ShipmentLookupSchema } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import {
  toCancelledShipment,
  toCreatedShipment,
  toShipmentTracking,
  toTrackingEvent,
} from '../src/mappers/results.js';
import { toCargoKey, toShippingOrder } from '../src/mappers/shipment.js';
import {
  CancelShipmentResponseSchema,
  CreateShipmentResponseSchema,
  QueryShipmentResponseSchema,
} from '../src/schemas/response.js';

const request = (overrides: Record<string, unknown> = {}) =>
  CreateShipmentRequestSchema.parse({
    referenceId: 'S-1',
    recipient: {
      name: 'Test Alıcı',
      phone: '0532 000 00 00',
      address: { cityCode: '34', district: 'Kadıköy', addressLine: 'Örnek Sokak No: 1' },
    },
    ...overrides,
  });

describe('toShippingOrder', () => {
  it('maps a core request to a Yurtiçi ShippingOrderVO', () => {
    const result = toShippingOrder(
      request({
        desi: 2,
        weightKg: 1.5,
        pieceCount: 3,
        description: 'Kitap',
        recipient: {
          name: 'Test Alıcı',
          phone: '+905320000000',
          email: 'a@example.com',
          address: {
            cityCode: '34',
            district: 'Kadıköy',
            neighborhood: 'Caferağa',
            addressLine: 'Örnek Sokak No: 1',
          },
        },
      }),
      { paymentType: 'sender' },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        cargoKey: 'S-1',
        invoiceKey: 'S-1',
        receiverCustName: 'Test Alıcı',
        receiverAddress: 'Caferağa, Örnek Sokak No: 1',
        cityName: 'İstanbul',
        townName: 'Kadıköy',
        receiverPhone1: '5320000000',
        emailAddress: 'a@example.com',
        desi: 2,
        kg: 1.5,
        cargoCount: 3,
        description: 'Kitap',
        taxOfficeId: 0,
        ttDocumentId: 0,
        dcSelectedCredit: 0,
        dcCreditRule: 0,
      },
    });
  });

  it('rejects a payment type that does not match the account', () => {
    const result = toShippingOrder(request({ paymentType: 'recipient' }), {
      paymentType: 'sender',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.details).toMatchObject({ issues: [{ path: 'paymentType' }] });
    }
  });

  it('reports Yurtiçi field limits with core field paths', () => {
    const result = toShippingOrder(
      request({
        referenceId: 'R'.repeat(21),
        description: 'x'.repeat(300),
        recipient: {
          name: 'Test Alıcı',
          phone: '+4915112345678',
          address: { cityCode: '34', district: 'Kadıköy', addressLine: 'a'.repeat(201) },
        },
      }),
      { paymentType: 'sender' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.provider).toBe('yurtici');
    const paths = (result.error.details?.issues as { path: string }[]).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'referenceId',
        'recipient.address',
        'recipient.phone',
        'description',
      ]),
    );
  });
});

describe('toCargoKey', () => {
  it('requires referenceId', () => {
    expect(toCargoKey(ShipmentLookupSchema.parse({ referenceId: 'S-1' }))).toEqual({
      ok: true,
      value: 'S-1',
    });
    const result = toCargoKey(ShipmentLookupSchema.parse({ trackingNumber: '700000000001' }));
    expect(result.ok || result.error.code).toBe('VALIDATION_FAILED');
  });
});

const created = (detail: Record<string, unknown>, outFlag = '0') =>
  CreateShipmentResponseSchema.parse({
    ShippingOrderResultVO: { outFlag, shippingOrderDetailVO: detail },
  });

describe('toCreatedShipment', () => {
  it('returns a created shipment', () => {
    expect(toCreatedShipment(created({ cargoKey: 'S-1', errCode: '0' }), 'S-1')).toEqual({
      ok: true,
      value: { referenceId: 'S-1', status: 'created' },
    });
  });

  it('prefers the record error, then the top-level error', () => {
    const detail = toCreatedShipment(
      created({ cargoKey: 'S-1', errCode: '60019', errMessage: 'Adres' }, '1'),
      'S-1',
    );
    expect(detail.ok || detail.error.code).toBe('CARGO_ADDRESS_INVALID');

    const top = toCreatedShipment(
      CreateShipmentResponseSchema.parse({
        ShippingOrderResultVO: { outFlag: '2', errCode: '936', errMessage: 'Beklenmeyen hata' },
      }),
      'S-1',
    );
    expect(top.ok || top.error.providerCode).toBe('936');

    const flagOnly = toCreatedShipment(
      CreateShipmentResponseSchema.parse({
        ShippingOrderResultVO: { outFlag: '2', outResult: 'Sistem hatası' },
      }),
      'S-1',
    );
    expect(flagOnly.ok || flagOnly.error.providerMessage).toBe('Sistem hatası');
  });
});

const cancelled = (detail: Record<string, unknown> | undefined, outFlag = '0') =>
  CancelShipmentResponseSchema.parse({
    ShippingOrderResultVO: {
      outFlag,
      ...(detail === undefined ? {} : { shippingCancelDetailVO: detail }),
    },
  });

describe('toCancelledShipment', () => {
  it('accepts CNL and already cancelled shipments', () => {
    expect(
      toCancelledShipment(
        cancelled({ cargoKey: 'S-1', operationStatus: 'CNL', errCode: '0', docId: '7001' }),
        'S-1',
      ),
    ).toEqual({
      ok: true,
      value: {
        referenceId: 'S-1',
        status: 'cancelled',
        providerStatus: 'CNL',
        trackingNumber: '7001',
      },
    });
    expect(
      toCancelledShipment(cancelled({ cargoKey: 'S-1', errCode: '82520' }, '1'), 'S-1'),
    ).toEqual({
      ok: true,
      value: { referenceId: 'S-1', status: 'cancelled', providerStatus: 'ISC' },
    });
  });

  it('rejects shipments that are already on their way', () => {
    const result = toCancelledShipment(
      cancelled({ cargoKey: 'S-1', operationStatus: 'IND', operationMessage: 'Teslimatta' }),
      'S-1',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        code: 'CARGO_CANCELLATION_NOT_ALLOWED',
        providerCode: 'IND',
        providerMessage: 'Teslimatta',
      });
    }
  });

  it('flags missing details and unknown statuses as unexpected responses', () => {
    const missing = toCancelledShipment(cancelled(undefined), 'S-1');
    expect(missing.ok || missing.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
    const unknown = toCancelledShipment(
      cancelled({ cargoKey: 'S-1', operationStatus: 'ZZZ' }),
      'S-1',
    );
    expect(unknown.ok || unknown.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
  });
});

const event = (eventId: string, eventDate: string, eventTime: string, extra = {}) => ({
  eventId,
  eventName: `Olay ${eventId}`,
  eventDate,
  eventTime,
  ...extra,
});

describe('toTrackingEvent', () => {
  it('converts Istanbul local time and builds description and location', () => {
    expect(
      toTrackingEvent({
        ...event('DG', '20261117', '91500'),
        reasonId: 'AY',
        reasonName: 'Alıcı Adreste Yok',
        unitName: 'Çankaya Şube',
        cityName: 'Ankara',
      }),
    ).toEqual({
      status: 'out_for_delivery',
      providerStatus: 'DG',
      description: 'Olay DG (Alıcı Adreste Yok)',
      location: 'Çankaya Şube, Ankara',
      occurredAt: '2026-11-17T09:15:00+03:00',
    });
    expect(
      toTrackingEvent({
        ...event('TS', '20261117', '143000'),
        reasonId: 'OK',
        reasonName: 'Sorun Yok',
      }),
    ).toMatchObject({ description: 'Olay TS' });
    expect(toTrackingEvent(event('TS', '20261332', '143000'))).toBeUndefined();
  });
});

const query = (detail: Record<string, unknown> | undefined, outFlag = '0') =>
  QueryShipmentResponseSchema.parse({
    ShippingDeliveryVO: {
      outFlag,
      ...(detail === undefined ? {} : { shippingDeliveryDetailVO: detail }),
    },
  });

describe('toShipmentTracking', () => {
  it('sorts events and resolves the overall status', () => {
    const result = toShipmentTracking(
      query({
        cargoKey: 'S-1',
        operationStatus: 'IND',
        shippingDeliveryItemDetailVO: {
          docId: '700000000003',
          invDocCargoVOArray: [
            event('DG', '20261117', '091500'),
            event('GT', '20261116', '143005'),
          ],
        },
      }),
      'S-1',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      referenceId: 'S-1',
      status: 'out_for_delivery',
      providerStatus: 'IND',
      trackingNumber: '700000000003',
    });
    expect(result.value.events.map((e) => e.providerStatus)).toEqual(['GT', 'DG']);
  });

  it('handles shipments without item details or records', () => {
    expect(toShipmentTracking(query({ cargoKey: 'S-1', operationCode: '0' }), 'S-1')).toEqual({
      ok: true,
      value: { referenceId: 'S-1', status: 'created', providerStatus: 'NOP', events: [] },
    });
    const missing = toShipmentTracking(query(undefined), 'S-1');
    expect(missing.ok || missing.error.code).toBe('CARGO_SHIPMENT_NOT_FOUND');
  });

  it('rejects events with impossible dates', () => {
    const result = toShipmentTracking(
      query({
        cargoKey: 'S-1',
        operationStatus: 'IND',
        shippingDeliveryItemDetailVO: { invDocCargoVOArray: event('GT', '20260230', '100000') },
      }),
      'S-1',
    );
    expect(result.ok || result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
  });
});
