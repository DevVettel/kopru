/**
 * iyzico mock senaryolarını tetikleyen deterministik test kartları. Numaralar iyzico'nun
 * resmi sandbox test kartlarıyla aynıdır; böylece aynı testler sandbox'a karşı da anlamlıdır.
 * Yalnızca {@link IYZICO_MOCK_TIMEOUT_CARD} Köprü'ye özgüdür.
 */

/** Hata üreten kartın döndüreceği iyzico hatası. */
export interface IyzicoMockFailure {
  readonly errorCode: string;
  readonly errorGroup: string;
  readonly errorMessage: string;
}

/** Başarılı tahsilat (Halkbank MasterCard kredi). İadede gün sonu yapılmamış sayılır → iptal. */
export const IYZICO_MOCK_SUCCESS_CARD = '5528790000000008';

/** Başarılı tahsilat (Garanti MasterCard kredi). Gün sonu yapılmış sayılır → tutar bazlı iade. */
export const IYZICO_MOCK_SETTLED_CARD = '5400360000000003';

/** Başarılı tahsilat; ancak iade ve iptal edilemez. */
export const IYZICO_MOCK_NON_REFUNDABLE_CARD = '5406670000000009';

/** Köprü'ye özgü: yanıt {@link IYZICO_MOCK_TIMEOUT_DELAY_MS} kadar gecikir (zaman aşımı testleri). */
export const IYZICO_MOCK_TIMEOUT_CARD = '4000000000000002';

/** Zaman aşımı kartında yanıtın geciktirildiği süre (ms). */
export const IYZICO_MOCK_TIMEOUT_DELAY_MS = 10_000;

/** 3DS doğrulaması `mdStatus = 0` ile başarısız olur. */
export const IYZICO_MOCK_THREEDS_MD0_CARD = '4131111111111117';

/** 3DS doğrulaması `mdStatus = 4` (doğrulama denemesi) ile sonuçlanır. */
export const IYZICO_MOCK_THREEDS_MD4_CARD = '4141111111111115';

/** 3DS başlatma başarısız olur. */
export const IYZICO_MOCK_THREEDS_INIT_FAIL_CARD = '4151111111111112';

/** Kart numarası → iyzico hatası. Tahsilatta (non-3DS) veya 3DS tamamlamada döner. */
export const IYZICO_MOCK_FAILURE_CARDS: ReadonlyMap<string, IyzicoMockFailure> = new Map([
  [
    '4111111111111129',
    {
      errorCode: '10051',
      errorGroup: 'NOT_SUFFICIENT_FUNDS',
      errorMessage: 'Kart limiti yetersiz, yetersiz bakiye',
    },
  ],
  [
    '4129111111111111',
    { errorCode: '10005', errorGroup: 'DO_NOT_HONOUR', errorMessage: 'İşlem onaylanmadı' },
  ],
  [
    '4128111111111112',
    { errorCode: '10012', errorGroup: 'INVALID_TRANSACTION', errorMessage: 'Geçersiz işlem' },
  ],
  [
    '4127111111111113',
    { errorCode: '10041', errorGroup: 'LOST_CARD', errorMessage: 'Kayıp kart, karta el koyunuz' },
  ],
  [
    '4126111111111114',
    {
      errorCode: '10043',
      errorGroup: 'STOLEN_CARD',
      errorMessage: 'Çalıntı kart, karta el koyunuz',
    },
  ],
  [
    '4125111111111115',
    { errorCode: '10054', errorGroup: 'EXPIRED_CARD', errorMessage: 'Son kullanma tarihi hatalı' },
  ],
  [
    '4124111111111116',
    { errorCode: '10084', errorGroup: 'INVALID_CVC2', errorMessage: 'Cvc2 bilgisi hatalı' },
  ],
  [
    '4123111111111117',
    {
      errorCode: '10057',
      errorGroup: 'NOT_PERMITTED_TO_CARDHOLDER',
      errorMessage: 'Kart sahibi bu işlemi yapamaz',
    },
  ],
  [
    '4122111111111118',
    {
      errorCode: '10058',
      errorGroup: 'NOT_PERMITTED_TO_TERMINAL',
      errorMessage: 'Terminalin bu işlemi yapmaya yetkisi yok',
    },
  ],
  [
    '4121111111111119',
    {
      errorCode: '10034',
      errorGroup: 'FRAUD_SUSPECT',
      errorMessage: 'Ödeme güvenlik denetimini geçemedi',
    },
  ],
  [
    '4120111111111110',
    {
      errorCode: '10041',
      errorGroup: 'PICKUP_CARD',
      errorMessage: 'Kayıp kart, karta el koyunuz',
    },
  ],
  [
    '4130111111111118',
    {
      errorCode: '10202',
      errorGroup: 'UNKNOWN',
      errorMessage: 'Ödeme işlemi esnasında genel bir hata oluştu',
    },
  ],
]);
