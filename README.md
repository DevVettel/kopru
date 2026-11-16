# 🌉 Köprü

> **Türkiye'nin ödeme, kargo ve e-Dönüşüm altyapıları için tek bir standart arayüz.**

Köprü; Türkiye'deki banka sanal POS'larını, ödeme kuruluşlarını (iyzico, PayTR vb.), kargo firmalarını (Yurtiçi, Aras vb.) ve e-Fatura / e-Arşiv entegratörlerini **tek bir tutarlı, tip güvenli TypeScript API'si** ve **standart JSON/REST arayüzü** altında birleştiren açık kaynak bir ara katman (middleware) ve kütüphanedir.

Stripe ve Plaid'in global ekosisteme getirdiği geliştirici deneyimini, yerel ekosisteme getirmeyi hedefliyoruz.

> ⚠️ **Durum:** Proje tasarım aşamasındadır. Henüz kullanıma hazır bir paket yayımlanmamıştır. Yol haritası için [ROADMAP.md](./ROADMAP.md) dosyasına bakın.

---

## 🧩 Çözdüğümüz Problem

Türkiye'de bir e-ticaret ya da SaaS ürünü geliştiren her ekip, aynı zahmetli yolu tekrar tekrar yürür:

| Problem | Bugünkü Durum |
| --- | --- |
| **Parçalı API'ler** | Her banka, ödeme kuruluşu ve kargo firması farklı protokol kullanır: SOAP, XML, form-post, imzalı hash'ler, REST… |
| **Tutarsız veri modelleri** | Bir sağlayıcıda `amount` kuruş cinsinden, diğerinde `"10,50"` string olarak gelir. Adres, il/ilçe kodları, telefon formatları her yerde farklıdır. |
| **Anlamsız hata kodları** | `"Hata: 05"`, `"ErrMsg: Islem onaylanmadi"`… Hataların anlamını çözmek için PDF dökümanlarda kaybolursunuz. |
| **Vendor lock-in** | Sağlayıcı değiştirmek, iş mantığının büyük kısmını yeniden yazmak demektir. |
| **Test zorluğu** | Sandbox ortamları ya yoktur, ya yavaştır, ya da üretimden farklı davranır. |
| **Tekrarlanan emek** | Aynı 3D Secure akışı, aynı hash hesaplaması, aynı XML parse işlemi binlerce şirkette yeniden yazılır. |

**Köprü bu emeği bir kez, doğru ve açık kaynak olarak yapar.**

---

## ✨ Yaklaşım: Önce Geliştirici Deneyimi (DX)

### 1. Tek API, değiştirilebilir sağlayıcılar
İş mantığınız sağlayıcıdan bağımsızdır. iyzico'dan PayTR'ye geçmek bir konfigürasyon değişikliğidir, yeniden yazım değil.

### 2. Uçtan uca tip güvenliği
Tüm istek ve yanıtlar **Zod** şemaları ile tanımlanır. Derleme zamanında TypeScript, çalışma zamanında Zod sizi korur. Sağlayıcıdan beklenmedik bir yanıt gelirse sessizce bozulmaz, anlamlı bir hata alırsınız.

### 3. Anlaşılır, standart hatalar
`"Hata: 05"` yerine `KopruError` sınıfından türeyen, makine tarafından okunabilir bir kod (`PAYMENT_CARD_DECLINED`), Türkçe/İngilizce açıklama ve sağlayıcının ham yanıtını içeren hatalar.

### 4. Gerçekçi Mock Server
Gerçek sağlayıcı hesabı açmadan, yerelde ve CI ortamında tüm akışları (3D Secure dahil) test edebilmeniz için sağlayıcı davranışlarını taklit eden bir mock sunucu.

### 5. İki kullanım modu
- **Kütüphane olarak:** Node.js uygulamanıza `npm` paketi olarak ekleyin.
- **Ara katman (middleware) olarak:** Dilden bağımsız standart bir JSON/REST servisi olarak ayağa kaldırın; PHP, Python, Go ya da herhangi bir istemciden kullanın.

---

## 🔭 Kapsam

| Alan | Örnek Sağlayıcılar |
| --- | --- |
| 💳 **Ödeme** | iyzico, PayTR, banka sanal POS'ları (Garanti BBVA, Akbank, İş Bankası, Yapı Kredi vb.) |
| 📦 **Kargo** | Yurtiçi Kargo, Aras Kargo, MNG, Sürat, PTT |
| 🧾 **e-Dönüşüm** | e-Fatura, e-Arşiv, e-İrsaliye entegratörleri |

---

## 👀 Hedeflenen Kullanım (Taslak)

> Aşağıdaki örnek, hedeflenen API tasarımını göstermek içindir ve değişebilir.

```ts
import { createPaymentClient } from '@kopru/core';
import { iyzico } from '@kopru/iyzico';

const payments = createPaymentClient({
  provider: iyzico({ apiKey: '...', secretKey: '...', sandbox: true }),
});

const result = await payments.charge({
  amount: { value: 15000, currency: 'TRY' }, // 150,00 TL — tutarlar her zaman kuruş cinsinden
  card: { number: '5528790000000008', expiry: '12/30', cvc: '123', holderName: 'Ada Lovelace' },
  buyer: { id: 'u_1', email: 'ada@example.com', identityNumber: '11111111111' },
  installments: 1,
});

if (result.ok) {
  console.log(result.value.transactionId);
} else {
  console.error(result.error.code); // örn: "PAYMENT_CARD_DECLINED"
}
```

---

## 📚 Dökümanlar

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Teknik mimari, monorepo yapısı, provider eklenti sistemi
- [ROADMAP.md](./ROADMAP.md) — MVP ve sonraki fazlar
- [CLAUDE.md](./CLAUDE.md) — Kod geliştirme kuralları ve standartlar

---

## 🤝 Katkı

Köprü topluluk ile büyüyecek bir projedir. Özellikle şu konularda katkıya ihtiyacımız var:

- Sağlayıcı dökümanlarına ve sandbox hesaplarına erişimi olan geliştiriciler
- Sanal POS / 3D Secure akışlarında deneyimli geliştiriciler
- e-Dönüşüm mevzuatına hakim katkıcılar

Katkı rehberi, ilk kod sürümüyle birlikte yayımlanacaktır.

## 📄 Lisans

MIT (planlanan)

> Köprü; adı geçen banka, ödeme kuruluşu veya kargo firmalarının hiçbiriyle resmi bir bağlantıya sahip değildir. Tüm marka adları sahiplerine aittir.
