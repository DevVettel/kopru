<img src="https://raw.githubusercontent.com/DevVettel/kopru/main/docs/assets/logo.svg" alt="Köprü logosu" width="120" align="right">

# @kopru/iyzico

Köprü'nün [iyzico](https://www.iyzico.com/) ödeme sağlayıcısı. iyzico API'sini `@kopru/core` ödeme sözleşmesinin arkasına yerleştirir: non-3DS tahsilat, 3D Secure ve tam iade tek bir standart API ile yapılır.

> [!WARNING]
> Köprü `0.x` sürümlerinde. API, küçük (minor) sürümler arasında değişebilir. iyzico sandbox'ına karşı henüz uçtan uca denenmedi; testler mock server'a karşı çalışır.

## Kurulum

```bash
pnpm add @kopru/core @kopru/iyzico
```

Node.js 22 ya da üzeri gerekir.

## Yetenekler

| Yetenek          | Destek | Not                                                          |
| ---------------- | ------ | ------------------------------------------------------------ |
| `charge`         | ✅     | Non-3DS tahsilat (hesabınızda iyzico tarafından açılmalıdır) |
| `threeDS`        | ✅     | `initThreeDS` + `completeThreeDS`                            |
| `refund`         | ✅     | Tam iade (aynı gün ise otomatik olarak iptal edilir)         |
| `installments`   | ✅     | iyzico'nun desteklediği taksit sayıları                      |
| `refund.partial` | ❌     | Faz 2                                                        |

## Konfigürasyon

```ts
import { createPaymentClient } from '@kopru/core';
import { iyzico } from '@kopru/iyzico';

const payments = createPaymentClient({
  provider: iyzico({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    sandbox: true,
  }),
});
```

| Alan                  | Varsayılan | Açıklama                                                                     |
| --------------------- | ---------- | ---------------------------------------------------------------------------- |
| `apiKey`, `secretKey` | (zorunlu)  | iyzico panelinden alınan anahtarlar. Asla loglanmaz.                         |
| `sandbox`             | `false`    | `true` ise `https://sandbox-api.iyzipay.com`, aksi halde canlı ortam         |
| `baseUrl`             | —          | Kök adresi elle belirler (örn. mock server). Verilirse `sandbox` yok sayılır |
| `locale`              | `tr`       | iyzico hata mesajlarının dili (`tr` / `en`)                                  |
| `basketItemType`      | `PHYSICAL` | Sepet kalemlerinin tipi (`PHYSICAL` / `VIRTUAL`)                             |
| `defaultItemCategory` | `Genel`    | `items` verilmediğinde tek kalemlik sepetin kategorisi                       |

Hatalı konfigürasyon `ConfigurationError` fırlatır.

## iyzico'ya Özgü Zorunlu Alanlar

iyzico, core'da opsiyonel olan bazı alıcı bilgilerini zorunlu tutar. Eksik olduklarında ağ isteği yapılmadan `VALIDATION_FAILED` döner; yer tutucu değer **gönderilmez.**

- `buyer.identityNumber` (TCKN)
- `buyer.address` veya `billingAddress` (biri verilmezse diğeri kullanılır)

`items` verilmezse sipariş, `orderId` ve `description` ile tek kalemlik sepet olarak gönderilir.

## Kullanım

### Non-3DS tahsilat

```ts
const result = await payments.charge({
  orderId: 'S-1001',
  amount: { value: 1050, currency: 'TRY' }, // 10,50 TL (kuruş cinsinden)
  card: { holderName: 'Ad Soyad', number: '5528790000000008', expiry: '12/30', cvc: '123' },
  buyer: {
    id: 'U-1',
    firstName: 'Ad',
    lastName: 'Soyad',
    email: 'ad@example.com',
    identityNumber: '10000000146',
    address: { cityCode: '34', district: 'Kadıköy', addressLine: 'Örnek Sokak No: 1' },
  },
});

if (result.ok) {
  result.value.transactionId; // iyzico paymentId; iade için saklayın
} else {
  result.error.code; // örn. PAYMENT_INSUFFICIENT_FUNDS
  result.error.userMessage; // "Kartınızın bakiyesi yetersiz."
}
```

### 3D Secure

```ts
// 1) Başlat: iyzico'nun banka sayfasını kullanıcıya gösterin.
const init = await payments.initThreeDS({
  ...chargeInput,
  callbackUrl: 'https://magaza.example/3ds',
});
if (init.ok && init.value.action.type === 'html') {
  res.send(init.value.action.html);
}

// 2) Banka, kullanıcıyı callbackUrl'e form-post ile döndürür. Gelen alanların tamamını iletin:
app.post('/3ds', async (req, res) => {
  const result = await payments.completeThreeDS({ payload: req.body });
  // result.ok → ödeme kesinleşti; aksi halde örn. PAYMENT_THREEDS_FAILED
});
```

Callback verisi kullanıcının tarayıcısından geçtiği için yalnızca yönlendirme amaçlı kullanılır; ödeme, sunucudan iyzico'ya yapılan `/payment/3dsecure/auth` çağrısıyla kesinleşir. `mdStatus` `1` değilse bu çağrı yapılmadan `PAYMENT_THREEDS_FAILED` döner. Sonuçtaki `orderId` callback'ten değil, iyzico'nun yanıtından alınır. Siparişi ödendi olarak işaretlemeden önce `orderId` ve `amount` değerlerini kendi kaydınızla karşılaştırın.

### Tam iade

```ts
const refund = await payments.refund({ transactionId: result.value.transactionId });
```

iyzico'da aynı gün yapılan ödemeler iade edilemez, iptal edilir. Köprü bunu sizin yerinize yönetir: önce tutar bazlı iade (`/v2/payment/refund`) denenir; iyzico "gün sonu yapılmalı" (`10223`) derse ödeme iptal edilir (`/payment/cancel`). İade edilen tutar, müşteriden tahsil edilen tutardır.

## Hata Eşleme

iyzico hata kodları standart Köprü kodlarına çevrilir; ham kod ve mesaj `providerCode` / `providerMessage` alanlarında korunur. Örnekler:

| iyzico            | Köprü                            |
| ----------------- | -------------------------------- |
| `10051`           | `PAYMENT_INSUFFICIENT_FUNDS`     |
| `10005`, `10012`  | `PAYMENT_CARD_DECLINED`          |
| `10054`           | `PAYMENT_CARD_EXPIRED`           |
| `10084`           | `PAYMENT_INVALID_CARD`           |
| `10034`           | `PAYMENT_FRAUD_SUSPECTED`        |
| `1000`, `1001`    | `PROVIDER_AUTHENTICATION_FAILED` |
| Eşlenmeyen kodlar | `PROVIDER_UNEXPECTED_RESPONSE`   |

İade sırasındaki iş hataları `PAYMENT_REFUND_FAILED` olarak döner. Tam tablo: [`src/errors.ts`](./src/errors.ts); dokümandan çıkarılan notlar ve tasarım kararları: [`NOTES.md`](./NOTES.md).

## Test

Testler gerçek iyzico'ya değil, [`@kopru/mock-server`](../mock-server/README.md) içindeki iyzico eklentisine karşı çalışır. Eklenti imzayı doğrular ve iyzico'nun resmi sandbox test kartlarıyla aynı numaraları kullanır; bu nedenle aynı kartlar sandbox'ta da benzer sonuç verir.

```ts
import { IYZICO_MOCK_API_KEY, IYZICO_MOCK_SECRET_KEY } from '@kopru/mock-server';

iyzico({
  apiKey: IYZICO_MOCK_API_KEY,
  secretKey: IYZICO_MOCK_SECRET_KEY,
  baseUrl: `${mockUrl}/iyzico`,
});
```

## Bilinen Sınırlamalar

- Yanıtlardaki `signature` alanı doğrulanmaz; iyzico bu imzanın nasıl üretildiğini belgelememektedir.
- 3DS tamamlama için v1 uç noktası kullanılır (v2, core sözleşmesinde bulunmayan alanlar ister).
- Kısmi iade, kart saklama ve pazaryeri (alt üye işyeri) özellikleri Faz 1 kapsamında değildir.
