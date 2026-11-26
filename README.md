<div align="center">

<img src="./docs/assets/logo.svg" alt="Köprü logosu" width="320">

# Köprü

**Türkiye'nin ödeme, kargo ve e-Dönüşüm altyapıları için tek bir TypeScript API'si**

[![CI](https://github.com/DevVettel/kopru/actions/workflows/ci.yml/badge.svg)](https://github.com/DevVettel/kopru/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%5E22.18%20%7C%7C%20%3E%3D24.11-339933?logo=nodedotjs&logoColor=white)](./docs/adr/0006-node-version.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](./tooling/tsconfig)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/tr/v1.0.0/)

[Mimari](./ARCHITECTURE.md) · [Yol haritası](./ROADMAP.md) · [Katkı rehberi](./CONTRIBUTING.md) · [Terimler sözlüğü](./docs/GLOSSARY.md)

</div>

---

Köprü, Türkiye'deki banka sanal POS'larını, ödeme kuruluşlarını (iyzico, PayTR vb.), kargo firmalarını (Yurtiçi, Aras vb.) ve e-Fatura / e-Arşiv entegratörlerini tip güvenli tek bir TypeScript API'si ve standart bir JSON/REST arayüzü altında toplayan açık kaynak bir ara katmandır (middleware). Stripe ile Plaid'in global ekosisteme getirdiği geliştirici deneyimini yerel ekosisteme taşımayı hedefliyoruz.

> [!WARNING]
> Proje erken geliştirme aşamasında. Faz 1 (MVP) paketleri npm'de `0.1.0` olarak yayımlandı; `0.x` sürümlerinde kırıcı değişiklikler olabilir. Sağlayıcılar mock sunucuya karşı test edildi; iyzico sandbox'ı ve Yurtiçi'nin gerçek servisiyle henüz doğrulanmadı. Ayrıntılar [yol haritasında](./ROADMAP.md).

## Neden Köprü?

Türkiye'de e-ticaret ya da SaaS ürünü geliştiren her ekip aynı zahmetli yoldan geçer:

| Sorun                       | Bugünkü durum                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parçalı API'ler**         | Her banka, ödeme kuruluşu ve kargo firması başka bir protokol kullanır: SOAP, XML, form-post, imzalı hash'ler, REST…                                 |
| **Tutarsız veri modelleri** | Bir sağlayıcıda `amount` kuruş cinsinden gelir, ötekinde `"10,50"` diye string olarak. Adres, il/ilçe kodu ve telefon biçimi de her yerde farklıdır. |
| **Anlamsız hata kodları**   | `"Hata: 05"`, `"ErrMsg: Islem onaylanmadi"`… Bir hatanın ne anlama geldiğini bulmak için PDF dokümanların arasında kaybolursunuz.                    |
| **Vendor lock-in**          | Sağlayıcı değiştirmek, iş mantığının büyük kısmını yeniden yazmak demektir.                                                                          |
| **Test zorluğu**            | Sandbox ortamı ya yoktur ya yavaştır ya da üretimden farklı davranır.                                                                                |
| **Tekrarlanan emek**        | Aynı 3D Secure akışı, aynı hash hesabı, aynı XML ayrıştırma binlerce şirkette yeniden yazılır.                                                       |

Köprü bu işi bir kez, doğru ve açık kaynak olarak yapar.

## Yaklaşım

Köprü'de öncelik geliştirici deneyimidir (DX).

**Tek API, değiştirilebilir sağlayıcılar.** İş mantığınız sağlayıcıya bağlı kalmaz. iyzico'dan PayTR'ye geçmek için kodu yeniden yazmanız gerekmez, konfigürasyonu değiştirmeniz yeter.

**Uçtan uca tip güvenliği.** Bütün istek ve yanıtlar Zod şemalarıyla tanımlanır. Derleme zamanında TypeScript, çalışma zamanında Zod sizi korur. Sağlayıcıdan beklenmedik bir yanıt gelirse kod sessizce bozulmaz, anlamlı bir hata alırsınız.

**Anlaşılır, standart hatalar.** Sağlayıcı `"Hata: 05"` döndürdüğünde size `KopruError` sınıfından türeyen bir hata gelir. İçinde makinenin okuyabileceği bir kod (`PAYMENT_CARD_DECLINED`), Türkçe ve İngilizce açıklama, bir de sağlayıcının ham yanıtı bulunur.

**Gerçekçi mock sunucu.** `@kopru/mock-server` sağlayıcıların davranışını taklit eder. Gerçek bir sağlayıcı hesabı açmadan bütün akışları (3D Secure dâhil) yerelde ve CI'da test edebilirsiniz.

**İki kullanım modu.** Köprü'yü Node.js uygulamanıza npm paketi olarak ekleyebilirsiniz. Dilden bağımsız bir JSON/REST servisi olarak ayağa kaldırıp PHP, Python, Go ya da başka bir istemciden de kullanabilirsiniz (REST sunucusu Faz 2'de geliyor).

## Kapsam

| Alan          | Örnek sağlayıcılar                                                                     |
| ------------- | -------------------------------------------------------------------------------------- |
| **Ödeme**     | iyzico, PayTR, banka sanal POS'ları (Garanti BBVA, Akbank, İş Bankası, Yapı Kredi vb.) |
| **Kargo**     | Yurtiçi Kargo, Aras Kargo, MNG, Sürat, PTT                                             |
| **e-Dönüşüm** | e-Fatura, e-Arşiv, e-İrsaliye entegratörleri                                           |

## Paketler

| Paket                                          | Durum              | Açıklama                                                                     |
| ---------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| [`@kopru/core`](./packages/core)               | `0.1.0` yayımlandı | Ortak sözleşmeler, Zod şemaları, hata sınıfları, HTTP istemcisi, yardımcılar |
| [`@kopru/mock-server`](./packages/mock-server) | `0.1.0` yayımlandı | iyzico ve Yurtiçi senaryolarıyla çalışan sağlayıcı taklit sunucusu ve CLI    |
| [`@kopru/iyzico`](./packages/payment-iyzico)   | `0.1.0` yayımlandı | iyzico ödeme sağlayıcısı                                                     |
| [`@kopru/yurtici`](./packages/cargo-yurtici)   | `0.1.0` yayımlandı | Yurtiçi Kargo sağlayıcısı                                                    |
| `@kopru/server`                                | Planlandı (Faz 2)  | Standart JSON/REST ara katmanı                                               |

## Kullanım

```ts
import { createPaymentClient } from '@kopru/core';
import { iyzico } from '@kopru/iyzico';

const payments = createPaymentClient({
  provider: iyzico({ apiKey: '...', secretKey: '...', sandbox: true }),
});

const result = await payments.charge({
  orderId: 'S-1001',
  amount: { value: 15000, currency: 'TRY' }, // 150,00 TL; tutarlar her zaman kuruş cinsinden
  card: { number: '5528790000000008', expiry: '12/30', cvc: '123', holderName: 'Ada Lovelace' },
  buyer: {
    id: 'u_1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    identityNumber: '10000000146', // sentetik test TCKN'si
    address: { cityCode: '34', district: 'Kadıköy', addressLine: 'Örnek Sokak No: 1' },
  },
  installments: 1,
});

if (result.ok) {
  console.log(result.value.transactionId);
} else {
  console.error(result.error.code); // örn: "PAYMENT_CARD_DECLINED"
}
```

3D Secure ödeme, kargo, takip ve iadeyi uçtan uca gösteren, hesap gerektirmeyen örnek: [`examples/checkout-flow`](./examples/checkout-flow) (`pnpm example:checkout`).

## Geliştirme

Node.js `22.18+` ya da `24.11+` ve pnpm `10` gerekir. pnpm sürümü `package.json` içinde sabitlendiği için `corepack enable` yeterlidir.

```bash
git clone https://github.com/DevVettel/kopru.git
cd kopru
corepack enable
pnpm install
pnpm test
```

Bütün komutlar ve PR süreci [katkı rehberinde](./CONTRIBUTING.md) anlatılıyor.

## Dokümanlar

| Doküman                                                                              | İçerik                                                    |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                                                 | Teknik mimari, monorepo yapısı, sağlayıcı eklenti sistemi |
| [ROADMAP.md](./ROADMAP.md)                                                           | MVP ve sonraki fazlar                                     |
| [docs/plans/PHASE-1.md](./docs/plans/PHASE-1.md)                                     | Faz 1'in görev bazlı uygulama planı                       |
| [docs/guides/adding-a-provider.md](./docs/guides/adding-a-provider.md)               | Yeni sağlayıcı ekleme rehberi                             |
| [docs/guides/testing-with-mock-server.md](./docs/guides/testing-with-mock-server.md) | Mock sunucu ile test, test kartları ve gönderileri        |
| [docs/adr](./docs/adr/)                                                              | Mimari karar kayıtları (ADR)                              |
| [docs/GLOSSARY.md](./docs/GLOSSARY.md)                                               | Türkçe alan terimlerinin koddaki İngilizce karşılıkları   |
| [CLAUDE.md](./CLAUDE.md)                                                             | Kod geliştirme kuralları ve standartlar                   |

## Katkı

Köprü toplulukla büyüyecek bir proje. Özellikle şu konularda yardıma ihtiyacımız var:

- Sağlayıcı dokümanlarına ve sandbox hesaplarına erişimi olan geliştiriciler
- Sanal POS ve 3D Secure akışlarında deneyimli geliştiriciler
- e-Dönüşüm mevzuatına hâkim katkıcılar

Başlamadan önce [katkı rehberini](./CONTRIBUTING.md) ve [davranış kurallarını](./CODE_OF_CONDUCT.md) okuyun. Bir güvenlik açığı bulduysanız lütfen issue açmayın, [güvenlik politikasındaki](./SECURITY.md) adımları izleyin.

## Lisans

[MIT](./LICENSE)

---

<sub>Köprü'nün adı geçen banka, ödeme kuruluşu ve kargo firmalarının hiçbiriyle resmî bir bağı yoktur. Bütün marka adları sahiplerine aittir.</sub>
