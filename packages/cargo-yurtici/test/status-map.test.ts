import { describe, expect, it } from 'vitest';
import { mapEventStatus, mapOperationStatus, resolveShipmentStatus } from '../src/status-map.js';

describe('status mapping', () => {
  it.each([
    ['NOP', 'created'],
    ['ISR', 'picked_up'],
    ['IND', 'in_transit'],
    ['DLV', 'delivered'],
    ['CNL', 'cancelled'],
    ['ISC', 'cancelled'],
    ['BI', 'cancelled'],
    ['dlv', 'delivered'],
    ['XYZ', 'unknown'],
  ])('operationStatus %s → %s', (raw, status) => {
    expect(mapOperationStatus(raw, undefined).status).toBe(status);
  });

  it('falls back to operationCode and keeps the raw value', () => {
    expect(mapOperationStatus(undefined, '5')).toEqual({
      providerStatus: 'DLV',
      status: 'delivered',
    });
    expect(mapOperationStatus('', '3')).toEqual({ providerStatus: 'CNL', status: 'cancelled' });
    expect(mapOperationStatus(undefined, '99')).toEqual({
      providerStatus: '99',
      status: 'unknown',
    });
    expect(mapOperationStatus(undefined, undefined)).toEqual({
      providerStatus: undefined,
      status: 'unknown',
    });
  });

  it('maps movement codes', () => {
    expect(mapEventStatus('GT')).toBe('picked_up');
    expect(mapEventStatus('dg')).toBe('out_for_delivery');
    expect(mapEventStatus('TS')).toBe('delivered');
    expect(mapEventStatus('IA')).toBe('returned');
    expect(mapEventStatus('ZZ')).toBe('unknown');
  });

  it('refines in-transit shipments with the last movement and return status', () => {
    expect(resolveShipmentStatus('in_transit', 'out_for_delivery', '0')).toBe('out_for_delivery');
    expect(resolveShipmentStatus('picked_up', 'returned', undefined)).toBe('returned');
    expect(resolveShipmentStatus('in_transit', 'in_transit', undefined)).toBe('in_transit');
    expect(resolveShipmentStatus('in_transit', undefined, undefined)).toBe('in_transit');
    expect(resolveShipmentStatus('delivered', 'out_for_delivery', undefined)).toBe('delivered');
    expect(resolveShipmentStatus('in_transit', 'in_transit', '3')).toBe('returned');
  });
});
