import { defineCargoProvider } from '@kopru/core';
import { YurticiConfigSchema } from './config.js';
import { YURTICI_PROVIDER_ID } from './errors.js';
import { toCancelledShipment, toCreatedShipment, toShipmentTracking } from './mappers/results.js';
import { toCargoKey, toShippingOrder } from './mappers/shipment.js';
import {
  CancelShipmentResponseSchema,
  CreateShipmentResponseSchema,
  QueryShipmentResponseSchema,
} from './schemas/response.js';
import { callYurtici } from './soap.js';

/** `queryShipment` anahtar tipi: `0` kargo anahtarı, `1` fatura anahtarı. */
const KEY_TYPE_CARGO_KEY = 0;

/**
 * Yurtiçi Kargo sağlayıcısı fabrikası. Konfigürasyon geçersizse `ConfigurationError` fırlatır.
 *
 * Yetenekler: `createShipment`, `cancelShipment`, `trackShipment`. Kapıda ödeme Faz 2'dedir.
 *
 * @example
 * const cargo = createCargoClient({
 *   provider: yurtici({ username: '…', password: '…', sandbox: true }),
 * });
 */
export const yurtici = defineCargoProvider({
  id: YURTICI_PROVIDER_ID,
  configSchema: YurticiConfigSchema,
  capabilities: ['createShipment', 'cancelShipment', 'trackShipment'],
  create: (config) => ({
    async createShipment(input, ctx) {
      const order = toShippingOrder(input, config);
      if (!order.ok) return order;
      const response = await callYurtici(config, ctx, {
        operation: 'createShipment',
        fields: { ShippingOrderVO: order.value },
        responseSchema: CreateShipmentResponseSchema,
      });
      if (!response.ok) return response;
      return toCreatedShipment(response.value, input.referenceId);
    },

    async cancelShipment(input, ctx) {
      const cargoKey = toCargoKey(input);
      if (!cargoKey.ok) return cargoKey;
      const response = await callYurtici(config, ctx, {
        operation: 'cancelShipment',
        fields: { cargoKeys: cargoKey.value },
        responseSchema: CancelShipmentResponseSchema,
      });
      if (!response.ok) return response;
      return toCancelledShipment(response.value, cargoKey.value);
    },

    async trackShipment(input, ctx) {
      const cargoKey = toCargoKey(input);
      if (!cargoKey.ok) return cargoKey;
      const response = await callYurtici(config, ctx, {
        operation: 'queryShipment',
        fields: {
          keys: cargoKey.value,
          keyType: KEY_TYPE_CARGO_KEY,
          addHistoricalData: true,
          onlyTracking: false,
        },
        responseSchema: QueryShipmentResponseSchema,
        idempotent: true,
      });
      if (!response.ok) return response;
      return toShipmentTracking(response.value, cargoKey.value);
    },
  }),
});
