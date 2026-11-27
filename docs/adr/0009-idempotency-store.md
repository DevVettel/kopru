# 0009: Idempotency deposu arayüzü

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-27

## Bağlam

`@kopru/server` yazma uçlarında `Idempotency-Key` başlığını destekler: ağ hatası sonrası tekrarlanan bir tahsilat isteği sağlayıcıya ikinci kez gitmemelidir. Kayıtların bir yerde tutulması gerekir; ancak proje global durum tutmaz ve core'da bağımlılık minimumdur.

## Karar

- Idempotency **server'ın** sorumluluğudur; core'a eklenmez.
- Server bir **`IdempotencyStore`** arayüzü tanımlar: anahtarı atomik olarak kilitleme (`begin`), yanıtı kaydetme (`complete`), kilidi bırakma (`release`) ve TTL.
- Varsayılan uygulama **bellek içi ve TTL'li**dir; `createServer({ idempotencyStore })` ile değiştirilir. Redis vb. adaptörler kullanıcı tarafında yazılır (rehberde örnek verilir).
- Kayıt anahtarı: API anahtarı kimliği + uç nokta + `Idempotency-Key`. İstek gövdesinin SHA-256 parmak izi saklanır.
- Davranış: aynı anahtar ve aynı gövde → kayıtlı yanıt; farklı gövde → `IDEMPOTENCY_KEY_CONFLICT` (422); ilk istek sürerken → 409 (yeniden denenebilir).

## Değerlendirilen Alternatifler

- **Core'da depo:** Core'a sunucu kavramı taşır.
- **Redis'i zorunlu bağımlılık yapmak:** Tek instance kullanımlar için gereksiz ağırlık.

## Sonuçlar

- Tek instance'ta ek altyapı gerektirmez.
- Bellek içi depo birden çok instance'ta tutarlılık sağlamaz; bu rehberde açıkça belirtilir ve paylaşılan depo önerilir.
