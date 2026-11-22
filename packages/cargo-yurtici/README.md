<img src="https://raw.githubusercontent.com/DevVettel/kopru/main/docs/assets/logo.svg" alt="Köprü logosu" width="120" align="right">

# @kopru/yurtici

Köprü'nün [Yurtiçi Kargo](https://www.yurticikargo.com/) sağlayıcısı. Yurtiçi'nin SOAP tabanlı web servisini (`ShippingOrderDispatcherServices`) `@kopru/core` kargo sözleşmesinin arkasına yerleştirir: gönderi oluşturma, iptal ve hareket geçmişiyle takip, JSON dostu tek bir API ile yapılır. SOAP zarfları harici bir kütüphane kullanılmadan core'un XML yardımcılarıyla oluşturulur ([ADR-0004](../../docs/adr/0004-no-soap-library.md)).

> [!WARNING]
> Paket geliştirme aşamasında, npm'de henüz yayımlanmadı. Yurtiçi'nin web servis dokümanı herkese açık değil. Uygulama, açık kaynak entegrasyonların kaynak kodundan derlenen bilgilere dayanıyor ve gerçek servise karşı henüz doğrulanmadı. Ayrıntılar ve doğrulanması gereken varsayımlar: [`NOTES.md`](./NOTES.md).

## Yetenekler

| Yetenek          | Destek | Not                                                 |
| ---------------- | ------ | --------------------------------------------------- |
| `createShipment` | ✅     | Takip numarası kargo teslim alındıktan sonra oluşur |
| `cancelShipment` | ✅     | Yalnızca kargo teslim alınmadan önce                |
| `trackShipment`  | ✅     | Durum + hareket geçmişi (eskiden yeniye)            |
| `cashOnDelivery` | ❌     | Faz 2                                               |

## Kurulum ve Konfigürasyon

```ts
import { createCargoClient } from '@kopru/core';
import { yurtici } from '@kopru/yurtici';

const cargo = createCargoClient({
  provider: yurtici({
    username: process.env.YURTICI_USERNAME,
    password: process.env.YURTICI_PASSWORD,
    sandbox: true,
  }),
});
```

| Alan                   | Varsayılan | Açıklama                                                                                       |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `username`, `password` | (zorunlu)  | Web servis kullanıcı adı ve şifresi (`wsUserName` / `wsPassword`). Şifre asla loglanmaz.       |
| `paymentType`          | `sender`   | Hesabın ödeme tipi (`sender` / `recipient`). Yurtiçi her ödeme tipi için ayrı kullanıcı verir. |
| `language`             | `TR`       | Yanıt mesajlarının dili (`TR` / `EN`)                                                          |
| `sandbox`              | `false`    | `true` ise `https://testws.yurticikargo.com`, aksi halde canlı ortam                           |
| `baseUrl`              | —          | Kök adresi elle belirler (örn. mock server). Servis yolu eklenir; `sandbox` yok sayılır        |

Hatalı konfigürasyon `ConfigurationError` fırlatır. Yurtiçi, web servise yalnızca tanımlı IP adreslerinden erişime izin verir; sunucunuzun çıkış IP'sini Yurtiçi bilgi işlem birimine bildirmeniz gerekir.

## Kullanım

### Gönderi oluşturma

```ts
const created = await cargo.createShipment({
  referenceId: 'S-1001', // Yurtiçi kargo anahtarı; en fazla 20 karakter, benzersiz olmalı
  recipient: {
    name: 'Ad Soyad',
    phone: '0532 000 00 00',
    address: {
      cityCode: '06',
      district: 'Çankaya',
      neighborhood: 'Kızılay',
      addressLine: 'Örnek Caddesi No: 1',
    },
  },
  pieceCount: 1,
  desi: 3,
});

if (!created.ok) {
  created.error.code; // örn. CARGO_ADDRESS_INVALID
}
```

Gönderen bilgisi Yurtiçi hesabınızdan alınır; `sender` alanı gönderilmez. Alıcı adresi Yurtiçi'ye `mahalle, açık adres` biçiminde, il adı plaka kodundan çevrilerek iletilir.

### Takip

```ts
const tracking = await cargo.trackShipment({ referenceId: 'S-1001' });
if (tracking.ok) {
  tracking.value.status; // 'in_transit'
  tracking.value.trackingNumber; // kargo teslim alındıktan sonra dolar
  tracking.value.events; // [{ status: 'picked_up', description: 'Kargo Teslim Alındı', occurredAt: '2026-11-16T14:30:05+03:00', … }]
}
```

Yurtiçi gönderileri yalnızca kargo anahtarıyla sorgulanabildiği için arama `referenceId` ile yapılır. Yalnızca `trackingNumber` verilirse `VALIDATION_FAILED` döner. Yurtiçi aynı gönderi için 1 dakika içinde tekrarlanan sorguları engeller.

### İptal

```ts
const cancelled = await cargo.cancelShipment({ referenceId: 'S-1001' });
```

İptal yalnızca kargo şubede teslim alınmadan önce yapılabilir; sonrasında `CARGO_CANCELLATION_NOT_ALLOWED` döner. Daha önce iptal edilmiş bir gönderiyi tekrar iptal etmek hata değildir.

## Durum ve Hata Eşleme

| Yurtiçi durumu      | Köprü          |
| ------------------- | -------------- |
| `NOP`               | `created`      |
| `ISR`               | `picked_up`    |
| `IND`               | `in_transit`\* |
| `DLV`               | `delivered`    |
| `CNL`, `ISC`, `BI`  | `cancelled`    |
| Eşlenmeyen değerler | `unknown`      |

\* Son hareket dağıtıma çıkışı gösteriyorsa `out_for_delivery`, gönderi iade edildiyse `returned`. Ham değer her zaman `providerStatus` alanında korunur.

| Yurtiçi hata kodu   | Köprü                                               |
| ------------------- | --------------------------------------------------- |
| `82519`             | `CARGO_SHIPMENT_NOT_FOUND`                          |
| `60019`, `82502`    | `CARGO_ADDRESS_INVALID`                             |
| `60020`             | `VALIDATION_FAILED` (anahtar daha önce kullanılmış) |
| `82500`–`82518` vb. | `VALIDATION_FAILED`                                 |
| Eşlenmeyen kodlar   | `PROVIDER_UNEXPECTED_RESPONSE`                      |

Tam tablolar: [`src/errors.ts`](./src/errors.ts), [`src/status-map.ts`](./src/status-map.ts).

## Test

Testler gerçek Yurtiçi'ye değil, [`@kopru/mock-server`](../mock-server/README.md) içindeki Yurtiçi eklentisine karşı çalışır. Eklenti aynı SOAP sözleşmesini taklit eder ve hazır gönderilerle (teslim edildi, yolda, dağıtımda, iade) deterministik hareket geçmişi sunar.

```ts
import { YURTICI_MOCK_PASSWORD, YURTICI_MOCK_USERNAME } from '@kopru/mock-server';

yurtici({
  username: YURTICI_MOCK_USERNAME,
  password: YURTICI_MOCK_PASSWORD,
  baseUrl: `${mockUrl}/yurtici`,
});
```

## Bilinen Sınırlamalar

- SOAP namespace'i, `SOAPAction` değeri ve kimlik doğrulama hatasının biçimi gerçek servise karşı doğrulanmadı ([`NOTES.md`](./NOTES.md) §2, §4).
- Kapıda ödeme, iade gönderisi (`saveReturnShipmentCode`) ve gönderen bilgisinin istekte verilmesi Faz 1 kapsamında değildir.
- Hareket kodu tablosu resmî listeden değil, açık kaynak entegrasyonlardan alınmıştır; tanınmayan kodlar `unknown` olarak döner.
