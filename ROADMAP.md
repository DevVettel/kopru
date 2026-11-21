# Yol Haritası

Köprü'nün geliştirme fazları ve her fazın tamamlanma kriterleri. Fazlar sırayla ilerler: Bir faz kriterlerini karşılamadan sonrakine geçilmez.

**Durum göstergeleri:** ⬜ Başlanmadı · 🟨 Devam ediyor · ✅ Tamamlandı

---

## Faz 1: MVP

**Hedef:** Mimarinin uçtan uca çalıştığını kanıtlamak. Tek bir ödeme ve tek bir kargo sağlayıcısı ile, gerçek sağlayıcı hesabı gerektirmeden yerelde test edilebilen, tip güvenli bir çekirdek.

> MVP kapsamı bilinçli olarak dar tutulmuştur. Faz 1'de **e-Dönüşüm, banka sanal POS'ları ve REST sunucusu yoktur.**
>
> 📋 Görev bazlı detaylı uygulama planı: [docs/plans/PHASE-1.md](./docs/plans/PHASE-1.md)

### 1.0 Altyapı ✅

- [x] pnpm workspaces monorepo kurulumu
- [x] Paylaşılan `tsconfig` tabanı (strict mode)
- [x] ESLint + Prettier konfigürasyonu
- [x] Vitest kurulumu
- [x] Build aracı (tsup) ile ESM + CJS çıktı
- [x] CI pipeline (GitHub Actions): lint, typecheck, test, build
- [x] Changesets ile sürümleme altyapısı

### 1.1 `@kopru/core` ✅

- [x] Primitives: `Money`, `Address`, `PhoneNumber`, `TCKN`, `VKN`, `IBAN` Zod şemaları
- [x] `Result<T, E>` tipi ve yardımcıları
- [x] `KopruError` hiyerarşisi ve hata kodu kataloğu
- [x] `PaymentProvider` arayüzü ve ödeme alanı şemaları (`ChargeRequest`, `ChargeResult`, `RefundRequest`, 3DS modelleri)
- [x] `CargoProvider` arayüzü ve kargo alanı şemaları (`CreateShipmentRequest`, `Shipment`, `TrackingEvent`, `ShipmentStatus`)
- [x] `defineProvider` yardımcısı ve capability sistemi
- [x] Ortak HTTP istemcisi (timeout, retry, hassas veri maskeleme)
- [x] Yardımcılar: HMAC/hash imzalama, XML ↔ JSON dönüşümü
- [x] `createPaymentClient` ve `createCargoClient` fabrika fonksiyonları
- [x] Sağlayıcılar için ortak sözleşme test paketi (contract test suite)

### 1.2 Ödeme Sağlayıcısı: `@kopru/iyzico` ⬜

> Seçim gerekçesi: Modern REST API, iyi belgelenmiş sandbox ortamı, Türkiye'de yaygın kullanım.

- [ ] Konfigürasyon şeması (apiKey, secretKey, sandbox)
- [ ] Kimlik doğrulama / istek imzalama
- [ ] Doğrudan ödeme (Non-3DS)
- [ ] 3D Secure başlatma ve tamamlama
- [ ] İade (tam iade)
- [ ] Hata kodu eşleme tablosu
- [ ] Contract test paketini geçme

### 1.3 Kargo Sağlayıcısı: `@kopru/yurtici` ⬜

> Seçim gerekçesi: Pazar payı yüksek; SOAP tabanlı API'si, mimarinin "eski" protokolleri de soyutlayabildiğini kanıtlamak için iyi bir test.

- [ ] Konfigürasyon şeması
- [ ] SOAP/XML istemci adaptörü
- [ ] Gönderi oluşturma
- [ ] Gönderi iptali
- [ ] Kargo takibi (durum ve hareket geçmişi)
- [ ] Sağlayıcı durumlarının standart `ShipmentStatus` değerlerine eşlenmesi
- [ ] Hata kodu eşleme tablosu
- [ ] Contract test paketini geçme

### 1.4 `@kopru/mock-server` 🟨

- [x] Sağlayıcıdan bağımsız mock sunucu çatısı
- [ ] iyzico senaryoları: başarılı ödeme, kart reddi, yetersiz bakiye, 3DS akışı, iade, zaman aşımı
- [ ] Yurtiçi senaryoları: gönderi oluşturma, geçersiz adres, takip hareketleri, bulunamayan gönderi
- [ ] Deterministik test verileri (test kartları, takip numaraları) dokümantasyonu
- [x] Vitest entegrasyon testlerinde programatik olarak başlatılabilme
- [x] CLI ile bağımsız çalıştırılabilme

### 1.5 Dokümantasyon ve Örnekler ⬜

- [ ] Her paket için Türkçe README
- [ ] `examples/` altında ödeme + kargo kullanan basit bir Node.js örneği
- [ ] "Yeni sağlayıcı nasıl eklenir" rehberi
- [ ] `CONTRIBUTING.md`

### Faz 1 Tamamlanma Kriterleri

- `pnpm install && pnpm test` temiz bir klonda, hiçbir gerçek kimlik bilgisi olmadan başarılı çalışır.
- Örnek uygulama mock server'a karşı ödeme alır, 3DS akışını tamamlar, iade yapar, kargo oluşturur ve takip eder.
- iyzico ve Yurtiçi paketleri contract test paketini geçer.
- Core paketinde `any` kullanımı sıfırdır; typecheck strict modda hatasız geçer.
- Paketler npm'e `0.1.0` olarak yayımlanabilir durumdadır.

---

## Faz 2: Genişleme

- [ ] `@kopru/server`: JSON/REST ara katmanı, OpenAPI dokümanı, Idempotency-Key desteği, Docker imajı
- [ ] İkinci ödeme sağlayıcısı: `@kopru/paytr`
- [ ] İkinci kargo sağlayıcısı: `@kopru/aras`
- [ ] Taksit sorgulama (BIN bazlı) ve kısmi iade
- [ ] Webhook / callback doğrulama yardımcıları

## Faz 3: Banka Sanal POS'ları

- [ ] Ortak sanal POS altyapısı (NestPay / EST, Payfor, GVP, PosNet gibi altyapı aileleri)
- [ ] Garanti BBVA, Akbank, İş Bankası, Yapı Kredi entegrasyonları
- [ ] Ön provizyon (pre-auth) ve provizyon kapama (capture)

## Faz 4: e-Dönüşüm

- [ ] `EInvoiceProvider` arayüzü ve UBL-TR modeli
- [ ] e-Fatura / e-Arşiv gönderimi ve durum sorgulama
- [ ] e-İrsaliye
- [ ] İlk entegratör sağlayıcısı

## Faz 5: Ekosistem

- [ ] Ek kargo firmaları (MNG, Sürat, PTT)
- [ ] Gözlemlenebilirlik: OpenTelemetry entegrasyonu
- [ ] Çoklu sağlayıcı yönlendirme (failover, maliyet bazlı routing)
- [ ] Dokümantasyon sitesi
- [ ] Diğer diller için REST istemci örnekleri (PHP, Python, Go)
