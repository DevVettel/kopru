# Mock Server ile Test Rehberi

`@kopru/mock-server`, sağlayıcıların HTTP API'lerini deterministik senaryolarla taklit eder. Gerçek bir sağlayıcı hesabı, internet bağlantısı ya da kimlik bilgisi gerekmez. Bu rehber uygulamanızı mock'a karşı nasıl test edeceğinizi ve hangi test verisinin hangi sonucu ürettiğini anlatır.

Uçtan uca çalışan bir örnek: [`examples/checkout-flow`](../../examples/checkout-flow).

## Kurulum

İstemcinizi mock'a yönlendirmek için yalnızca `baseUrl` ve kimlik bilgileri değişir; uygulama kodunuz aynı kalır.

```ts
import { createCargoClient, createPaymentClient } from '@kopru/core';
import { iyzico } from '@kopru/iyzico';
import {
  IYZICO_MOCK_API_KEY,
  IYZICO_MOCK_SECRET_KEY,
  YURTICI_MOCK_PASSWORD,
  YURTICI_MOCK_USERNAME,
  startMockServer,
} from '@kopru/mock-server';
import { yurtici } from '@kopru/yurtici';

const server = await startMockServer(); // boş bir port seçer

const payments = createPaymentClient({
  provider: iyzico({
    apiKey: IYZICO_MOCK_API_KEY,
    secretKey: IYZICO_MOCK_SECRET_KEY,
    baseUrl: `${server.url}/iyzico`,
  }),
});
const cargo = createCargoClient({
  provider: yurtici({
    username: YURTICI_MOCK_USERNAME,
    password: YURTICI_MOCK_PASSWORD,
    baseUrl: `${server.url}/yurtici`,
  }),
});

// … testler …
await server.stop();
```

| Sağlayıcı | Kimlik bilgisi sabitleri                         | Değerleri                                                     |
| --------- | ------------------------------------------------ | ------------------------------------------------------------- |
| iyzico    | `IYZICO_MOCK_API_KEY`, `IYZICO_MOCK_SECRET_KEY`  | `sandbox-kopru-mock-api-key`, `sandbox-kopru-mock-secret-key` |
| Yurtiçi   | `YURTICI_MOCK_USERNAME`, `YURTICI_MOCK_PASSWORD` | `KOPRU_MOCK`, `kopru-mock-password`                           |

Ayrı bir süreçte çalıştırmak isterseniz CLI'ı kullanın: `kopru-mock --port 4010`. Bu durumda kök adresler `http://127.0.0.1:4010/iyzico` ve `http://127.0.0.1:4010/yurtici` olur.

### Vitest `globalSetup`

Bütün test dosyalarının aynı sunucuyu kullanması için:

```ts
// test/global-setup.ts
import { startMockServer } from '@kopru/mock-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mockServerUrl: string;
  }
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await startMockServer();
  project.provide('mockServerUrl', server.url);
  return () => server.stop();
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { globalSetup: ['test/global-setup.ts'] } });
```

Testlerde adresi `inject('mockServerUrl')` ile alın. Sunucu durumu (ödemeler, gönderiler) bellekte tutulur ve bütün testlerce paylaşılır; testlerin birbirini etkilememesi için her testte farklı `orderId` / `referenceId` kullanın ya da sunucuyu test dosyası içinde başlatın.

## iyzico test kartları

Bütün kartlarda son kullanma tarihi olarak gelecekteki bir tarih (`12/30`), CVC olarak herhangi üç hane (`123`) kullanılabilir. Numaralar iyzico'nun resmî sandbox kartlarıdır; `4000000000000002` Köprü'ye özgüdür. Tabloda ilk sütunda parantez içinde verilen adlar `@kopru/mock-server` paketinden dışa aktarılan sabitlerdir.

### Başarılı ödemeler

| Kart                                                   | Tahsilat | `refund` sonucu                                                   |
| ------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `5528790000000008` (`IYZICO_MOCK_SUCCESS_CARD`)        | Başarılı | Başarılı (aynı gün: iade `10223` döner, Köprü ödemeyi iptal eder) |
| `5400360000000003` (`IYZICO_MOCK_SETTLED_CARD`)        | Başarılı | Başarılı (gün sonu yapılmış: tutar bazlı iade)                    |
| `5406670000000009` (`IYZICO_MOCK_NON_REFUNDABLE_CARD`) | Başarılı | `PAYMENT_REFUND_FAILED` (`10202`)                                 |

### Hatalı ödemeler

Bu kartlar non-3DS tahsilatta hemen, 3DS akışında `completeThreeDS` aşamasında hata döner.

| Kart               | iyzico kodu | Köprü kodu                   |
| ------------------ | ----------- | ---------------------------- |
| `4111111111111129` | `10051`     | `PAYMENT_INSUFFICIENT_FUNDS` |
| `4129111111111111` | `10005`     | `PAYMENT_CARD_DECLINED`      |
| `4128111111111112` | `10012`     | `PAYMENT_CARD_DECLINED`      |
| `4127111111111113` | `10041`     | `PAYMENT_CARD_DECLINED`      |
| `4126111111111114` | `10043`     | `PAYMENT_CARD_DECLINED`      |
| `4125111111111115` | `10054`     | `PAYMENT_CARD_EXPIRED`       |
| `4124111111111116` | `10084`     | `PAYMENT_INVALID_CARD`       |
| `4123111111111117` | `10057`     | `PAYMENT_CARD_DECLINED`      |
| `4122111111111118` | `10058`     | `PAYMENT_CARD_DECLINED`      |
| `4121111111111119` | `10034`     | `PAYMENT_FRAUD_SUSPECTED`    |
| `4120111111111110` | `10041`     | `PAYMENT_CARD_DECLINED`      |
| `4130111111111118` | `10202`     | `PAYMENT_CARD_DECLINED`      |

### 3D Secure

| Kart                                                      | Sonuç                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Başarılı kartlar                                          | `initThreeDS` HTML döner, callback `mdStatus=1`, `completeThreeDS` başarılı |
| `4131111111111117` (`IYZICO_MOCK_THREEDS_MD0_CARD`)       | `completeThreeDS` → `PAYMENT_THREEDS_FAILED` (`mdStatus=0`)                 |
| `4141111111111115` (`IYZICO_MOCK_THREEDS_MD4_CARD`)       | `completeThreeDS` → `PAYMENT_THREEDS_FAILED` (`mdStatus=4`)                 |
| `4151111111111112` (`IYZICO_MOCK_THREEDS_INIT_FAIL_CARD`) | `initThreeDS` → `PAYMENT_CARD_DECLINED` (`10202`)                           |

`initThreeDS` sonucundaki HTML, callback alanlarını `callbackUrl` adresine POST eden bir formdur. Tarayıcıda açıldığında kendiliğinden gönderilir. Otomatik testlerde formu ayrıştırıp alanları `completeThreeDS` metoduna verebilirsiniz; hazır bir örnek [`browser.ts`](../../examples/checkout-flow/src/browser.ts) dosyasındadır.

### Diğer durumlar

| Tetikleyici                                     | Köprü kodu                                                      |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `4000000000000002` (`IYZICO_MOCK_TIMEOUT_CARD`) | Yanıt 10 sn gecikir; `timeoutMs` daha kısaysa `NETWORK_TIMEOUT` |
| Yanlış `apiKey` / `secretKey`                   | `PROVIDER_AUTHENTICATION_FAILED` (`1000`)                       |
| Bilinmeyen `transactionId` ile iade             | `PAYMENT_REFUND_FAILED` (`5087`)                                |

## Yurtiçi test gönderileri

Yurtiçi gönderileri `referenceId` (kargo anahtarı, en fazla 20 karakter) ile bulunur. Aşağıdaki anahtarlar hazır gelir; hareket tarihleri ve takip numaraları sabittir.

| `referenceId`                                                  | Takip no       | `trackShipment` durumu | Hareketler (eskiden yeniye)                                                  |
| -------------------------------------------------------------- | -------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `KOPRU-DELIVERED` (`YURTICI_MOCK_DELIVERED_KEY`)               | `700000000001` | `delivered`            | `picked_up` → `in_transit` → `in_transit` → `out_for_delivery` → `delivered` |
| `KOPRU-IN-TRANSIT` (`YURTICI_MOCK_IN_TRANSIT_KEY`)             | `700000000002` | `in_transit`           | `picked_up` → `in_transit`                                                   |
| `KOPRU-OUT-FOR-DELIVERY` (`YURTICI_MOCK_OUT_FOR_DELIVERY_KEY`) | `700000000003` | `out_for_delivery`     | `picked_up` → `in_transit` → `in_transit` → `out_for_delivery`               |
| `KOPRU-RETURNED` (`YURTICI_MOCK_RETURNED_KEY`)                 | `700000000004` | `returned`             | `picked_up` → `in_transit` → `in_transit` → `out_for_delivery` → `returned`  |
| `createShipment` ile oluşturulan anahtar                       | yok            | `created`              | yok                                                                          |

| Tetikleyici                                                        | Sonuç                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `createShipment`, yeni anahtar                                     | Başarılı, durum `created`                                                            |
| `createShipment`, `KOPRU-EXISTING` ya da hazır anahtarlar          | `VALIDATION_FAILED` (`60020`)                                                        |
| `createShipment`, açık adreste `KOPRU-INVALID-ADDRESS`             | `CARGO_ADDRESS_INVALID` (`60019`)                                                    |
| `cancelShipment`, oluşturulmuş anahtar (tekrarlanan iptal dâhil)   | Başarılı, durum `cancelled`                                                          |
| `cancelShipment`, teslim alınmış gönderi (örn. `KOPRU-IN-TRANSIT`) | `CARGO_CANCELLATION_NOT_ALLOWED`                                                     |
| `trackShipment` / `cancelShipment`, bilinmeyen anahtar             | `CARGO_SHIPMENT_NOT_FOUND` (`82519`)                                                 |
| Yanlış `username` / `password`                                     | `PROVIDER_UNEXPECTED_RESPONSE` (`soap:Server`); ham mesaj `providerMessage` alanında |
| `KOPRU-TIMEOUT` (`YURTICI_MOCK_TIMEOUT_KEY`)                       | Yanıt 10 sn gecikir; `timeoutMs` daha kısaysa `NETWORK_TIMEOUT`                      |

Yurtiçi'nin gerçek servisi herkese açık belgelenmediği için bu senaryolar açık kaynak entegrasyonlardan derlenmiştir ([NOTES.md](../../packages/cargo-yurtici/NOTES.md)). Canlıya geçmeden önce kendi hesabınızla doğrulayın.

## Giden istekleri doğrulamak

Mock server gelen bütün istekleri maskelenmiş olarak kaydeder:

```ts
// Sunucu aynı süreçteyse
server.requests.list({ plugin: 'iyzico', method: 'POST' });

// Sunucu başka bir süreçteyse (globalSetup, CLI)
import { createMockServerClient } from '@kopru/mock-server';
const mock = createMockServerClient(url);
await mock.clearRequests();
await mock.requests({ plugin: 'yurtici' });
```

Kart numarası, CVC, parola, imza ve TCKN kayda açık hâliyle girmez. Bu yüzden bu alanları istek kaydından değil, mapper birim testlerinden doğrulayın.

Çalışan sunucudaki bütün senaryoların güncel listesi: `GET /__kopru/scenarios`.
