# Katkı Rehberi

Köprü'ye katkı vermek istediğiniz için teşekkürler. Bu rehber, geliştirme ortamını kurup ilk katkınızı göndermeniz için gerekenleri anlatıyor.

> [!NOTE]
> Rehber şimdilik taslak. Faz 1'in sonunda (M6.4) genişletilecek.

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
```

## Sık kullanılan komutlar

| Komut                | Açıklama                                   |
| -------------------- | ------------------------------------------ |
| `pnpm build`         | Tüm paketleri derler (ESM + CJS + `.d.ts`) |
| `pnpm typecheck`     | Strict mode tip kontrolü                   |
| `pnpm lint`          | ESLint (type-aware) kontrolü               |
| `pnpm test`          | Tüm paketlerin testlerini çalıştırır       |
| `pnpm test:coverage` | Testleri kapsama raporuyla çalıştırır      |
| `pnpm format`        | Prettier ile biçimlendirir                 |
| `pnpm changeset`     | Sürüm notu (changeset) ekler               |

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

## Pull request süreci

1. `main` dalından yeni bir dal açın.
2. Değişikliğinizi testleriyle birlikte yapın.
3. Değişiklik yayımlanan bir paketi etkiliyorsa `pnpm changeset` ile sürüm notu ekleyin.
4. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` komutunun hatasız geçtiğinden emin olun.
5. PR'ı açıp şablondaki kontrol listesini doldurun. Birleştirme için CI'ın yeşil olması gerekir.

## Mimari kararlar

Mimariyi etkileyen bir değişiklik önerecekseniz önce [docs/adr](./docs/adr/) altına bir ADR taslağı koyup tartışmayı orada başlatın.
