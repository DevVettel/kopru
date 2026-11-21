# 0004: Harici SOAP kütüphanesi kullanılmaması

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-16

## Bağlam

Yurtiçi Kargo ve bazı banka sanal POS'ları SOAP/XML web servisleri sunar. Faz 1'de yalnızca birkaç operasyon (gönderi oluşturma, iptal, takip) gereklidir.

## Karar

Harici bir SOAP istemci kütüphanesi kullanılmaz. SOAP zarfları `@kopru/core` içindeki XML yardımcılarıyla oluşturulur ve `fetch` ile gönderilir. Yanıtlar JSON'a çevrilip Zod ile doğrulanır.

## Değerlendirilen Alternatifler

- **`soap` (npm):** WSDL'den dinamik istemci üretir; ağırdır, tip güvenliği zayıftır ve çalışma zamanında beklenmedik davranışlar gösterebilir.

## Sonuçlar

- Tam kontrol ve tip güvenliği; Zod doğrulaması diğer sağlayıcılarla aynı şekilde uygulanır.
- WSDL'deki her operasyon elle modellenir; bu yüzden yalnızca ihtiyaç duyulan operasyonlar eklenir.
