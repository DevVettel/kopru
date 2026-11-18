# @kopru/core

Köprü'nün çekirdek paketi. Tüm sağlayıcı paketlerinin (`@kopru/iyzico`, `@kopru/yurtici` vb.) dayandığı ortak sözleşmeleri, Zod şemalarını, standart hata sınıflarını ve yardımcıları içerir.

> ⚠️ Paket henüz geliştirme aşamasındadır ve npm'de yayımlanmamıştır. Ayrıntılar için [ARCHITECTURE.md](../../ARCHITECTURE.md) ve [Faz 1 planı](../../docs/plans/PHASE-1.md).

## İçerik

| Modül        | Dışa aktarılanlar                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`     | `Result<T, E>`, `ok`, `err`, `isOk`, `isErr`, `unwrap`, `unwrapOr`, `mapResult`                                                                    |
| `errors`     | `KopruError` ve alt sınıfları, `ERROR_CATALOG`, `createKopruError`, `fromZodError`, `validate`                                                     |
| `primitives` | `MoneySchema` (+ `toDecimalString` / `fromDecimalString`), `TCKNSchema`, `VKNSchema`, `PhoneNumberSchema`, `AddressSchema`, `CITIES`, `IBANSchema` |

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

## İlkeler

- Para tutarları her zaman **kuruş cinsinden tam sayı** olarak taşınır; ondalık dönüşümü yalnızca mapper'larda yapılır.
- Beklenen iş hataları `Result` ile döner; `KopruError.toJSON()` yığın izi ve `cause` içermez.
- TCKN gibi hassas veriler hiçbir zaman hata ayrıntılarına veya loglara kopyalanmaz.
