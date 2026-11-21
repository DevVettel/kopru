import { ConfigurationError } from '@kopru/core';
import { afterEach, describe, expect, inject, it } from 'vitest';
import {
  BUILTIN_PLUGINS,
  createMockServerClient,
  defineMockPlugin,
  startMockServer,
  type RunningMockServer,
} from '../src/index.js';

describe('startMockServer', () => {
  const started: RunningMockServer[] = [];
  const start = async (...args: Parameters<typeof startMockServer>): Promise<RunningMockServer> => {
    const server = await startMockServer(...args);
    started.push(server);
    return server;
  };

  afterEach(async () => {
    await Promise.all(started.splice(0).map((server) => server.stop()));
  });

  it('boş bir portta başlar, echo senaryosuna yanıt verir ve durdurulur', async () => {
    const server = await start();
    expect(server.url).toBe(`http://127.0.0.1:${String(server.port)}`);
    expect(server.port).toBeGreaterThan(0);
    expect(server.plugins).toBe(BUILTIN_PLUGINS);

    const response = await fetch(`${server.url}/echo/ping`, { method: 'POST', body: 'pong' });
    expect(await response.json()).toMatchObject({ path: '/echo/ping', body: 'pong' });
    expect(server.requests.last({ plugin: 'echo' })?.body).toBe('pong');

    await server.stop();
    await expect(fetch(`${server.url}/__kopru/health`)).rejects.toThrow();
    await server.stop(); // İkinci çağrı güvenlidir.
  });

  it('eklentiye gerçek sunucu adresini verir', async () => {
    const plugin = defineMockPlugin({
      name: 'base',
      basePath: '/base',
      description: 'Adres testi',
      scenarios: [],
      register: (app, context) => app.get('/', (c) => c.text(context.baseUrl())),
    });
    const server = await start({ plugins: [plugin] });
    expect(await (await fetch(`${server.url}/base`)).text()).toBe(server.url);
  });

  it('durdurulurken bekleyen gecikmeli istekleri kapatır', async () => {
    const server = await start();
    const pending = fetch(`${server.url}/echo/delay/30000`);
    // İstek sunucuya ulaşıp bekleme moduna girene kadar bekle.
    await expect.poll(() => fetch(`${server.url}/__kopru/health`).then((r) => r.ok)).toBe(true);
    const stopping = server.stop();
    await expect(pending).rejects.toThrow();
    await stopping;
  });

  it('onRequest kancasını çağırır ve kayıt sınırını uygular', async () => {
    const seen: string[] = [];
    const server = await start({ requestLogLimit: 1, onRequest: (entry) => seen.push(entry.path) });
    await fetch(`${server.url}/echo/1`);
    await fetch(`${server.url}/echo/2`);
    expect(seen).toEqual(['/echo/1', '/echo/2']);
    expect(server.requests.list().map((entry) => entry.path)).toEqual(['/echo/2']);
  });

  it.each([
    { port: -1 },
    { port: 70_000 },
    { port: 1.5 },
    { hostname: '' },
    { requestLogLimit: 0 },
  ])('geçersiz seçenekleri reddeder: %o', async (options) => {
    await expect(startMockServer(options)).rejects.toThrow(ConfigurationError);
  });

  it('kullanılan portta ConfigurationError fırlatır', async () => {
    const server = await start();
    await expect(startMockServer({ port: server.port })).rejects.toThrow(/could not listen/);
  });

  it('IPv6 adresini köşeli parantezle biçimlendirir', async () => {
    let server: RunningMockServer;
    try {
      server = await start({ hostname: '::1' });
    } catch {
      return; // IPv6 desteklemeyen ortam (bazı CI konteynerleri).
    }
    expect(server.url).toBe(`http://[::1]:${String(server.port)}`);
  });
});

describe('globalSetup ile başlatılan sunucu', () => {
  const url = inject('mockServerUrl');
  const client = createMockServerClient(`${url}/`);

  it('istek kaydı ve senaryolar yönetim istemcisiyle sorgulanabilir', async () => {
    await client.clearRequests();
    await fetch(`${url}/echo/orders?id=1`, { method: 'POST', body: '{"cvc":"123"}' });
    await fetch(`${url}/echo/other`);

    const posts = await client.requests({ method: 'POST', path: '/echo/orders' });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      plugin: 'echo',
      query: { id: '1' },
      body: '{"cvc":"[REDACTED]"}',
    });
    expect(await client.requests()).toHaveLength(2);

    const plugins = await client.scenarios();
    expect(plugins.map((plugin) => plugin.name)).toEqual(['echo', 'iyzico']);

    await client.clearRequests();
    expect(await client.requests()).toEqual([]);
  });
});

describe('createMockServerClient', () => {
  it('başarısız yanıtı ProviderError olarak fırlatır', async () => {
    const client = createMockServerClient('http://mock', () =>
      Promise.resolve(new Response('no', { status: 500 })),
    );
    await expect(client.requests()).rejects.toMatchObject({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      message: 'Mock server GET /requests failed with HTTP 500',
    });
  });

  it('beklenmeyen gövdeyi ProviderError olarak fırlatır', async () => {
    const client = createMockServerClient('http://mock', () =>
      Promise.resolve(Response.json([{ id: 'x' }])),
    );
    await expect(client.scenarios()).rejects.toMatchObject({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
    });
  });
});
