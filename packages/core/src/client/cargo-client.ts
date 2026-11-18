import type { CargoCapability, CargoProvider } from '../domain/cargo/provider.js';
import {
  CreateShipmentRequestSchema,
  ShipmentLookupSchema,
  ShipmentSchema,
  ShipmentTrackingSchema,
  type CreateShipmentRequestInput,
  type Shipment,
  type ShipmentLookup,
  type ShipmentTracking,
} from '../domain/cargo/schemas.js';
import type { KopruError } from '../errors/kopru-error.js';
import type { Result } from '../result/result.js';
import {
  createContextFactory,
  runOperation,
  type CallOptions,
  type ClientOptions,
} from './run-operation.js';

/** `createCargoClient` seçenekleri. */
export interface CargoClientOptions extends ClientOptions {
  provider: CargoProvider;
}

/** Kullanıcıya açılan kargo istemcisi. Tüm girdiler doğrulanır, tüm çıktılar `Result` döner. */
export interface CargoClient {
  readonly providerId: string;
  /** Sağlayıcının yeteneği destekleyip desteklemediğini döner (örn. `cashOnDelivery`). */
  supports(capability: CargoCapability): boolean;
  /** Gönderi oluşturur. */
  createShipment(
    input: CreateShipmentRequestInput,
    options?: CallOptions,
  ): Promise<Result<Shipment, KopruError>>;
  /** Gönderiyi iptal eder. */
  cancelShipment(
    input: ShipmentLookup,
    options?: CallOptions,
  ): Promise<Result<Shipment, KopruError>>;
  /** Gönderinin durumunu ve hareket geçmişini getirir. */
  trackShipment(
    input: ShipmentLookup,
    options?: CallOptions,
  ): Promise<Result<ShipmentTracking, KopruError>>;
}

/**
 * Kargo istemcisi oluşturur.
 *
 * @example
 * const cargo = createCargoClient({ provider: yurtici({ username, password, sandbox: true }) });
 * const tracking = await cargo.trackShipment({ referenceId: 'S-1' });
 */
export function createCargoClient(options: CargoClientOptions): CargoClient {
  const { provider } = options;
  const createContext = createContextFactory(options);
  const base = {
    providerId: provider.id,
    hasCapability: (capability: CargoCapability) => provider.capabilities.has(capability),
  };
  const createShipment = provider.createShipment?.bind(provider);
  const cancelShipment = provider.cancelShipment?.bind(provider);
  const trackShipment = provider.trackShipment?.bind(provider);

  return {
    providerId: provider.id,
    supports: (capability) => provider.capabilities.has(capability),

    createShipment: (input, call) =>
      runOperation({
        ...base,
        operation: 'createShipment',
        inputSchema: CreateShipmentRequestSchema,
        outputSchema: ShipmentSchema,
        input,
        requiredCapabilities: (req) =>
          req.cashOnDelivery === undefined
            ? ['createShipment']
            : ['createShipment', 'cashOnDelivery'],
        invoke: createShipment && ((req) => createShipment(req, createContext(call))),
      }),

    cancelShipment: (input, call) =>
      runOperation({
        ...base,
        operation: 'cancelShipment',
        inputSchema: ShipmentLookupSchema,
        outputSchema: ShipmentSchema,
        input,
        requiredCapabilities: () => ['cancelShipment'],
        invoke:
          cancelShipment && ((req: ShipmentLookup) => cancelShipment(req, createContext(call))),
      }),

    trackShipment: (input, call) =>
      runOperation({
        ...base,
        operation: 'trackShipment',
        inputSchema: ShipmentLookupSchema,
        outputSchema: ShipmentTrackingSchema,
        input,
        requiredCapabilities: () => ['trackShipment'],
        invoke: trackShipment && ((req: ShipmentLookup) => trackShipment(req, createContext(call))),
      }),
  };
}
