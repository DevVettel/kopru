/**
 * @packageDocumentation
 * Köprü iyzico ödeme sağlayıcısı. `createPaymentClient` ile birlikte kullanılır;
 * iyzico'ya özgü ham şemalar ve mapper'lar dışarı açılmaz.
 */

/** Paketin npm üzerindeki adı. */
export const PACKAGE_NAME = '@kopru/iyzico';

export { iyzico } from './provider.js';

export {
  IYZICO_PRODUCTION_BASE_URL,
  IYZICO_SANDBOX_BASE_URL,
  IyzicoConfigSchema,
  type IyzicoConfig,
  type IyzicoConfigInput,
} from './config.js';

export { IYZICO_ERROR_MAP, IYZICO_PROVIDER_ID } from './errors.js';
