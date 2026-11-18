# Köprü — Terimler Sözlüğü

Bu sözlük, Türkçe alan terimlerinin kodda hangi **İngilizce** isimle karşılandığını tanımlar. Amaç, aynı kavramın farklı paketlerde farklı isimlerle yazılmasını engellemektir. Yeni bir alan kavramı kodlanmadan önce buraya eklenir; buradaki isimler bağlayıcıdır.

> Kural: Bir terim burada varsa, kodda yalnızca buradaki İngilizce karşılık kullanılır. Eş anlamlı alternatifler (`payment` / `transaction` / `charge` gibi) karıştırılmaz.

---

## 💳 Ödeme

| Türkçe Terim                     | Kod Karşılığı                  | Açıklama                                                                    |
| -------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Ödeme / Tahsilat                 | `charge`                       | Karttan para çekme işleminin tamamı (tek adımlı satış).                     |
| İşlem                            | `transaction`                  | Sağlayıcı tarafında oluşan tekil kayıt; `transactionId` ile tanımlanır.     |
| Sipariş / Sepet numarası         | `orderId`                      | İşlemi başlatan tarafın (mağazanın) referansı. Idempotency için kullanılır. |
| Sanal POS                        | `virtualPos`                   | Bankaların internet üzerinden kart ödemesi alma altyapısı.                  |
| Ödeme kuruluşu                   | `paymentInstitution`           | iyzico, PayTR gibi BDDK lisanslı aracı kuruluşlar.                          |
| Üye işyeri                       | `merchant`                     | Ödemeyi alan işletme.                                                       |
| Üye işyeri numarası              | `merchantId`                   | Banka/kuruluş tarafından verilen işyeri kimliği.                            |
| Taksit                           | `installment`                  | Taksit sayısı `installments: number` (tek çekim = `1`).                     |
| Tek çekim                        | `installments: 1`              | Ayrı bir kavram olarak modellenmez.                                         |
| 3D Secure / 3D Doğrulama         | `threeDS`                      | Fonksiyonlar: `initThreeDS`, `completeThreeDS`.                             |
| Ön provizyon                     | `preAuthorization` (`preAuth`) | Tutarın bloke edilmesi, henüz çekilmemesi.                                  |
| Provizyon kapama / Son provizyon | `capture`                      | Bloke edilen tutarın tahsil edilmesi.                                       |
| İptal (gün içi)                  | `cancel` / `void`              | Gün sonu öncesi işlemin geri alınması. Kod: `cancel`.                       |
| İade                             | `refund`                       | Gün sonu sonrası tutarın geri ödenmesi.                                     |
| Kısmi iade                       | `partialRefund`                | Capability: `refund.partial`.                                               |
| Gün sonu                         | `settlement`                   | Bankanın işlemleri mutabakata aldığı kapanış.                               |
| Kart sahibi                      | `cardHolder`                   | Kart üzerindeki isim: `holderName`.                                         |
| Son kullanma tarihi              | `expiry`                       | `MM/YY` formatında.                                                         |
| Güvenlik kodu                    | `cvc`                          | CVV/CVC2 ayrımı yapılmaz, her yerde `cvc`.                                  |
| BIN numarası                     | `bin`                          | Kartın ilk 6–8 hanesi; banka/kart ailesi tespiti için.                      |
| Kart ailesi                      | `cardFamily`                   | Bonus, World, Maximum, Axess vb.                                            |
| Alıcı                            | `buyer`                        | Ödemeyi yapan son kullanıcı.                                                |
| Tutar                            | `amount` (`Money`)             | Her zaman kuruş cinsinden tam sayı.                                         |
| Kuruş                            | minor unit                     | `Money.value` alanı kuruş cinsindendir; ayrı bir alan yoktur.               |
| Hash / İmza                      | `signature`                    | İstek/yanıt bütünlüğü için hesaplanan değer.                                |
| Sepet kalemi                     | `basketItem` (liste: `items`)  | Siparişteki tekil ürün; fiyatlar toplamı `amount`'a eşittir.                |
| Kartın son 4 hanesi              | `cardLastFour`                 | Sonuçlarda kartı tanımlamak için; tam numara asla dönmez.                   |
| 3D yönlendirmesi                 | `ThreeDSAction`                | `html` (sağlayıcı sayfası) veya `redirect` (URL + form alanları).           |
| Yetenek                          | `capability`                   | Sağlayıcının desteklediği işlem; örn. `refund.partial`.                     |

## 📦 Kargo

| Türkçe Terim                         | Kod Karşılığı                          | Açıklama                                                        |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------------- |
| Gönderi                              | `shipment`                             | Kargo firmasına teslim edilen paket kaydı.                      |
| Gönderi oluşturma                    | `createShipment`                       |                                                                 |
| Gönderi iptali                       | `cancelShipment`                       |                                                                 |
| Takip numarası                       | `trackingNumber`                       | Kargo firmasının verdiği, son kullanıcının gördüğü numara.      |
| Kargo anahtarı / Referans no         | `referenceId`                          | Gönderiyi oluşturan tarafın kendi referansı.                    |
| Kargo takibi                         | `tracking`                             | Fonksiyon: `trackShipment`.                                     |
| Hareket / Durum geçmişi              | `trackingEvent`                        | Tekil hareket kaydı; liste: `events`.                           |
| Gönderi durumu                       | `ShipmentStatus`                       | Standart durum enum'u (aşağıda).                                |
| Gönderen                             | `sender`                               |                                                                 |
| Alıcı                                | `recipient`                            | Ödemedeki `buyer` ile karıştırılmaz.                            |
| Desi                                 | `desi`                                 | Hacimsel ağırlık birimi. Türkiye'ye özgü olduğu için çevrilmez. |
| Ağırlık                              | `weightKg`                             | Kilogram cinsinden.                                             |
| Koli / Parça adedi                   | `pieceCount`                           |                                                                 |
| Kapıda ödeme                         | `cashOnDelivery`                       | Tutarı `Money` ile taşınır.                                     |
| Ödeme tipi (gönderici/alıcı ödemeli) | `paymentType`: `sender` \| `recipient` |                                                                 |
| Şube / Transfer merkezi              | `branch` / `hub`                       |                                                                 |
| Teslim edildi                        | `delivered`                            |                                                                 |
| Gönderi tarafı (gönderen/alıcı)      | `ShipmentContact`                      | Ad, telefon, e-posta ve adres.                                  |
| Gönderi arama anahtarı               | `ShipmentLookup`                       | `referenceId` veya `trackingNumber` (en az biri).               |
| Takip sonucu                         | `ShipmentTracking`                     | Gönderi + hareket listesi (`events`).                           |
| İade edildi (kargo)                  | `returned`                             | Ödemedeki `refund` ile karıştırılmaz.                           |

### Standart `ShipmentStatus` değerleri

| Değer              | Anlam                                              |
| ------------------ | -------------------------------------------------- |
| `created`          | Gönderi kaydı oluşturuldu, henüz kargoya verilmedi |
| `picked_up`        | Kargo firması teslim aldı                          |
| `in_transit`       | Transfer sürecinde                                 |
| `out_for_delivery` | Dağıtıma çıktı                                     |
| `delivered`        | Alıcıya teslim edildi                              |
| `delivery_failed`  | Teslim edilemedi (adreste bulunamadı vb.)          |
| `returned`         | Göndericiye iade edildi                            |
| `cancelled`        | İptal edildi                                       |
| `unknown`          | Sağlayıcı durumu eşlenemedi (ham değer korunur)    |

## 🧾 e-Dönüşüm (Faz 4)

| Türkçe Terim                       | Kod Karşılığı                              | Açıklama                                             |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| e-Fatura                           | `eInvoice`                                 | GİB'e kayıtlı mükellefler arası fatura.              |
| e-Arşiv Fatura                     | `eArchiveInvoice`                          | e-Fatura mükellefi olmayan alıcılara kesilen fatura. |
| e-İrsaliye                         | `eDispatchNote`                            |                                                      |
| Entegratör                         | `integrator`                               | GİB onaylı özel entegratör firması.                  |
| GİB                                | `gib`                                      | Gelir İdaresi Başkanlığı.                            |
| Mükellef                           | `taxpayer`                                 |                                                      |
| Vergi dairesi                      | `taxOffice`                                |                                                      |
| Fatura senaryosu (Temel/Ticari)    | `invoiceScenario`: `basic` \| `commercial` |                                                      |
| Fatura tipi (Satış/İade/Tevkifat…) | `invoiceType`                              |                                                      |
| ETTN                               | `ettn`                                     | Evrensel tekil fatura numarası (UUID). Çevrilmez.    |
| UBL-TR                             | `ublTr`                                    | Türkiye'ye özgü UBL standardı.                       |
| KDV                                | `vat`                                      |                                                      |
| Tevkifat                           | `withholding`                              |                                                      |

## 🪪 Kimlik ve Adres

| Türkçe Terim    | Kod Karşılığı                         | Açıklama                                    |
| --------------- | ------------------------------------- | ------------------------------------------- |
| T.C. Kimlik No  | `identityNumber` (şema: `TCKNSchema`) | 11 hane, algoritmik doğrulama yapılır.      |
| Vergi Kimlik No | `taxNumber` (şema: `VKNSchema`)       | 10 hane.                                    |
| IBAN            | `iban`                                | `TR` ile başlayan 26 karakter.              |
| İl              | `city`                                | Plaka koduyla birlikte: `cityCode` (01–81). |
| İlçe            | `district`                            |                                             |
| Mahalle         | `neighborhood`                        |                                             |
| Açık adres      | `addressLine`                         |                                             |
| Posta kodu      | `postalCode`                          |                                             |
| Telefon         | `phone`                               | E.164 formatında (`+905xxxxxxxxx`).         |
