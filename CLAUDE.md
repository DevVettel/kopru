# CLAUDE.md — Köprü Geliştirme Kuralları

Bu dosya, Köprü projesinde kod geliştirirken uyulması **zorunlu** kuralları içerir. Herhangi bir kod yazmadan önce bu dosyayı, [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md) ve [docs/GLOSSARY.md](./docs/GLOSSARY.md) dosyalarını referans al.

---

## Proje Özeti

Köprü; Türkiye'deki ödeme kuruluşlarını, banka sanal POS'larını, kargo firmalarını ve e-Dönüşüm entegratörlerini tek bir standart TypeScript API'si ve JSON/REST arayüzü altında birleştiren açık kaynak bir ara katmandır. pnpm workspaces tabanlı bir monorepodur. Çekirdek paket `@kopru/core`, sağlayıcılar ise ayrı eklenti paketleridir (örn. `@kopru/iyzico`).

---

## 🚫 Değişmez Kurallar

### 1. TypeScript — Strict Mode
- Tüm kodlar **TypeScript** ile yazılır. `.js` kaynak dosyası eklenmez (konfigürasyon dosyaları hariç, onlar da mümkünse `.ts`).
- `tsconfig` içinde `"strict": true` zorunludur. Ek olarak şunlar açık tutulur: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- **`any` kullanmak yasaktır.** Bilinmeyen veri `unknown` olarak alınır ve Zod şeması ile daraltılır.
- `@ts-ignore` yasaktır. Zorunlu durumlarda açıklamalı `@ts-expect-error` kullanılır.
- Non-null assertion (`!`) ve gereksiz tip dönüşümleri (`as`) kullanılmaz; gerekiyorsa nedeni yorumla açıklanır.

### 2. Veri Doğrulama — Zod
- Tüm veri doğrulama **Zod** ile yapılır. Başka bir doğrulama kütüphanesi eklenmez.
- **Önce şema, sonra tip:** Tipler elle yazılmaz, `z.infer<typeof XSchema>` ile şemadan türetilir.
- Şema isimleri `Schema` son ekini alır: `ChargeRequestSchema` → tip `ChargeRequest`.
- Doğrulama sınırlarda yapılır: kullanıcı girdisi, sağlayıcı konfigürasyonu, sağlayıcı ham yanıtı, webhook/callback girdileri.
- Zod hataları doğrudan dışarı sızdırılmaz; `ValidationError` (core) içine sarılır.

### 3. Dil Kuralları
| Öğe | Dil |
| --- | --- |
| Sınıf, arayüz, tip, değişken, fonksiyon, dosya ve klasör isimleri | **İngilizce** |
| Commit mesajları | **İngilizce** |
| Hata kodları ve `KopruError.message` | **İngilizce** |
| README dosyaları ve kullanıcı dökümantasyonu | **Türkçe** |
| Kod içi açıklama yorumları ve JSDoc | **Türkçe** |
| `KopruError.userMessage` (son kullanıcıya gösterilebilir mesaj) | **Türkçe** |

Örnek:
```ts
/**
 * Verilen tutarı kart üzerinden tahsil eder.
 *
 * @param input - Doğrulanmış ödeme isteği
 * @returns Başarılı işlemde işlem bilgisi, aksi halde standart Köprü hatası
 */
export async function charge(input: ChargeRequest): Promise<Result<ChargeResult, KopruError>> { ... }
```

### 4. Kod Tekrarı Yok — Tek Doğruluk Kaynağı `@kopru/core`
- Tüm ortak tipler, arayüzler, Zod şemaları, hata sınıfları ve yardımcılar **`@kopru/core`** paketinde tanımlanır ve oradan import edilir.
- Sağlayıcı paketleri ortak bir tipi veya yardımcıyı **yeniden tanımlayamaz.** İki sağlayıcıda tekrarlanan bir mantık görürsen onu core'a taşı.
- Sağlayıcı paketleri birbirini import edemez. Yalnızca `@kopru/core`'a bağımlı olabilirler.
- Sağlayıcıya özgü şemalar (ham API formatları) yalnızca ilgili sağlayıcı paketinde kalır ve dışarı export edilmez.
- Core, hiçbir sağlayıcıya özgü bilgi içermez.

---

## 📐 Kodlama Standartları

### İsimlendirme
- Türkçe alan terimlerinin İngilizce karşılıkları **[docs/GLOSSARY.md](./docs/GLOSSARY.md)** dosyasındaki tabloya göre seçilir. Sözlükte olmayan yeni bir kavram kodlanmadan önce sözlüğe eklenir.
- Dosyalar: `kebab-case.ts`
- Sınıflar, tipler, arayüzler: `PascalCase` (arayüzlerde `I` ön eki kullanılmaz)
- Fonksiyonlar, değişkenler: `camelCase`
- Sabitler: `SCREAMING_SNAKE_CASE`
- Hata kodları: `DOMAIN_MEANING` (örn. `PAYMENT_CARD_DECLINED`)
- Paket isimleri: `@kopru/<sağlayıcı>` veya `@kopru/<işlev>`

### Mimari
- Beklenen iş hataları `Result<T, KopruError>` ile döner; yalnızca programlama/konfigürasyon hataları fırlatılır.
- Para tutarları her zaman **kuruş cinsinden tam sayı** (`Money`) olarak taşınır. `number` ile ondalık para hesabı yapılmaz.
- Tarih/saat işlemlerinde saat dilimi açıkça belirtilir (`Europe/Istanbul`).
- Mapper'lar (core ⇄ sağlayıcı dönüşümleri) saf fonksiyonlardır ve yan etki içermez.
- Global/mutable durum tutulmaz; konfigürasyon her zaman açıkça enjekte edilir.
- Yeni bir çalışma zamanı bağımlılığı eklemeden önce gerekçesi belirtilir; core'da bağımlılık minimumda tutulur.
- Varsayılan export (`export default`) kullanılmaz; yalnızca isimli export.

### Güvenlik
- Kart numarası, CVC, API anahtarı, secret ve TCKN **asla** loglanmaz; core HTTP istemcisinin maskeleme mekanizması kullanılır.
- Kart verisi kalıcı olarak saklanmaz.
- Gerçek kimlik bilgileri, API anahtarları veya gerçek kişisel veri repoya commit edilmez. Test fixture'ları anonimleştirilir.

### Test
- Test aracı: **Vitest**.
- Her mapper, şema ve hata eşlemesi için birim testi yazılır.
- Her sağlayıcı paketi core'daki contract test paketini geçmek zorundadır.
- Entegrasyon testleri gerçek sağlayıcılara değil, `@kopru/mock-server`'a karşı çalışır.

---

## 📝 Commit Kuralları
- Commit mesajları **İngilizce** ve [Conventional Commits](https://www.conventionalcommits.org/) formatındadır:
  ```
  feat(core): add Money schema with kuruş-based integer amounts
  fix(iyzico): map error code 10051 to PAYMENT_INSUFFICIENT_FUNDS
  docs: update provider authoring guide
  ```
- Scope olarak paket adı kullanılır (`core`, `iyzico`, `yurtici`, `mock-server`, `server`).
- Kullanıcı açıkça istemedikçe commit veya push yapılmaz.

---

## ✅ Kod Yazmadan Önce Kontrol Listesi
1. Bu iş ROADMAP'teki mevcut fazın kapsamında mı?
2. Gereken tip/şema/yardımcı zaten `@kopru/core`'da var mı?
3. Yeni bir ortak kavram mı ekliyorum? → Core'a eklenmeli.
4. Mimariyi değiştiren bir karar mı? → Önce `ARCHITECTURE.md` güncellenmeli (gerekirse ADR yazılmalı).

## ✅ Kod Yazdıktan Sonra Kontrol Listesi
1. `pnpm typecheck`, `pnpm lint` ve `pnpm test` hatasız geçiyor mu?
2. `any`, `@ts-ignore` veya tekrarlanan tip tanımı var mı?
3. Public API'ler Türkçe JSDoc ile belgelendi mi?
4. Hassas veri loglanıyor mu?
5. ROADMAP'teki ilgili maddeler güncellendi mi?
