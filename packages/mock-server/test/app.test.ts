import { describe, expect, it, vi } from 'vitest';
import { createMockApp, defineMockPlugin, echoPlugin, type RecordedRequest } from '../src/index.js';

const VALID_CARD = '5528790000000008';

const contextPlugin = defineMockPlugin({
  name: 'context',
  basePath: '/context',
  description: 'Bağlamı test eden eklenti',
  scenarios: [],
  register: (app, context) => {
    app.get('/base-url', (c) => c.json({ baseUrl: context.baseUrl() }));
    app.get('/boom', () => {
      throw new Error(`boom ${VALID_CARD}`);
    });
  },
});

describe('createMockApp', () => {
  it("eklenti route'larını basePath altına bağlar", async () => {
    const { app } = createMockApp({ plugins: [echoPlugin] });
    const response = await app.request('/echo/hello?x=1', { method: 'POST', body: 'hi' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      method: 'POST',
      path: '/echo/hello',
      query: { x: '1' },
      body: 'hi',
    });
  });

  it('eşleşmeyen route için 404 döner ve isteği plugin=null ile kaydeder', async () => {
    const { app, requestLog } = createMockApp({ plugins: [echoPlugin] });
    const response = await app.request('/unknown');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'MOCK_ROUTE_NOT_FOUND',
      message: 'No mock route for GET /unknown',
    });
    expect(requestLog.last()).toMatchObject({ plugin: null, path: '/unknown', status: 404 });
  });

  it('istekleri maskeleyerek kaydeder ve onRequest kancasını çağırır', async () => {
    const onRequest = vi.fn<(entry: RecordedRequest) => void>();
    const { app, requestLog } = createMockApp({ plugins: [echoPlugin], onRequest });

    await app.request(`/echo/pay?cardNumber=${VALID_CARD}&order=7`, {
      method: 'POST',
      headers: { authorization: 'IYZWSv2 secret', 'content-type': 'application/json' },
      body: JSON.stringify({ card: { number: VALID_CARD, cvc: '123' }, price: '10.0' }),
    });

    const entry = requestLog.last();
    expect(entry).toMatchObject({ plugin: 'echo', method: 'POST', path: '/echo/pay', status: 200 });
    expect(entry?.query).toEqual({ cardNumber: '[REDACTED]', order: '7' });
    expect(entry?.headers.authorization).toBe('[REDACTED]');
    expect(entry?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(entry?.body ?? '')).toEqual({
      card: { number: '[REDACTED]', cvc: '[REDACTED]' },
      price: '10.0',
    });
    expect(JSON.stringify(requestLog.list())).not.toContain(VALID_CARD);
    expect(onRequest).toHaveBeenCalledWith(entry);
  });

  it('gövdesiz isteği boş gövdeyle kaydeder', async () => {
    const { app, requestLog } = createMockApp({ plugins: [echoPlugin] });
    await app.request('/echo/x');
    expect(requestLog.last()?.body).toBe('');
  });

  it('yönetim uç noktalarını kaydetmez', async () => {
    const { app, requestLog } = createMockApp({ plugins: [echoPlugin] });
    await app.request('/echo/a');

    expect(await (await app.request('/__kopru/health')).json()).toEqual({ status: 'ok' });
    const listed: unknown = await (await app.request('/__kopru/requests')).json();
    expect(listed).toHaveLength(1);

    const scenarios: unknown = await (await app.request('/__kopru/scenarios')).json();
    expect(scenarios).toEqual([
      {
        name: 'echo',
        basePath: '/echo',
        description: echoPlugin.description,
        scenarios: echoPlugin.scenarios,
      },
    ]);

    const cleared = await app.request('/__kopru/requests', { method: 'DELETE' });
    expect(cleared.status).toBe(204);
    expect(requestLog.list()).toEqual([]);
  });

  it('eklentiye baseUrl bağlamını verir', async () => {
    const withDefault = createMockApp({ plugins: [contextPlugin] });
    expect(await (await withDefault.app.request('/context/base-url')).json()).toEqual({
      baseUrl: 'http://localhost',
    });

    const custom = createMockApp({ plugins: [contextPlugin], baseUrl: () => 'http://mock:1' });
    expect(await (await custom.app.request('/context/base-url')).json()).toEqual({
      baseUrl: 'http://mock:1',
    });
  });

  it('eklenti hatasını maskelenmiş 500 yanıtına çevirir', async () => {
    const { app, requestLog } = createMockApp({ plugins: [contextPlugin] });
    const response = await app.request('/context/boom');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'MOCK_INTERNAL_ERROR',
      message: 'boom ****0008',
    });
    expect(requestLog.last()?.status).toBe(500);
  });

  it('çakışan eklentileri reddeder', () => {
    expect(() => createMockApp({ plugins: [echoPlugin, echoPlugin] })).toThrow(/Duplicate/);
  });
});

describe('echoPlugin', () => {
  const { app } = createMockApp({ plugins: [echoPlugin] });

  it('istenen durum koduyla yanıt verir', async () => {
    const response = await app.request('/echo/status/503');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 503 });
  });

  it.each(['abc', '199', '600', '204'])('geçersiz durum kodunu reddeder: %s', async (code) => {
    const response = await app.request(`/echo/status/${code}`);
    expect(response.status).toBe(400);
  });

  it('yanıtı geciktirir', async () => {
    const response = await app.request('/echo/delay/5');
    expect(await response.json()).toEqual({ delayedMs: 5 });
  });

  it.each(['-1', '30001', 'x'])('geçersiz gecikmeyi reddeder: %s', async (ms) => {
    expect((await app.request(`/echo/delay/${ms}`)).status).toBe(400);
  });

  it('3DS sayfası callback adresine form-post yapar', async () => {
    const response = await app.request(
      '/echo/3ds?callbackUrl=http%3A%2F%2Fshop.test%2Fcb&status=failure',
    );
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('action="http://shop.test/cb"');
    expect(html).toContain('name="status" value="failure"');
  });

  it('3DS sayfası varsayılan olarak başarı döner', async () => {
    const html = await (
      await app.request('/echo/3ds?callbackUrl=http%3A%2F%2Fshop.test%2Fcb')
    ).text();
    expect(html).toContain('name="status" value="success"');
  });

  it.each(['', '?callbackUrl=nope'])('callbackUrl geçersizse 400 döner: %s', async (query) => {
    expect((await app.request(`/echo/3ds${query}`)).status).toBe(400);
  });
});
