# Örnek: Alışveriş akışı

Köprü ile uçtan uca bir alışveriş akışı. Her şey yerelde, [`@kopru/mock-server`](../../packages/mock-server) üzerinde çalışır. Sağlayıcı hesabı ya da kimlik bilgisi gerekmez.

## Çalıştırma

Depo kökünde:

```bash
pnpm install
pnpm example:checkout
```

Sağlayıcılara giden (maskelenmiş) istekleri de görmek için, paketler bir kez derlendikten sonra `examples/checkout-flow` dizininde `node src/main.ts --verbose` komutunu kullanın.

## Akış

1. Sipariş oluşturulur.
2. Yetersiz bakiyeli kartla ödeme denenir ve `PAYMENT_INSUFFICIENT_FUNDS` alınır.
3. 3D Secure ile ödeme yapılır: `initThreeDS` → banka sayfası → callback → `completeThreeDS`. Sonuçtaki `orderId` ve `amount`, sipariş kaydıyla karşılaştırılır.
4. Yurtiçi Kargo gönderisi oluşturulur ve durumu sorgulanır.
5. Teslim edilmiş hazır bir gönderinin hareket geçmişi gösterilir.
6. Alıcı vazgeçer, gönderi iptal edilir.
7. Ödeme iade edilir. iyzico'da aynı gün yapılan ödemeler için Köprü bunu kendiliğinden iptale çevirir.

## Dosyalar

| Dosya                                                | İçerik                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| [`src/clients.ts`](./src/clients.ts)                 | Sağlayıcı seçimi ve konfigürasyon; gerçek ortama geçişte değişir |
| [`src/checkout.ts`](./src/checkout.ts)               | İş mantığı; sağlayıcılardan habersizdir                          |
| [`src/callback-server.ts`](./src/callback-server.ts) | 3DS dönüş adresi; uygulamanızda bir route olur                   |
| [`src/browser.ts`](./src/browser.ts)                 | Kullanıcının tarayıcısını taklit eder; uygulamanızda gerekmez    |
| [`src/order.ts`](./src/order.ts)                     | Sipariş kaydı ve sentetik alıcı                                  |
| [`src/main.ts`](./src/main.ts)                       | Mock server'ı başlatır ve akışı çalıştırır                       |

Örnek derlenmez. Node.js `22.18+` / `24.11+` TypeScript dosyalarını doğrudan çalıştırabildiği için içe aktarmalar `.ts` uzantılıdır. Örnekteki sipariş bellekte tutulur; gerçek uygulamada sipariş durumunu ve `transactionId` değerini veritabanında saklayın.
