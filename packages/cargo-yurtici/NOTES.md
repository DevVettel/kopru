# Yurtiçi Kargo Web Servis Notları (M5.0)

Bu dosya, `@kopru/yurtici` uygulanmadan önce Yurtiçi Kargo web servisi hakkında toplanan bilgileri ve verilen tasarım kararlarını özetler. Son kontrol: **2026-11-22**.

> ⚠️ **Kaynak uyarısı:** Yurtiçi Kargo'nun web servis dokümanı herkese açık yayımlanmıyor. Doküman, entegrasyon başvurusundan sonra müşteriye iletiliyor. Test ortamına da yalnızca Yurtiçi bilgi işlem birimine bildirilmiş IP adreslerinden erişilebiliyor. Bu yüzden aşağıdaki bilgiler, gerçek ortamda çalışan açık kaynak entegrasyonların **kaynak kodundan** derlendi; WSDL ile doğrulanamadı. Doğrulanamayan noktalar "**Varsayım**" etiketiyle işaretlenmiştir. Gerçek kimlik bilgisiyle yapılacak ilk duman testinde öncelikle bunlar kontrol edilmelidir.

**İkincil kaynaklar (MIT/Apache-2.0):**

- [tcgunel/omniship-yurtici](https://github.com/tcgunel/omniship-yurtici) (`src/Carrier.php`, `src/Message/*`, `src/Support/OperationStatus.php`, README'deki hata kodu tabloları)
- [smberg/yurtici-kargo-php](https://github.com/smberg/yurtici-kargo-php) (`src/YurticiKargo/Request.php`, `Shipment.php`, `QueryShipment.php`)

---

## 1. Ortamlar

| Ortam | Servis adresi                                                                     |
| ----- | --------------------------------------------------------------------------------- |
| Test  | `https://testws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices` |
| Canlı | `https://ws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices`     |

- Kaynaklar adres konusunda birbiriyle çelişiyor. Eski README'ler test için `http://testwebservices.yurticikargo.com:9090/...`, canlı için `http://webservices.yurticikargo.com:8080/...` adreslerini veriyor. Tablodaki adresler, en güncel kod tabanındaki (`omniship-yurtici` `Carrier.php`) sabitlerdir. `baseUrl` ile değiştirilebilir.
- 2026-11-22 tarihinde `testwebservices.yurticikargo.com:9090` adresine yapılan bağlantı zaman aşımına uğradı. Bu, IP kısıtlamasıyla tutarlıdır.
- Herkese açık test kullanıcısı (gönderici ödemeli): `YKTEST` / `YK`. Bu bilgi repoya **yazılmaz**; mock server kendi sahte kimlik bilgilerini kullanır.
- Kimlik bilgileri **ödeme tipine göre** ayrı tanımlanır: gönderici ödemeli ve alıcı ödemeli gönderiler için farklı kullanıcılar kullanılır.

## 2. SOAP Ayrıntıları

| Konu          | Değer                                                        | Durum                                                                      |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| SOAP sürümü   | 1.1                                                          | **Varsayım** (PHP `SoapClient` varsayılanı)                                |
| Namespace     | `http://yurticikargo.com.tr/ShippingOrderDispatcherServices` | **Varsayım** (`omniship-yurtici` test yardımcısındaki `uri`; ön ek `ship`) |
| Alt elemanlar | Namespace'siz (`elementFormDefault="unqualified"`)           | **Varsayım** (JAX-WS varsayılanı)                                          |
| `SOAPAction`  | `""`                                                         | **Varsayım**                                                               |
| Kimlik        | Her operasyonun gövdesinde `wsUserName`, `wsPassword`        | Kodla doğrulandı                                                           |
| Dil alanı     | `queryShipment`: `wsLanguage`; diğerleri: `userLanguage`     | Kodla doğrulandı                                                           |

Tekrarlayan tüm elemanlar `maxOccurs="unbounded"` olarak tanımlıdır. Tek bir kayıt döndüğünde XML ayrıştırıcı nesne, birden fazla kayıt döndüğünde dizi üretir. Şemalar bu iki durumu core'daki `xmlList` ile birleştirir.

## 3. Operasyonlar

### `createShipment`

`wsUserName`, `wsPassword`, `userLanguage`, `ShippingOrderVO[]`.

| `ShippingOrderVO` alanı                                           | Sınır            | Köprü kaynağı                                    |
| ----------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| `cargoKey` \*                                                     | 20               | `referenceId`                                    |
| `invoiceKey` \*                                                   | 20               | `referenceId`                                    |
| `receiverCustName` \*                                             | 200              | `recipient.name`                                 |
| `receiverAddress` \*                                              | 500 (pratik 200) | `recipient.address.neighborhood` + `addressLine` |
| `cityName`                                                        | 40               | `getCityName(recipient.address.cityCode)`        |
| `townName`                                                        | 40               | `recipient.address.district`                     |
| `receiverPhone1` \*                                               | 10 hane          | `recipient.phone` (E.164 → `+90` atılır)         |
| `emailAddress`                                                    | 200              | `recipient.email`                                |
| `desi`, `kg`                                                      | Double (9,3)     | `desi`, `weightKg`                               |
| `cargoCount`                                                      | Integer (4)      | `pieceCount`                                     |
| `description`                                                     | 255              | `description`                                    |
| `taxOfficeId`, `ttDocumentId`, `dcSelectedCredit`, `dcCreditRule` | Long             | Sabit `0` (`omniship-yurtici` ile aynı)          |

\* Zorunlu. Kapıda ödeme alanları (`ttCollectionType`, `ttInvoiceAmount`, `ttDocumentSaveType` …) Faz 1'de gönderilmez.

**Yanıt:** `createShipmentResponse > ShippingOrderResultVO`: `outFlag`, `outResult`, `errCode`, `errMessage`, `jobId`, `count`, `shippingOrderDetailVO[]` (`cargoKey`, `invoiceKey`, `errCode`, `errMessage`).

- `outFlag`: `0` en az bir kayıt başarılı, `1` tüm kayıtlar hatalı, `2` beklenmeyen hata.
- Kayıt düzeyinde `errCode` boş veya `0` ise kayıt başarılıdır.
- Takip numarası (`docId`) oluşturma yanıtında **dönmez**. Kargo şubede teslim alınıp faturalandıktan sonra `queryShipment` ile öğrenilir.

### `cancelShipment`

`wsUserName`, `wsPassword`, `userLanguage`, `cargoKeys[]`. Yalnızca fatura kesilmeden (kargo teslim alınmadan) önce iptal yapılabilir.

**Yanıt:** `cancelShipmentResponse > ShippingOrderResultVO > shippingCancelDetailVO[]` (`cargoKey`, `invoiceKey`, `operationCode`, `operationStatus`, `operationMessage`, `errCode`, `errMessage`, `docId`).

Bir README'deki SOAP Action tablosunda operasyon adı `cancelDispatch` olarak geçiyor; iki kod tabanı da `cancelShipment` çağırıyor. Köprü `cancelShipment` kullanır.

### `queryShipment`

`wsUserName`, `wsPassword`, `wsLanguage`, `keys[]`, `keyType` (`0` kargo anahtarı, `1` fatura anahtarı), `addHistoricalData` (hareket geçmişi), `onlyTracking` (yalnızca takip bağlantısı). Aynı gönderi için 1 dakika içinde tekrarlanan sorgular engellenir.

**Yanıt:** `queryShipmentResponse > ShippingDeliveryVO > shippingDeliveryDetailVO[]`:

- Kayıt: `cargoKey`, `invoiceKey`, `operationCode`, `operationStatus`, `operationMessage`, `errCode`, `errMessage`, `shippingDeliveryItemDetailVO`.
- `shippingDeliveryItemDetailVO`: `docId` (takip numarası), `trackingUrl`, `deliveryDate`/`deliveryTime`, `returnStatus`, `rejectStatus`, `invDocCargoVOArray[]`.
- Hareket (`invDocCargoVOArray`): `eventId`, `eventName`, `reasonId`, `reasonName`, `eventDate` (`YYYYMMDD`), `eventTime` (`HHMMSS`), `unitId`, `unitName`, `cityName`, `townName`.

Tarih ve saatler saat dilimi bilgisi olmadan, **İstanbul yerel saatiyle** döner. Core'daki `istanbulLocalToDateTime` ile `+03:00` farkı açıkça yazılır.

## 4. Hata Kodu Eşleme

Tablonun tamamı `src/errors.ts` içindedir. Eşlenmeyen kodlar (örn. `936` beklenmeyen hata, `80057` iş numarası bulunamadı) `PROVIDER_UNEXPECTED_RESPONSE` olur.

| Yurtiçi kodları                                      | Anlam                                    | Köprü kodu                     |
| ---------------------------------------------------- | ---------------------------------------- | ------------------------------ |
| `82519`                                              | Kargo anahtarı bu kullanıcıda bulunamadı | `CARGO_SHIPMENT_NOT_FOUND`     |
| `82520`                                              | Gönderi daha önce iptal edilmiş          | İptalde başarı (bkz. §6)       |
| `60019`, `82502`                                     | Alıcı adresi eksik / çok uzun            | `CARGO_ADDRESS_INVALID`        |
| `60020`                                              | Kargo anahtarı daha önce kullanılmış     | `VALIDATION_FAILED`            |
| `80859`, `82500`, `60017`, `82501`, `60018`, `82503` | Anahtar / alıcı adı eksik veya çok uzun  | `VALIDATION_FAILED`            |
| `82505`–`82518`                                      | Kapıda ödeme, e-posta, telefon, biçim    | `VALIDATION_FAILED`            |
| `82526`, `82527`                                     | Sorgu anahtarı / anahtar tipi eksik      | `VALIDATION_FAILED`            |
| SOAP Fault                                           | Kimlik doğrulama vb.                     | `PROVIDER_UNEXPECTED_RESPONSE` |

- **Varsayım:** Kaynaklarda `queryShipment` için ayrı bir "bulunamadı" kodu yok. Bilinmeyen anahtar için de `82519` döndüğü varsayılır. Yanıtta hiç kayıt yoksa sonuç yine `CARGO_SHIPMENT_NOT_FOUND` olur.
- **Varsayım:** Hatalı kullanıcı adı/şifre için belgelenmiş bir kod yok. Kimlik hatasının SOAP Fault olarak döndüğü varsayılır. Fault mesajı `providerMessage` alanında korunur. Gerçek davranış görüldüğünde `PROVIDER_AUTHENTICATION_FAILED` eşlemesi eklenmelidir.

## 5. Durum Eşleme

### Gönderi durumu (`operationStatus` / `operationCode`)

| Kod | Durum | Yurtiçi açıklaması                                  | Köprü        |
| --- | ----- | --------------------------------------------------- | ------------ |
| 0   | `NOP` | Kargo işlem görmemiş                                | `created`    |
| 1   | `IND` | Kargo teslimattadır                                 | `in_transit` |
| 2   | `ISR` | Kargo işlem görmüş, faturası henüz düzenlenmemiştir | `picked_up`  |
| 3   | `CNL` | Kargo çıkışı engellendi                             | `cancelled`  |
| 4   | `ISC` | Daha önce iptal edilmiştir                          | `cancelled`  |
| 5   | `DLV` | Kargo teslim edilmiştir                             | `delivered`  |
| 6   | `BI`  | Fatura şube tarafından iptal edilmiştir             | `cancelled`  |

`operationStatus` boşsa `operationCode` kullanılır. Eşlenemeyen değerler `unknown` olur, ham değer `providerStatus` alanında korunur.

`IND`, faturalamadan teslimata kadar bütün süreci kapsar. Bu yüzden genel durum şu şekilde netleştirilir:

- Son hareket dağıtıma çıkışı (`DG`) veya iadeyi (`IA`) gösteriyorsa o durum kullanılır.
- `returnStatus = 3` (göndericiye iade edildi) ise durum `returned` olur.

### Hareket durumu (`eventId`)

| `eventId`  | Köprü              | Not                         |
| ---------- | ------------------ | --------------------------- |
| `GT`       | `picked_up`        |                             |
| `IN`, `YK` | `in_transit`       | `YK`: Kargo İndirildi       |
| `DG`       | `out_for_delivery` |                             |
| `TS`, `TE` | `delivered`        |                             |
| `IA`       | `returned`         |                             |
| Diğerleri  | `unknown`          | Ham kod `providerStatus`'ta |

**Varsayım:** Bu tablo `omniship-yurtici`'den alındı; Yurtiçi'nin resmî hareket kodu listesine ulaşılamadı. `reasonId` `OK` (Sorun Yok) dışında bir değer taşıyorsa neden açıklaması hareket açıklamasına eklenir (örn. "Dağıtıma Çıkarıldı (Alıcı Adreste Yok)"). `delivery_failed` durumu, hangi neden kodlarının başarısız teslimat anlamına geldiği doğrulanamadığı için Faz 1'de üretilmez.

## 6. Tasarım Kararları

1. **Referans anahtarı:** `referenceId` hem `cargoKey` hem `invoiceKey` olarak gönderilir. Yurtiçi bu alanları 20 karakterle sınırlar; daha uzun referanslar ağ isteği yapılmadan `VALIDATION_FAILED` döner.
2. **Arama yalnızca `referenceId` ile:** Web servis gönderiyi yalnızca kargo/fatura anahtarıyla sorgular. Yalnızca `trackingNumber` verilirse `VALIDATION_FAILED` döner.
3. **Gönderen bilgisi:** Yurtiçi göndereni web servis hesabından alır. `sender` alanı gönderilmez.
4. **Ödeme tipi hesaba bağlıdır:** Konfigürasyondaki `paymentType` hesabın tipidir. İstekteki `paymentType` bununla uyuşmazsa `VALIDATION_FAILED` döner. Hem gönderici hem alıcı ödemeli gönderi yapanlar iki ayrı sağlayıcı örneği oluşturur. Tek örnekte iki hesabı yönetmek, iptal ve takipte hangi hesabın kullanılacağı bilinemediği için reddedildi.
5. **İptal tekrar edilebilir:** `82520` (zaten iptal) başarı sayılır ve `cancelled` döner. Gönderi iptal dışında bir durumdaysa (`IND`, `DLV` …) `CARGO_CANCELLATION_NOT_ALLOWED` döner; ham durum `providerCode` alanına yazılır.
6. **Kapıda ödeme Faz 2'de:** Kapıda ödeme alanlarının (`ttDocumentId`, tahsilat tipi, taksit kuralları) anlamı ve sözleşme bağımlılıkları doğrulanamadı. `cashOnDelivery` yeteneği bildirilmez; istek ağa çıkmadan `PROVIDER_CAPABILITY_NOT_SUPPORTED` döner.
7. **Tekrar deneme:** Yalnızca `queryShipment` idempotent kabul edilir ve yeniden denenebilir. Oluşturma ve iptal yeniden denenmez.
8. **Hassas veri:** `wsPassword` istek gövdesinde gider. Core'daki maskeleme, `password`/`secret` ile biten tüm anahtarları (`wsPassword` dâhil) maskeleyecek şekilde genişletildi.
