import { describe, expect, it } from 'vitest';
import { createCargoClient, type CargoClient } from '../client/cargo-client.js';
import type { ClientOptions } from '../client/run-operation.js';
import { CARGO_CAPABILITIES, type CargoProvider } from '../domain/cargo/provider.js';
import {
  ShipmentSchema,
  ShipmentTrackingSchema,
  type CreateShipmentRequestInput,
  type ShipmentLookup,
} from '../domain/cargo/schemas.js';
import { CARGO_CAPABILITY_METHODS, assertCapabilityMethods } from '../provider/capabilities.js';
import { createRecordingHttpClient } from './shared.js';

/** Kargo sözleşme testlerinde kullanılan, sağlayıcıya özgü deterministik girdiler. */
export interface CargoContractFixtures {
  /** Başarıyla oluşturulması beklenen gönderi. */
  shipment: CreateShipmentRequestInput;
  /** Sağlayıcıda bulunmayan bir gönderi; takipte `CARGO_SHIPMENT_NOT_FOUND` beklenir. */
  missingShipment?: ShipmentLookup;
}

/** `runCargoProviderContract` seçenekleri. */
export interface CargoContractOptions {
  /** Her test için yeni bir sağlayıcı örneği üretir. */
  createProvider: () => CargoProvider;
  fixtures: CargoContractFixtures;
  /** Client seçenekleri (örn. mock server'a yönlendirilmiş HTTP ayarları). */
  clientOptions?: ClientOptions;
}

/**
 * Bir kargo sağlayıcısının Köprü sözleşmesine uyduğunu doğrulayan Vitest test paketini tanımlar.
 * Her sağlayıcı paketi bu paketi geçmek zorundadır.
 */
export function runCargoProviderContract(options: CargoContractOptions): void {
  const { fixtures } = options;
  const probe = options.createProvider();
  const has = (capability: (typeof CARGO_CAPABILITIES)[number]): boolean =>
    probe.capabilities.has(capability);
  const client = () =>
    createCargoClient({ ...options.clientOptions, provider: options.createProvider() });

  describe(`cargo provider contract: ${probe.id}`, () => {
    it('declares a valid kind, id and known capabilities', () => {
      expect(probe.kind).toBe('cargo');
      expect(probe.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const capability of probe.capabilities) {
        expect(CARGO_CAPABILITIES).toContain(capability);
      }
    });

    it('implements exactly the methods its capabilities require', () => {
      expect(() => {
        assertCapabilityMethods(probe.id, probe.capabilities, probe, CARGO_CAPABILITY_METHODS);
      }).not.toThrow();
    });

    it('rejects invalid input with VALIDATION_FAILED before reaching the network', async () => {
      const http = createRecordingHttpClient();
      const cargo = createCargoClient({ provider: options.createProvider(), http });
      const result = await cargo.createShipment({ ...fixtures.shipment, referenceId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(http.requests).toHaveLength(0);
    });

    const lookup = { referenceId: 'contract' };
    const cases = [
      {
        capability: 'createShipment',
        call: (c: CargoClient) => c.createShipment(fixtures.shipment),
      },
      {
        capability: 'cashOnDelivery',
        call: (c: CargoClient) =>
          c.createShipment({
            ...fixtures.shipment,
            cashOnDelivery: { value: 1000, currency: 'TRY' },
          }),
      },
      { capability: 'cancelShipment', call: (c: CargoClient) => c.cancelShipment(lookup) },
      { capability: 'trackShipment', call: (c: CargoClient) => c.trackShipment(lookup) },
    ] as const;
    const unsupported = cases.filter((c) => !has(c.capability));

    describe.runIf(unsupported.length > 0)(
      'unsupported capabilities fail without network calls',
      () => {
        for (const { capability, call } of unsupported) {
          it(`${capability} → PROVIDER_CAPABILITY_NOT_SUPPORTED`, async () => {
            const http = createRecordingHttpClient();
            const result = await call(
              createCargoClient({ provider: options.createProvider(), http }),
            );
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe('PROVIDER_CAPABILITY_NOT_SUPPORTED');
            expect(http.requests).toHaveLength(0);
          });
        }
      },
    );

    if (has('createShipment')) {
      it('createShipment returns a valid Shipment that echoes the reference', async () => {
        const result = await client().createShipment(fixtures.shipment);
        expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
        if (!result.ok) return;
        expect(ShipmentSchema.safeParse(result.value).success).toBe(true);
        expect(result.value.referenceId).toBe(fixtures.shipment.referenceId);
      });
    }

    if (has('createShipment') && has('trackShipment')) {
      it('trackShipment returns valid tracking for a created shipment', async () => {
        const cargo = client();
        const created = await cargo.createShipment(fixtures.shipment);
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        const tracked = await cargo.trackShipment({ referenceId: created.value.referenceId });
        expect(tracked.ok, tracked.ok ? '' : tracked.error.message).toBe(true);
        if (!tracked.ok) return;
        expect(ShipmentTrackingSchema.safeParse(tracked.value).success).toBe(true);
        expect(tracked.value.referenceId).toBe(created.value.referenceId);
      });
    }

    if (has('createShipment') && has('cancelShipment')) {
      it('cancelShipment marks a created shipment as cancelled', async () => {
        const cargo = client();
        const created = await cargo.createShipment(fixtures.shipment);
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        const cancelled = await cargo.cancelShipment({ referenceId: created.value.referenceId });
        expect(cancelled.ok, cancelled.ok ? '' : cancelled.error.message).toBe(true);
        if (cancelled.ok) expect(cancelled.value.status).toBe('cancelled');
      });
    }

    const { missingShipment } = fixtures;
    if (has('trackShipment') && missingShipment !== undefined) {
      it('tracking an unknown shipment returns CARGO_SHIPMENT_NOT_FOUND', async () => {
        const result = await client().trackShipment(missingShipment);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('CARGO_SHIPMENT_NOT_FOUND');
          expect(result.error.provider).toBe(probe.id);
        }
      });
    }
  });
}
