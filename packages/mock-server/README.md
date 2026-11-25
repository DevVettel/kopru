<img src="https://raw.githubusercontent.com/DevVettel/kopru/main/docs/assets/logo.svg" alt="Köprü logosu" width="120" align="right">

# @kopru/mock-server

Köprü'nün sağlayıcı taklit sunucusu. Sağlayıcıların HTTP API'lerini deterministik senaryolarla taklit eder. Böylece gerçek bir sağlayıcı hesabı açmadan bütün akışları (3D Secure dâhil) yerelde ve CI'da test edebilirsiniz. Sağlayıcı paketlerini mock'a yönlendirmek için yalnızca `baseUrl` değerini değiştirmek yeterli.

> [!WARNING]
> Köprü `0.x` sürümlerinde. API, küçük (minor) sürümler arasında değişebilir. Yerleşik eklentiler: örnek `echo`, `iyzico` ve `yurtici`.

## Kurulum

```bash
pnpm add -D @kopru/mock-server
```

Node.js 22 ya da üzeri gerekir.

Test kartları, hazır gönderiler ve Köprü hata kodlarıyla karşılıkları: [Mock server ile test rehberi](../../docs/guides/testing-with-mock-server.md).

## Testlerden Kullanım (Vitest `globalSetup`)

```ts
// test/global-setup.ts
import type { TestProject } from 'vitest/node';
import { startMockServer } from '@kopru/mock-server';

declare module 'vitest' {
  export interface ProvidedContext {
    mockServerUrl: string;
  }
}

export async function setup(project: TestProject) {
  const server = await startMockServer(); // port: 0 → boş bir port seçilir
  project.provide('mockServerUrl', server.url);
  return () => server.stop();
}
```

```ts
// test/payment.test.ts
import { inject, it, expect } from 'vitest';
import { createMockServerClient } from '@kopru/mock-server';

const url = inject('mockServerUrl');
const mock = createMockServerClient(url);

it('sağlayıcıya ödeme isteği gider', async () => {
  // ... sağlayıcıyı `${url}/iyzico` adresine yönlendirerek çağır
  const requests = await mock.requests({ plugin: 'iyzico', method: 'POST' });
  expect(requests).toHaveLength(1);
});
```

Sunucuyu test dosyasının içinde de başlatabilirsiniz; bu durumda istek kaydına doğrudan `server.requests.list()` ile erişilir.

## CLI

```bash
kopru-mock --port 4010          # varsayılan: 127.0.0.1:4010
kopru-mock -p 0 -H 0.0.0.0 -q   # rastgele port, tüm arayüzler, istekleri yazma
```

Gelen her istek maskelenmiş olarak tek satır hâlinde konsola yazılır. `Ctrl+C` ile sunucu düzgün kapatılır.

## Yönetim Uç Noktaları

| Uç nokta                   | Açıklama                                          |
| -------------------------- | ------------------------------------------------- |
| `GET /__kopru/health`      | Sağlık kontrolü                                   |
| `GET /__kopru/scenarios`   | Kayıtlı eklentiler ve senaryoları                 |
| `GET /__kopru/requests`    | İstek kaydı (en fazla 1000 kayıt, eskiler atılır) |
| `DELETE /__kopru/requests` | İstek kaydını temizler                            |

## İstek Kaydı ve Güvenlik

Kayda alınan isteklerin başlıkları, sorgu parametreleri ve gövdesi `@kopru/core` maskeleme yardımcılarından geçirilir: kart numarasının yalnızca son 4 hanesi kalır; CVC, API anahtarı, `Authorization` başlığı, parola ve TCKN `[REDACTED]` olarak saklanır. Bu nedenle testlerde imza başlığı gibi gizli değerler istek kaydından doğrulanamaz; bunlar sağlayıcı paketinin birim testlerinde doğrulanır.

## Yerleşik Eklentiler

### `echo` (`/echo`)

| Senaryo    | Tetikleyici                            | Sonuç                                                      |
| ---------- | -------------------------------------- | ---------------------------------------------------------- |
| `echo`     | `ANY /echo/*`                          | İsteği JSON olarak yansıtır                                |
| `status`   | `GET /echo/status/:code`               | Verilen durum koduyla yanıt (200–599; 204/205/304 hariç)   |
| `delay`    | `GET /echo/delay/:ms`                  | Yanıtı geciktirir (en fazla 30 sn); zaman aşımı testleri   |
| `three-ds` | `GET /echo/3ds?callbackUrl=…&status=…` | `status` alanını callback'e otomatik POST eden 3DS sayfası |

### `iyzico` (`/iyzico`)

iyzico API'sinin (`/payment/auth`, `/payment/3dsecure/initialize`, `/payment/3dsecure/auth`, `/payment/detail`, `/v2/payment/refund`, `/payment/cancel`) taklidi. Her istekte IYZWSv2 imzası doğrulanır; kimlik bilgileri `IYZICO_MOCK_API_KEY` ve `IYZICO_MOCK_SECRET_KEY` sabitleriyle dışa aktarılır. Ödemeler sunucu ömrü boyunca bellekte tutulur; ödeme kimlikleri `10000001`'den başlayarak artar.

Kart numaraları iyzico'nun resmi sandbox test kartlarıyla aynıdır (zaman aşımı kartı hariç):

| Kart numarası      | Sonuç                                                          |
| ------------------ | -------------------------------------------------------------- |
| `5528790000000008` | Başarılı. Aynı gün sayılır: iade `10223` döner, iptal başarılı |
| `5400360000000003` | Başarılı. Gün sonu yapılmış sayılır: tutar bazlı iade başarılı |
| `5406670000000009` | Başarılı; iade ve iptal `10202` ile başarısız                  |
| `4111111111111129` | `10051` yetersiz bakiye                                        |
| `4129111111111111` | `10005` işlem onaylanmadı                                      |
| `4128111111111112` | `10012` geçersiz işlem                                         |
| `4127111111111113` | `10041` kayıp kart                                             |
| `4126111111111114` | `10043` çalıntı kart                                           |
| `4125111111111115` | `10054` son kullanma tarihi hatalı                             |
| `4124111111111116` | `10084` hatalı CVC2                                            |
| `4123111111111117` | `10057` kart sahibi bu işlemi yapamaz                          |
| `4122111111111118` | `10058` terminal yetkisiz                                      |
| `4121111111111119` | `10034` dolandırıcılık şüphesi                                 |
| `4120111111111110` | `10041` karta el koyunuz                                       |
| `4130111111111118` | `10202` genel hata                                             |
| `4131111111111117` | 3DS: callback `status=failure`, `mdStatus=0`                   |
| `4141111111111115` | 3DS: callback `status=failure`, `mdStatus=4`                   |
| `4151111111111112` | 3DS başlatma `10202` ile başarısız                             |
| `4000000000000002` | Köprü'ye özgü: yanıt 10 sn gecikir (zaman aşımı testleri)      |

Hata kartları non-3DS tahsilatta hemen, 3DS akışında ise `/payment/3dsecure/auth` aşamasında hata döner. 3DS başlatma yanıtındaki `threeDSHtmlContent`, callback alanlarını (`status`, `paymentId`, `conversationData`, `conversationId`, `mdStatus`) `callbackUrl` adresine otomatik POST eden bir sayfadır. Hatalı imza `1000`, sepet toplamı uyuşmazlığı `5062`, çözülemeyen gövde `11`, bulunamayan ödeme `5087` döner.

### `yurtici` (`/yurtici`)

Yurtiçi Kargo `ShippingOrderDispatcherServices` SOAP servisinin taklidi: `POST /yurtici/KOPSWebServices/ShippingOrderDispatcherServices` adresinde `createShipment`, `cancelShipment` ve `queryShipment` operasyonları. Kimlik bilgileri gövdedeki `wsUserName` / `wsPassword` alanlarıyla doğrulanır ve `YURTICI_MOCK_USERNAME` / `YURTICI_MOCK_PASSWORD` sabitleriyle dışa aktarılır. Gönderiler sunucu ömrü boyunca bellekte tutulur.

| Kargo anahtarı / tetikleyici           | Sonuç                                                           |
| -------------------------------------- | --------------------------------------------------------------- |
| Herhangi bir yeni anahtar              | Oluşturma başarılı (`NOP`); tekrar oluşturma kaydı yeniler      |
| `KOPRU-DELIVERED`                      | Takip: `DLV`, takip no `700000000001`, 5 adımlı hareket geçmişi |
| `KOPRU-IN-TRANSIT`                     | Takip: `IND`, son hareket transfer merkezi; iptal reddedilir    |
| `KOPRU-OUT-FOR-DELIVERY`               | Takip: `IND`, son hareket `DG` (dağıtıma çıkarıldı)             |
| `KOPRU-RETURNED`                       | Takip: başarısız teslimat denemesi + iade (`returnStatus=3`)    |
| `KOPRU-EXISTING` veya hazır anahtarlar | Oluşturma `60020` (anahtar daha önce kullanılmış)               |
| Adreste `KOPRU-INVALID-ADDRESS`        | Oluşturma `60019` (geçersiz alıcı adresi)                       |
| `KOPRU-TIMEOUT`                        | Köprü'ye özgü: yanıt 10 sn gecikir (zaman aşımı testleri)       |
| Oluşturulmamış anahtar                 | Takip ve iptal `82519` (bulunamadı)                             |

Oluşturulan bir gönderinin ilk iptali `CNL` döner, ikinci iptal `82520` (zaten iptal) döner. Ayrıca eksik/uzun kargo anahtarı (`80859`/`82500`), eksik alıcı adı (`60018`) ve 10 haneli olmayan telefon (`82516`) gibi alan hataları taklit edilir. Hatalı kimlik bilgisi, çözülemeyen XML ve bilinmeyen operasyonlar HTTP 500 ile SOAP Fault döner. Hareket geçmişi yalnızca `addHistoricalData=true` gönderildiğinde döner; hareketler, sağlayıcının sıralama yaptığını sınamak için bilinçli olarak karışık sırayla verilir.

## Eklenti Yazmak

Sağlayıcı paketinin tamamı için: [Yeni sağlayıcı ekleme rehberi](../../docs/guides/adding-a-provider.md).

Sağlayıcı senaryoları bu paketin `src/plugins/<sağlayıcı>/` dizininde yaşar. Sağlayıcı paketleri yalnızca `@kopru/core`'a bağımlı olabildiğinden mock eklentileri sağlayıcı paketinin içine konmaz; bu ayrım aynı zamanda mock'un sağlayıcı paketinin koduna değil, sağlayıcının **ham HTTP sözleşmesine** göre yazılmasını sağlar.

```ts
// src/plugins/acme/index.ts
import { defineMockPlugin } from '../../plugin.js';
import { renderAutoPostPage } from '../../three-ds.js';

export const acmePlugin = defineMockPlugin({
  name: 'acme',
  basePath: '/acme',
  description: 'Acme ödeme API taklidi',
  scenarios: [
    { id: 'charge-success', description: 'Başarılı ödeme', trigger: 'Kart 5528790000000008' },
  ],
  register: (app, context) => {
    app.post('/payments', async (c) => c.json({ status: 'success' }));
    app.get('/3ds/:id', (c) =>
      c.html(
        renderAutoPostPage({
          action: `${context.baseUrl()}/acme/callback`,
          fields: { id: c.req.param('id') },
        }),
      ),
    );
  },
});
```

Route yolları `basePath`'e göreli yazılır. Eklenti, `src/plugins/index.ts` içindeki `BUILTIN_PLUGINS` listesine eklenince CLI ve `startMockServer` tarafından otomatik kaydedilir. Ad veya yol çakışması `ConfigurationError` ile reddedilir; `/__kopru` yolu yönetim için ayrılmıştır.
