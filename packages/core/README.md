<img src="https://raw.githubusercontent.com/DevVettel/kopru/main/docs/assets/logo.svg" alt="Köprü logosu" width="120" align="right">

# @kopru/core

Köprü'nün çekirdek paketi. Bütün sağlayıcı paketleri (`@kopru/iyzico`, `@kopru/yurtici` vb.) buradaki ortak sözleşmelere, Zod şemalarına, standart hata sınıflarına ve yardımcılara dayanır.

> [!WARNING]
> Köprü `0.x` sürümlerinde. API, küçük (minor) sürümler arasında değişebilir. Mimari için [ARCHITECTURE.md](https://github.com/DevVettel/kopru/blob/main/ARCHITECTURE.md).

## Kurulum

```bash
pnpm add @kopru/core
```

Node.js 22 ya da üzeri gerekir.

## İçerik

| Modül                 | Dışa aktarılanlar                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `result`              | `Result<T, E>`, `ok`, `err`, `isOk`, `isErr`, `unwrap`, `unwrapOr`, `mapResult`                                                                                          |
| `errors`              | `KopruError` ve alt sınıfları, `ERROR_CATALOG`, `createKopruError`, `fromZodError`, `validate`                                                                           |
| `primitives`          | `MoneySchema` (+ `toDecimalString` / `fromDecimalString`), `TCKNSchema`, `VKNSchema`, `PhoneNumberSchema`, `AddressSchema`, `CITIES`, `IBANSchema`                       |
| `domain/payment`      | `ChargeRequestSchema`, `ChargeResultSchema`, `ThreeDSInitRequestSchema`, `ThreeDSInitResultSchema`, `RefundRequestSchema`, `PaymentProvider`                             |
| `domain/cargo`        | `CreateShipmentRequestSchema`, `ShipmentSchema`, `ShipmentTrackingSchema`, `TrackingEventSchema`, `ShipmentStatusSchema`, `CargoProvider`                                |
| `provider`            | `definePaymentProvider`, `defineCargoProvider`, `supports`, `ProviderContext`                                                                                            |
| `http`                | `createHttpClient` (timeout, idempotent retry, maskeli log kancaları), `redact*` yardımcıları                                                                            |
| `utils`               | `hash`, `hmac`, `safeEqual`, `base64*`, `parseXml`, `buildXml`, `buildSoapEnvelope`, `parseSoapEnvelope`, `xmlList`, `formatIstanbulDateTime`, `istanbulLocalToDateTime` |
| `client`              | `createPaymentClient`, `createCargoClient`                                                                                                                               |
| `@kopru/core/testing` | `runPaymentProviderContract`, `runCargoProviderContract`, `createRecordingHttpClient` (yalnızca ESM, Vitest gerektirir)                                                  |

## Örnek

```ts
import { MoneySchema, PhoneNumberSchema, validate, toDecimalString } from '@kopru/core';

const result = validate(MoneySchema, { value: 1050, currency: 'TRY' });
if (result.ok) {
  toDecimalString(result.value); // "10.50"
} else {
  console.error(result.error.code, result.error.details); // VALIDATION_FAILED, { issues: [...] }
}

PhoneNumberSchema.parse('0532 123 45 67'); // "+905321234567"
```

### Sağlayıcı kullanımı

```ts
import { createPaymentClient } from '@kopru/core';

const payments = createPaymentClient({
  provider: someProvider({ apiKey: '…' }), // örn. @kopru/iyzico
  http: { timeoutMs: 15_000, hooks: { onRequest: (e) => console.log(e) } }, // log verisi maskelenmiştir
});

if (payments.supports('refund.partial')) {
  // …
}
const result = await payments.charge({
  orderId: 'S-1',
  amount: { value: 1050, currency: 'TRY' },
  card,
  buyer,
});
```

### Taksit sorgusu ve bildirimler

Sağlayıcı `installments.query` yeteneğini destekliyorsa kartın ilk 6–8 hanesi ve tutar için taksit seçenekleri sorgulanabilir:

```ts
const installments = await payments.queryInstallments({
  bin: '41111111',
  amount: { value: 120_000, currency: 'TRY' },
});
// installments.value.options → [{ installments: 1, installmentAmount, totalAmount }, …]
```

`notifications` yeteneğini destekleyen sağlayıcılarda, sağlayıcının bildirim (webhook) adresinize gönderdiği istek **ham gövdesiyle** verilir. İmza sağlayıcı paketinde doğrulanır; geçersiz imzada `WEBHOOK_SIGNATURE_INVALID` döner. Dönen `acknowledgement`, sağlayıcıya aynen yanıt olarak verilmelidir:

```ts
const parsed = await payments.parseNotification({ headers: request.headers, body: rawBody });
if (parsed.ok) {
  const { notification, acknowledgement } = parsed.value; // notification.status: succeeded | failed | pending
  response
    .status(acknowledgement.status)
    .type(acknowledgement.contentType)
    .send(acknowledgement.body);
}
```

Aynı bildirim birden çok kez gelebilir; tekilleştirme (`orderId` + `status`) uygulamanın sorumluluğundadır.

## İlkeler

- Para tutarları her zaman **kuruş cinsinden tam sayı** olarak taşınır; ondalık dönüşümü yalnızca mapper'larda yapılır.
- Beklenen iş hataları `Result` ile döner; `KopruError.toJSON()` yığın izi ve `cause` içermez.
- TCKN gibi hassas veriler hiçbir zaman hata ayrıntılarına veya loglara kopyalanmaz.
