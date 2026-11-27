# 0007: `@kopru/server` için Hono

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-27

## Bağlam

`@kopru/server`, core şemalarını JSON/REST olarak dışarı açan ara katmandır (ARCHITECTURE §7). ADR-0003 mock server için Hono'yu seçmiş, sunucu kararını Faz 2'ye bırakmıştı.

## Karar

`@kopru/server` **Hono** ile yazılır; Node.js'te `@hono/node-server` adaptörü kullanılır. Programatik API bir Hono uygulaması döner, böylece kullanıcı onu kendi Hono/Node sunucusuna bağlayabilir.

## Değerlendirilen Alternatifler

- **Fastify:** Olgun ekosistem ve kendi şema doğrulaması var; ancak doğrulamayı core'daki Zod şemaları zaten yapıyor. İkinci bir framework ve eklenti modeli öğrenmek gerekir.
- **Express:** Tip güvenliği zayıf, Web Standartları (`Request`/`Response`) tabanlı değil.

## Sonuçlar

- Mock server ile aynı framework kullanılır; bilgi ve test yardımcıları paylaşılır.
- Web Standartları tabanlı olduğu için ileride Bun/Deno/edge ortamlarına taşınması kolaydır.
- Hono'nun ara katman ekosistemi Fastify'ınkinden küçüktür; gereken birkaç ara katman (kimlik doğrulama, idempotency, istek kimliği) projede yazılır.
