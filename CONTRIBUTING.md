# Katkı Rehberi

Köprü'ye katkı vermek istediğiniz için teşekkürler. Bu rehber, geliştirme ortamını kurup ilk katkınızı göndermeniz için gerekenleri anlatıyor.

Projeye katılan herkesin [davranış kurallarına](./CODE_OF_CONDUCT.md) uyması beklenir. Güvenlik açıklarını issue olarak değil, [güvenlik politikasında](./SECURITY.md) anlatıldığı gibi bildirin.

## Gereksinimler

- **Node.js** `22.18+` ya da `24.11+`. Önerilen sürüm `.nvmrc` dosyasında.
- **pnpm** `10`. Sürüm `package.json` içindeki `packageManager` alanında sabit, `corepack enable` ile kendiliğinden kullanılır.

## Kurulum

```bash
git clone https://github.com/DevVettel/kopru.git
cd kopru
corepack enable
pnpm install
pnpm build
pnpm test
```

Testler ve örnekler hiçbir kimlik bilgisi gerektirmez; hepsi mock server'a karşı çalışır. Kurulumu uçtan uca denemek için `pnpm example:checkout` komutunu çalıştırın.

## Nereden başlamalı?

| Yapmak istediğiniz                         | Başlangıç noktası                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| Yeni bir ödeme ya da kargo sağlayıcısı     | [Yeni sağlayıcı ekleme rehberi](./docs/guides/adding-a-provider.md)           |
| Bir akışı gerçek hesap olmadan test etmek  | [Mock server ile test rehberi](./docs/guides/testing-with-mock-server.md)     |
| Hata kodu ya da durum eşlemesini düzeltmek | İlgili paketin `src/errors.ts` / `src/status-map.ts` dosyası ve `NOTES.md`'si |
| Mimariyi etkileyen bir değişiklik          | [ADR süreci](#mimari-kararlar)                                                |

Büyük bir değişikliğe başlamadan önce issue açıp konuşmak, boşa emek harcanmasını önler. Kapsam [yol haritasıyla](./ROADMAP.md) sınırlıdır.

## Depo yapısı

| Dizin       | İçerik                                                  |
| ----------- | ------------------------------------------------------- |
| `packages/` | npm'e yayımlanan paketler                               |
| `examples/` | Yayımlanmayan örnek uygulamalar; testleri CI'da çalışır |
| `tooling/`  | Paylaşılan TypeScript, ESLint ve tsup ayarları          |
| `docs/`     | Rehberler, ADR'ler, planlar ve terimler sözlüğü         |

## Sık kullanılan komutlar

| Komut                   | Açıklama                                   |
| ----------------------- | ------------------------------------------ |
| `pnpm build`            | Tüm paketleri derler (ESM + CJS + `.d.ts`) |
| `pnpm typecheck`        | Strict mode tip kontrolü                   |
| `pnpm lint`             | ESLint (type-aware) kontrolü               |
| `pnpm test`             | Tüm paketlerin testlerini çalıştırır       |
| `pnpm test:coverage`    | Testleri kapsama raporuyla çalıştırır      |
| `pnpm format`           | Prettier ile biçimlendirir                 |
| `pnpm format:check`     | Biçimlendirmeyi denetler (CI'da zorunlu)   |
| `pnpm example:checkout` | Örnek alışveriş akışını çalıştırır         |
| `pnpm changeset`        | Sürüm notu (changeset) ekler               |

Tek bir paket üzerinde çalışırken filtre kullanabilirsiniz: `pnpm --filter @kopru/core test`

## Kurallar

Kod yazmadan önce şu üç dosyayı okuyun:

| Dosya                                  | İçerik                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [CLAUDE.md](./CLAUDE.md)               | Kodlama kuralları: TypeScript strict, Zod, dil kuralları, tek doğruluk kaynağı olarak `@kopru/core` |
| [ARCHITECTURE.md](./ARCHITECTURE.md)   | Mimari ve paket sınırları                                                                           |
| [docs/GLOSSARY.md](./docs/GLOSSARY.md) | Türkçe terimlerin koddaki karşılıkları                                                              |

En sık takılınan noktalar:

- Kod, isimlendirme ve commit mesajları **İngilizce**, README ve JSDoc yorumları **Türkçe** yazılır.
- Commit mesajları [Conventional Commits](https://www.conventionalcommits.org/tr/v1.0.0/) biçimindedir: `feat(core): add Money schema`
- `any`, `@ts-ignore` ve varsayılan export (`export default`) kullanılmaz. Lint bunları engeller.
- Sağlayıcı paketleri yalnızca `@kopru/core` paketini import edebilir. Bunu da lint denetler.

## Testler

- Test aracı Vitest'tir. Her mapper, şema ve hata eşlemesi için birim testi yazılır.
- Sağlayıcı paketleri `@kopru/core/testing` içindeki sözleşme testlerini geçmek zorundadır.
- Entegrasyon testleri gerçek sağlayıcılara değil, mock server'a karşı çalışır.
- Kapsama hedefi core için en az %90, sağlayıcı paketleri için en az %80'dir.
- Hata düzeltmelerinde önce hatayı gösteren testi ekleyin.
- Fixture'larda gerçek kart, TCKN, API anahtarı ya da kişisel veri **kullanılmaz.**

## Pull request süreci

1. `main` dalından yeni bir dal açın.
2. Değişikliğinizi testleriyle birlikte yapın.
3. Değişiklik yayımlanan bir paketi etkiliyorsa `pnpm changeset` ile sürüm notu ekleyin.
4. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` komutunun hatasız geçtiğinden emin olun.
5. PR'ı açıp şablondaki kontrol listesini doldurun. Birleştirme için CI'ın Node.js 22 ve 24'te yeşil olması gerekir.

## Mimari kararlar

Mimariyi etkileyen bir değişiklik önerecekseniz önce [docs/adr](./docs/adr/) altına bir ADR taslağı koyup tartışmayı orada başlatın.

## Sürüm yayımlama

Bu bölüm depo yöneticileri içindir. Sürümler [Changesets](./.changeset/README.md) ile yönetilir.

1. `pnpm version-packages` bekleyen changeset'leri tüketir, sürümleri yükseltir ve `CHANGELOG.md` dosyalarını yazar. Sonuç bir PR ile `main` dalına alınır.
2. GitHub Actions'ta **Release** iş akışı önce `dry-run` işaretli olarak çalıştırılır.
3. Deneme temizse iş akışı `main` dalında `dry-run` kapalı olarak yeniden başlatılır. Yayın, `npm` ortamındaki onaydan sonra yapılır ve sürüm etiketleri depoya gönderilir.

Ön koşullar: npm'de `@kopru` scope'una yayın yetkisi, depoda `npm` adlı bir ortam (onaylayıcı tanımlı) ve bu ortamda `NPM_TOKEN` secret'ı.
