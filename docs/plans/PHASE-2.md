# Faz 2 (Genişleme): Uygulama Planı

Bu doküman, [ROADMAP.md](../../ROADMAP.md) içindeki Faz 2 hedeflerini sıralı, bağımlılıkları belli ve tek tek doğrulanabilir görevlere böler. Kilometre taşı numaraları Faz 1'in devamıdır (M7'den başlar). Her görev tek bir PR (veya küçük bir PR grubu) olacak büyüklüktedir.

- **Kapsam:** Core sözleşme genişletmeleri (kısmi iade, BIN bazlı taksit sorgulama, webhook/bildirim doğrulama, idempotency), `@kopru/iyzico` genişletmesi, `@kopru/paytr`, `@kopru/aras`, `@kopru/server` (REST + OpenAPI + Docker), `0.2.0` yayını.
- **Kapsam dışı:** Banka sanal POS'ları ve ön provizyon (Faz 3), e-Dönüşüm (Faz 4), OpenTelemetry ve çoklu sağlayıcı yönlendirme (Faz 5), Yurtiçi kapıda ödeme (doğrulanabilir doküman bulunana kadar; bkz. [cargo-yurtici/NOTES.md](../../packages/cargo-yurtici/NOTES.md) §6).
- **Referanslar:** [ARCHITECTURE.md](../../ARCHITECTURE.md), [CLAUDE.md](../../CLAUDE.md), [GLOSSARY.md](../GLOSSARY.md), [PHASE-1.md](./PHASE-1.md)

**Görev durumu:** ⬜ Başlanmadı · 🟨 Devam ediyor · ✅ Tamamlandı

---

## 0. Faz Başında Verilecek Kararlar (Önerilen)

Aşağıdaki kararlar **önerilmiştir ve onay beklemektedir.** Onaylananlar [docs/adr](../adr/README.md) altında ADR olarak kayda geçirilir, ardından ilgili kilometre taşının kodlamasına başlanır.

| #   | Karar                              | Öneri                                                                                                                                                                                                                                | Gerekçe                                                                                                                                                                                           |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | `@kopru/server` HTTP framework'ü   | **Hono** (`@hono/node-server`) → ADR-0007                                                                                                                                                                                            | Mock server'da zaten kullanılıyor (ADR-0003); Web Standartları tabanlı, hafif. Fastify'a göre ek öğrenme ve bağımlılık yok.                                                                       |
| K2  | OpenAPI üretimi                    | **Zod 4'ün yerleşik `z.toJSONSchema()`'sı** + elle kurulan OpenAPI 3.1 iskeleti; ek kütüphane yok → ADR-0008                                                                                                                         | OpenAPI 3.1 JSON Schema 2020-12 kullanır; Zod 4 bunu doğrudan üretir. `@hono/zod-openapi` gibi katmanlar route tanımını kendi DSL'ine bağlar ve core şemalarının tek kaynak olmasını zorlaştırır. |
| K3  | Idempotency deposu                 | Core'da değil, server'da **`IdempotencyStore` arayüzü** + varsayılan bellek içi (TTL'li) uygulama. Redis vb. kullanıcı adaptörüdür → ADR-0009                                                                                        | Global durum yasağı nedeniyle depo enjekte edilir; Redis istemcisini zorunlu bağımlılık yapmamak için yalnızca arayüz sunulur.                                                                    |
| K4  | Asenkron ödeme sonucu (bildirim)   | Core'a sağlayıcıdan bağımsız **`PaymentNotification`** modeli ve `parseNotification` işlemi (yetenek: `notifications`) eklenir. İmza doğrulaması sağlayıcı paketinde yapılır; geçersiz imza → `WEBHOOK_SIGNATURE_INVALID` → ADR-0010 | PayTR gibi sağlayıcılar 3DS sonucunu tarayıcı callback'iyle değil, sunucudan sunucuya bildirimle iletir. Faz 1 risk tablosunda öngörülen sözleşme değişikliği budur.                              |
| K5  | Taksit sorgulama sözleşmesi        | Yeni işlem **`queryInstallments({ bin, amount })`** → `InstallmentQueryResult` (kart ailesi, banka, taksit seçenekleri: sayı, taksit tutarı, toplam). Yeni yetenek: **`installments.query`**                                         | Mevcut `installments` yeteneği "taksitli tahsilat" anlamındadır; sorgu ayrı bir uç nokta olduğu için ayrı yetenek gerekir.                                                                        |
| K6  | `@kopru/server` kimlik doğrulaması | Zorunlu **Bearer API anahtarı** (`KOPRU_SERVER_API_KEYS`, virgülle ayrılmış). Anahtar yoksa sunucu başlamaz; yalnızca açık `--insecure-no-auth` bayrağıyla yerelde kapatılabilir                                                     | Sunucu ödeme işlemlerini dışarı açar; varsayılan güvenli olmalıdır.                                                                                                                               |
| K7  | Server'da sağlayıcı konfigürasyonu | Ortam değişkenleri (`KOPRU_IYZICO_API_KEY` …) **veya** `kopru.config.json`; ikisi de Zod ile doğrulanır. Programatik kullanımda `createServer({ payment, cargo })`                                                                   | Docker'da ortam değişkeni, kütüphane olarak kullanımda kod tabanlı konfigürasyon doğal olandır.                                                                                                   |
| K8  | Sürüm                              | Faz 2 sonunda tüm paketler **`0.2.0`**; core sözleşme değişiklikleri `0.x` kuralı gereği minor ile yayımlanır                                                                                                                        | Changesets ile; trusted publishing (OIDC) ilk kez bu yayında kullanılır.                                                                                                                          |

Yeni hata kodları (kataloğa eklenecek): `WEBHOOK_SIGNATURE_INVALID`, `IDEMPOTENCY_KEY_CONFLICT`, `PAYMENT_INSTALLMENT_NOT_AVAILABLE`. Yeni terimler (bildirim, BIN sorgusu, taksit seçeneği, idempotency anahtarı) kodlanmadan önce [GLOSSARY.md](../GLOSSARY.md)'ye eklenir.

---

## 1. Kilometre Taşları ve Bağımlılıklar

```
M7 Core sözleşme genişletmeleri (kısmi iade, taksit sorgusu, bildirim, yeni hata kodları)
 ├─▶ M8  @kopru/iyzico genişletmesi
 ├─▶ M9  @kopru/paytr      (mock senaryolarıyla birlikte)
 ├─▶ M10 @kopru/aras       (mock senaryolarıyla birlikte)
 └─▶ M11 @kopru/server     (REST, OpenAPI, Idempotency-Key, Docker)
          └──────┴──────┴─▶ M12 Örnekler + dokümantasyon + 0.2.0 yayını
```

M8, M9, M10 ve M11 birbirinden bağımsızdır ve M7'den sonra paralel yürütülebilir. M7.0 araştırması PayTR ve Aras dokümanlarına bakarak yapılır; böylece core sözleşmesi tek bir sağlayıcıya göre şekillenmez.

---

## M7: Core Sözleşme Genişletmeleri ⬜

**Amaç:** Faz 2 sağlayıcılarının ve REST sunucusunun ihtiyaç duyduğu ortak kavramları core'a eklemek.

| ID   | Görev                                                                                                                                                                                 | Notlar                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| M7.0 | iyzico, PayTR ve Aras dokümanlarından taksit sorgusu, kısmi iade ve bildirim (webhook) alanlarının karşılaştırılması; ortak alt kümenin bu dokümana eklenmesi                         | Sözleşme tasarımından önce; sonuç bu planın "Durum" notuna yazılır |
| M7.1 | `GLOSSARY.md` güncellemesi ve hata kataloğuna yeni kodlar (Türkçe `userMessage` ile)                                                                                                  | K4, K5                                                             |
| M7.2 | `domain/payment`: `InstallmentQueryRequestSchema`, `InstallmentOptionSchema`, `InstallmentQueryResultSchema`; `queryInstallments` işlemi ve `installments.query` yeteneği             | BIN 6–8 hane; tutarlar kuruş                                       |
| M7.3 | `domain/payment`: `PaymentNotificationSchema` (orderId, transactionId, durum, tutar, ham alanlar); `parseNotification({ headers, body, rawBody })` işlemi ve `notifications` yeteneği | Ham gövde imza doğrulaması için korunur                            |
| M7.4 | `domain/cargo`: kargo durum bildirimi için aynı desen (`ShipmentNotificationSchema`, `parseNotification`) — **yalnızca M7.0 en az bir kargo sağlayıcısında push bildirimi bulursa**   | Bulunmazsa Faz 5'e ertelenir                                       |
| M7.5 | `utils/crypto.ts`: imza doğrulama yardımcıları (`verifyHmacSignature` — sabit zamanlı karşılaştırma, hex/base64)                                                                      | Mevcut `safeEqual` üzerine                                         |
| M7.6 | Client: `payment.queryInstallments()`, `payment.parseNotification()`; yeteneğe göre ağ isteği yapılmadan ret                                                                          | ARCHITECTURE §4.3 akışı                                            |
| M7.7 | Contract test paketine yeni işlemler: taksit sorgusu sonuç şeması, bildirimde geçersiz imzanın `WEBHOOK_SIGNATURE_INVALID` dönmesi, kısmi iade tutar kontrolü                         | Fixture'lar sağlayıcıdan gelir                                     |
| M7.8 | `ARCHITECTURE.md` §4.4 yetenek tablosu ve §5.2 doğrulama noktaları güncellemesi                                                                                                       |                                                                    |

**Bitti sayılır:** Sahte sağlayıcılar yeni contract testlerini geçer; core kapsaması ≥ %95 kalır; mevcut iyzico/Yurtiçi testleri değişmeden geçer.

---

## M8: `@kopru/iyzico` Genişletmesi ⬜

**Amaç:** iyzico ile kısmi iade, BIN bazlı taksit sorgusu ve bildirim doğrulaması.

| ID   | Görev                                                                                                                                  | Notlar                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| M8.0 | `NOTES.md` güncellemesi: kısmi iade, taksit sorgusu ve webhook imza biçiminin güncel dokümandan doğrulanması                           | Uygulamadan önce                  |
| M8.1 | `refund.partial`: tutarlı iade; tam iadedeki `/payment/cancel` geri dönüşü yalnızca tam iadede kalır                                   | Tutar dönüşümü yalnızca mapper'da |
| M8.2 | `installments.query`: taksit sorgusu → `InstallmentQueryResult`                                                                        |                                   |
| M8.3 | `notifications`: webhook imza doğrulaması ve `PaymentNotification` eşlemesi                                                            | Geçersiz imza testleri            |
| M8.4 | 3DS v2 değerlendirmesi (NOTES.md §6.3): K4 sonrası sözleşme v2'yi taşıyabiliyorsa geçiş, taşıyamıyorsa gerekçesiyle v1'de kalma kararı | Karar NOTES.md'ye yazılır         |
| M8.5 | Mock senaryoları: kısmi iade (başarı, tutar aşımı), taksit sorgusu (bilinen/bilinmeyen BIN), imzalı/imzasız bildirim                   | Deterministik test BIN'leri       |
| M8.6 | Contract + entegrasyon testleri, README yetenek tablosu                                                                                |                                   |

**Bitti sayılır:** Yeni yetenekler contract testlerini ve mock senaryolarını geçer.

---

## M9: `@kopru/paytr` ⬜

**Amaç:** İkinci ödeme sağlayıcısı ile core sözleşmesinin farklı bir akışı (asenkron bildirim) taşıyabildiğini kanıtlamak.

| ID   | Görev                                                                                                                                                     | Notlar                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| M9.0 | PayTR dokümanının incelenmesi (Direct API, bildirim URL'i ve hash, iade, taksit/BIN sorgusu, hata kodları) → `packages/payment-paytr/NOTES.md`            | Hangi API'nin (Direct / iFrame) kullanılacağı burada kararlaştırılır |
| M9.1 | `config.ts`: `merchantId`, `merchantKey`, `merchantSalt`, `testMode`, `baseUrl`                                                                           | Anahtarlar maskelenir                                                |
| M9.2 | `auth.ts`: token/hash üretimi (resmi örneklerle birim testi)                                                                                              |                                                                      |
| M9.3 | `schemas/` ve `mappers/`                                                                                                                                  |                                                                      |
| M9.4 | `errors.ts`: hata eşleme tablosu                                                                                                                          | Eşlenmeyen → `PROVIDER_UNEXPECTED_RESPONSE`                          |
| M9.5 | `provider.ts`: `initThreeDS`, `parseNotification`, `refund` (+ `refund.partial`), `queryInstallments`; desteklenmeyen işlemler yetenek olarak bildirilmez | Non-3DS desteği M9.0 sonucuna bağlı                                  |
| M9.6 | Mock eklentisi `packages/mock-server/src/plugins/paytr/`: 3DS → bildirim akışı, ret, iade, taksit sorgusu, zaman aşımı                                    | Mock, bildirimi `callbackUrl`'e imzalı POST ile gönderir             |
| M9.7 | Contract + entegrasyon testleri, Türkçe README, `LICENSE`, smoke test'e eklenmesi                                                                         |                                                                      |

**Bitti sayılır:** Contract testleri ve tüm mock senaryoları geçer; paket smoke testinde ESM/CJS olarak kurulur.

---

## M10: `@kopru/aras` ⬜

**Amaç:** İkinci kargo sağlayıcısı.

| ID    | Görev                                                                                                                           | Notlar                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| M10.0 | Aras Kargo entegrasyon dokümanının incelenmesi (protokol, operasyonlar, durum ve hata kodları) → `packages/cargo-aras/NOTES.md` | Protokol SOAP ise ADR-0004/0005 yaklaşımı aynen uygulanır |
| M10.1 | `config.ts`, istemci adaptörü (SOAP veya REST)                                                                                  |                                                           |
| M10.2 | `schemas/`, `mappers/`, `status-map.ts` (→ `ShipmentStatus`), `errors.ts`                                                       | Eşlenmeyen durum → `unknown` + ham değer                  |
| M10.3 | `provider.ts`: `createShipment`, `cancelShipment`, `trackShipment`; `cashOnDelivery` yalnızca doküman doğrulanırsa              |                                                           |
| M10.4 | Mock eklentisi `plugins/aras/`: oluşturma, geçersiz adres, iptal, takip geçmişi, bulunamayan gönderi                            |                                                           |
| M10.5 | Contract + entegrasyon testleri, Türkçe README, `LICENSE`, smoke test                                                           |                                                           |

**Bitti sayılır:** Contract testleri ve tüm mock senaryoları geçer. Yurtiçi'deki gibi doğrulanamayan varsayımlar NOTES.md'de işaretlenir.

---

## M11: `@kopru/server` ⬜

**Amaç:** Köprü'yü dilden bağımsız bir JSON/REST servisi olarak çalıştırmak (ARCHITECTURE §6.4, §7).

| ID     | Görev                                                                                                                                                                                             | Notlar                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| M11.0  | ADR-0007 (Hono), ADR-0008 (OpenAPI), ADR-0009 (idempotency) yazımı                                                                                                                                | K1–K3 onayından sonra                                              |
| M11.1  | Paket iskeleti; programatik API `createServer({ payment?, cargo?, apiKeys, idempotencyStore? })` → Hono uygulaması; `startServer({ port })`                                                       | Sağlayıcılar `peerDependency`; server hiçbirini zorunlu paketlemez |
| M11.2  | Hata zarfı ve HTTP durum eşlemesi (§6.4), `requestId` üretimi, maskeli istek logu                                                                                                                 | Kategori → durum kodu tablosu tek yerde                            |
| M11.3  | Bearer API anahtarı ara katmanı (K6), sabit zamanlı karşılaştırma                                                                                                                                 |                                                                    |
| M11.4  | Ödeme uçları: `POST /v1/payments/charge`, `/v1/payments/3ds/init`, `/v1/payments/3ds/complete`, `/v1/payments/refunds`, `/v1/payments/installments/query`, `/v1/payments/notifications/:provider` | Bildirim ucu API anahtarı yerine sağlayıcı imzasıyla korunur       |
| M11.5  | Kargo uçları: `POST /v1/cargo/shipments`, `DELETE /v1/cargo/shipments/:id`, `GET /v1/cargo/shipments/:id/tracking`                                                                                |                                                                    |
| M11.6  | `Idempotency-Key`: yazma uçlarında; aynı anahtar + aynı gövde → kayıtlı yanıt, farklı gövde → `IDEMPOTENCY_KEY_CONFLICT` (422), işlemdeyken → 409                                                 | Gövde parmak izi SHA-256                                           |
| M11.7  | OpenAPI 3.1 dokümanı: `GET /openapi.json`; şemalar core'dan `z.toJSONSchema()` ile                                                                                                                | Dokümanın snapshot testi + geçerlilik doğrulaması                  |
| M11.8  | Ortam değişkeni / `kopru.config.json` konfigürasyonu (K7), CLI `kopru-server`                                                                                                                     | Hatalı konfigürasyon → başlangıçta `ConfigurationError`            |
| M11.9  | `GET /health` ve `GET /ready`                                                                                                                                                                     |                                                                    |
| M11.10 | Dockerfile (çok aşamalı, Node 22 slim, root olmayan kullanıcı), CI'da imaj derleme ve mock server'a karşı duman testi                                                                             | GHCR'ye yayın M12'de ve kullanıcı onayıyla                         |
| M11.11 | Entegrasyon testleri: mock server'a karşı tüm uçlar, kimlik doğrulama, idempotency yarış durumu, hassas verinin logda olmadığı test                                                               |                                                                    |

**Bitti sayılır:** Tüm uçlar mock server'a karşı uçtan uca test edilmiştir; OpenAPI dokümanı geçerlidir; Docker imajı CI'da derlenir ve `/health` yanıt verir.

---

## M12: Örnekler, Dokümantasyon ve `0.2.0` Yayını ⬜

| ID    | Görev                                                                                                       | Notlar                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| M12.1 | `examples/checkout-flow`'un sağlayıcı seçilebilir hale getirilmesi (iyzico/PayTR, Yurtiçi/Aras)             |                                                                       |
| M12.2 | `examples/rest-client`: `@kopru/server`'a `curl` ve basit bir istemciyle istek atan örnek                   | Faz 5'teki diğer dil örneklerinin temeli                              |
| M12.3 | `docs/guides/rest-server.md` (Docker ile çalıştırma, konfigürasyon, idempotency), `docs/guides/webhooks.md` |                                                                       |
| M12.4 | Kök README paket tablosu ve ARCHITECTURE güncellemesi                                                       |                                                                       |
| M12.5 | npm'de trusted publisher ayarları (yeni paketler dahil) ve "disallow tokens"; yeni paketlerin ilk yayını    | Yapılandırma 2 gün içinde yayın yapılmazsa düşer; yayından hemen önce |
| M12.6 | Changesets ile `0.2.0`, `release.yml` ile OIDC yayını; Docker imajının GHCR'ye gönderilmesi                 | Yayın kullanıcı onayıyla                                              |
| M12.7 | ROADMAP'te Faz 2'nin tamamlandı olarak işaretlenmesi                                                        |                                                                       |

> **Not (M12.5):** `@kopru/paytr`, `@kopru/aras` ve `@kopru/server` npm'de henüz yoktur. Trusted publishing paketin var olmasını gerektirdiği için bu paketlerin ilk yayını Faz 1'deki gibi yerelden 2FA ile yapılır, ardından trusted publisher tanımlanır.

---

## 2. Faz 2 Tamamlanma Kriterleri (Definition of Done)

- [ ] Temiz bir klonda `pnpm install && pnpm build && pnpm test` kimlik bilgisi olmadan geçer; CI Node 22 ve 24'te yeşildir.
- [ ] iyzico, PayTR, Yurtiçi ve Aras paketleri genişletilmiş contract test paketini geçer.
- [ ] iyzico ve PayTR'de kısmi iade ve BIN bazlı taksit sorgusu mock'a karşı çalışır.
- [ ] Bildirim (webhook) imzaları sağlayıcı paketinde doğrulanır; geçersiz imza testle kanıtlanmıştır.
- [ ] `@kopru/server` Docker imajı mock server'a karşı ödeme, 3DS, iade, gönderi ve takip akışını tamamlar; `Idempotency-Key` tekrar eden isteği ikinci kez sağlayıcıya iletmez.
- [ ] OpenAPI 3.1 dokümanı core şemalarından üretilir ve geçerlidir.
- [ ] Kod tabanında `any` ve `@ts-ignore` yoktur; core kapsaması ≥ %90, sağlayıcılar ve server ≥ %80.
- [ ] Tüm paketler `0.2.0` olarak trusted publishing ile yayımlanmıştır.

## 3. Riskler

| Risk                                                                 | Etki                                  | Önlem                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| PayTR'nin asenkron akışının mevcut 3DS sözleşmesine uymaması         | Core'da kırıcı değişiklik             | M7.0'da sözleşme PayTR'ye bakılarak tasarlanır (K4); `0.x` içinde minor ile yayımlanır, CHANGELOG'da belirtilir |
| Aras dokümanına veya test ortamına erişim olmaması                   | Doğrulanmamış varsayımlar             | Yurtiçi'deki gibi varsayımlar NOTES.md'de işaretlenir; mock birincil test ortamıdır                             |
| REST sunucusunun güvenlik yüzeyi                                     | Yetkisiz ödeme işlemi, veri sızıntısı | Varsayılan zorunlu API anahtarı (K6), maskeli log, bildirim uçlarında sağlayıcı imzası, logda hassas veri testi |
| Idempotency'nin çoklu instance'ta bellek içi depoyla tutarsız olması | Çift tahsilat                         | Bellek içi depo yalnızca tek instance için belgelenir; paylaşılan depo için arayüz ve rehber sunulur            |
| Sandbox kimlik bilgisi olmaması                                      | Gerçek davranış doğrulanamaz          | Mock birincil; sandbox testleri opsiyonel ve ayrı CI işi                                                        |
| Kapsam kayması                                                       | Fazın uzaması                         | Kapsam dışı maddeler bu dokümanın başında sabittir; yeni istekler Faz 3+ maddelerine yazılır                    |
