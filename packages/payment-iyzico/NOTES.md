# iyzico API Notları (M4.0)

Bu dosya, `@kopru/iyzico` uygulanmadan önce iyzico'nun güncel dokümanından çıkarılan bilgileri ve verilen tasarım kararlarını özetler. Son kontrol: **2026-11-21**.

**Kaynaklar:** [docs.iyzico.com](https://docs.iyzico.com/) (HMAC kimlik doğrulama, Non-3DS ve 3DS entegrasyonu, iptal ve iade, hata kodları, test kartları), ikincil kaynak olarak [iyzipay-node](https://github.com/iyzico/iyzipay-node) (`lib/utils.js`, `lib/IyzipayResource.js`).

---

## 1. Ortamlar

| Ortam   | Kök adres                         |
| ------- | --------------------------------- |
| Sandbox | `https://sandbox-api.iyzipay.com` |
| Canlı   | `https://api.iyzipay.com`         |

Sandbox ve canlı anahtarları tamamen farklıdır (sandbox anahtarları `sandbox-` ile başlar). Anahtar ile kök adres uyuşmazsa `1001` hatası döner.

## 2. Kimlik Doğrulama (IYZWSv2 / HMAC-SHA256)

```
randomKey     = herhangi bir rastgele metin (x-iyzi-rnd başlığında da gönderilir)
signature     = hex( HMAC-SHA256( secretKey, randomKey + uriPath + body ) )
authString    = "apiKey:" + apiKey + "&randomKey:" + randomKey + "&signature:" + signature
Authorization = "IYZWSv2 " + base64(authString)
```

- `uriPath` sorgu metni içermeyen yoldur (örn. `/payment/auth`).
- `body` gönderilen JSON metninin **birebir aynısıdır**; imzalanan ve gönderilen baytlar aynı olmalıdır.
- Başlıklar: `Authorization`, `x-iyzi-rnd`, `Content-Type: application/json`.
- Test vektörü dokümandaki örneklerin gizli anahtarı verilmediği için `openssl dgst -sha256 -hmac` ile bağımsız olarak üretilmiştir (`test/auth.test.ts`).

## 3. Kullanılan Uç Noktalar

| İşlem              | Uç nokta                            | Not                                                           |
| ------------------ | ----------------------------------- | ------------------------------------------------------------- |
| Non-3DS tahsilat   | `POST /payment/auth`                | Hesapta özelliğin açık olması gerekir                         |
| 3DS başlatma       | `POST /payment/3dsecure/initialize` | `threeDSHtmlContent` Base64 kodlu HTML döner                  |
| 3DS tamamlama      | `POST /payment/3dsecure/auth`       | v1; yalnızca `paymentId` (+ varsa `conversationData`) ister   |
| Ödeme detayı       | `POST /payment/detail`              | İadeden önce ödenen tutarı öğrenmek için                      |
| İade (tutar bazlı) | `POST /v2/payment/refund`           | `paymentId` + `price`; aynı gün yapılan ödemede `10223` döner |
| İptal              | `POST /payment/cancel`              | Yalnızca ödeme ile aynı gün; kısmi tutar desteklenmez         |

### Tahsilat isteği (zorunlu alanlar)

`price`, `paidPrice`, `currency`, `paymentCard`, `buyer`, `shippingAddress`, `billingAddress`, `basketItems`.

- **paymentCard:** `cardHolderName`, `cardNumber`, `expireMonth` (MM), `expireYear` (YYYY), `cvc`.
- **buyer:** `id`, `name`, `surname`, `identityNumber`, `email`, `gsmNumber`, `registrationAddress`, `city`, `country` (opsiyonel: `ip`, `zipCode`).
- **adresler:** `contactName`, `city`, `country`, `address` (opsiyonel: `zipCode`).
- **basketItems[]:** `id`, `name`, `category1`, `itemType` (`PHYSICAL` | `VIRTUAL`), `price`. Kalemlerin toplamı `price`'a eşit olmalıdır (`5062`).
- Tutarlar ondalık metin olarak gönderilir (`"10.50"`); yanıtta sayı olarak döner (`10.5`).

### Tahsilat yanıtı (kullanılan alanlar)

`status` (`success` | `failure`), `errorCode`, `errorMessage`, `errorGroup`, `systemTime` (epoch ms), `conversationId`, `paymentId`, `price`, `paidPrice`, `currency`, `installment`, `fraudStatus` (`1` onay, `0` inceleme, `-1` red), `binNumber`, `lastFourDigits`, `cardFamily`.

### 3DS akışı

1. `initialize` → `threeDSHtmlContent` (Base64) ve `paymentId`.
2. Banka, kullanıcının tarayıcısı üzerinden `callbackUrl`'e form-post yapar: `status`, `paymentId`, `conversationData`, `conversationId`, `mdStatus`.
3. `mdStatus` değerleri: `1` başarılı; `0`/`-1` doğrulama başarısız; `2`, `3` kart/banka sisteme kayıtlı değil; `4` doğrulama denemesi; `5` doğrulama yapılamıyor; `6` 3DS hatası; `7` sistem hatası; `8` bilinmeyen kart.
4. `status === "success"` ve `mdStatus === "1"` ise `/payment/3dsecure/auth` çağrılır; tahsilat bu çağrıyla kesinleşir.

## 4. Hata Kodu Eşleme Özeti

Tablonun tamamı `src/errors.ts` içindedir. Eşlenmeyen kodlar `PROVIDER_UNEXPECTED_RESPONSE` olur.

| iyzico kodları                                                                                        | Köprü kodu                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| `10051`                                                                                               | `PAYMENT_INSUFFICIENT_FUNDS`     |
| `10054`, `10229`                                                                                      | `PAYMENT_CARD_EXPIRED`           |
| `12`–`16`, `10084`, `10212`, `10213`, `10215`, `10233`                                                | `PAYMENT_INVALID_CARD`           |
| `10005`, `10012`, `10041`, `10043`, `10057`, `10058`, `10093`, `10201`, `10202`, `10207`, `10209` vb. | `PAYMENT_CARD_DECLINED`          |
| `10034`, `6001`                                                                                       | `PAYMENT_FRAUD_SUSPECTED`        |
| `10210`, `10211`, `mdStatus ≠ 1`                                                                      | `PAYMENT_THREEDS_FAILED`         |
| `10214`, `10219`, `10228`, `1`, `2`                                                                   | `PROVIDER_UNAVAILABLE`           |
| `1000`–`1009`                                                                                         | `PROVIDER_AUTHENTICATION_FAILED` |
| `11`, `3`–`10`, `17`–`27`, `5008`, `5050`, `5062`                                                     | `VALIDATION_FAILED`              |
| İade/iptal işlemindeki diğer tüm iş hataları                                                          | `PAYMENT_REFUND_FAILED`          |

## 5. Sandbox Test Kartları

| Kart numarası      | Davranış                              |
| ------------------ | ------------------------------------- |
| `5528790000000008` | Başarılı (Halkbank, MasterCard kredi) |
| `4111111111111129` | Yetersiz bakiye (`10051`)             |
| `4129111111111111` | İşlem onaylanmadı (`10005`)           |
| `4128111111111112` | Geçersiz işlem (`10012`)              |
| `4127111111111113` | Kayıp kart (`10041`)                  |
| `4126111111111114` | Çalıntı kart (`10043`)                |
| `4125111111111115` | Süresi geçmiş kart (`10054`)          |
| `4124111111111116` | Hatalı CVC2 (`10084`)                 |
| `4123111111111117` | Kart sahibi işlem yapamaz (`10057`)   |
| `4122111111111118` | Terminal yetkisiz (`10058`)           |
| `4121111111111119` | Dolandırıcılık şüphesi (`10034`)      |
| `4120111111111110` | Karta el koyunuz (`10041`)            |
| `4130111111111118` | Genel hata (`10202`)                  |
| `4131111111111117` | 3DS: `mdStatus = 0`                   |
| `4141111111111115` | 3DS: `mdStatus = 4`                   |
| `4151111111111112` | 3DS başlatma başarısız                |

Doküman, hata kartlarını sayısal kodlarla ayrıca eşlemez; parantez içindeki kodlar kart açıklamalarından ve hata kodu tablosundan çıkarılmıştır. Mock server bu eşlemeyi kullanır.

## 6. Tasarım Kararları

1. **Eksik zorunlu alıcı bilgisi:** iyzico `identityNumber` ve kayıt adresi ister; core `BuyerSchema`'da bunlar opsiyoneldir. Eksikse ağ isteği yapılmadan `VALIDATION_FAILED` döner. Yer tutucu (`11111111111` gibi) **gönderilmez.** Fatura adresi verilmezse alıcı adresi kullanılır (ve tersi).
2. **Tam iade:** `/payment/detail` ile ödenen tutar (`paidPrice`) alınır, `/v2/payment/refund` çağrılır. Ödeme henüz gün sonundan geçmediği için `10223` dönerse `/payment/cancel` ile iptal edilir. Böylece kullanıcı tek bir `refund` çağrısıyla her durumda tam iade yapabilir.
3. **3DS tamamlama v1:** v2 (`/payment/v2/3dsecure/auth`), callback'te bulunmayan `paidPrice`, `basketId` ve `currency` alanlarını ister; bu core `ThreeDSCallback` sözleşmesini değiştirmeyi gerektirir. Faz 1'de durumsuz v1 kullanılır; v2 Faz 2'de değerlendirilecektir.
4. **Yanıt imzası doğrulaması yapılmaz:** iyzico, yanıtlardaki `signature` alanının hangi alanlardan ve hangi sırayla üretildiğini belgelememektedir. 3DS'te callback verisine güvenilmez; tahsilat sunucudan sunucuya yapılan `/payment/3dsecure/auth` çağrısının sonucuyla kesinleşir.
5. **Sepet:** `items` verilmezse sipariş tek kalemlik sepet olarak gönderilir. Kalem tipi (`PHYSICAL`/`VIRTUAL`) ve kategori konfigürasyondan gelir.
6. **Tekrar deneme yok:** Tahsilat, iade ve iptal istekleri idempotent değildir ve yeniden denenmez; yalnızca `/payment/detail` yeniden denenebilir.
