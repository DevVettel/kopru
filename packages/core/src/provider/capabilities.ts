import type { CargoCapability, CargoOperations } from '../domain/cargo/provider.js';
import type { PaymentCapability, PaymentOperations } from '../domain/payment/provider.js';
import { ConfigurationError, ProviderError } from '../errors/kopru-error.js';

/** Her ödeme yeteneğinin sağlayıcıda zorunlu kıldığı metotlar. */
export const PAYMENT_CAPABILITY_METHODS = {
  charge: ['charge'],
  threeDS: ['initThreeDS', 'completeThreeDS'],
  refund: ['refund'],
  'refund.partial': ['refund'],
  installments: [],
} as const satisfies Record<PaymentCapability, readonly (keyof PaymentOperations)[]>;

/** Her kargo yeteneğinin sağlayıcıda zorunlu kıldığı metotlar. */
export const CARGO_CAPABILITY_METHODS = {
  createShipment: ['createShipment'],
  cancelShipment: ['cancelShipment'],
  trackShipment: ['trackShipment'],
  cashOnDelivery: ['createShipment'],
} as const satisfies Record<CargoCapability, readonly (keyof CargoOperations)[]>;

/** Yetenek bildiren herhangi bir nesne (sağlayıcı veya client). */
export interface HasCapabilities<C extends string> {
  readonly capabilities: ReadonlySet<C>;
}

/**
 * Sağlayıcının verilen yeteneği destekleyip desteklemediğini döner.
 */
export function supports<C extends string>(target: HasCapabilities<C>, capability: C): boolean {
  return target.capabilities.has(capability);
}

/**
 * Desteklenmeyen işlem için standart hatayı üretir. Bu hata ağ isteği yapılmadan döner.
 */
export function capabilityNotSupported(providerId: string, capability: string): ProviderError {
  return new ProviderError({
    code: 'PROVIDER_CAPABILITY_NOT_SUPPORTED',
    message: `Provider "${providerId}" does not support capability "${capability}"`,
    provider: providerId,
    details: { capability },
  });
}

/**
 * Bildirilen yeteneklerle uygulanan metotların tutarlı olduğunu doğrular:
 * her yeteneğin gerektirdiği metotlar uygulanmış olmalı ve her uygulanan metot
 * en az bir bildirilen yetenek tarafından kapsanmalıdır.
 *
 * @throws ConfigurationError Tutarsızlık varsa (sağlayıcı paketindeki programlama hatası)
 */
export function assertCapabilityMethods<C extends string, M extends string>(
  providerId: string,
  capabilities: ReadonlySet<C>,
  operations: Partial<Record<M, unknown>>,
  requirements: Readonly<Record<C, readonly M[]>>,
): void {
  const covered = new Set<string>();
  for (const capability of capabilities) {
    for (const method of requirements[capability]) {
      covered.add(method);
      if (typeof operations[method] !== 'function') {
        throw new ConfigurationError({
          message: `Provider "${providerId}" declares capability "${capability}" but does not implement "${method}"`,
          provider: providerId,
        });
      }
    }
  }
  for (const [method, implementation] of Object.entries(operations)) {
    if (typeof implementation === 'function' && !covered.has(method)) {
      throw new ConfigurationError({
        message: `Provider "${providerId}" implements "${method}" without declaring a capability for it`,
        provider: providerId,
      });
    }
  }
}
