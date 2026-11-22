import type { MockPlugin } from '../plugin.js';
import { echoPlugin } from './echo.js';
import { iyzicoPlugin } from './iyzico/index.js';
import { yurticiPlugin } from './yurtici/index.js';

export { ECHO_MAX_DELAY_MS, echoPlugin } from './echo.js';
export * from './iyzico/index.js';
export * from './yurtici/index.js';

/**
 * Pakette gelen eklentiler. `startMockServer` ve CLI, eklenti listesi verilmediğinde
 * bunların tamamını kaydeder. Yeni sağlayıcı eklentileri eklendikçe bu listeye katılır.
 */
export const BUILTIN_PLUGINS: readonly MockPlugin[] = [echoPlugin, iyzicoPlugin, yurticiPlugin];
