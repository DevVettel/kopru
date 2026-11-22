<img src="https://raw.githubusercontent.com/DevVettel/kopru/main/docs/assets/logo.svg" alt="Köprü logosu" width="120" align="right">

# @kopru/core

Köprü'nün çekirdek paketi. Bütün sağlayıcı paketleri (`@kopru/iyzico`, `@kopru/yurtici` vb.) buradaki ortak sözleşmelere, Zod şemalarına, standart hata sınıflarına ve yardımcılara dayanır.

> [!WARNING]
> Paket geliştirme aşamasında, npm'de henüz yayımlanmadı. Ayrıntılar için [ARCHITECTURE.md](../../ARCHITECTURE.md) ve [Faz 1 planı](../../docs/plans/PHASE-1.md).

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

## İlkeler

- Para tutarları her zaman **kuruş cinsinden tam sayı** olarak taşınır; ondalık dönüşümü yalnızca mapper'larda yapılır.
- Beklenen iş hataları `Result` ile döner; `KopruError.toJSON()` yığın izi ve `cause` içermez.
- TCKN gibi hassas veriler hiçbir zaman hata ayrıntılarına veya loglara kopyalanmaz.
