# 0003 — Mock server için Hono

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-16

## Bağlam

`@kopru/mock-server`, sağlayıcı HTTP API'lerini taklit eden, testlerden programatik olarak başlatılabilen hafif bir sunucudur. Faz 2'deki `@kopru/server` için de bir HTTP framework'ü seçilecektir.

## Karar

Mock server **Hono** (`@hono/node-server` adaptörü) ile yazılır.

## Değerlendirilen Alternatifler

- **Fastify:** Olgun ve hızlı; ancak daha ağır ve eklenti sistemi mock ihtiyacı için fazla.
- **Node `http` modülü:** Bağımlılıksız ama routing ve gövde ayrıştırma elle yazılmak zorunda.

## Sonuçlar

- Hafif, Web Standartları (Request/Response) tabanlı ve tip güvenli bir katman.
- `@kopru/server` için de güçlü aday; nihai karar Faz 2'de ayrı bir ADR ile verilir.
