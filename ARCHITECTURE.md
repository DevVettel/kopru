# Köprü — Mimari Tasarım Dökümanı

Bu döküman Köprü'nün teknik mimarisini, paket yapısını ve temel tasarım kararlarını tanımlar. Kod yazılırken bu döküman referans alınır; mimariyi değiştiren her karar önce burada güncellenir.

---

## 1. Tasarım İlkeleri

1. **Sağlayıcıdan bağımsız çekirdek.** `@kopru/core` hiçbir sağlayıcıyı tanımaz; yalnızca sözleşmeleri (arayüzler, şemalar, hatalar) tanımlar.
2. **Sağlayıcılar eklentidir.** Her sağlayıcı ayrı bir pakettir ve core'daki sözleşmeyi uygular. Kullanıcı yalnızca ihtiyaç duyduğu paketi kurar.
3. **Sınırlarda doğrulama.** Dışarıdan gelen her veri (kullanıcı girdisi ve sağlayıcı yanıtı) Zod ile doğrulanır. İçeride veri her zaman tip güvenlidir.
4. **Hatalar veridir.** Beklenen iş hataları (kart reddi, geçersiz adres) `Result` tipi ile döner; beklenmeyen hatalar `KopruError` olarak fırlatılır.
5. **Tek doğruluk kaynağı.** Ortak tipler, şemalar ve yardımcılar yalnızca `@kopru/core` içinde tanımlanır.
6. **Sıfır gizli yan etki.** Paketler global durum tutmaz; tüm konfigürasyon açıkça enjekte edilir.

---

## 2. Monorepo Yapısı (pnpm workspaces)

Proje, **pnpm workspaces** ile yönetilen bir monorepodur. Derleme orkestrasyonu için Turborepo, sürümleme ve yayımlama için Changesets kullanılması planlanmaktadır.

```
kopru/
├── packages/
│   ├── core/                  # @kopru/core — sözleşmeler, şemalar, hatalar, yardımcılar
│   ├── payment-iyzico/        # @kopru/iyzico — iyzico ödeme sağlayıcısı
│   ├── cargo-yurtici/         # @kopru/yurtici — Yurtiçi Kargo sağlayıcısı
│   ├── server/                # @kopru/server — standart JSON/REST ara katmanı
│   └── mock-server/           # @kopru/mock-server — sağlayıcı taklit sunucusu
├── tooling/
│   ├── tsconfig/              # Paylaşılan tsconfig tabanları (strict)
│   └── eslint-config/         # Paylaşılan lint kuralları
├── examples/                  # Örnek uygulamalar
├── docs/                      # Ek dökümanlar, ADR'ler
├── pnpm-workspace.yaml
├── package.json
├── README.md
├── ARCHITECTURE.md
├── ROADMAP.md
└── CLAUDE.md
```

### Bağımlılık kuralları

```
           ┌──────────────┐
           │  @kopru/core │  ← hiçbir @kopru paketine bağımlı değildir
           └──────▲───────┘
      ┌───────────┼─────────────┬──────────────────┐
      │           │             │                  │
┌─────┴─────┐ ┌───┴───────┐ ┌───┴──────────┐ ┌─────┴──────────────┐
│ @kopru/   │ │ @kopru/   │ │ @kopru/      │ │ @kopru/            │
│ iyzico    │ │ yurtici   │ │ server       │ │ mock-server        │
└───────────┘ └───────────┘ └──────────────┘ └────────────────────┘
```

- Sağlayıcı paketleri yalnızca `@kopru/core`'a bağımlıdır; **birbirlerine asla bağımlı olamazlar.**
- `@kopru/core` → `zod` dışında çalışma zamanı bağımlılığı minimum tutulur.
- `@kopru/server`, sağlayıcıları `peerDependency` / dinamik kayıt ile kullanır; hepsini zorunlu olarak paketlemez.
- Workspace içi bağımlılıklar `workspace:*` protokolü ile tanımlanır.

### Paket çıktıları

- ESM + CJS çift çıktı, `.d.ts` tip tanımlarıyla birlikte.
- Node.js ≥ 22 hedeflenir; `fetch` yerleşik olarak kullanılır (bkz. [ADR-0006](./docs/adr/0006-node-version.md)).

---

## 3. `@kopru/core` Sorumlulukları

Core, projenin "anayasası"dır. Sorumlulukları:

| Modül             | Sorumluluk                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/payment`  | Ödeme alanı şemaları: `ChargeRequest`, `ChargeResult`, `RefundRequest`, `ThreeDSInitResult`, `Installment` vb. ve `PaymentProvider` arayüzü    |
| `domain/cargo`    | Kargo alanı şemaları: `CreateShipmentRequest`, `Shipment`, `TrackingEvent`, `ShipmentStatus` ve `CargoProvider` arayüzü                        |
| `domain/einvoice` | e-Dönüşüm şemaları ve `EInvoiceProvider` arayüzü (Faz 2+)                                                                                      |
| `primitives`      | Ortak değer tipleri: `Money` (kuruş cinsinden tam sayı + para birimi), `Address` (il/ilçe kodlu), `PhoneNumber` (E.164), `TCKN`, `VKN`, `IBAN` |
| `errors`          | `KopruError` hiyerarşisi ve standart hata kodları kataloğu                                                                                     |
| `result`          | `Result<T, E>` tipi ve yardımcıları (`ok`, `err`)                                                                                              |
| `provider`        | Provider tanımlama yardımcısı (`defineProvider`), yetenek (capability) sistemi, kayıt (registry)                                               |
| `http`            | Sağlayıcıların kullandığı ortak HTTP istemcisi: zaman aşımı, yeniden deneme, loglama kancaları, hassas veri maskeleme                          |
| `utils`           | Hash/HMAC imzalama, XML ↔ JSON dönüşümü, tarih/saat (Europe/Istanbul) yardımcıları                                                             |
| `client`          | Kullanıcıya açılan fabrika fonksiyonları: `createPaymentClient`, `createCargoClient`                                                           |

> Core, **hiçbir sağlayıcıya özgü** alan, sabit veya mantık içermez.

---

## 4. Provider Eklenti Mimarisi

### 4.1. Sözleşme

Her alan (domain) için core bir provider arayüzü tanımlar. Kavramsal olarak:

```ts
// @kopru/core — kavramsal taslak
interface PaymentProvider {
  readonly id: string; // "iyzico"
  readonly capabilities: PaymentCapabilities; // { threeDS: true, installments: true, refund: true, ... }

  charge(input: ChargeRequest, ctx: ProviderContext): Promise<Result<ChargeResult, KopruError>>;
  initThreeDS(
    input: ChargeRequest,
    ctx: ProviderContext,
  ): Promise<Result<ThreeDSInitResult, KopruError>>;
  completeThreeDS(
    input: ThreeDSCallback,
    ctx: ProviderContext,
  ): Promise<Result<ChargeResult, KopruError>>;
  refund(input: RefundRequest, ctx: ProviderContext): Promise<Result<RefundResult, KopruError>>;
}
```

### 4.2. Sağlayıcı paketi anatomisi

```
packages/payment-iyzico/
├── src/
│   ├── index.ts          # Public API: iyzico(config) fabrika fonksiyonu
│   ├── config.ts         # Sağlayıcı konfigürasyonunun Zod şeması
│   ├── mappers/          # core şeması ⇄ sağlayıcı formatı dönüşümleri (saf fonksiyonlar)
│   ├── schemas/          # Sağlayıcının ham istek/yanıtlarının Zod şemaları
│   ├── errors.ts         # Sağlayıcı hata kodu → core hata kodu eşlemesi
│   ├── auth.ts           # İmzalama / kimlik doğrulama
│   └── provider.ts       # PaymentProvider arayüzünün uygulanması
└── test/
    ├── fixtures/         # Gerçek sağlayıcı yanıt örnekleri (anonimleştirilmiş)
    └── *.test.ts
```

### 4.3. Akış

```
Kullanıcı girdisi
   │
   ▼
[1] Core şeması ile doğrulama (ChargeRequestSchema.parse)
   │
   ▼
[2] Capability kontrolü (sağlayıcı bu işlemi destekliyor mu?)
   │
   ▼
[3] Mapper: core modeli → sağlayıcı istek formatı
   │
   ▼
[4] Core HTTP istemcisi ile çağrı (timeout, retry, maskeli log)
   │
   ▼
[5] Sağlayıcı ham yanıtının Zod ile doğrulanması
   │
   ▼
[6] Mapper: sağlayıcı yanıtı → core sonuç modeli  |  hata kodu → KopruError
   │
   ▼
Result<ChargeResult, KopruError>
```

### 4.4. Capability sistemi

Her sağlayıcı her özelliği desteklemez (örn. kısmi iade, taksit sorgulama, kargo iptali). Sağlayıcı, desteklediği yetenekleri statik olarak bildirir. Desteklenmeyen bir işlem çağrılırsa ağ isteği yapılmadan `PROVIDER_CAPABILITY_NOT_SUPPORTED` hatası döner. Böylece kullanıcı, çalışma zamanında `client.supports('refund.partial')` ile kontrol yapabilir.

### 4.5. Yeni sağlayıcı ekleme kontrol listesi

1. `packages/<alan>-<sağlayıcı>` paketini oluştur.
2. Konfigürasyon ve ham API şemalarını Zod ile yaz.
3. Mapper'ları saf fonksiyonlar olarak yaz ve birim testlerini ekle.
4. Hata kodu eşleme tablosunu doldur.
5. Mock server'a sağlayıcı senaryolarını ekle.
6. Ortak sözleşme test paketini (contract test suite) geçir.

---

## 5. Zod ile Tip Güvenliği

### 5.1. Şema önce gelir

Tipler elle yazılmaz; şemadan türetilir:

```ts
export const MoneySchema = z.object({
  value: z.number().int().nonnegative(), // kuruş cinsinden
  currency: z.enum(['TRY', 'USD', 'EUR']),
});
export type Money = z.infer<typeof MoneySchema>;
```

### 5.2. Doğrulama noktaları

| Sınır                                                                    | Neden                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Kullanıcı girdisi** (client metodları, REST endpoint'leri)             | Hatalı veriyi sağlayıcıya gitmeden yakalamak                      |
| **Sağlayıcı konfigürasyonu**                                             | Eksik API anahtarı vb. hataları başlangıçta yakalamak             |
| **Sağlayıcı ham yanıtı**                                                 | Sağlayıcının belgelenmemiş/değişmiş davranışını sessizce yutmamak |
| **Webhook / callback girdisi** (3D Secure dönüşü, kargo durum bildirimi) | Dış dünyadan gelen güvenilmeyen veri                              |

### 5.3. Kurallar

- `any` yasaktır; bilinmeyen veri `unknown` olarak alınır ve şema ile daraltılır.
- Doğrulama hataları `ValidationError`'a dönüştürülür; Zod issue'ları `details.issues` alanında korunur.
- Para birimi değerleri her zaman **kuruş cinsinden tam sayı** olarak taşınır; ondalık dönüşümü yalnızca mapper'larda yapılır.
- Sağlayıcı yanıt şemaları bilinmeyen alanlara karşı toleranslıdır (`passthrough`), ancak kullanılan alanlar için katıdır.

---

## 6. Hata Yönetimi

### 6.1. İki kategori

| Kategori                          | Örnekler                                              | Nasıl iletilir                         |
| --------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| **Beklenen (iş) hataları**        | Kart reddedildi, yetersiz bakiye, geçersiz posta kodu | `Result` içinde `{ ok: false, error }` |
| **Beklenmeyen (sistem) hataları** | Yanlış konfigürasyon, programlama hatası              | `KopruError` olarak fırlatılır         |

Ağ hataları ve zaman aşımları da `Result` ile döner, ancak `retryable: true` işaretiyle.

### 6.2. `KopruError` yapısı

```ts
// kavramsal taslak
class KopruError extends Error {
  code: KopruErrorCode; // "PAYMENT_CARD_DECLINED"
  category: ErrorCategory; // "validation" | "payment" | "cargo" | "provider" | "network" | "config"
  message: string; // İngilizce, geliştiriciye yönelik
  userMessage?: string; // Türkçe, son kullanıcıya gösterilebilir
  retryable: boolean;
  provider?: string; // "iyzico"
  providerCode?: string; // Sağlayıcının ham hata kodu: "10051"
  providerMessage?: string; // Sağlayıcının ham mesajı
  details?: Record<string, unknown>;
  cause?: unknown;
}
```

Alt sınıflar: `ValidationError`, `PaymentError`, `CargoError`, `ProviderError`, `NetworkError`, `ConfigurationError`.

### 6.3. Hata kodu kataloğu

Tüm kodlar core içinde tek bir katalogda tanımlanır ve `ALAN_ANLAM` formatındadır:

```
VALIDATION_FAILED
CONFIG_INVALID
NETWORK_TIMEOUT
NETWORK_CONNECTION_FAILED
PROVIDER_UNAVAILABLE
PROVIDER_AUTHENTICATION_FAILED
PROVIDER_CAPABILITY_NOT_SUPPORTED
PROVIDER_UNEXPECTED_RESPONSE
PAYMENT_CARD_DECLINED
PAYMENT_INSUFFICIENT_FUNDS
PAYMENT_CARD_EXPIRED
PAYMENT_INVALID_CARD
PAYMENT_THREEDS_FAILED
PAYMENT_FRAUD_SUSPECTED
PAYMENT_REFUND_FAILED
CARGO_ADDRESS_INVALID
CARGO_SHIPMENT_NOT_FOUND
CARGO_CANCELLATION_NOT_ALLOWED
```

Katalog (`packages/core/src/errors/codes.ts`) her kod için kategoriyi, varsayılan `retryable` değerini ve son kullanıcıya yönelik varsayılan Türkçe `userMessage`'ı tek yerde tanımlar. Yeni bir kod önce kataloğa eklenir.

Her sağlayıcı paketi, kendi ham kodlarını bu kataloğa eşleyen bir tablo tutar. Eşlenemeyen kodlar `PROVIDER_UNEXPECTED_RESPONSE` olarak döner ve ham bilgi korunur.

### 6.4. REST katmanında hatalar

`@kopru/server`, hataları tutarlı bir JSON zarfı ile döner:

```json
{
  "error": {
    "code": "PAYMENT_CARD_DECLINED",
    "category": "payment",
    "message": "The card was declined by the issuer.",
    "userMessage": "Kartınız bankanız tarafından reddedildi.",
    "retryable": false,
    "provider": "iyzico",
    "providerCode": "10051"
  },
  "requestId": "req_..."
}
```

HTTP durum kodu kategoriye göre belirlenir (`validation` → 422, `config` → 500, `network` → 502/504, iş hataları → 402/409 vb.).

---

## 7. `@kopru/server` (JSON/REST Ara Katmanı)

- Hafif bir HTTP framework'ü (Hono veya Fastify — ADR ile kararlaştırılacak) üzerine kurulur.
- Endpoint'ler alan bazlıdır: `POST /v1/payments/charge`, `POST /v1/cargo/shipments`, `GET /v1/cargo/shipments/:id/tracking`.
- İstek/yanıt şemaları core'daki Zod şemalarının aynısıdır; OpenAPI dökümanı bu şemalardan otomatik üretilir.
- Idempotency-Key başlığı desteklenir.
- Kimlik bilgileri ortam değişkenleri veya konfigürasyon dosyası ile sağlanır; asla loglanmaz.

## 8. `@kopru/mock-server`

- Sağlayıcıların HTTP API'lerini taklit eder; sağlayıcı paketleri yalnızca `baseUrl` değiştirilerek mock'a yönlendirilir.
- Senaryolar deterministiktir: belirli test kart numaraları / takip numaraları belirli sonuçları üretir (başarı, ret, 3DS, zaman aşımı).
- 3D Secure yönlendirme ve callback akışını simüle eder.
- Hem yerel geliştirme hem CI testlerinde kullanılır.

---

## 9. Güvenlik

- Kart numarası, CVC, API anahtarları ve TCKN loglarda otomatik maskelenir.
- Kart verisi hiçbir koşulda kalıcı olarak saklanmaz (PCI-DSS kapsamını küçültmek için).
- Webhook/callback imzaları sağlayıcı paketinde doğrulanır.
- Bağımlılıklar minimum tutulur ve düzenli denetlenir.

## 10. Test Stratejisi

| Seviye              | Araç                       | Kapsam                                |
| ------------------- | -------------------------- | ------------------------------------- |
| Birim               | Vitest                     | Mapper'lar, şemalar, hata eşlemeleri  |
| Sözleşme (contract) | Vitest + ortak test paketi | Her sağlayıcının core arayüzüne uyumu |
| Entegrasyon         | Vitest + mock-server       | Uçtan uca akışlar                     |
| Sandbox (opsiyonel) | Manuel / zamanlanmış CI    | Gerçek sağlayıcı sandbox'ları         |

## 11. Mimari Karar Kayıtları (ADR)

Önemli kararlar `docs/adr/NNNN-baslik.md` formatında kaydedilir. Kayıtlı kararların listesi: [docs/adr/README.md](./docs/adr/README.md).

Bekleyen kararlar:

- `@kopru/server` için HTTP framework seçimi (Faz 2; mock server için Hono seçildi, bkz. ADR-0003)
