import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ConfigurationError,
  createCargoClient,
  createPaymentClient,
  definePaymentProvider,
  ok,
  supports,
  type PaymentProvider,
} from '../src/index.js';
import { createRecordingHttpClient } from '../src/testing/index.js';
import {
  FAKE_SIGNATURE_HEADER,
  UNKNOWN_BIN,
  chargeInput,
  fakeCargo,
  fakeNotification,
  installmentQueryInput,
  fakeCargoBasic,
  fakePay,
  fakePayBasic,
  shipmentInput,
} from './fakes.js';

const FIXED_NOW = new Date('2026-11-18T10:00:00Z');

describe('definePaymentProvider', () => {
  it('hatalı konfigürasyonda issue listesiyle ConfigurationError fırlatır', () => {
    expect.assertions(4);
    try {
      fakePay({ apiKey: '' });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      if (error instanceof ConfigurationError) {
        expect(error.provider).toBe('fake-pay');
        expect(error.message).toContain('apiKey');
        expect(error.details).toEqual({ issues: [expect.objectContaining({ path: 'apiKey' })] });
      }
    }
  });

  it('kebab-case olmayan kimliği reddeder', () => {
    expect(() =>
      definePaymentProvider({
        id: 'Bad_Id',
        configSchema: z.object({}),
        capabilities: [],
        create: () => ({}),
      }),
    ).toThrow(ConfigurationError);
  });

  it('yeteneği bildirip metodu uygulamayan sağlayıcıyı reddeder', () => {
    const broken = definePaymentProvider({
      id: 'broken',
      configSchema: z.object({}),
      capabilities: ['threeDS'],
      create: () => ({ initThreeDS: () => Promise.reject(new Error('unused')) }),
    });
    expect(() => broken({})).toThrow(/does not implement "completeThreeDS"/);
  });

  it('yetenek bildirmeden metot uygulayan sağlayıcıyı reddeder', () => {
    const broken = definePaymentProvider({
      id: 'broken',
      configSchema: z.object({}),
      capabilities: [],
      create: () => ({ refund: () => Promise.reject(new Error('unused')) }),
    });
    expect(() => broken({})).toThrow(/without declaring a capability/);
  });

  it('dondurulmuş sağlayıcı nesnesi döner', () => {
    const provider = fakePay({ apiKey: 'k' });
    expect(Object.isFrozen(provider)).toBe(true);
    expect(provider.kind).toBe('payment');
    expect(supports(provider, 'refund.partial')).toBe(true);
    expect(supports(fakePayBasic({ apiKey: 'k' }), 'refund')).toBe(false);
  });
});

describe('createPaymentClient', () => {
  it('supports() sağlayıcı yeteneklerini yansıtır', () => {
    const payments = createPaymentClient({ provider: fakePayBasic({ apiKey: 'k' }) });
    expect(payments.providerId).toBe('fake-pay-basic');
    expect(payments.supports('charge')).toBe(true);
    expect(payments.supports('threeDS')).toBe(false);
  });

  it('enjekte edilen zamanı ve HTTP istemcisini bağlama geçirir', async () => {
    const http = createRecordingHttpClient();
    const payments = createPaymentClient({
      provider: fakePay({ apiKey: 'k' }),
      http,
      now: () => FIXED_NOW,
    });
    const result = await payments.charge(chargeInput);
    expect(result.ok && result.value.createdAt).toBe('2026-11-18T13:00:00+03:00');
  });

  it('girdi varsayılanlarını uygular (installments = 1)', async () => {
    const payments = createPaymentClient({ provider: fakePay({ apiKey: 'k' }), http: {} });
    const result = await payments.charge(chargeInput);
    expect(result.ok && result.value.installments).toBe(1);
  });

  it('3DS akışını tamamlar ve başarısız callback’i hata olarak döner', async () => {
    const payments = createPaymentClient({ provider: fakePay({ apiKey: 'k' }) });
    const ok3ds = await payments.completeThreeDS({
      payload: { orderId: 'ORDER-1', status: 'success' },
    });
    expect(ok3ds.ok).toBe(true);
    const failed = await payments.completeThreeDS({ payload: { status: 'failure' } });
    expect(!failed.ok && failed.error.code).toBe('PAYMENT_THREEDS_FAILED');
  });

  it('kısmi iade refund.partial yeteneğiyle yapılır', async () => {
    const payments = createPaymentClient({ provider: fakePay({ apiKey: 'k' }) });
    const charged = await payments.charge(chargeInput);
    if (!charged.ok) throw charged.error;
    const refunded = await payments.refund({
      transactionId: charged.value.transactionId,
      amount: { value: 50, currency: 'TRY' },
    });
    expect(refunded.ok && refunded.value.amount.value).toBe(50);
  });

  it('sağlayıcının geçersiz sonucunu PROVIDER_UNEXPECTED_RESPONSE ile reddeder', async () => {
    const sloppy = definePaymentProvider({
      id: 'sloppy',
      configSchema: z.object({}),
      capabilities: ['charge'],
      create: () => ({
        charge: (input) =>
          Promise.resolve(
            ok({
              transactionId: '',
              orderId: input.orderId,
              amount: input.amount,
              installments: 1,
              createdAt: 'yesterday',
            }),
          ),
      }),
    });
    const result = await createPaymentClient({ provider: sloppy({}) }).charge(chargeInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
      expect(result.error.provider).toBe('sloppy');
      expect(result.error.message).toMatch(/transactionId.*createdAt/);
    }
  });

  it('elle oluşturulmuş, metodu eksik sağlayıcıda işlemi desteklenmiyor sayar', async () => {
    const handmade: PaymentProvider = {
      kind: 'payment',
      id: 'handmade',
      capabilities: new Set(['charge']),
    };
    const result = await createPaymentClient({ provider: handmade }).charge(chargeInput);
    expect(!result.ok && result.error.code).toBe('PROVIDER_CAPABILITY_NOT_SUPPORTED');
    expect(!result.ok && result.error.details).toEqual({ capability: 'charge' });
  });

  it('sınıf tabanlı sağlayıcılarda this bağlamını korur', async () => {
    class ClassProvider implements PaymentProvider {
      readonly kind = 'payment';
      readonly id = 'class-pay';
      readonly capabilities = new Set(['charge'] as const);
      private readonly prefix = 'cls';

      charge(input: Parameters<NonNullable<PaymentProvider['charge']>>[0]) {
        return Promise.resolve(
          ok({
            transactionId: `${this.prefix}_1`,
            orderId: input.orderId,
            amount: input.amount,
            installments: input.installments,
            createdAt: '2026-11-18T13:00:00+03:00',
          }),
        );
      }
    }
    const result = await createPaymentClient({ provider: new ClassProvider() }).charge(chargeInput);
    expect(result.ok && result.value.transactionId).toBe('cls_1');
  });

  describe('queryInstallments', () => {
    it('BIN’i normalize eder ve artan sıralı seçenekler döner', async () => {
      const payments = createPaymentClient({ provider: fakePay({ apiKey: 'test' }) });
      const result = await payments.queryInstallments(installmentQueryInput);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.bin).toBe('41111111');
      expect(result.value.options.map((o) => o.installments)).toEqual([1, 3, 6]);
      expect(result.value.options[1]).toEqual({
        installments: 3,
        installmentAmount: { value: 350, currency: 'TRY' },
        totalAmount: { value: 1050, currency: 'TRY' },
      });
    });

    it('geçersiz BIN’i ağa gitmeden VALIDATION_FAILED ile reddeder', async () => {
      const http = createRecordingHttpClient();
      const payments = createPaymentClient({ provider: fakePay({ apiKey: 'test' }), http });
      const result = await payments.queryInstallments({ ...installmentQueryInput, bin: '4111' });
      expect(!result.ok && result.error.code).toBe('VALIDATION_FAILED');
      expect(http.requests).toHaveLength(0);
    });

    it('sağlayıcı hatasını olduğu gibi döner', async () => {
      const payments = createPaymentClient({ provider: fakePay({ apiKey: 'test' }) });
      const result = await payments.queryInstallments({
        ...installmentQueryInput,
        bin: UNKNOWN_BIN,
      });
      expect(!result.ok && result.error.code).toBe('PAYMENT_INVALID_CARD');
    });

    it('sıralı olmayan sağlayıcı sonucunu PROVIDER_UNEXPECTED_RESPONSE yapar', async () => {
      const unsorted = definePaymentProvider({
        id: 'unsorted-pay',
        configSchema: z.object({}),
        capabilities: ['installments.query'],
        create: () => ({
          queryInstallments: (input) => {
            const option = (installments: number) => ({
              installments,
              installmentAmount: input.amount,
              totalAmount: input.amount,
            });
            return Promise.resolve(ok({ bin: input.bin, options: [option(3), option(1)] }));
          },
        }),
      });
      const result = await createPaymentClient({ provider: unsorted({}) }).queryInstallments(
        installmentQueryInput,
      );
      expect(!result.ok && result.error.code).toBe('PROVIDER_UNEXPECTED_RESPONSE');
    });
  });

  describe('parseNotification', () => {
    it('başlık isimlerini küçük harfe çevirir ve imzalı bildirimi ayrıştırır', async () => {
      const payments = createPaymentClient({ provider: fakePay({ apiKey: 'test' }) });
      const request = fakeNotification({ orderId: 'ORDER-9', status: 'failed' });
      expect(Object.keys(request.headers ?? {})).toEqual([FAKE_SIGNATURE_HEADER]);
      const result = await payments.parseNotification(request);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.notification).toEqual({
        orderId: 'ORDER-9',
        status: 'failed',
        providerStatus: 'failed',
        failure: { code: 'PAYMENT_CARD_DECLINED', providerCode: '05' },
      });
      expect(result.value.acknowledgement).toEqual({
        status: 200,
        contentType: 'text/plain',
        body: 'OK',
      });
    });

    it('imzasız bildirimi WEBHOOK_SIGNATURE_INVALID ile reddeder', async () => {
      const payments = createPaymentClient({ provider: fakePay({ apiKey: 'test' }) });
      const result = await payments.parseNotification({ body: 'orderId=ORDER-9&status=success' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
      expect(result.error.category).toBe('validation');
      expect(result.error.userMessage).toBe('Bildirim imzası doğrulanamadı.');
    });

    it('desteklemeyen sağlayıcıda PROVIDER_CAPABILITY_NOT_SUPPORTED döner', async () => {
      const payments = createPaymentClient({ provider: fakePayBasic({ apiKey: 'test' }) });
      const result = await payments.parseNotification({ body: '' });
      expect(!result.ok && result.error.code).toBe('PROVIDER_CAPABILITY_NOT_SUPPORTED');
    });
  });
});

describe('createCargoClient', () => {
  it('kapıda ödeme desteklenmiyorsa ağ isteği yapmadan hata döner', async () => {
    const http = createRecordingHttpClient();
    const cargo = createCargoClient({ provider: fakeCargoBasic({ apiKey: 'k' }), http });
    expect(cargo.supports('cashOnDelivery')).toBe(false);
    const result = await cargo.createShipment({
      ...shipmentInput,
      cashOnDelivery: { value: 1000, currency: 'TRY' },
    });
    expect(!result.ok && result.error.code).toBe('PROVIDER_CAPABILITY_NOT_SUPPORTED');
    expect(http.requests).toHaveLength(0);
  });

  it('girdiyi normalize eder ve gönderiyi oluşturur', async () => {
    const cargo = createCargoClient({ provider: fakeCargo({ apiKey: 'k' }) });
    expect(cargo.providerId).toBe('fake-cargo');
    const created = await cargo.createShipment({
      ...shipmentInput,
      cashOnDelivery: { value: 1000, currency: 'TRY' },
    });
    expect(created.ok && created.value.trackingNumber).toBe('TRK1');
    const tracked = await cargo.trackShipment({ trackingNumber: 'TRK1' });
    expect(tracked.ok && tracked.value.events).toHaveLength(1);
  });

  it('arama anahtarı olmadan takip isteğini reddeder', async () => {
    const cargo = createCargoClient({ provider: fakeCargo({ apiKey: 'k' }) });
    const result = await cargo.trackShipment({});
    expect(!result.ok && result.error.code).toBe('VALIDATION_FAILED');
  });

  it('bulunamayan gönderinin iptalini hata olarak döner', async () => {
    const cargo = createCargoClient({ provider: fakeCargo({ apiKey: 'k' }) });
    const result = await cargo.cancelShipment({ referenceId: 'NOPE' });
    expect(!result.ok && result.error.code).toBe('CARGO_SHIPMENT_NOT_FOUND');
  });
});
