# 0008: OpenAPI dokümanının Zod 4 ile üretilmesi

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-27

## Bağlam

`@kopru/server` bir OpenAPI dokümanı sunmalıdır ve istek/yanıt şemaları core'daki Zod şemalarının aynısı olmalıdır (ARCHITECTURE §7). Şemaların tek kaynağı core'dur.

## Karar

OpenAPI **3.1** dokümanı, Zod 4'ün yerleşik `z.toJSONSchema()` fonksiyonuyla üretilen JSON Schema'lardan, server içinde elle kurulan bir iskelete (yollar, parametreler, yanıt kodları, hata zarfı) yerleştirilerek oluşturulur. Ek bağımlılık eklenmez.

- İstek gövdeleri `io: 'input'`, yanıtlar `io: 'output'` modunda üretilir (varsayılan değerli alanlar istekte opsiyoneldir).
- JSON Schema'ya çevrilemeyen yapılar (`refine` içindeki çapraz alan kuralları) dokümanda açıklama olarak yer alır; doğrulama yine Zod ile çalışma zamanında yapılır.
- Doküman bir snapshot testi ve bir OpenAPI 3.1 geçerlilik testiyle korunur.

## Değerlendirilen Alternatifler

- **`@hono/zod-openapi`:** Route'ları kendi `createRoute` DSL'iyle tanımlatır ve şemalara OpenAPI meta verisi eklenmesini bekler; core şemalarını server'a özgü bir katmana bağlar.
- **`zod-openapi` / `zod-to-openapi`:** Zod 4'ün yerleşik desteği varken ek bağımlılık gereksizdir.
- **Elle yazılmış YAML:** Şemalarla senkron kalmaz.

## Sonuçlar

- Şema değişikliği dokümana otomatik yansır; snapshot testi farkı görünür kılar.
- OpenAPI 3.1, JSON Schema 2020-12 kullandığı için dönüşüm kayıpsıza yakındır; 3.0 bekleyen eski araçlar desteklenmez.
