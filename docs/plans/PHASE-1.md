# Faz 1 (MVP): Uygulama Planı

Bu doküman, [ROADMAP.md](../../ROADMAP.md) içindeki Faz 1 hedeflerini sıralı, bağımlılıkları belli ve tek tek doğrulanabilir görevlere böler. Her görev tek bir PR (veya küçük bir PR grubu) olacak büyüklüktedir.

- **Kapsam:** Altyapı, `@kopru/core`, `@kopru/iyzico`, `@kopru/yurtici`, `@kopru/mock-server`, örnek uygulama ve dokümantasyon.
- **Kapsam dışı:** `@kopru/server` (REST), banka sanal POS'ları, e-Dönüşüm, taksit sorgulama, kısmi iade, ön provizyon.
- **Referanslar:** [ARCHITECTURE.md](../../ARCHITECTURE.md), [CLAUDE.md](../../CLAUDE.md), [GLOSSARY.md](../GLOSSARY.md)

**Görev durumu:** ⬜ Başlanmadı · 🟨 Devam ediyor · ✅ Tamamlandı

---

## 0. Faz Başında Verilen Kararlar (ADR)

Aşağıdaki kararlar 2026-11-16 tarihinde onaylanmış ve [docs/adr](../adr/README.md) altında kayda geçirilmiştir.

| #        | Karar                    | Karar                                                                                         | Gerekçe                                                                               |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| ADR-0001 | Build aracı              | **tsup**                                                                                      | ESM + CJS + `.d.ts` çıktısını tek konfigürasyonla üretir, monorepoda yaygın ve sade.  |
| ADR-0002 | `Result` tipi            | **Kendi implementasyonumuz** (core içinde, ~50 satır)                                         | Harici bağımlılık eklememek; API'yi alanımıza göre şekillendirmek.                    |
| ADR-0003 | Mock server HTTP katmanı | **Hono** (Node adapter)                                                                       | Hafif, tip güvenli, Faz 2'deki `@kopru/server` için de aday; tek framework öğrenilir. |
| ADR-0004 | SOAP istemcisi           | **Harici SOAP kütüphanesi yok**; core'daki XML yardımcıları + `fetch` ile elle zarf oluşturma | `soap` paketleri ağır ve tip güvenliği zayıf; ihtiyacımız birkaç operasyonla sınırlı. |
| ADR-0005 | XML ayrıştırıcı          | **fast-xml-parser**                                                                           | Bağımlılıksız, hızlı, iki yönlü (parse + build).                                      |
| ADR-0006 | Node.js minimum sürümü   | **22** (CI: 22 + 24)                                                                          | Node 20 Nisan 2026'da EOL oldu; araçlar (tsup 9, vitest 5) ≥ 22 gerektiriyor.         |

---

## 1. Kilometre Taşları ve Bağımlılıklar

```
M0 Altyapı
 └─▶ M1 Core temelleri (primitives, Result, errors)
      └─▶ M2 Core sağlayıcı katmanı (provider sözleşmeleri, HTTP, client)
           ├─▶ M3 Mock server çatısı
           │    ├─▶ M4 iyzico  (mock senaryolarıyla birlikte)
           │    └─▶ M5 Yurtiçi (mock senaryolarıyla birlikte)
           └────────────┴─▶ M6 Örnek uygulama + dokümantasyon + 0.1.0 yayını
```

M4 ve M5 birbirinden bağımsızdır ve paralel yürütülebilir.

---

## M0: Altyapı ✅

**Amaç:** Boş ama tam çalışan bir monorepo: `pnpm install && pnpm build && pnpm test` yeşil.

| ID    | Görev                                                                                                                                                                  | Çıktı                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| M0.1  | Kök `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `.gitignore`, `.editorconfig`                                                                           | Workspace iskeleti                       |
| M0.2  | `tooling/tsconfig`: `base.json` (strict + CLAUDE.md'deki ek bayraklar), `library.json`                                                                                 | Paylaşılan tsconfig                      |
| M0.3  | `tooling/eslint-config`: typescript-eslint strict-type-checked, `no-explicit-any: error`, `no-default-export`, import sınırları (sağlayıcılar birbirini import edemez) | Paylaşılan lint                          |
| M0.4  | Prettier konfigürasyonu                                                                                                                                                | Format standardı                         |
| M0.5  | Turborepo: `build`, `typecheck`, `lint`, `test` pipeline'ları                                                                                                          | `turbo.json`                             |
| M0.6  | Vitest projeler konfigürasyonu                                                                                                                                         | Kök `vitest.config.ts` (`test.projects`) |
| M0.7  | tsup ortak konfigürasyonu                                                                                                                                              | Paket başına tek satırlık build ayarı    |
| M0.8  | GitHub Actions: Node 22 & 24 matrisinde format → lint → typecheck → test → build                                                                                       | `.github/workflows/ci.yml`               |
| M0.9  | Changesets kurulumu                                                                                                                                                    | `.changeset/`                            |
| M0.10 | `LICENSE` (MIT), `CONTRIBUTING.md` taslağı                                                                                                                             | Lisans ve katkı rehberi                  |

**Bitti sayılır:** Boş bir `@kopru/core` paketi derlenir, tek bir örnek test geçer, CI yeşil.

---

## M1: Core Temelleri ✅

**Amaç:** Tüm paketlerin kullanacağı değer tipleri, sonuç tipi ve hata sistemi.

| ID   | Görev                                                                                                                                            | Notlar                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| M1.1 | `result/`: `Result<T, E>`, `ok()`, `err()`, `isOk()`, `isErr()`, `unwrap()`                                                                      | Discriminated union: `{ ok: true, value }` \| `{ ok: false, error }`                                 |
| M1.2 | `errors/codes.ts`: hata kodu kataloğu (`as const` + tip)                                                                                         | ARCHITECTURE.md §6.3'teki kodlar                                                                     |
| M1.3 | `errors/`: `KopruError` ve alt sınıflar (`ValidationError`, `PaymentError`, `CargoError`, `ProviderError`, `NetworkError`, `ConfigurationError`) | `toJSON()` ile serileştirilebilir; `cause` desteği                                                   |
| M1.4 | `errors/from-zod.ts`: `ZodError` → `ValidationError` dönüştürücü                                                                                 | Issue'lar `details.issues` içinde                                                                    |
| M1.5 | `primitives/money.ts`: `MoneySchema`, `Currency`                                                                                                 | Kuruş cinsinden tam sayı; `toDecimalString()` / `fromDecimalString()` yardımcıları (mapper'lar için) |
| M1.6 | `primitives/identity.ts`: `TCKNSchema` (algoritmik doğrulama), `VKNSchema`                                                                       | Test vektörleri ile                                                                                  |
| M1.7 | `primitives/phone.ts`: `PhoneNumberSchema` (E.164, TR normalizasyonu: `0532…` → `+90532…`)                                                       |                                                                                                      |
| M1.8 | `primitives/address.ts`: `AddressSchema`, il plaka kodu (01–81) listesi                                                                          | İlçe listesi Faz 1'de serbest metin                                                                  |
| M1.9 | `primitives/iban.ts`: `IBANSchema` (TR, mod-97 doğrulama)                                                                                        |                                                                                                      |

**Bitti sayılır:** Tüm primitives için birim testleri (geçerli/geçersiz örnekler) geçer; kapsama ≥ %95.

> ✅ 2026-11-18 tamamlandı: 95 birim testi; kapsama satır %100, dal %98.9. Ek olarak `unwrapOr`, `mapResult`, `validate()` (şema → `Result`), `createKopruError()` (koda göre alt sınıf) ve katalogda varsayılan Türkçe `userMessage` eklendi.

---

## M2: Core Sağlayıcı Katmanı ✅

**Amaç:** Sağlayıcıların uyacağı sözleşmeler ve kullanacağı ortak altyapı.

| ID    | Görev                                                                                                                                                                                                  | Notlar                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| M2.1  | `domain/payment/schemas.ts`: `CardSchema`, `BuyerSchema`, `ChargeRequestSchema`, `ChargeResultSchema`, `ThreeDSInitResultSchema`, `ThreeDSCallbackSchema`, `RefundRequestSchema`, `RefundResultSchema` | İsimler GLOSSARY.md'ye göre                                                        |
| M2.2  | `domain/payment/provider.ts`: `PaymentProvider` arayüzü, `PaymentCapabilities`                                                                                                                         |                                                                                    |
| M2.3  | `domain/cargo/schemas.ts`: `CreateShipmentRequestSchema`, `ShipmentSchema`, `TrackingEventSchema`, `ShipmentStatusSchema`                                                                              | GLOSSARY.md'deki standart durumlar                                                 |
| M2.4  | `domain/cargo/provider.ts`: `CargoProvider` arayüzü, `CargoCapabilities`                                                                                                                               |                                                                                    |
| M2.5  | `provider/define-provider.ts`: `definePaymentProvider`, `defineCargoProvider` yardımcıları; config şemasının otomatik doğrulanması                                                                     | Hatalı config → `ConfigurationError` (fırlatılır)                                  |
| M2.6  | `provider/capabilities.ts`: capability kontrolü, `supports()`                                                                                                                                          | Desteklenmeyen işlem → `PROVIDER_CAPABILITY_NOT_SUPPORTED`, ağ isteği yapılmaz     |
| M2.7  | `http/client.ts`: `fetch` tabanlı istemci; timeout, yalnızca idempotent işlemlerde retry (exponential backoff), `onRequest`/`onResponse` log kancaları                                                 | Ağ hataları → `NetworkError` (`retryable: true`)                                   |
| M2.8  | `http/redact.ts`: kart no, CVC, apiKey, secret, TCKN maskeleme                                                                                                                                         | Log kancalarına giden her veri buradan geçer                                       |
| M2.9  | `utils/crypto.ts`: HMAC-SHA256/SHA1/SHA512, Base64 yardımcıları                                                                                                                                        |                                                                                    |
| M2.10 | `utils/xml.ts`: XML ↔ JSON, SOAP zarfı oluşturma/çözme                                                                                                                                                 | fast-xml-parser üzerine ince katman                                                |
| M2.11 | `client/`: `createPaymentClient`, `createCargoClient`: girdi doğrulama → capability → provider çağrısı → çıktı doğrulama                                                                               | ARCHITECTURE.md §4.3 akışı                                                         |
| M2.12 | `testing/` alt export'u (`@kopru/core/testing`): sağlayıcılar için **contract test paketi**                                                                                                            | `runPaymentProviderContract(provider, fixtures)` / `runCargoProviderContract(...)` |

**Bitti sayılır:** Sahte (in-memory) bir `PaymentProvider` ve `CargoProvider` contract test paketini geçer; client akışı uçtan uca test edilmiştir.

> ✅ 2026-11-18 tamamlandı: 4 sahte sağlayıcı (tam ve kısıtlı yetenekli ödeme/kargo) sözleşme paketlerini geçer; toplam 186 test, kapsama satır %99.7 / dal %98.3 (`src/testing` hariç). Notlar:
>
> - Yetenekler nesne yerine metin listesiyle bildirilir (`['charge', 'refund.partial']`); client girdiye göre gereken yetenekleri hesaplar.
> - `fast-xml-builder` doğrudan bağımlılık olarak eklendi (ADR-0005 ek notu).
> - `@kopru/core/testing` yalnızca ESM'dir (Vitest CommonJS'ten yüklenemez).
> - Ek: `utils/date.ts` (`formatIstanbulDateTime`, `DateTimeSchema`), `safeEqual` (callback imza doğrulaması için).

---

## M3: Mock Server Çatısı ✅

**Amaç:** Sağlayıcı senaryolarının eklenebileceği, testlerden programatik başlatılabilen sunucu.

| ID   | Görev                                                                                                | Notlar                                                   |
| ---- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| M3.1 | `@kopru/mock-server` paketi, Hono tabanlı uygulama                                                   |                                                          |
| M3.2 | Senaryo kayıt API'si: her sağlayıcı kendi route'larını ve senaryolarını bir "plugin" olarak kaydeder |                                                          |
| M3.3 | Programatik API: `startMockServer({ port?: 0 })` → `{ url, stop() }`                                 | Vitest `globalSetup` içinde kullanılır                   |
| M3.4 | CLI: `kopru-mock --port 4010`                                                                        |                                                          |
| M3.5 | İstek kaydı (request log) ve testlerde sorgulanabilmesi                                              | Testte "sağlayıcıya şu istek gitti mi?" doğrulaması için |
| M3.6 | 3DS simülasyonu için basit HTML sayfası (otomatik form-post ile callback'e dönüş)                    |                                                          |

**Bitti sayılır:** Örnek bir "echo" senaryosu ile sunucu testlerden başlatılıp durdurulabiliyor.

> ✅ 2026-11-19 tamamlandı: `echo` eklentisi ile sunucu hem test içinden hem Vitest `globalSetup` üzerinden başlatılıp durduruluyor; 74 test, `mock-server/src` kapsaması satır %97.8 / dal %96 (`cli.ts` giriş dosyası hariç; kalanlar savunma amaçlı hata dalları). Notlar:
>
> - Sağlayıcı senaryoları `packages/mock-server/src/plugins/<sağlayıcı>/` altında yaşar; sağlayıcı paketleri yalnızca core'a bağımlı kalır ve mock, sağlayıcının ham HTTP sözleşmesine göre yazılır.
> - İstek kaydı core'un maskeleme yardımcılarından geçer; kart numarası, CVC, `Authorization` ve TCKN açık tutulmaz. Başka süreçteki sunucunun kaydı `/__kopru/requests` ve `createMockServerClient` ile sorgulanır.
> - 3DS simülasyonu `renderAutoPostPage` ile; eklentiler 3DS yönlendirme adreslerini `context.baseUrl()` ile üretir.
> - Sunucu `@hono/node-server`'ın `getRequestListener`'ı ile Node `http.createServer` üzerine kurulur; `stop()` açık bağlantıları da kapatır.

---

## M4: `@kopru/iyzico` ⬜

**Amaç:** iyzico ile non-3DS ödeme, 3DS ödeme ve tam iade.

| ID   | Görev                                                                                                                                                            | Notlar                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M4.0 | iyzico API dokümanının incelenmesi; kullanılacak endpoint'lerin, imzalama yönteminin ve hata kodlarının `packages/payment-iyzico/NOTES.md` dosyasına çıkarılması | Uygulamadan önce güncel dokümandan doğrulanır     |
| M4.1 | `config.ts`: `apiKey`, `secretKey`, `baseUrl` / `sandbox` şeması                                                                                                 |                                                   |
| M4.2 | `auth.ts`: istek imzalama ve `Authorization` başlığı                                                                                                             | Resmi dokümandaki test vektörleri ile birim testi |
| M4.3 | `schemas/`: ham istek/yanıt Zod şemaları (yalnızca kullanılan alanlar katı)                                                                                      |                                                   |
| M4.4 | `mappers/`: `ChargeRequest` → iyzico isteği; iyzico yanıtı → `ChargeResult`                                                                                      | Tutar dönüşümü yalnızca burada                    |
| M4.5 | `errors.ts`: iyzico hata kodu → Köprü hata kodu tablosu                                                                                                          | Eşlenmeyen → `PROVIDER_UNEXPECTED_RESPONSE`       |
| M4.6 | `provider.ts`: `charge`, `initThreeDS`, `completeThreeDS`, `refund`                                                                                              |                                                   |
| M4.7 | Mock senaryoları: başarı, kart reddi, yetersiz bakiye, 3DS başarı/başarısız, iade, zaman aşımı                                                                   | Deterministik test kartlarıyla                    |
| M4.8 | Contract test paketi + entegrasyon testleri (mock server'a karşı)                                                                                                |                                                   |
| M4.9 | Paket README'si (Türkçe)                                                                                                                                         |                                                   |

**Bitti sayılır:** Contract testleri ve tüm mock senaryoları geçer; sandbox'a karşı manuel duman testi (opsiyonel, kimlik bilgisi varsa) yapılmıştır.

---

## M5: `@kopru/yurtici` ⬜

**Amaç:** Yurtiçi Kargo ile gönderi oluşturma, iptal ve takip.

| ID    | Görev                                                                                                                                                                    | Notlar                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| M5.0  | Yurtiçi Kargo web servis dokümanının incelenmesi; operasyonların, alanların, durum kodlarının ve hata kodlarının `packages/cargo-yurtici/NOTES.md` dosyasına çıkarılması | Uygulamadan önce güncel dokümandan doğrulanır         |
| M5.1  | `config.ts`: kullanıcı adı, şifre, dil, `baseUrl` / `sandbox` şeması                                                                                                     |                                                       |
| M5.2  | `soap.ts`: operasyon bazlı SOAP zarfı oluşturma ve yanıt çözme (core `utils/xml` üzerine)                                                                                |                                                       |
| M5.3  | `schemas/`: ham SOAP yanıtlarının (JSON'a çevrilmiş hali) Zod şemaları                                                                                                   |                                                       |
| M5.4  | `mappers/`: `CreateShipmentRequest` ⇄ Yurtiçi formatı; Yurtiçi hareketleri → `TrackingEvent[]`                                                                           |                                                       |
| M5.5  | `status-map.ts`: Yurtiçi durum kodları → `ShipmentStatus`                                                                                                                | Eşlenmeyen → `unknown` + ham değer                    |
| M5.6  | `errors.ts`: hata kodu eşleme tablosu                                                                                                                                    |                                                       |
| M5.7  | `provider.ts`: `createShipment`, `cancelShipment`, `trackShipment`                                                                                                       |                                                       |
| M5.8  | Mock senaryoları: oluşturma, geçersiz adres, iptal, çok adımlı takip geçmişi, bulunamayan gönderi                                                                        | SOAP yanıtları gerçek örneklerden (anonimleştirilmiş) |
| M5.9  | Contract test paketi + entegrasyon testleri                                                                                                                              |                                                       |
| M5.10 | Paket README'si (Türkçe)                                                                                                                                                 |                                                       |

**Bitti sayılır:** Contract testleri ve tüm mock senaryoları geçer.

---

## M6: Örnek Uygulama, Dokümantasyon ve Yayın ⬜

| ID   | Görev                                                                                                  | Notlar                                     |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| M6.1 | `examples/checkout-flow`: mock server'a karşı ödeme (3DS dahil) → kargo oluşturma → takip → iade akışı | Kimlik bilgisi gerektirmez                 |
| M6.2 | `docs/guides/adding-a-provider.md`                                                                     | ARCHITECTURE.md §4.5'in genişletilmiş hali |
| M6.3 | `docs/guides/testing-with-mock-server.md`                                                              | Test kartları ve takip numaraları tablosu  |
| M6.4 | `CONTRIBUTING.md` son hali                                                                             |                                            |
| M6.5 | Changesets ile `0.1.0` sürümü; npm yayın iş akışı (`release.yml`)                                      | Yayın kullanıcı onayıyla yapılır           |
| M6.6 | ROADMAP.md'de Faz 1'in tamamlandı olarak işaretlenmesi                                                 |                                            |

---

## 2. Faz 1 Tamamlanma Kriterleri (Definition of Done)

ROADMAP.md'deki kriterlerin ölçülebilir hali:

- [ ] Temiz bir klonda `pnpm install && pnpm build && pnpm test` kimlik bilgisi olmadan geçer.
- [ ] CI, Node 22 ve 24'te yeşildir.
- [ ] `pnpm lint` sıfır uyarı ile geçer; kod tabanında `any` ve `@ts-ignore` yoktur.
- [ ] iyzico ve Yurtiçi paketleri contract test paketini geçer.
- [ ] `examples/checkout-flow` uçtan uca çalışır.
- [ ] Core test kapsaması ≥ %90, sağlayıcı paketleri ≥ %80.
- [ ] Tüm public API'ler Türkçe JSDoc ile belgelidir.
- [ ] Log çıktılarında hassas veri bulunmadığı bir testle doğrulanmıştır.

## 3. Riskler

| Risk                                                 | Etki                         | Önlem                                                                                                          |
| ---------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Sağlayıcı dokümanlarının eksik/güncel olmaması       | Yanlış eşleme, gizli hatalar | M4.0 / M5.0 araştırma görevleri; ham yanıtların Zod ile doğrulanması; gerçek yanıt fixture'ları                |
| Sandbox hesaplarına erişim olmaması                  | Gerçek davranış doğrulanamaz | Mock server birincil test ortamı; sandbox testleri opsiyonel ve ayrı CI işi                                    |
| Core sözleşmesinin tek sağlayıcıya göre şekillenmesi | Faz 2'de kırıcı değişiklik   | Sözleşme tasarlanırken PayTR/Aras dokümanlarına da göz atılır; `0.x` sürümünde kırıcı değişikliğe izin verilir |
| Yurtiçi SOAP karmaşıklığı                            | M5'te gecikme                | ADR-0004 ile ince, operasyon bazlı adaptör; tüm WSDL'i modellemeye çalışılmaz                                  |
| Kapsam kayması                                       | MVP'nin uzaması              | Kapsam dışı maddeler bu dokümanın başında sabittir; yeni istekler Faz 2'ye yazılır                             |
