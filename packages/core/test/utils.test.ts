import { describe, expect, it } from 'vitest';
import {
  DateTimeSchema,
  base64Decode,
  base64Encode,
  buildSoapEnvelope,
  buildXml,
  formatIstanbulDateTime,
  hash,
  hmac,
  parseSoapEnvelope,
  parseXml,
  randomHex,
  safeEqual,
} from '../src/index.js';

describe('crypto', () => {
  it('bilinen test vektörleriyle hash ve HMAC üretir', () => {
    expect(hash('sha256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hash('sha1', 'abc', 'base64')).toBe('qZk+NkcGgWq6PiVxeFDCbJzQ2J0=');
    // RFC 4231 test case 2
    expect(hmac('sha256', 'Jefe', 'what do ya want for nothing?')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
    expect(hmac('sha512', 'k', 'd', 'base64')).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('Base64 dönüşümü UTF-8 karakterleri korur', () => {
    expect(base64Encode('Köprü')).toBe('S8O2cHLDvA==');
    expect(base64Decode('S8O2cHLDvA==')).toBe('Köprü');
  });

  it('randomHex istenen uzunlukta üretir', () => {
    expect(randomHex()).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex(4)).toHaveLength(8);
  });

  it('safeEqual sabit sürede karşılaştırır', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('date', () => {
  it('anı Europe/Istanbul saatine ve +03:00 farkıyla çevirir', () => {
    expect(formatIstanbulDateTime(new Date('2026-11-18T10:00:00Z'))).toBe(
      '2026-11-18T13:00:00+03:00',
    );
    expect(formatIstanbulDateTime(new Date('2026-12-31T22:30:15.999Z'))).toBe(
      '2027-01-01T01:30:15+03:00',
    );
  });

  it('DateTimeSchema saat dilimi farkı zorunlu tutar', () => {
    expect(DateTimeSchema.safeParse('2026-11-18T13:00:00+03:00').success).toBe(true);
    expect(DateTimeSchema.safeParse('2026-11-18T10:00:00Z').success).toBe(true);
    expect(DateTimeSchema.safeParse('2026-11-18T13:00:00').success).toBe(false);
  });
});

describe('xml', () => {
  it('XML’i metin değerleriyle ve namespace’siz çözer', () => {
    const result = parseXml(
      '<ns:Root xmlns:ns="urn:x"><ns:Tracking id="7">0012345</ns:Tracking><Empty/></ns:Root>',
    );
    expect(result).toEqual({
      ok: true,
      value: {
        Root: { Tracking: { '#text': '0012345', '@_id': '7' }, Empty: '' },
      },
    });
  });

  it('XML olmayan veya bozuk girdiyi PROVIDER_UNEXPECTED_RESPONSE ile reddeder', () => {
    for (const input of ['not xml', '', '<a><b></a>', '<?xml version="1.0"?>']) {
      const result = parseXml(input);
      expect(result.ok, input).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
    }
  });

  it('buildXml öznitelikleri yazar ve değerleri kaçışlar', () => {
    expect(buildXml({ a: { '@_id': '1', b: 'x < y & z' } })).toBe(
      '<a id="1"><b>x &lt; y &amp; z</b></a>',
    );
  });

  it('SOAP zarfını oluşturur ve geri çözer', () => {
    const xml = buildSoapEnvelope({
      namespaces: { ws: 'http://ws.example/' },
      header: { 'ws:Auth': { 'ws:User': 'u' } },
      body: { 'ws:Track': { 'ws:key': 'SHP-1' } },
    });
    expect(xml).toContain('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"');
    expect(xml).toContain('xmlns:ws="http://ws.example/"');
    expect(parseSoapEnvelope(xml)).toEqual({
      ok: true,
      value: { body: { Track: { key: 'SHP-1' } }, header: { Auth: { User: 'u' } } },
    });

    const soap12 = buildSoapEnvelope({ version: '1.2', body: { Ping: '' } });
    expect(soap12).toContain('http://www.w3.org/2003/05/soap-envelope');
    expect(parseSoapEnvelope(soap12)).toEqual({
      ok: true,
      value: { body: { Ping: '' }, header: undefined },
    });
  });

  it('SOAP 1.1 fault bilgisini ProviderError olarak korur', () => {
    const result = parseSoapEnvelope(
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>Invalid user</faultstring></s:Fault></s:Body></s:Envelope>',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
      expect(result.error.providerCode).toBe('s:Client');
      expect(result.error.providerMessage).toBe('Invalid user');
    }
  });

  it('SOAP 1.2 fault bilgisini okur; bilinmeyen fault yapısını da kabul eder', () => {
    const result = parseSoapEnvelope(
      '<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"><env:Body><env:Fault><env:Code><env:Value>env:Sender</env:Value></env:Code><env:Reason><env:Text xml:lang="tr">Hatalı</env:Text></env:Reason></env:Fault></env:Body></env:Envelope>',
    );
    expect(!result.ok && result.error.providerCode).toBe('env:Sender');
    expect(!result.ok && result.error.providerMessage).toBe('Hatalı');

    const bare = parseSoapEnvelope('<Envelope><Body><Fault><x>1</x></Fault></Body></Envelope>');
    expect(!bare.ok && bare.error.message).toBe('SOAP fault: unknown reason');
    expect(!bare.ok && bare.error.providerCode).toBeUndefined();
  });

  it('SOAP olmayan XML’i reddeder', () => {
    expect(parseSoapEnvelope('<Root/>').ok).toBe(false);
    expect(parseSoapEnvelope('<Envelope><Header/></Envelope>').ok).toBe(false);
    expect(parseSoapEnvelope('bozuk').ok).toBe(false);
  });
});
