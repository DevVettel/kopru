import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CargoError,
  ConfigurationError,
  ERROR_CATALOG,
  ERROR_CODES,
  KopruError,
  KopruErrorJSONSchema,
  NetworkError,
  PaymentError,
  ProviderError,
  ValidationError,
  createKopruError,
  formatIssuePath,
  fromZodError,
  isErrorCodeOf,
  isKopruError,
  validate,
} from '../src/index.js';

describe('hata kataloğu', () => {
  it('her kod DOMAIN_MEANING formatındadır ve katalogda kaydı vardır', () => {
    for (const code of ERROR_CODES) {
      expect(code).toMatch(/^[A-Z]+(_[A-Z]+)+$/);
      expect(ERROR_CATALOG[code].userMessage.length).toBeGreaterThan(0);
    }
  });
});

describe('KopruError', () => {
  it('kategori, varsayılan userMessage ve retryable değerlerini katalogdan alır', () => {
    const error = new KopruError({ code: 'NETWORK_TIMEOUT', message: 'Request timed out' });
    expect(error).toBeInstanceOf(Error);
    expect(error.category).toBe('network');
    expect(error.retryable).toBe(true);
    expect(error.userMessage).toBe(ERROR_CATALOG.NETWORK_TIMEOUT.userMessage);
    expect(error.name).toBe('KopruError');
    expect('cause' in error).toBe(false);
  });

  it('verilen değerler katalog varsayılanlarını ezer ve cause korunur', () => {
    const cause = new Error('socket hang up');
    const error = new PaymentError({
      code: 'PAYMENT_CARD_DECLINED',
      message: 'Card declined',
      userMessage: 'Özel mesaj',
      retryable: true,
      provider: 'acme',
      providerCode: '10051',
      providerMessage: 'Not sufficient funds',
      details: { attempt: 1 },
      cause,
    });
    expect(error.userMessage).toBe('Özel mesaj');
    expect(error.retryable).toBe(true);
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('PaymentError');
  });

  it('toJSON() şemaya uygun çıktı üretir, cause ve stack içermez', () => {
    const error = new ProviderError({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      message: 'Unexpected response',
      provider: 'acme',
      providerCode: 'X1',
      providerMessage: 'weird',
      details: { status: 500 },
      cause: new Error('inner'),
    });
    const json = error.toJSON();
    expect(KopruErrorJSONSchema.parse(json)).toEqual(json);
    expect(json).toEqual({
      name: 'ProviderError',
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      category: 'provider',
      message: 'Unexpected response',
      userMessage: ERROR_CATALOG.PROVIDER_UNEXPECTED_RESPONSE.userMessage,
      retryable: false,
      provider: 'acme',
      providerCode: 'X1',
      providerMessage: 'weird',
      details: { status: 500 },
    });
    expect(JSON.parse(JSON.stringify(error))).toEqual(json);
  });

  it('toJSON() tanımsız opsiyonel alanları dahil etmez', () => {
    expect(Object.keys(new ConfigurationError({ message: 'missing apiKey' }).toJSON())).toEqual([
      'name',
      'code',
      'category',
      'message',
      'userMessage',
      'retryable',
    ]);
  });

  it('ValidationError ve ConfigurationError varsayılan kod kullanır', () => {
    expect(new ValidationError({ message: 'bad' }).code).toBe('VALIDATION_FAILED');
    expect(new ConfigurationError({ message: 'bad' }).code).toBe('CONFIG_INVALID');
  });

  it('alt sınıflar doğru isim ve kategoriye sahiptir', () => {
    expect(new CargoError({ code: 'CARGO_SHIPMENT_NOT_FOUND', message: 'x' }).category).toBe(
      'cargo',
    );
    expect(new NetworkError({ code: 'NETWORK_CONNECTION_FAILED', message: 'x' }).name).toBe(
      'NetworkError',
    );
  });

  it('createKopruError() koda göre doğru alt sınıfı seçer', () => {
    const cases = [
      ['VALIDATION_FAILED', ValidationError],
      ['CONFIG_INVALID', ConfigurationError],
      ['PAYMENT_INSUFFICIENT_FUNDS', PaymentError],
      ['CARGO_ADDRESS_INVALID', CargoError],
      ['PROVIDER_UNAVAILABLE', ProviderError],
      ['NETWORK_TIMEOUT', NetworkError],
    ] as const;
    for (const [code, ErrorClass] of cases) {
      const error = createKopruError({ code, message: 'x' });
      expect(error).toBeInstanceOf(ErrorClass);
      expect(error.code).toBe(code);
    }
  });

  it('isErrorCodeOf() ve isKopruError() doğru çalışır', () => {
    expect(isErrorCodeOf('PAYMENT_CARD_DECLINED', 'payment')).toBe(true);
    expect(isErrorCodeOf('PAYMENT_CARD_DECLINED', 'cargo')).toBe(false);
    expect(isKopruError(new ValidationError({ message: 'x' }))).toBe(true);
    expect(isKopruError(new Error('x'))).toBe(false);
  });
});

describe('fromZodError / validate', () => {
  const Schema = z.object({
    items: z.array(z.object({ price: z.number() })),
    name: z.string(),
  });

  it('issue yollarını okunabilir biçimde formatlar', () => {
    expect(formatIssuePath([])).toBe('');
    expect(formatIssuePath(['items', 0, 'price'])).toBe('items[0].price');
    expect(formatIssuePath([Symbol('s')])).toBe('Symbol(s)');
  });

  it('ZodError → ValidationError dönüşümü issue listesini korur', () => {
    const parsed = Schema.safeParse({ items: [{ price: 'x' }], name: 1 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const error = fromZodError(parsed.error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.cause).toBe(parsed.error);
    expect(error.details).toEqual({
      issues: [
        expect.objectContaining({ path: 'items[0].price', code: 'invalid_type' }),
        expect.objectContaining({ path: 'name', code: 'invalid_type' }),
      ],
    });
    expect(error.message).toContain('items[0].price');
  });

  it('kök seviyesindeki issue mesajı yol olmadan özetlenir', () => {
    const parsed = z.string().safeParse(1);
    if (parsed.success) throw new Error('expected failure');
    const error = fromZodError(parsed.error, { userMessage: 'Hatalı giriş' });
    expect(error.message).toBe(`Validation failed: ${parsed.error.issues[0]?.message ?? ''}`);
    expect(error.userMessage).toBe('Hatalı giriş');
  });

  it('validate() Result döner', () => {
    expect(validate(Schema, { items: [], name: 'a' })).toEqual({
      ok: true,
      value: { items: [], name: 'a' },
    });
    const failed = validate(Schema, null, { message: 'Custom' });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.message).toBe('Custom');
  });
});
