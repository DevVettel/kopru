import {
  createHttpClient,
  err,
  NetworkError,
  ok,
  type HttpRequest,
  type HttpResponse,
  type ProviderContext,
} from '@kopru/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { YurticiConfigSchema } from '../src/config.js';
import { buildYurticiEnvelope, callYurtici } from '../src/soap.js';

const config = YurticiConfigSchema.parse({
  username: 'USER',
  password: 'super-secret',
  baseUrl: 'https://yurtici.test',
});

function context(
  response: HttpResponse | NetworkError,
): ProviderContext & { requests: HttpRequest[] } {
  const requests: HttpRequest[] = [];
  return {
    requests,
    signal: undefined,
    now: () => new Date('2026-11-22T10:00:00Z'),
    http: {
      request(request) {
        requests.push(request);
        return Promise.resolve(response instanceof NetworkError ? err(response) : ok(response));
      },
    },
  };
}

const xml = (body: string) =>
  `<?xml version="1.0"?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body>${body}</S:Body></S:Envelope>`;

const call = {
  operation: 'queryShipment',
  fields: { keys: 'S-1' },
  responseSchema: z.object({ outFlag: z.string() }),
} as const;

describe('buildYurticiEnvelope', () => {
  it('puts credentials and the operation-specific language field in the body', () => {
    const query = buildYurticiEnvelope(config, 'queryShipment', { keys: 'S-1' });
    expect(query).toContain(
      'xmlns:ship="http://yurticikargo.com.tr/ShippingOrderDispatcherServices"',
    );
    expect(query).toContain(
      '<ship:queryShipment><wsUserName>USER</wsUserName><wsPassword>super-secret</wsPassword><wsLanguage>TR</wsLanguage><keys>S-1</keys></ship:queryShipment>',
    );
    expect(buildYurticiEnvelope(config, 'cancelShipment', {})).toContain(
      '<userLanguage>TR</userLanguage>',
    );
  });
});

describe('callYurtici', () => {
  it('posts a SOAP 1.1 request and parses the operation response', async () => {
    const ctx = context({
      status: 200,
      headers: {},
      body: xml(
        '<ns2:queryShipmentResponse xmlns:ns2="urn:x"><outFlag>0</outFlag></ns2:queryShipmentResponse>',
      ),
    });
    const result = await callYurtici(config, ctx, { ...call, idempotent: true });
    expect(result).toEqual({ ok: true, value: { outFlag: '0' } });
    expect(ctx.requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://yurtici.test/KOPSWebServices/ShippingOrderDispatcherServices',
      idempotent: true,
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
    });
  });

  it('passes network errors through', async () => {
    const error = new NetworkError({ code: 'NETWORK_TIMEOUT', message: 'timeout' });
    const result = await callYurtici(config, context(error), call);
    expect(result).toEqual({ ok: false, error });
  });

  it('maps SOAP faults, non-XML 5xx responses and schema mismatches', async () => {
    const fault = await callYurtici(
      config,
      context({
        status: 500,
        headers: {},
        body: xml(
          '<S:Fault><faultcode>S:Server</faultcode><faultstring>Hatalı şifre</faultstring></S:Fault>',
        ),
      }),
      call,
    );
    expect(fault.ok || fault.error).toMatchObject({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      provider: 'yurtici',
      providerCode: 'S:Server',
      providerMessage: 'Hatalı şifre',
    });

    const unavailable = await callYurtici(
      config,
      context({ status: 503, headers: {}, body: '<html>Service Unavailable' }),
      call,
    );
    expect(unavailable.ok || unavailable.error.code).toBe('PROVIDER_UNAVAILABLE');

    const html = await callYurtici(config, context({ status: 200, headers: {}, body: 'OK' }), call);
    expect(html.ok || html.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');

    const mismatch = await callYurtici(
      config,
      context({ status: 200, headers: {}, body: xml('<createShipmentResponse/>') }),
      call,
    );
    expect(mismatch.ok || mismatch.error.details).toHaveProperty('issues');
  });

  it('never logs the web service password', async () => {
    const logs: string[] = [];
    const http = createHttpClient({
      retry: { retries: 0 },
      fetch: () => Promise.resolve(new Response('not xml', { status: 200 })),
      hooks: { onRequest: (event) => logs.push(event.body ?? '') },
    });
    await callYurtici(config, { http, signal: undefined, now: () => new Date() }, call);
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toContain('super-secret');
    expect(logs[0]).toContain('<wsPassword>[REDACTED]</wsPassword>');
  });
});
