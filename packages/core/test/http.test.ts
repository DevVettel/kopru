import { describe, expect, it, vi } from 'vitest';
import {
  REDACTED,
  createHttpClient,
  redact,
  redactHeaders,
  redactSensitiveNumbers,
  redactText,
  redactUrl,
  type HttpRequestLogEvent,
  type HttpResponseLogEvent,
} from '../src/index.js';

const PAN = '4111111111111111';
const TCKN = '10000000146';

describe('redact', () => {
  it('hassas anahtarları ve metin içindeki kart/TCKN numaralarını maskeler', () => {
    const input = {
      card: { number: PAN, cvc: '123', holderName: 'Test' },
      api_key: 'k',
      'Secret-Key': 's',
      buyer: { identityNumber: TCKN, note: `kart ${PAN} tckn ${TCKN}` },
      list: [{ password: 'p' }, 42, null],
    };
    expect(redact(input)).toEqual({
      card: { number: REDACTED, cvc: REDACTED, holderName: 'Test' },
      api_key: REDACTED,
      'Secret-Key': REDACTED,
      buyer: { identityNumber: REDACTED, note: `kart ****1111 tckn ${REDACTED}` },
      list: [{ password: REDACTED }, 42, null],
    });
    expect(input.card.number).toBe(PAN);
  });

  it('ek anahtarları destekler', () => {
    expect(redact({ merchantPass: 'x' }, { extraKeys: ['merchant_pass'] })).toEqual({
      merchantPass: REDACTED,
    });
  });

  it('Luhn geçersiz uzun sayıları ve geçersiz TCKN benzeri sayıları maskelemez', () => {
    expect(redactSensitiveNumbers('order 4111111111111112 id 12345678901')).toBe(
      'order 4111111111111112 id 12345678901',
    );
  });

  it('JSON gövdeyi yapısal olarak maskeler', () => {
    expect(JSON.parse(redactText(JSON.stringify({ cvc: '123', ok: true })))).toEqual({
      cvc: REDACTED,
      ok: true,
    });
  });

  it('XML etiketlerini ve form alanlarını maskeler', () => {
    expect(redactText('<ns:Password attr="1">gizli</ns:Password><Name>Ali</Name>')).toBe(
      `<ns:Password attr="1">${REDACTED}</ns:Password><Name>Ali</Name>`,
    );
    expect(redactText(`cvc=123&amount=10&pan=${PAN}`)).toBe(
      `cvc=${REDACTED}&amount=10&pan=${REDACTED}`,
    );
    expect(redactText('"plain"')).toBe('"plain"');
  });

  it('başlıkları ve URL sorgu parametrelerini maskeler', () => {
    expect(redactHeaders({ Authorization: 'Bearer x', 'Content-Type': 'a' })).toEqual({
      Authorization: REDACTED,
      'Content-Type': 'a',
    });
    expect(redactUrl('https://api.example/pay?apiKey=abc&x=1')).toBe(
      'https://api.example/pay?apiKey=%5BREDACTED%5D&x=1',
    );
    expect(redactUrl('/relative?token=abc')).toBe(`/relative?token=${REDACTED}`);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createHttpClient', () => {
  it('yanıtı döner ve maskelenmiş log kancalarını çağırır', async () => {
    const requests: HttpRequestLogEvent[] = [];
    const responses: HttpResponseLogEvent[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(jsonResponse(200, { cardNumber: PAN })),
    );
    const http = createHttpClient({
      fetch,
      hooks: {
        onRequest: (e) => requests.push(e),
        onResponse: (e) => responses.push(e),
      },
    });

    const result = await http.request({
      method: 'POST',
      url: 'https://api.example/charge',
      headers: { Authorization: 'secret' },
      body: JSON.stringify({ cvc: '123' }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe(200);
      expect(result.value.headers['content-type']).toBe('application/json');
      expect(JSON.parse(result.value.body)).toEqual({ cardNumber: PAN });
    }
    expect(requests[0]?.headers).toEqual({ Authorization: REDACTED });
    expect(requests[0]?.body).toBe(JSON.stringify({ cvc: REDACTED }));
    expect(responses[0]?.status).toBe(200);
    expect(responses[0]?.body).toBe(JSON.stringify({ cardNumber: REDACTED }));
  });

  it('log kancasındaki hata isteği bozmaz', async () => {
    const http = createHttpClient({
      fetch: () => Promise.resolve(new Response('ok')),
      hooks: {
        onRequest: () => {
          throw new Error('hook failure');
        },
      },
    });
    const result = await http.request({ method: 'GET', url: 'https://api.example' });
    expect(result.ok).toBe(true);
  });

  it('idempotent isteği 5xx yanıtında yeniden dener', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const http = createHttpClient({ fetch, sleep, retry: { baseDelayMs: 100 } });

    const result = await http.request({ method: 'GET', url: 'https://api.example' });
    expect(result.ok && result.value.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it('idempotent olmayan isteği (POST) yeniden denemez', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    const http = createHttpClient({ fetch, sleep: () => Promise.resolve() });

    const result = await http.request({ method: 'POST', url: 'https://api.example', body: '{}' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_CONNECTION_FAILED');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('idempotent: true verilen POST isteğini yeniden dener ve deneme sayısını sınırlar', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const http = createHttpClient({
      fetch,
      sleep,
      retry: { retries: 3, baseDelayMs: 100, maxDelayMs: 250 },
    });

    await http.request({ method: 'POST', url: 'https://api.example', idempotent: true });
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200, 250]);
  });

  it('zaman aşımında NETWORK_TIMEOUT döner', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const http = createHttpClient({ fetch, timeoutMs: 10 });

    const result = await http.request({ method: 'POST', url: 'https://api.example' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_TIMEOUT');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('çağıran tarafından iptal edilen istek tekrar denenmez', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn<typeof globalThis.fetch>((_url, init) =>
      init?.signal?.aborted === true
        ? Promise.reject(new DOMException('aborted', 'AbortError'))
        : Promise.resolve(new Response('')),
    );
    const http = createHttpClient({ fetch, sleep: () => Promise.resolve() });

    const result = await http.request({
      method: 'GET',
      url: 'https://api.example',
      signal: controller.signal,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK_CONNECTION_FAILED');
      expect(result.error.retryable).toBe(false);
    }
  });

  it('varsayılan olarak global fetch ve gerçek bekleme kullanır', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(new Response('done'));
    const http = createHttpClient({ retry: { baseDelayMs: 1 } });
    const result = await http.request({ method: 'GET', url: 'https://api.example' });
    expect(result.ok && result.value.body).toBe('done');
    spy.mockRestore();
  });
});
