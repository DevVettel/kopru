import { redactHeaders, redactText } from '@kopru/core';
import { Hono } from 'hono';
import {
  ADMIN_PATH_PREFIX,
  assertUniquePlugins,
  findPluginForPath,
  type MockPlugin,
  type MockPluginContext,
} from './plugin.js';
import { createRequestLog, type RecordedRequest, type WritableRequestLog } from './request-log.js';

/** `createMockApp` seçenekleri. */
export interface MockAppOptions {
  /** Kaydedilecek sağlayıcı eklentileri. */
  plugins: readonly MockPlugin[];
  /** Kullanılacak istek kaydı; verilmezse yeni bir kayıt oluşturulur. */
  requestLog?: WritableRequestLog;
  /** Sunucunun dışarıdan erişilebilir kök adresini dönen fonksiyon. */
  baseUrl?: () => string;
  /** Her istek kaydedildikten sonra çağrılır (örn. CLI'da konsola yazmak için). */
  onRequest?: (entry: RecordedRequest) => void;
}

/** `createMockApp` sonucu. */
export interface MockApp {
  /** Hono uygulaması; `app.request()` ile sunucu başlatmadan da test edilebilir. */
  readonly app: Hono;
  /** Uygulamanın istek kaydı. */
  readonly requestLog: WritableRequestLog;
}

/** Varsayılan kök adres; uygulama bir sunucuya bağlanmadan kullanıldığında geçerlidir. */
const DEFAULT_BASE_URL = 'http://localhost';

/**
 * Eklentileri kaydedilmiş, istek kaydı tutan mock server uygulamasını oluşturur.
 *
 * Yönetim uç noktaları (`/__kopru/*`) kayda alınmaz:
 * - `GET /__kopru/health` — sağlık kontrolü
 * - `GET /__kopru/scenarios` — eklentiler ve senaryoları
 * - `GET /__kopru/requests` — istek kaydı
 * - `DELETE /__kopru/requests` — istek kaydını temizler
 *
 * @throws {ConfigurationError} Eklentiler geçersizse veya çakışıyorsa
 */
export function createMockApp(options: MockAppOptions): MockApp {
  const { plugins, onRequest } = options;
  assertUniquePlugins(plugins);

  const requestLog = options.requestLog ?? createRequestLog();
  const context: MockPluginContext = { baseUrl: options.baseUrl ?? (() => DEFAULT_BASE_URL) };
  const app = new Hono();

  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    if (url.pathname === ADMIN_PATH_PREFIX || url.pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)) {
      await next();
      return;
    }

    const body = await c.req.raw.clone().text();
    await next();

    const entry = requestLog.record({
      plugin: findPluginForPath(plugins, url.pathname)?.name ?? null,
      method: c.req.method,
      path: url.pathname,
      query: redactRecord(Object.fromEntries(url.searchParams)),
      headers: redactHeaders(Object.fromEntries(c.req.raw.headers)),
      body: body === '' ? '' : redactText(body),
      status: c.res.status,
    });
    onRequest?.(entry);
  });

  app.get(`${ADMIN_PATH_PREFIX}/health`, (c) => c.json({ status: 'ok' }));
  app.get(`${ADMIN_PATH_PREFIX}/scenarios`, (c) =>
    c.json(
      plugins.map(({ name, basePath, description, scenarios }) => ({
        name,
        basePath,
        description,
        scenarios,
      })),
    ),
  );
  app.get(`${ADMIN_PATH_PREFIX}/requests`, (c) => c.json(requestLog.list()));
  app.delete(`${ADMIN_PATH_PREFIX}/requests`, (c) => {
    requestLog.clear();
    return c.body(null, 204);
  });

  for (const plugin of plugins) {
    const pluginApp = new Hono();
    plugin.register(pluginApp, context);
    app.route(plugin.basePath, pluginApp);
  }

  app.notFound((c) =>
    c.json(
      { error: 'MOCK_ROUTE_NOT_FOUND', message: `No mock route for ${c.req.method} ${c.req.path}` },
      404,
    ),
  );
  app.onError((error, c) =>
    c.json({ error: 'MOCK_INTERNAL_ERROR', message: redactText(error.message) }, 500),
  );

  return { app, requestLog };
}

/**
 * Sorgu parametrelerini, gövde metniyle aynı kurallarla (anahtar ve kart/TCKN
 * görünümlü değerler) maskeler.
 */
function redactRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  const params = new URLSearchParams(record);
  return Object.fromEntries(new URLSearchParams(redactText(params.toString())));
}
