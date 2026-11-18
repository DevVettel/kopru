import { describe, expect, it } from 'vitest';
import {
  AddressSchema,
  CITIES,
  CityCodeSchema,
  IBANSchema,
  MoneySchema,
  PhoneNumberSchema,
  TCKNSchema,
  VKNSchema,
  ValidationError,
  fromDecimalString,
  getCityName,
  isValidTCKN,
  isValidTRIBAN,
  isValidVKN,
  normalizePhoneNumber,
  toDecimalString,
} from '../src/index.js';

// Not: Aşağıdaki kimlik numaraları algoritma ile üretilmiş sentetik test vektörleridir;
// gerçek kişilere ait değildir.
const VALID_TCKNS = ['10000000146', '12345678950', '11111111110'];
const VALID_VKNS = ['1234567890', '1111111114', '9999999994'];
// Kaynak: ISO 13616 / Wikipedia örnek TR IBAN'ı (sentetik).
const VALID_IBAN = 'TR330006100519786457841326';

describe('MoneySchema', () => {
  it('kuruş cinsinden tam sayıları kabul eder', () => {
    expect(MoneySchema.parse({ value: 1050, currency: 'TRY' })).toEqual({
      value: 1050,
      currency: 'TRY',
    });
    expect(MoneySchema.safeParse({ value: 0, currency: 'USD' }).success).toBe(true);
  });

  it.each([
    { value: 10.5, currency: 'TRY' },
    { value: -1, currency: 'TRY' },
    { value: Number.MAX_SAFE_INTEGER + 1, currency: 'TRY' },
    { value: 100, currency: 'GBP' },
    { value: '100', currency: 'TRY' },
  ])('geçersiz tutarı reddeder: %o', (input) => {
    expect(MoneySchema.safeParse(input).success).toBe(false);
  });
});

describe('toDecimalString', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [50, '0.50'],
    [1050, '10.50'],
    [123456789, '1234567.89'],
  ])('%i kuruş → %s', (value, expected) => {
    expect(toDecimalString({ value, currency: 'TRY' })).toBe(expected);
  });
});

describe('fromDecimalString', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.50', 1050],
    ['0.05', 5],
    [' 1234567.89 ', 123456789],
    ['10.5000', 1050],
  ])('%s → %i kuruş', (input, value) => {
    expect(fromDecimalString(input, 'EUR')).toEqual({
      ok: true,
      value: { value, currency: 'EUR' },
    });
  });

  it.each(['', 'abc', '10,50', '-1', '1.005', '.5', '1e3', '99999999999999999'])(
    'geçersiz girdiyi reddeder: "%s"',
    (input) => {
      const result = fromDecimalString(input, 'TRY');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    },
  );

  it('toDecimalString ile gidiş-dönüş tutarlıdır', () => {
    for (const value of [0, 1, 99, 100, 1999, 1000001]) {
      const money = { value, currency: 'TRY' as const };
      expect(fromDecimalString(toDecimalString(money), 'TRY')).toEqual({ ok: true, value: money });
    }
  });
});

describe('TCKN', () => {
  it.each(VALID_TCKNS)('geçerli: %s', (value) => {
    expect(isValidTCKN(value)).toBe(true);
    expect(TCKNSchema.parse(` ${value} `)).toBe(value);
  });

  it.each([
    '01234567890', // ilk hane sıfır
    '1234567895', // 10 hane
    '123456789500', // 12 hane
    '1234567895a',
    '12345678951', // 11. hane yanlış
    '12345678940', // 10. hane yanlış
  ])('geçersiz: %s', (value) => {
    expect(isValidTCKN(value)).toBe(false);
    expect(TCKNSchema.safeParse(value).success).toBe(false);
  });
});

describe('VKN', () => {
  it.each(VALID_VKNS)('geçerli: %s', (value) => {
    expect(isValidVKN(value)).toBe(true);
    expect(VKNSchema.parse(value)).toBe(value);
  });

  it.each(['1234567891', '123456789', '12345678901', '12345678a0'])('geçersiz: %s', (value) => {
    expect(isValidVKN(value)).toBe(false);
    expect(VKNSchema.safeParse(value).success).toBe(false);
  });
});

describe('PhoneNumberSchema', () => {
  it.each([
    ['05321234567', '+905321234567'],
    ['0532 123 45 67', '+905321234567'],
    ['(0532) 123-45-67', '+905321234567'],
    ['5321234567', '+905321234567'],
    ['905321234567', '+905321234567'],
    ['+90 532 123 45 67', '+905321234567'],
    ['00905321234567', '+905321234567'],
    ['02121234567', '+902121234567'],
    ['+4915112345678', '+4915112345678'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
    expect(PhoneNumberSchema.parse(input)).toBe(expected);
  });

  it.each(['', '123', '0532123456', '+9053212345678', '+0123456789', 'abc', '6321234567'])(
    'geçersiz: "%s"',
    (input) => {
      expect(normalizePhoneNumber(input)).toBeUndefined();
      const result = PhoneNumberSchema.safeParse(input);
      expect(result.success).toBe(false);
    },
  );
});

describe('Address', () => {
  it('81 il ve benzersiz plaka kodu içerir', () => {
    expect(CITIES).toHaveLength(81);
    const codes = CITIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(81);
    expect(codes[0]).toBe('01');
    expect(codes[80]).toBe('81');
  });

  it('plaka kodundan il adını döner', () => {
    expect(getCityName('34')).toBe('İstanbul');
    expect(getCityName('06')).toBe('Ankara');
  });

  it.each(['00', '82', '6', 6])('geçersiz plaka kodunu reddeder: %s', (code) => {
    expect(CityCodeSchema.safeParse(code).success).toBe(false);
  });

  it('geçerli adresi kabul eder ve metinleri kırpar', () => {
    expect(
      AddressSchema.parse({
        cityCode: '34',
        district: ' Kadıköy ',
        neighborhood: 'Moda',
        addressLine: 'Örnek Sok. No: 1',
        postalCode: '34710',
      }),
    ).toEqual({
      cityCode: '34',
      district: 'Kadıköy',
      neighborhood: 'Moda',
      addressLine: 'Örnek Sok. No: 1',
      postalCode: '34710',
    });
  });

  it.each([
    { cityCode: '34', district: '', addressLine: 'x' },
    { cityCode: '34', district: 'x', addressLine: '   ' },
    { cityCode: '34', district: 'x', addressLine: 'x', postalCode: '3471' },
    { cityCode: '99', district: 'x', addressLine: 'x' },
  ])('geçersiz adresi reddeder: %o', (input) => {
    expect(AddressSchema.safeParse(input).success).toBe(false);
  });
});

describe('IBANSchema', () => {
  it("geçerli IBAN'ı normalize ederek kabul eder", () => {
    expect(isValidTRIBAN(VALID_IBAN)).toBe(true);
    expect(IBANSchema.parse('tr33 0006 1005 1978 6457 8413 26')).toBe(VALID_IBAN);
  });

  it.each([
    'TR330006100519786457841327', // kontrol hatası
    'TR33000610051978645784132', // eksik hane
    'DE89370400440532013000', // TR değil
    'TR33000610051978645784132A',
    '',
  ])('geçersiz: %s', (input) => {
    expect(isValidTRIBAN(input)).toBe(false);
    expect(IBANSchema.safeParse(input).success).toBe(false);
  });
});
