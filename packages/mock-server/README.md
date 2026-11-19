# @kopru/mock-server

Köprü sağlayıcı taklit sunucusu. Sağlayıcıların HTTP API'lerini deterministik senaryolarla taklit eder; böylece gerçek sağlayıcı hesabı açmadan, yerelde ve CI'da tüm akışlar (3D Secure dahil) test edilebilir. Sağlayıcı paketleri yalnızca `baseUrl` değiştirilerek mock'a yönlendirilir.

> ⚠️ Paket henüz geliştirme aşamasındadır ve npm'de yayımlanmamıştır. Şu an yalnızca örnek `echo` eklentisi bulunur; iyzico ve Yurtiçi senaryoları M4/M5 kapsamında eklenecektir ([Faz 1 planı](../../docs/plans/PHASE-1.md)).

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

Gelen her istek maskelenmiş olarak tek satır halinde konsola yazılır. `Ctrl+C` ile sunucu düzgün kapatılır.

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

## Eklenti Yazmak

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
