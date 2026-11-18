import type { KopruError } from '../../errors/kopru-error.js';
import type { ProviderContext } from '../../provider/context.js';
import type { Result } from '../../result/result.js';
import type {
  CreateShipmentRequest,
  Shipment,
  ShipmentLookup,
  ShipmentTracking,
} from './schemas.js';

/** Kargo sağlayıcısı yetenekleri. */
export const CARGO_CAPABILITIES = [
  'createShipment',
  'cancelShipment',
  'trackShipment',
  'cashOnDelivery',
] as const;

/** Kargo sağlayıcısı yeteneği. */
export type CargoCapability = (typeof CARGO_CAPABILITIES)[number];

/**
 * Kargo sağlayıcısının uyguladığı işlemler. Bir metot, ilgili yetenek
 * bildirildiyse zorunludur (bkz. `defineCargoProvider`).
 */
export interface CargoOperations {
  createShipment?: (
    input: CreateShipmentRequest,
    ctx: ProviderContext,
  ) => Promise<Result<Shipment, KopruError>>;
  cancelShipment?: (
    input: ShipmentLookup,
    ctx: ProviderContext,
  ) => Promise<Result<Shipment, KopruError>>;
  trackShipment?: (
    input: ShipmentLookup,
    ctx: ProviderContext,
  ) => Promise<Result<ShipmentTracking, KopruError>>;
}

/**
 * Kargo sağlayıcısı sözleşmesi. Sağlayıcı paketleri bunu `defineCargoProvider`
 * ile üretir; kullanıcılar `createCargoClient` üzerinden kullanır.
 */
export interface CargoProvider extends CargoOperations {
  readonly kind: 'cargo';
  /** Sağlayıcı kimliği (örn. `yurtici`). */
  readonly id: string;
  readonly capabilities: ReadonlySet<CargoCapability>;
}
