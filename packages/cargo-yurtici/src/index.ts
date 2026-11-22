/**
 * @packageDocumentation
 * Köprü Yurtiçi Kargo sağlayıcısı. `createCargoClient` ile birlikte kullanılır;
 * Yurtiçi'ye özgü ham şemalar ve mapper'lar dışarı açılmaz.
 */

/** Paketin npm üzerindeki adı. */
export const PACKAGE_NAME = '@kopru/yurtici';

export { yurtici } from './provider.js';

export {
  YURTICI_PRODUCTION_BASE_URL,
  YURTICI_SERVICE_PATH,
  YURTICI_TEST_BASE_URL,
  YurticiConfigSchema,
  type YurticiConfig,
  type YurticiConfigInput,
} from './config.js';

export { YURTICI_ERROR_MAP, YURTICI_PROVIDER_ID } from './errors.js';

export {
  YURTICI_EVENT_STATUS_MAP,
  YURTICI_OPERATION_CODES,
  YURTICI_OPERATION_STATUS_MAP,
} from './status-map.js';
