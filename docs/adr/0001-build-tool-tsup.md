# 0001: Build aracı olarak tsup

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-16

## Bağlam

Kütüphane paketleri hem ESM hem CJS tüketicilere `.d.ts` tip tanımlarıyla birlikte dağıtılmalıdır. Konfigürasyonun tüm paketlerde aynı ve kısa olması istenir.

## Karar

Paketler **tsup** ile derlenir. Ortak ayarlar `@kopru/tsup-config` paketindeki `defineLibraryConfig()` fonksiyonundadır; her paketin `tsup.config.ts` dosyası yalnızca bu fonksiyonu çağırır.

## Değerlendirilen Alternatifler

- **tsdown:** Rolldown tabanlı, hızlı ve tsup'ın halefi olarak konumlanıyor. Ekosistem olgunlaştığında geçiş yeniden değerlendirilebilir; ortak konfigürasyon paketi sayesinde geçiş tek noktadan yapılır.
- **unbuild / saf `tsc`:** Çift format çıktısı için daha fazla elle ayar gerektirir.

## Sonuçlar

- Tek satırlık paket konfigürasyonu.
- Build aracı değişikliği yalnızca `tooling/tsup-config` içinde yapılır.
