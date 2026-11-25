# Yeni Sağlayıcı Ekleme Rehberi

Bu rehber, Köprü'ye yeni bir ödeme ya da kargo sağlayıcısının nasıl ekleneceğini baştan sona anlatır. Örneklerde hayalî bir ödeme kuruluşu olan **Acme** kullanılıyor. Kargo sağlayıcılarında da adımlar aynıdır; `definePaymentProvider` yerine `defineCargoProvider`, `runPaymentProviderContract` yerine `runCargoProviderContract` kullanılır.

Gerçek örnekler: REST/JSON için [`packages/payment-iyzico`](../../packages/payment-iyzico), SOAP/XML için [`packages/cargo-yurtici`](../../packages/cargo-yurtici).

## Başlamadan önce

1. [CLAUDE.md](../../CLAUDE.md) kurallarını ve [ARCHITECTURE.md §4](../../ARCHITECTURE.md#4-provider-eklenti-mimarisi) bölümünü okuyun.
2. Sağlayıcının [yol haritasındaki](../../ROADMAP.md) yerine bakın ve bir "Sağlayıcı isteği" issue'su açın.
3. Sağlayıcının güncel API dokümanını bulun. Doküman herkese açık değilse hangi bilginin nereden geldiğini `NOTES.md` dosyasına yazın.

## 1. Araştırma: `NOTES.md`

Kod yazmadan önce `packages/payment-acme/NOTES.md` dosyasını oluşturun. Şunları içermeli:

- Ortamlar ve kök adresler
- Kimlik doğrulama ve imzalama
- Kullanılacak uç noktalar, zorunlu alanlar ve alan sınırları
- Hata kodları ve Köprü kodlarına eşlemesi
- Test kartları ya da test gönderileri
- Tasarım kararları ve **doğrulanamayan varsayımlar**

Bir varsayımı kodda gizlemeyin. Gerçek servise karşı doğrulanmadıysa açıkça öyle yazın.

## 2. Paket iskeleti

Paket dizini `<alan>-<sağlayıcı>` biçimindedir: `payment-acme`, `cargo-acme`. Lint, bu adlandırmaya bakarak sağlayıcı paketinin `src/` altında `@kopru/core` dışında bir `@kopru` paketini import etmesini engeller.

```
packages/payment-acme/
├── src/
│   ├── index.ts        # Public API
│   ├── config.ts       # Konfigürasyon şeması
│   ├── schemas/        # Ham istek/yanıt şemaları (dışarı açılmaz)
│   ├── mappers/        # Saf dönüşüm fonksiyonları
│   ├── errors.ts       # Hata kodu eşleme tablosu
│   ├── auth.ts         # İmzalama (gerekiyorsa)
│   └── provider.ts     # definePaymentProvider çağrısı
├── test/
├── NOTES.md
├── README.md
├── package.json
├── eslint.config.js
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

En kolay yol, en yakın sağlayıcının konfigürasyon dosyalarını (`package.json`, `eslint.config.js`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`) kopyalayıp `name`, `description`, `keywords`, `repository.directory`, `homepage` ve Vitest proje adını değiştirmektir. `version` alanını `0.0.0` bırakın; ilk sürümü Changesets belirler.

Çalışma zamanı bağımlılıkları yalnızca `@kopru/core` (`workspace:^`) ve `zod` olmalıdır. `@kopru/mock-server` yalnızca `devDependencies` altında yer alır.

## 3. Konfigürasyon şeması

Her sağlayıcı `baseUrl` alanını desteklemelidir; mock server'a yönlendirme bununla yapılır.

```ts
// src/config.ts
import { z } from 'zod';

/** Acme konfigürasyon şeması. */
export const AcmeConfigSchema = z
  .object({
    /** Acme API anahtarı. Asla loglanmaz. */
    apiKey: z.string().trim().min(1),
    /** `true` ise test ortamı kullanılır. */
    sandbox: z.boolean().default(false),
    /** Kök adresi elle belirler (örn. mock server); verilirse `sandbox` yok sayılır. */
    baseUrl: z.url({ protocol: /^https?$/ }).optional(),
  })
  .transform(({ baseUrl, sandbox, ...rest }) => ({
    ...rest,
    baseUrl: (
      baseUrl ?? (sandbox ? 'https://sandbox.acme.example' : 'https://api.acme.example')
    ).replace(/\/+$/, ''),
  }));

/** Doğrulanmış Acme konfigürasyonu. */
export type AcmeConfig = z.output<typeof AcmeConfigSchema>;
```

## 4. Ham yanıt şemaları

Yalnızca kullandığınız alanları tanımlayın. Zod bilinmeyen alanları yok sayar; kullandığınız alanlarda ise katı olun ki sağlayıcının değişen davranışı sessizce yutulmasın. Bu şemalar `src/index.ts` üzerinden dışarı açılmaz.

```ts
// src/schemas/response.ts
import { z } from 'zod';

/** Başarılı tahsilat yanıtı. */
export const AcmePaymentSchema = z.object({
  result: z.literal('OK'),
  paymentId: z.string().min(1),
  /** Ondalık metin (örn. `"10.50"`). */
  total: z.string(),
});

/** Başarısız yanıt. */
export const AcmeFailureSchema = z.object({
  result: z.literal('ERROR'),
  code: z.string(),
  message: z.string().optional(),
});

/** Acme'nin tahsilat yanıtı. */
export const AcmeResponseSchema = z.discriminatedUnion('result', [
  AcmePaymentSchema,
  AcmeFailureSchema,
]);

export type AcmePayment = z.infer<typeof AcmePaymentSchema>;
export type AcmeFailure = z.infer<typeof AcmeFailureSchema>;
```

## 5. Hata eşleme

Hata kodları [core kataloğundan](../../packages/core/src/errors/codes.ts) seçilir. Uygun bir kod yoksa yeni kodu önce kataloğa ekleyin. Sağlayıcının ham kodu ve mesajı `providerCode` / `providerMessage` alanlarında her zaman korunur.

```ts
// src/errors.ts
import { createKopruError, type KopruError, type KopruErrorCode } from '@kopru/core';
import type { AcmeFailure } from './schemas/response.js';

export const ACME_PROVIDER_ID = 'acme';

/** Acme hata kodu → Köprü hata kodu. Tabloda olmayanlar `PROVIDER_UNEXPECTED_RESPONSE` olur. */
export const ACME_ERROR_MAP: ReadonlyMap<string, KopruErrorCode> = new Map([
  ['05', 'PAYMENT_CARD_DECLINED'],
  ['51', 'PAYMENT_INSUFFICIENT_FUNDS'],
  ['54', 'PAYMENT_CARD_EXPIRED'],
  ['401', 'PROVIDER_AUTHENTICATION_FAILED'],
]);

/** Acme'nin başarısız yanıtını standart hataya çevirir. Saf fonksiyondur. */
export function mapAcmeError(failure: AcmeFailure): KopruError {
  return createKopruError({
    code: ACME_ERROR_MAP.get(failure.code) ?? 'PROVIDER_UNEXPECTED_RESPONSE',
    message: `Acme request failed with error code ${failure.code}`,
    provider: ACME_PROVIDER_ID,
    providerCode: failure.code,
    ...(failure.message === undefined ? {} : { providerMessage: failure.message }),
  });
}
```

## 6. Mapper'lar

Mapper'lar saf fonksiyonlardır: ağ isteği yapmaz, saate ya da rastgele sayıya doğrudan erişmez; ihtiyaç duydukları değeri parametre olarak alır. Tutarlar core'da her zaman kuruş cinsinden tam sayıdır. Ondalık dönüşümü yalnızca burada, `toDecimalString` ve `fromDecimalString` ile yapılır.

```ts
// src/mappers/payment.ts
import {
  fromDecimalString,
  ok,
  parseCardExpiry,
  toDecimalString,
  type ChargeRequest,
  type ChargeResult,
  type KopruError,
  type Result,
} from '@kopru/core';
import type { AcmePayment } from '../schemas/response.js';

/** Core isteğini Acme formatına çevirir. */
export function toAcmePayment(input: ChargeRequest) {
  const { month, year } = parseCardExpiry(input.card.expiry);
  return {
    orderNo: input.orderId,
    total: toDecimalString(input.amount), // 1050 → "10.50"
    currency: input.amount.currency,
    card: { pan: input.card.number, month, year, cvc: input.card.cvc },
  };
}

/** Acme yanıtını core sonucuna çevirir. */
export function toChargeResult(
  payment: AcmePayment,
  input: ChargeRequest,
  now: Date,
): Result<ChargeResult, KopruError> {
  const amount = fromDecimalString(payment.total, input.amount.currency);
  if (!amount.ok) return amount;
  return ok({
    transactionId: payment.paymentId,
    orderId: input.orderId,
    amount: amount.value,
    installments: input.installments,
    createdAt: now.toISOString(),
    cardLastFour: input.card.number.slice(-4),
  });
}
```

Sağlayıcı, core'da opsiyonel olan bir alanı zorunlu tutuyorsa yer tutucu değer **göndermeyin.** Ağ isteği yapmadan `VALIDATION_FAILED` dönün (örnek: iyzico'nun `identityNumber` alanı).

## 7. Sağlayıcı

```ts
// src/provider.ts
import { ProviderError, definePaymentProvider, err } from '@kopru/core';
import { AcmeConfigSchema } from './config.js';
import { ACME_PROVIDER_ID, mapAcmeError } from './errors.js';
import { toAcmePayment, toChargeResult } from './mappers/payment.js';
import { AcmeResponseSchema } from './schemas/response.js';

/** Yanıt gövdesini çözer; JSON değilse `undefined` döner ve şema doğrulamasında elenir. */
function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

/** Acme ödeme sağlayıcısı fabrikası. */
export const acme = definePaymentProvider({
  id: ACME_PROVIDER_ID,
  configSchema: AcmeConfigSchema,
  capabilities: ['charge'],
  create: (config) => ({
    async charge(input, ctx) {
      const response = await ctx.http.request({
        method: 'POST',
        url: `${config.baseUrl}/payments`,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(toAcmePayment(input)),
        idempotent: false, // tahsilat asla otomatik tekrarlanmaz
        ...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
      });
      if (!response.ok) return response; // NetworkError

      const { status, body } = response.value;
      const parsed = AcmeResponseSchema.safeParse(parseJson(body));
      if (!parsed.success) {
        return err(
          new ProviderError({
            code: status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_UNEXPECTED_RESPONSE',
            message: `Acme returned an unrecognized response (HTTP ${String(status)})`,
            provider: ACME_PROVIDER_ID,
          }),
        );
      }
      if (parsed.data.result === 'ERROR') return err(mapAcmeError(parsed.data));
      return toChargeResult(parsed.data, input, ctx.now());
    },
  }),
});
```

Dikkat edilecek noktalar:

- **Ağ erişimi yalnızca `ctx.http` iledir.** Zaman aşımı, yeniden deneme ve log maskeleme böyle sağlanır. Zaman için `ctx.now()` kullanın.
- **`idempotent: true` yalnızca sorgularda verilir.** Tahsilat, iade, iptal ve gönderi oluşturma otomatik olarak tekrarlanmaz.
- **Beklenen hatalar `Result` ile döner**, fırlatılmaz.
- **Yetenek ve metot tutarlı olmalıdır.** `threeDS` bildiriyorsanız `initThreeDS` ve `completeThreeDS` zorunludur; aksi hâlde fabrika `ConfigurationError` fırlatır.
- **Callback verisine güvenmeyin.** 3DS callback'i kullanıcının tarayıcısından geçer. Ödemeyi sunucudan sunucuya bir çağrıyla ya da imza doğrulayarak kesinleştirin; `orderId` ve `amount` değerlerini callback'ten değil bu doğrulanmış yanıttan alın.
- **Hassas alanlar maskelenmelidir.** Kart numaraları ve TCKN otomatik tanınır. Sağlayıcının gizli alan adı [`SENSITIVE_KEYS`](../../packages/core/src/http/redact.ts) listesinde yoksa core'a ekleyin ve testini yazın.

## 8. Mock server eklentisi

Eklenti `packages/mock-server/src/plugins/acme/` altında yaşar ve sağlayıcı paketinizi import etmez. Böylece mock, sizin kodunuza değil sağlayıcının **ham HTTP sözleşmesine** göre yazılır. Aynı nedenle imza doğrulamasını da bağımsız olarak yeniden yazın.

```ts
// packages/mock-server/src/plugins/acme/index.ts
import { defineMockPlugin } from '../../plugin.js';
import { z } from 'zod';

/** Mock Acme'nin kabul ettiği API anahtarı. */
export const ACME_MOCK_API_KEY = 'acme-mock-api-key';

/** Yetersiz bakiye döndüren kart. */
export const ACME_MOCK_INSUFFICIENT_FUNDS_CARD = '4111111111111129';

const RequestSchema = z.object({
  orderNo: z.string().min(1),
  total: z.string(),
  card: z.object({ pan: z.string() }),
});

/** Acme API taklidi. */
export const acmePlugin = defineMockPlugin({
  name: 'acme',
  basePath: '/acme',
  description: 'Acme ödeme API taklidi',
  scenarios: [
    { id: 'charge-success', description: 'Başarılı ödeme', trigger: 'Diğer bütün kartlar' },
    {
      id: 'charge-insufficient-funds',
      description: '51 yetersiz bakiye',
      trigger: `pan=${ACME_MOCK_INSUFFICIENT_FUNDS_CARD}`,
    },
  ],
  register: (app) => {
    let nextId = 1;
    app.post('/payments', async (c) => {
      if (c.req.header('authorization') !== `Bearer ${ACME_MOCK_API_KEY}`) {
        return c.json({ result: 'ERROR', code: '401' }, 401);
      }
      const request = RequestSchema.safeParse(await c.req.json());
      if (!request.success) return c.json({ result: 'ERROR', code: '400' }, 400);
      if (request.data.card.pan === ACME_MOCK_INSUFFICIENT_FUNDS_CARD) {
        return c.json({ result: 'ERROR', code: '51', message: 'Yetersiz bakiye' });
      }
      return c.json({ result: 'OK', paymentId: String(nextId++), total: request.data.total });
    });
  },
});
```

Sonra `src/plugins/index.ts` dosyasında eklentiyi dışa aktarıp `BUILTIN_PLUGINS` listesine ekleyin. En az şu senaryolar bulunmalı: başarı, iş hataları, hatalı kimlik bilgisi, zaman aşımı; varsa 3DS ve iade. Senaryolar deterministik olmalı: aynı girdi her zaman aynı sonucu üretir.

## 9. Testler

| Test                | Ne doğrular?                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Birim               | Her mapper, şema ve hata eşlemesi; imzalama için bağımsız üretilmiş test vektörü             |
| Sözleşme (contract) | Sağlayıcının core sözleşmesine uyumu                                                         |
| Entegrasyon         | Mock server'a karşı bütün senaryolar, zaman aşımı, bozuk yanıtlar, loglarda sızıntı olmaması |

Sözleşme testi:

```ts
// test/contract.test.ts
import { runPaymentProviderContract } from '@kopru/core/testing';
import { ACME_MOCK_API_KEY, ACME_MOCK_INSUFFICIENT_FUNDS_CARD } from '@kopru/mock-server';
import { inject } from 'vitest';
import { acme } from '../src/index.js';
import { chargeInput } from './fixtures.js';

runPaymentProviderContract({
  createProvider: () =>
    acme({ apiKey: ACME_MOCK_API_KEY, baseUrl: `${inject('mockServerUrl')}/acme` }),
  fixtures: {
    successfulCharge: chargeInput(),
    declinedCharge: chargeInput(ACME_MOCK_INSUFFICIENT_FUNDS_CARD),
    // `threeDS` bildiriliyorsa `threeDSInit` de zorunludur.
  },
});
```

`mockServerUrl` değerini sağlayan `globalSetup` için [mock server rehberine](./testing-with-mock-server.md) bakın. Sağlayıcı paketlerinde hedef kapsama en az %80'dir (`pnpm test:coverage`).

Fixture'larda gerçek kart, TCKN, anahtar ya da kişisel veri kullanmayın.

## 10. Son adımlar

- [ ] `README.md` (Türkçe): yetenekler, kurulum, konfigürasyon, kullanım, hata eşleme, sınırlamalar
- [ ] `NOTES.md`: kaynaklar, kararlar ve doğrulanmamış varsayımlar
- [ ] Public API'lerde Türkçe JSDoc
- [ ] Yeni terimler [GLOSSARY.md](../GLOSSARY.md) içinde
- [ ] Mock server README'sinde ve [test rehberinde](./testing-with-mock-server.md) senaryo tablosu
- [ ] Kök `README.md` paket tablosu ve `ROADMAP.md`
- [ ] `pnpm changeset`: sağlayıcı ve `@kopru/mock-server` için `minor`
- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
