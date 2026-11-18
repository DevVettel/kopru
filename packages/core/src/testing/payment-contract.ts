import { describe, expect, it } from 'vitest';
import { createPaymentClient, type PaymentClient } from '../client/payment-client.js';
import type { ClientOptions } from '../client/run-operation.js';
import { PAYMENT_CAPABILITIES, type PaymentProvider } from '../domain/payment/provider.js';
import {
  ChargeResultSchema,
  RefundResultSchema,
  ThreeDSInitResultSchema,
  type ChargeRequestInput,
  type ThreeDSInitRequestInput,
} from '../domain/payment/schemas.js';
import { PAYMENT_CAPABILITY_METHODS, assertCapabilityMethods } from '../provider/capabilities.js';
import { createRecordingHttpClient } from './shared.js';

/** Ödeme sözleşme testlerinde kullanılan, sağlayıcıya özgü deterministik girdiler. */
export interface PaymentContractFixtures {
  /** Başarıyla sonuçlanması beklenen tahsilat isteği. */
  successfulCharge: ChargeRequestInput;
  /** Ödeme kategorisinde (örn. kart reddi) hatayla sonuçlanması beklenen istek. */
  declinedCharge?: ChargeRequestInput;
  /** 3DS başlatma isteği; sağlayıcı `threeDS` destekliyorsa zorunludur. */
  threeDSInit?: ThreeDSInitRequestInput;
}

/** `runPaymentProviderContract` seçenekleri. */
export interface PaymentContractOptions {
  /** Her test için yeni bir sağlayıcı örneği üretir. */
  createProvider: () => PaymentProvider;
  fixtures: PaymentContractFixtures;
  /** Client seçenekleri (örn. mock server'a yönlendirilmiş HTTP ayarları). */
  clientOptions?: ClientOptions;
}

/**
 * Bir ödeme sağlayıcısının Köprü sözleşmesine uyduğunu doğrulayan Vitest test paketini tanımlar.
 * Her sağlayıcı paketi bu paketi geçmek zorundadır.
 *
 * @example
 * runPaymentProviderContract({ createProvider: () => iyzico(config), fixtures, clientOptions });
 */
export function runPaymentProviderContract(options: PaymentContractOptions): void {
  const { fixtures } = options;
  const probe = options.createProvider();
  const has = (capability: (typeof PAYMENT_CAPABILITIES)[number]): boolean =>
    probe.capabilities.has(capability);
  const client = () =>
    createPaymentClient({ ...options.clientOptions, provider: options.createProvider() });

  describe(`payment provider contract: ${probe.id}`, () => {
    it('declares a valid kind, id and known capabilities', () => {
      expect(probe.kind).toBe('payment');
      expect(probe.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const capability of probe.capabilities) {
        expect(PAYMENT_CAPABILITIES).toContain(capability);
      }
    });

    it('implements exactly the methods its capabilities require', () => {
      expect(() => {
        assertCapabilityMethods(probe.id, probe.capabilities, probe, PAYMENT_CAPABILITY_METHODS);
      }).not.toThrow();
    });

    it('rejects invalid input with VALIDATION_FAILED before reaching the network', async () => {
      const http = createRecordingHttpClient();
      const payments = createPaymentClient({ provider: options.createProvider(), http });
      const result = await payments.charge({ ...fixtures.successfulCharge, orderId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(http.requests).toHaveLength(0);
    });

    const cases = [
      {
        capability: 'charge',
        call: (c: PaymentClient) => c.charge(fixtures.successfulCharge),
      },
      {
        capability: 'installments',
        call: (c: PaymentClient) => c.charge({ ...fixtures.successfulCharge, installments: 3 }),
      },
      {
        capability: 'threeDS',
        call: (c: PaymentClient) => c.completeThreeDS({ payload: {} }),
      },
      {
        capability: 'refund',
        call: (c: PaymentClient) => c.refund({ transactionId: 'contract' }),
      },
      {
        capability: 'refund.partial',
        call: (c: PaymentClient) =>
          c.refund({ transactionId: 'contract', amount: { value: 1, currency: 'TRY' } }),
      },
    ] as const;
    const unsupported = cases.filter((c) => !has(c.capability));

    describe.runIf(unsupported.length > 0)(
      'unsupported capabilities fail without network calls',
      () => {
        for (const { capability, call } of unsupported) {
          it(`${capability} → PROVIDER_CAPABILITY_NOT_SUPPORTED`, async () => {
            const http = createRecordingHttpClient();
            const result = await call(
              createPaymentClient({ provider: options.createProvider(), http }),
            );
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.code).toBe('PROVIDER_CAPABILITY_NOT_SUPPORTED');
            expect(http.requests).toHaveLength(0);
          });
        }
      },
    );

    if (has('charge')) {
      it('charge returns a valid ChargeResult that echoes the order', async () => {
        const result = await client().charge(fixtures.successfulCharge);
        expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
        if (!result.ok) return;
        expect(ChargeResultSchema.safeParse(result.value).success).toBe(true);
        expect(result.value.orderId).toBe(fixtures.successfulCharge.orderId);
        expect(result.value.amount).toEqual(fixtures.successfulCharge.amount);
      });
    }

    const { declinedCharge } = fixtures;
    if (has('charge') && declinedCharge !== undefined) {
      it('declined charge returns a payment error', async () => {
        const result = await client().charge(declinedCharge);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.category).toBe('payment');
          expect(result.error.provider).toBe(probe.id);
        }
      });
    }

    if (has('threeDS')) {
      it('initThreeDS returns a valid ThreeDSInitResult', async () => {
        expect(fixtures.threeDSInit, 'fixtures.threeDSInit is required for threeDS').toBeDefined();
        if (fixtures.threeDSInit === undefined) return;
        const result = await client().initThreeDS(fixtures.threeDSInit);
        expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
        if (!result.ok) return;
        expect(ThreeDSInitResultSchema.safeParse(result.value).success).toBe(true);
        expect(result.value.orderId).toBe(fixtures.threeDSInit.orderId);
      });
    }

    if (has('charge') && has('refund')) {
      it('full refund of a successful charge returns a valid RefundResult', async () => {
        const payments = client();
        const charged = await payments.charge(fixtures.successfulCharge);
        expect(charged.ok).toBe(true);
        if (!charged.ok) return;
        const refunded = await payments.refund({ transactionId: charged.value.transactionId });
        expect(refunded.ok, refunded.ok ? '' : refunded.error.message).toBe(true);
        if (!refunded.ok) return;
        expect(RefundResultSchema.safeParse(refunded.value).success).toBe(true);
        expect(refunded.value.transactionId).toBe(charged.value.transactionId);
        expect(refunded.value.amount).toEqual(charged.value.amount);
      });
    }
  });
}
