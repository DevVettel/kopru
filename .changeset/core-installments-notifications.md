---
'@kopru/core': minor
---

BIN bazlı taksit sorgusu (`queryInstallments`, `installments.query` yeteneği) ve sağlayıcı bildirimlerinin imza doğrulamalı ayrıştırılması (`parseNotification`, `notifications` yeteneği) eklendi. Yeni hata kodları: `PAYMENT_INSTALLMENT_NOT_AVAILABLE`, `WEBHOOK_SIGNATURE_INVALID`. Yeni yardımcı: `verifyHmacSignature`. Contract test paketi kısmi iade, taksit sorgusu ve bildirim testleriyle genişletildi.
