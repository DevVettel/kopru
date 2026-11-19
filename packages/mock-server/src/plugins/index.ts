import type { MockPlugin } from '../plugin.js';
import { echoPlugin } from './echo.js';

export { ECHO_MAX_DELAY_MS, echoPlugin } from './echo.js';

/**
 * Pakette gelen eklentiler. `startMockServer` ve CLI, eklenti listesi verilmediğinde
 * bunların tamamını kaydeder. Sağlayıcı eklentileri (iyzico, Yurtiçi) eklendikçe
 * bu listeye katılır.
 */
export const BUILTIN_PLUGINS: readonly MockPlugin[] = [echoPlugin];
