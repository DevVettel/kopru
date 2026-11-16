# Köprü'ye Katkı Rehberi

Köprü'ye katkıda bulunmak istediğiniz için teşekkürler! Bu rehber, geliştirme ortamını kurmanız ve ilk katkınızı göndermeniz için gereken her şeyi içerir.

> Bu bir taslaktır; Faz 1 sonunda (M6.4) genişletilecektir.

## Gereksinimler

- **Node.js** `22.18+` veya `24.11+` (önerilen sürüm `.nvmrc` dosyasındadır)
- **pnpm** `10` (sürüm `package.json` → `packageManager` alanında sabittir; `corepack enable` ile otomatik kullanılır)

## Kurulum

```bash
git clone https://github.com/DevVettel/kopru.git
cd kopru
corepack enable
pnpm install
```

## Sık Kullanılan Komutlar

| Komut                | Açıklama                                   |
| -------------------- | ------------------------------------------ |
| `pnpm build`         | Tüm paketleri derler (ESM + CJS + `.d.ts`) |
| `pnpm typecheck`     | Strict mode tip kontrolü                   |
| `pnpm lint`          | ESLint (type-aware) kontrolü               |
| `pnpm test`          | Tüm paketlerin testlerini çalıştırır       |
| `pnpm test:coverage` | Testleri kapsama raporuyla çalıştırır      |
| `pnpm format`        | Prettier ile biçimlendirir                 |
| `pnpm changeset`     | Sürüm notu (changeset) ekler               |

Tek bir paket üzerinde çalışmak için: `pnpm --filter @kopru/core test`

## Kurallar

Kod yazmadan önce mutlaka okuyun:

- [CLAUDE.md](./CLAUDE.md) — Kodlama kuralları (TypeScript strict, Zod, dil kuralları, `@kopru/core` tek doğruluk kaynağı)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Mimari ve paket sınırları
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — Türkçe terimlerin kod karşılıkları

Özetle:

- Kod, isimlendirme ve commit mesajları **İngilizce**; README ve JSDoc yorumları **Türkçe**.
- Commit mesajları [Conventional Commits](https://www.conventionalcommits.org/) formatında: `feat(core): add Money schema`
- `any`, `@ts-ignore` ve varsayılan export (`export default`) kullanılmaz; lint bunları engeller.
- Sağlayıcı paketleri yalnızca `@kopru/core` paketini import edebilir; lint bunu da engeller.

## Pull Request Süreci

1. `main` dalından yeni bir dal açın.
2. Değişikliğinizi testleriyle birlikte yapın.
3. Yayımlanan bir paketi etkiliyorsa `pnpm changeset` ile sürüm notu ekleyin.
4. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` komutlarının geçtiğinden emin olun.
5. PR açın; CI'ın yeşil olması gerekir.

## Mimari Kararlar

Mimariyi etkileyen bir değişiklik önerecekseniz, önce [docs/adr](./docs/adr/) altında bir ADR taslağı ile tartışma başlatın.
