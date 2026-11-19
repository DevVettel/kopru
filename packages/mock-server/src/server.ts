import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigurationError, validate } from '@kopru/core';
import { getRequestListener } from '@hono/node-server';
import { z } from 'zod';
import { createMockApp } from './app.js';
import type { MockPlugin } from './plugin.js';
import { BUILTIN_PLUGINS } from './plugins/index.js';
import { createRequestLog, type RecordedRequest, type RequestLog } from './request-log.js';

/** Mock server'ın varsayılan dinleme adresi; yalnızca yerel makineden erişilir. */
export const DEFAULT_MOCK_HOSTNAME = '127.0.0.1';

/** `startMockServer` seçeneklerinin doğrulanan kısmı. */
export const MockServerOptionsSchema = z.object({
  /** Dinlenecek port; `0` işletim sisteminin boş bir port seçmesini sağlar. */
  port: z.number().int().min(0).max(65_535).default(0),
  /** Dinlenecek adres. */
  hostname: z.string().min(1).default(DEFAULT_MOCK_HOSTNAME),
  /** İstek kaydında tutulacak en fazla kayıt sayısı. */
  requestLogLimit: z.number().int().positive().optional(),
});

/** `startMockServer` seçenekleri. */
export type MockServerOptions = z.input<typeof MockServerOptionsSchema> & {
  /** Kaydedilecek eklentiler; verilmezse yerleşik eklentilerin tamamı (`BUILTIN_PLUGINS`). */
  plugins?: readonly MockPlugin[];
  /** Her istek kaydedildikten sonra çağrılır. */
  onRequest?: (entry: RecordedRequest) => void;
};

/** Çalışan mock server. */
export interface RunningMockServer {
  /** Sunucunun kök adresi (örn. `http://127.0.0.1:53124`); sonunda `/` yoktur. */
  readonly url: string;
  /** Sunucunun dinlediği port. */
  readonly port: number;
  /** Sunucunun istek kaydı (aynı süreçten erişim için). */
  readonly requests: RequestLog;
  /** Kayıtlı eklentiler. */
  readonly plugins: readonly MockPlugin[];
  /** Sunucuyu durdurur; açık bağlantılar (örn. gecikmeli yanıtlar) kapatılır. */
  readonly stop: () => Promise<void>;
}

/**
 * Mock server'ı başlatır. Vitest `globalSetup` içinde veya testlerden doğrudan
 * kullanılabilir.
 *
 * @example
 * const server = await startMockServer();
 * const client = createPaymentClient(iyzico({ ..., baseUrl: `${server.url}/iyzico` }));
 * await server.stop();
 *
 * @throws {ConfigurationError} Seçenekler veya eklentiler geçersizse ya da port kullanılamıyorsa
 */
export async function startMockServer(options: MockServerOptions = {}): Promise<RunningMockServer> {
  const parsed = validate(MockServerOptionsSchema, options);
  if (!parsed.ok) {
    throw new ConfigurationError({
      message: `Invalid mock server options: ${parsed.error.message}`,
      cause: parsed.error,
    });
  }
  const { port, hostname, requestLogLimit } = parsed.value;
  const plugins = options.plugins ?? BUILTIN_PLUGINS;

  let url = '';
  const requestLog = createRequestLog(requestLogLimit);
  const { app } = createMockApp({
    plugins,
    requestLog,
    baseUrl: () => url,
    ...(options.onRequest === undefined ? {} : { onRequest: options.onRequest }),
  });

  const listener = getRequestListener(app.fetch);
  // Hata yönetimi Hono'nun `onError` katmanında yapılır; dinleyicinin sözü beklenmez.
  const server = createServer((incoming, outgoing) => {
    void listener(incoming, outgoing);
  });
  const address = await listen(server, port, hostname);
  url = `http://${formatHost(address)}:${String(address.port)}`;

  return {
    url,
    port: address.port,
    requests: requestLog,
    plugins,
    stop: () => close(server),
  };
}

function listen(server: Server, port: number, hostname: string): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(
        new ConfigurationError({
          message: `Mock server could not listen on ${hostname}:${String(port)}: ${error.message}`,
          cause: error,
        }),
      );
    };
    server.once('error', onError);
    server.listen(port, hostname, () => {
      server.off('error', onError);
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new ConfigurationError({ message: 'Mock server did not bind to a TCP address' }));
        return;
      }
      resolve(address);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
    server.closeAllConnections();
  });
}

function formatHost(address: AddressInfo): string {
  return address.family === 'IPv6' ? `[${address.address}]` : address.address;
}
