/**
 * @packageDocumentation
 * Köprü mock server'ı. Sağlayıcı HTTP API'lerini deterministik senaryolarla
 * taklit eder; entegrasyon testleri gerçek sağlayıcılar yerine buna karşı çalışır.
 */

/** Paketin npm üzerindeki adı. */
export const PACKAGE_NAME = '@kopru/mock-server';

export {
  ADMIN_PATH_PREFIX,
  ScenarioDescriptorSchema,
  defineMockPlugin,
  type MockPlugin,
  type MockPluginContext,
  type ScenarioDescriptor,
} from './plugin.js';

export {
  DEFAULT_REQUEST_LOG_LIMIT,
  RecordedRequestSchema,
  createRequestLog,
  matchesFilter,
  type RecordedRequest,
  type RequestFilter,
  type RequestLog,
  type WritableRequestLog,
} from './request-log.js';

export {
  AutoPostPageOptionsSchema,
  escapeHtml,
  renderAutoPostPage,
  type AutoPostPageOptions,
} from './three-ds.js';

export { createMockApp, type MockApp, type MockAppOptions } from './app.js';

export {
  DEFAULT_MOCK_HOSTNAME,
  MockServerOptionsSchema,
  startMockServer,
  type MockServerOptions,
  type RunningMockServer,
} from './server.js';

export {
  PluginInfoSchema,
  createMockServerClient,
  type MockServerClient,
  type PluginInfo,
} from './client.js';

export * from './plugins/index.js';
