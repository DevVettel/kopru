import { ProviderError, validate } from '@kopru/core';
import { z } from 'zod';
import { ScenarioDescriptorSchema } from './plugin.js';
import { ADMIN_PATH_PREFIX } from './plugin.js';
import {
  matchesFilter,
  RecordedRequestSchema,
  type RecordedRequest,
  type RequestFilter,
} from './request-log.js';

/** `GET /__kopru/scenarios` yanıtındaki eklenti kaydı. */
export const PluginInfoSchema = z.object({
  name: z.string(),
  basePath: z.string(),
  description: z.string(),
  scenarios: z.array(ScenarioDescriptorSchema),
});

/** `GET /__kopru/scenarios` yanıtındaki eklenti kaydı. */
export type PluginInfo = z.infer<typeof PluginInfoSchema>;

/**
 * Başka bir süreçte (örn. Vitest `globalSetup`) çalışan mock server'ın yönetim
 * uç noktalarına erişen istemci.
 */
export interface MockServerClient {
  /** İstek kaydını döner; süzgeç verilirse yalnızca uyan kayıtlar. */
  readonly requests: (filter?: RequestFilter) => Promise<readonly RecordedRequest[]>;
  /** İstek kaydını temizler. */
  readonly clearRequests: () => Promise<void>;
  /** Kayıtlı eklentileri ve senaryolarını döner. */
  readonly scenarios: () => Promise<readonly PluginInfo[]>;
}

/**
 * Mock server yönetim istemcisi oluşturur.
 *
 * @param baseUrl - Mock server kök adresi (`RunningMockServer.url`)
 * @param fetchImpl - Testlerde değiştirilebilen `fetch` uygulaması
 */
export function createMockServerClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): MockServerClient {
  const root = baseUrl.replace(/\/+$/, '');

  const call = async <S extends z.ZodType>(
    method: 'GET' | 'DELETE',
    path: string,
    schema: S,
  ): Promise<z.output<S>> => {
    const response = await fetchImpl(`${root}${ADMIN_PATH_PREFIX}${path}`, { method });
    if (!response.ok) {
      throw new ProviderError({
        code: 'PROVIDER_UNEXPECTED_RESPONSE',
        message: `Mock server ${method} ${path} failed with HTTP ${String(response.status)}`,
        provider: 'mock-server',
      });
    }
    const body: unknown = response.status === 204 ? undefined : await response.json();
    const result = validate(schema, body);
    if (!result.ok) {
      throw new ProviderError({
        code: 'PROVIDER_UNEXPECTED_RESPONSE',
        message: `Mock server ${method} ${path} returned an unexpected body: ${result.error.message}`,
        provider: 'mock-server',
        cause: result.error,
      });
    }
    return result.value;
  };

  return {
    requests: async (filter) => {
      const entries = await call('GET', '/requests', z.array(RecordedRequestSchema));
      return filter === undefined
        ? entries
        : entries.filter((entry) => matchesFilter(entry, filter));
    },
    clearRequests: async () => {
      await call('DELETE', '/requests', z.undefined());
    },
    scenarios: () => call('GET', '/scenarios', z.array(PluginInfoSchema)),
  };
}
