import type { z } from 'zod';
import type { CargoCapability, CargoOperations, CargoProvider } from '../domain/cargo/provider.js';
import type {
  PaymentCapability,
  PaymentOperations,
  PaymentProvider,
} from '../domain/payment/provider.js';
import { summarizeIssues, toValidationIssues } from '../errors/from-zod.js';
import { ConfigurationError } from '../errors/kopru-error.js';
import {
  CARGO_CAPABILITY_METHODS,
  PAYMENT_CAPABILITY_METHODS,
  assertCapabilityMethods,
} from './capabilities.js';

/** Sağlayıcı tanımının ortak alanları. */
export interface ProviderDefinition<S extends z.ZodType, C extends string, O> {
  /** Sağlayıcı kimliği (örn. `iyzico`); kebab-case. */
  id: string;
  /** Sağlayıcı konfigürasyonunun Zod şeması. */
  configSchema: S;
  /** Desteklenen yetenekler. */
  capabilities: readonly C[];
  /** Doğrulanmış konfigürasyonla sağlayıcı işlemlerini üretir. */
  create: (config: z.output<S>) => O;
}

/** Konfigürasyon alıp sağlayıcı örneği döndüren fabrika. */
export type ProviderFactory<S extends z.ZodType, P> = (config: z.input<S>) => P;

function parseConfig<S extends z.ZodType>(id: string, schema: S, config: unknown): z.output<S> {
  const parsed = schema.safeParse(config);
  if (parsed.success) return parsed.data;
  const issues = toValidationIssues(parsed.error);
  throw new ConfigurationError({
    message: `Invalid configuration for provider "${id}": ${summarizeIssues(issues)}`,
    provider: id,
    details: { issues },
  });
}

function assertProviderId(id: string): void {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new ConfigurationError({ message: `Invalid provider id "${id}": must be kebab-case` });
  }
}

/**
 * Ödeme sağlayıcısı tanımlar. Dönen fabrika, konfigürasyonu Zod ile doğrular
 * (hatalıysa `ConfigurationError` fırlatır) ve yetenek/metot tutarlılığını kontrol eder.
 *
 * @example
 * export const acmePay = definePaymentProvider({
 *   id: 'acme-pay',
 *   configSchema: z.object({ apiKey: z.string().min(1) }),
 *   capabilities: ['charge', 'refund'],
 *   create: (config) => ({ charge: async (input, ctx) => …, refund: async (input, ctx) => … }),
 * });
 */
export function definePaymentProvider<S extends z.ZodType>(
  definition: ProviderDefinition<S, PaymentCapability, PaymentOperations>,
): ProviderFactory<S, PaymentProvider> {
  assertProviderId(definition.id);
  return (config) => {
    const operations = definition.create(
      parseConfig(definition.id, definition.configSchema, config),
    );
    const capabilities = new Set(definition.capabilities);
    assertCapabilityMethods(definition.id, capabilities, operations, PAYMENT_CAPABILITY_METHODS);
    return Object.freeze({ ...operations, kind: 'payment', id: definition.id, capabilities });
  };
}

/**
 * Kargo sağlayıcısı tanımlar. Davranışı `definePaymentProvider` ile aynıdır.
 */
export function defineCargoProvider<S extends z.ZodType>(
  definition: ProviderDefinition<S, CargoCapability, CargoOperations>,
): ProviderFactory<S, CargoProvider> {
  assertProviderId(definition.id);
  return (config) => {
    const operations = definition.create(
      parseConfig(definition.id, definition.configSchema, config),
    );
    const capabilities = new Set(definition.capabilities);
    assertCapabilityMethods(definition.id, capabilities, operations, CARGO_CAPABILITY_METHODS);
    return Object.freeze({ ...operations, kind: 'cargo', id: definition.id, capabilities });
  };
}
