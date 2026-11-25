# Güvenlik Politikası

Köprü ödeme ve kişisel veri akışlarının arasında durduğu için güvenlik bildirimlerini öncelikli ele alıyoruz.

## Desteklenen sürümler

`0.x` döneminde yalnızca en son yayımlanan sürüm ve `main` dalı destekleniyor.

## Açık bildirme

Güvenlik açıklarını **herkese açık bir issue ile bildirmeyin.** Bunun yerine GitHub'ın özel bildirim kanalını kullanın:

1. Deponun **Security** sekmesine gidin.
2. **Report a vulnerability** düğmesine tıklayın.
3. Açığı, etkisini ve yeniden üretme adımlarını yazın.

Bildirimi inceledikten sonra aynı kanal üzerinden size dönüş yapılır. Açık düzeltilip yayımlanana kadar ayrıntıları paylaşmamanızı rica ediyoruz.

## Kapsam

Özellikle şu konulardaki bildirimler bizim için değerli:

- Kart numarası, CVC, API anahtarı, secret ya da TCKN'nin loglara, hata ayrıntılarına veya mock sunucunun istek kaydına maskelenmeden düşmesi
- İmza, hash ya da callback doğrulamasının atlatılabilmesi
- Sağlayıcı yanıtlarının doğrulanmadan iş mantığına ulaşması

Bildirim hazırlarken gerçek kart verisi ya da gerçek kişisel veri kullanmayın. Sağlayıcıların test kartları ve anonim örnekler yeterli.
