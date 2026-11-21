# 0005: XML ayrıştırıcı olarak fast-xml-parser

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-16

## Bağlam

SOAP servisleri ve bazı banka API'leri XML ile çalışır. Hem XML oluşturma hem ayrıştırma gereklidir.

## Karar

`@kopru/core` içindeki XML yardımcıları **fast-xml-parser** üzerine ince bir katman olarak yazılır.

## Değerlendirilen Alternatifler

- **xml2js:** Yaygın ama callback tabanlı API'si eski ve daha yavaş.
- **DOM tabanlı ayrıştırıcılar:** Node ortamında ek bağımlılık ve gereksiz karmaşıklık getirir.

## Sonuçlar

- Bağımlılıksız, hızlı ve hem `parse` hem `build` destekleyen tek kütüphane.
- Sağlayıcı paketleri fast-xml-parser'ı doğrudan değil, core yardımcıları üzerinden kullanır.

## Ek Not (2026-11-18)

fast-xml-parser 5.x içinde `XMLBuilder` ve `XMLValidator` deprecated olarak işaretlendi. Oluşturma için aynı ekibin ayırdığı **`fast-xml-builder`** paketi (fast-xml-parser'ın zaten kendi bağımlılığıdır) doğrudan kullanılır. Ayrıştırma öncesi iyi biçimlilik kontrolü için şimdilik fast-xml-parser içindeki `XMLValidator` kullanılır; kaldırılırsa `fast-xml-validator` paketine geçilir.
