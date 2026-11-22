import { buildSoapEnvelope, parseSoapEnvelope } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import {
  YURTICI_MOCK_DELIVERED_KEY,
  YURTICI_MOCK_EXISTING_KEY,
  YURTICI_MOCK_INVALID_ADDRESS_MARKER,
  YURTICI_MOCK_IN_TRANSIT_KEY,
  YURTICI_MOCK_PASSWORD,
  YURTICI_MOCK_SERVICE_PATH,
  YURTICI_MOCK_USERNAME,
  createMockApp,
  yurticiPlugin,
} from '../src/index.js';

const NAMESPACE = 'http://yurticikargo.com.tr/ShippingOrderDispatcherServices';

function setup() {
  const { app, requestLog } = createMockApp({ plugins: [yurticiPlugin] });
  const call = async (
    operation: string,
    fields: Record<string, unknown>,
    password = YURTICI_MOCK_PASSWORD,
  ) => {
    const xml = buildSoapEnvelope({
      namespaces: { ship: NAMESPACE },
      body: {
        [`ship:${operation}`]: {
          wsUserName: YURTICI_MOCK_USERNAME,
          wsPassword: password,
          ...fields,
        },
      },
    });
    const response = await app.request(`/yurtici${YURTICI_MOCK_SERVICE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
    });
    const text = await response.text();
    return { status: response.status, text, envelope: parseSoapEnvelope(text) };
  };
  return { call, requestLog };
}

const order = (cargoKey: string, extra: Record<string, unknown> = {}) => ({
  ShippingOrderVO: {
    cargoKey,
    invoiceKey: cargoKey,
    receiverCustName: 'Test Alıcı',
    receiverAddress: 'Caferağa, Örnek Sokak No: 1',
    cityName: 'İstanbul',
    townName: 'Kadıköy',
    receiverPhone1: '5320000000',
    cargoCount: 1,
    ...extra,
  },
});

/** Yanıt gövdesindeki operasyon sonucunu döner (`<operation>Response` içeriği). */
function result(envelope: Awaited<ReturnType<ReturnType<typeof setup>['call']>>['envelope']) {
  expect(envelope.ok).toBe(true);
  return envelope.ok ? envelope.value.body : {};
}

describe('yurtici mock plugin', () => {
  it('creates, tracks and cancels a shipment', async () => {
    const { call } = setup();
    const created = result((await call('createShipment', order('S-1'))).envelope);
    expect(created).toMatchObject({
      createShipmentResponse: {
        ShippingOrderResultVO: {
          outFlag: '0',
          shippingOrderDetailVO: { cargoKey: 'S-1', errCode: '0' },
        },
      },
    });

    const tracked = result(
      (await call('queryShipment', { keys: 'S-1', keyType: 0, addHistoricalData: true })).envelope,
    );
    expect(tracked).toMatchObject({
      queryShipmentResponse: {
        ShippingDeliveryVO: { shippingDeliveryDetailVO: { operationStatus: 'NOP' } },
      },
    });

    const cancelled = result((await call('cancelShipment', { cargoKeys: 'S-1' })).envelope);
    expect(cancelled).toMatchObject({
      cancelShipmentResponse: {
        ShippingOrderResultVO: {
          shippingCancelDetailVO: { operationStatus: 'CNL', operationCode: '3', errCode: '0' },
        },
      },
    });

    const again = result((await call('cancelShipment', { cargoKeys: 'S-1' })).envelope);
    expect(again).toMatchObject({
      cancelShipmentResponse: {
        ShippingOrderResultVO: { outFlag: '1', shippingCancelDetailVO: { errCode: '82520' } },
      },
    });
  });

  it.each([
    [{ cargoKey: '' }, '80859'],
    [{ cargoKey: 'K'.repeat(21) }, '82500'],
    [{ receiverAddress: '' }, '60019'],
    [{ receiverAddress: `x ${YURTICI_MOCK_INVALID_ADDRESS_MARKER}` }, '60019'],
    [{ receiverPhone1: '05320000000' }, '82516'],
    [{ cargoKey: YURTICI_MOCK_EXISTING_KEY }, '60020'],
  ])('rejects invalid orders: %o → %s', async (extra, errCode) => {
    const { call } = setup();
    const body = result((await call('createShipment', order('S-2', extra))).envelope);
    expect(body).toMatchObject({
      createShipmentResponse: {
        ShippingOrderResultVO: { outFlag: '1', shippingOrderDetailVO: { errCode } },
      },
    });
  });

  it('returns seeded tracking history only when requested', async () => {
    const { call } = setup();
    const withHistory = await call('queryShipment', {
      keys: YURTICI_MOCK_DELIVERED_KEY,
      keyType: 0,
      addHistoricalData: true,
    });
    expect(withHistory.text).toContain('<eventId>TS</eventId>');
    expect(result(withHistory.envelope)).toMatchObject({
      queryShipmentResponse: {
        ShippingDeliveryVO: {
          shippingDeliveryDetailVO: {
            operationStatus: 'DLV',
            shippingDeliveryItemDetailVO: { docId: '700000000001' },
          },
        },
      },
    });

    const withoutHistory = await call('queryShipment', {
      keys: YURTICI_MOCK_DELIVERED_KEY,
      keyType: 0,
      addHistoricalData: false,
    });
    expect(withoutHistory.text).not.toContain('invDocCargoVOArray');
  });

  it('refuses to cancel a shipment that is already on its way', async () => {
    const { call } = setup();
    const body = result(
      (await call('cancelShipment', { cargoKeys: YURTICI_MOCK_IN_TRANSIT_KEY })).envelope,
    );
    expect(body).toMatchObject({
      cancelShipmentResponse: {
        ShippingOrderResultVO: { shippingCancelDetailVO: { operationStatus: 'IND' } },
      },
    });
  });

  it('returns 82519 for unknown shipments', async () => {
    const { call } = setup();
    for (const [operation, fields] of [
      ['queryShipment', { keys: 'NOPE', keyType: 0 }],
      ['cancelShipment', { cargoKeys: 'NOPE' }],
    ] as const) {
      expect((await call(operation, fields)).text).toContain('<errCode>82519</errCode>');
    }
  });

  it('returns a SOAP fault for invalid credentials, unknown operations and malformed XML', async () => {
    const { call, requestLog } = setup();
    const denied = await call('queryShipment', { keys: 'S-1' }, 'wrong');
    expect(denied.status).toBe(500);
    expect(denied.envelope.ok || denied.envelope.error.providerMessage).toBe(
      'Kullanıcı adı veya şifre hatalı.',
    );
    expect(requestLog.list().at(-1)?.body).not.toContain('wrong');

    const unknown = await call('saveReturnShipmentCode', {});
    expect(unknown.envelope.ok || unknown.envelope.error.providerMessage).toContain(
      'Desteklenmeyen operasyon',
    );

    const { app } = createMockApp({ plugins: [yurticiPlugin] });
    const malformed = await app.request(`/yurtici${YURTICI_MOCK_SERVICE_PATH}`, {
      method: 'POST',
      body: 'not xml',
    });
    expect(malformed.status).toBe(500);
  });

  it('rejects structurally invalid operation bodies', async () => {
    const { call } = setup();
    for (const [operation, fields] of [
      ['createShipment', { ShippingOrderVO: 'text' }],
      ['cancelShipment', { cargoKeys: { nested: 'x' } }],
      ['queryShipment', { keys: { nested: 'x' } }],
    ] as const) {
      const response = await call(operation, fields);
      expect(response.status, operation).toBe(500);
    }
  });
});
