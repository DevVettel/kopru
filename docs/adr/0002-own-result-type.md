# 0002: Kendi `Result` tipimiz

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-16

## Bağlam

Beklenen iş hataları (kart reddi, geçersiz adres) istisna fırlatmak yerine değer olarak döndürülecektir (ARCHITECTURE.md §6).

## Karar

`Result<T, E>` tipi `@kopru/core` içinde basit bir discriminated union olarak yazılır: `{ ok: true; value: T } | { ok: false; error: E }`. Yanında `ok()`, `err()`, `isOk()`, `isErr()`, `unwrap()` yardımcıları bulunur.

## Değerlendirilen Alternatifler

- **neverthrow, ts-results, Effect:** Güçlü ama ek çalışma zamanı bağımlılığı ve öğrenme maliyeti getirir; kullanıcıların API'mizi kullanmak için üçüncü taraf bir kütüphaneyi öğrenmesi gerekir.

## Sonuçlar

- Sıfır ek bağımlılık; tip `if (result.ok)` ile doğal olarak daraltılır.
- Zincirleme (`map`, `andThen`) gibi gelişmiş yardımcılar ihtiyaç doğarsa eklenir.
