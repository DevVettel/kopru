# Mimari Karar Kayıtları (ADR)

Köprü'nün mimarisini etkileyen kararlar burada kayıt altına alınır. Her ADR; bağlamı, kararı ve sonuçlarını içerir. Kabul edilmiş bir ADR değiştirilmez; yerine yeni bir ADR yazılır ve eskisi "Yerini aldı" olarak işaretlenir.

| #                                            | Başlık                                          | Durum        |
| -------------------------------------------- | ----------------------------------------------- | ------------ |
| [0001](./0001-build-tool-tsup.md)            | Build aracı olarak tsup                         | Kabul edildi |
| [0002](./0002-own-result-type.md)            | Kendi `Result` tipimiz                          | Kabul edildi |
| [0003](./0003-mock-server-hono.md)           | Mock server için Hono                           | Kabul edildi |
| [0004](./0004-no-soap-library.md)            | Harici SOAP kütüphanesi kullanılmaması          | Kabul edildi |
| [0005](./0005-xml-parser-fast-xml-parser.md) | XML ayrıştırıcı olarak fast-xml-parser          | Kabul edildi |
| [0006](./0006-node-version.md)               | Desteklenen Node.js sürümleri                   | Kabul edildi |
| [0007](./0007-server-hono.md)                | `@kopru/server` için Hono                       | Kabul edildi |
| [0008](./0008-openapi-from-zod.md)           | OpenAPI dokümanının Zod 4 ile üretilmesi        | Kabul edildi |
| [0009](./0009-idempotency-store.md)          | Idempotency deposu arayüzü                      | Kabul edildi |
| [0010](./0010-payment-notifications.md)      | Ödeme bildirimleri ve taksit sorgusu sözleşmesi | Kabul edildi |

Şablon: [`template.md`](./template.md)
