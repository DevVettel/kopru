# 0006 — Desteklenen Node.js sürümleri

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-16

## Bağlam

Faz 1 planında minimum sürüm olarak Node.js 20 önerilmişti. Ancak Node.js 20'nin desteği Nisan 2026'da sona ermiştir (EOL). Ayrıca geliştirme araçları (tsup 9, vitest 5) en az Node.js 22.12–22.18 gerektirmektedir.

## Karar

- **Yayımlanan paketler:** `engines.node: ">=22"`; derleme hedefi `node22`.
- **Geliştirme ortamı:** Node.js `^22.18.0 || >=24.11.0` (kök `package.json`); önerilen sürüm `.nvmrc` içinde `24`.
- **CI:** Node.js 22 ve 24 matrisinde çalışır.

## Değerlendirilen Alternatifler

- **Node.js 20:** EOL olduğu için reddedildi.
- **Yalnızca Node.js 24:** Henüz 22 kullanan çok sayıda üretim ortamı olduğu için reddedildi.

## Sonuçlar

- Yerleşik `fetch`, `crypto.subtle` ve `AbortSignal.timeout` güvenle kullanılabilir.
- Node.js 22'nin EOL tarihinde (Nisan 2027) bu karar yeniden değerlendirilir.
