# 0010: Ödeme bildirimleri (webhook) ve taksit sorgusu sözleşmesi

- **Durum:** Kabul edildi
- **Tarih:** 2026-11-27

## Bağlam

Faz 1 sözleşmesinde ödeme sonucu yalnızca senkron yanıttan (`charge`) veya tarayıcının getirdiği 3DS callback'inden (`completeThreeDS`) gelir. Faz 2 sağlayıcıları farklıdır:

- **PayTR**, ödeme sonucunu sunucudan sunucuya "Bildirim URL"ine POST eder. `hash = base64(HMAC-SHA256(merchant_key, merchant_oid + merchant_salt + status + total_amount))`; yanıt gövdesi tam olarak `OK` olmalıdır, aksi halde bildirim tekrarlanır.
- **iyzico** webhook'ları JSON gövdeli POST'tur; imza `X-IYZ-SIGNATURE-V3` başlığında, HMAC-SHA256 (hex) ile gelir ve herhangi bir 2xx yanıt yeterlidir. Gövdede tutar yoktur.

Taksit sorgusu da iki sağlayıcıda farklıdır: iyzico BIN + tutar için hazır taksit tutarlarını döner; PayTR BIN bilgisini ve kart ailesi bazlı oranları ayrı servislerden verir.

## Karar

**Bildirimler**

- Core'a `parseNotification` işlemi ve `notifications` yeteneği eklenir.
- Girdi (`NotificationRequest`): başlıklar (küçük harfe normalize) ve **ham gövde** (`string`). İmza ham gövde üzerinden doğrulanabilsin diye gövde ayrıştırılmadan verilir.
- Çıktı (`PaymentNotificationResult`):
  - `notification`: `orderId`, opsiyonel `transactionId`, `status` (`succeeded` | `failed` | `pending`), ham `providerStatus`, opsiyonel `amount` ve `occurredAt`, başarısızlıkta `failure` (`code`, `providerCode`, `providerMessage`).
  - `acknowledgement`: sağlayıcıya dönülecek yanıt (`status`, `contentType`, `body`). Sunucu bunu aynen döner; böylece PayTR'nin `OK` gibi kuralları sağlayıcı paketinde kalır.
- İmza sağlayıcı paketinde doğrulanır; geçersiz imza `WEBHOOK_SIGNATURE_INVALID` (kategori `validation`) döner. Core, sabit zamanlı karşılaştırma yapan `verifyHmacSignature` yardımcısını sunar.
- Aynı bildirimin birden çok kez gelebileceği belgelenir; tekilleştirme (`orderId` + `status`) uygulamanın sorumluluğundadır.

**Taksit sorgusu**

- Core'a `queryInstallments({ bin, amount })` işlemi ve `installments.query` yeteneği eklenir. Mevcut `installments` yeteneği "taksitli tahsilat" anlamını korur.
- Çıktı (`InstallmentQueryResult`): kart bilgileri (`bankName`, `bankCode`, `cardType`, `cardScheme`, `cardFamily`, `commercial`) ve en az bir `InstallmentOption` (`installments`, `installmentAmount`, `totalAmount`; tutarlar kuruş). Taksit sayıları tekildir ve artan sıradadır.
- Tanınmayan BIN `PAYMENT_INVALID_CARD`; taksit yapılamayan kart yalnızca tek çekim seçeneğiyle başarılı döner. Taksitli tahsilatta seçilen taksit kartta yoksa `PAYMENT_INSTALLMENT_NOT_AVAILABLE` kullanılır.

**Kargo bildirimleri:** Yurtiçi ve Aras için herkese açık bir push bildirim servisi bulunamadı; kargo tarafındaki eşdeğer işlem Faz 5'e ertelenir.

## Değerlendirilen Alternatifler

- **`completeThreeDS`'i bildirimle beslemek:** Tarayıcı callback'i ile sunucu bildirimi farklı güven ve yanıt kurallarına sahiptir; tek işlemde birleştirmek PayTR'nin `OK` yanıtını ve iyzico'nun tutarsız gövdesini taşıyamaz.
- **Ayrıştırılmış gövde (`Record<string, string>`) almak:** JSON gövdeler ve ham gövde üzerinden imzalayan sağlayıcılar için yetersiz.
- **Taksit için `installments` yeteneğini yeniden kullanmak:** Taksitli tahsilat yapabilen ama sorgu servisi sunmayan sağlayıcılar ayırt edilemez.

## Sonuçlar

- Asenkron sonuç veren sağlayıcılar core sözleşmesini kırmadan eklenebilir; değişiklik yalnızca eklemedir (minor).
- Sunucunun bildirim uçları sağlayıcıdan bağımsız kalır (`/v1/payments/notifications/:provider`).
- iyzico bildiriminde tutar olmadığından `amount` opsiyoneldir; tutar kontrolü gereken uygulamalar işlemi ayrıca sorgulamalıdır.
