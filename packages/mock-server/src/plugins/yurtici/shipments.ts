/**
 * Yurtiçi mock senaryolarını tetikleyen deterministik kargo anahtarları ve hazır gönderiler.
 * Takip numaraları ve tarihler sabittir; aynı istek her zaman aynı yanıtı üretir.
 */

/** Mock gönderi hareketi (Yurtiçi `invDocCargoVOArray` öğesi). */
export interface YurticiMockEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly reasonId: string;
  readonly reasonName: string;
  /** `YYYYMMDD`. */
  readonly eventDate: string;
  /** `HHMMSS`. */
  readonly eventTime: string;
  readonly unitName: string;
  readonly cityName: string;
  readonly townName: string;
}

/** Mock'un bellekte tuttuğu gönderi. */
export interface YurticiMockShipment {
  /** Yurtiçi işlem durumu (`NOP`, `IND`, `DLV`, `CNL` …). */
  operationStatus: string;
  /** Gönderi (takip) numarası; kargo teslim alınana kadar yoktur. */
  docId: string | undefined;
  /** `3` ise gönderi göndericiye iade edilmiştir. */
  returnStatus: string | undefined;
  events: readonly YurticiMockEvent[];
}

/** Yurtiçi işlem durumu → işlem kodu. */
export const YURTICI_MOCK_OPERATION_CODES: Readonly<Record<string, string>> = {
  NOP: '0',
  IND: '1',
  ISR: '2',
  CNL: '3',
  ISC: '4',
  DLV: '5',
  BI: '6',
};

/** Yurtiçi işlem durumu → açıklama. */
export const YURTICI_MOCK_OPERATION_MESSAGES: Readonly<Record<string, string>> = {
  NOP: 'Kargo İşlem Görmemiş.',
  IND: 'Kargo Teslimattadır.',
  ISR: 'Kargo İşlem Görmüş, Faturası Henüz Düzenlenmemiştir.',
  CNL: 'Kargo Çıkışı Engellendi.',
  ISC: 'Kargo Daha Önceden İptal Edilmiştir.',
  DLV: 'Kargo Teslim Edilmiştir.',
  BI: 'Fatura Şube Tarafından İptal Edilmiştir.',
};

/** Teslim edilmiş gönderi: teslim alma → transfer → dağıtım → teslim. */
export const YURTICI_MOCK_DELIVERED_KEY = 'KOPRU-DELIVERED';

/** Yoldaki gönderi: teslim alındı, transfer merkezine ulaştı. */
export const YURTICI_MOCK_IN_TRANSIT_KEY = 'KOPRU-IN-TRANSIT';

/** Dağıtıma çıkmış gönderi. */
export const YURTICI_MOCK_OUT_FOR_DELIVERY_KEY = 'KOPRU-OUT-FOR-DELIVERY';

/** Teslim edilemeyip göndericiye iade edilmiş gönderi. */
export const YURTICI_MOCK_RETURNED_KEY = 'KOPRU-RETURNED';

/** Daha önce kullanılmış kargo anahtarı: oluşturma `60020` ile başarısız olur. */
export const YURTICI_MOCK_EXISTING_KEY = 'KOPRU-EXISTING';

/** Köprü'ye özgü: yanıt {@link YURTICI_MOCK_TIMEOUT_DELAY_MS} kadar gecikir. */
export const YURTICI_MOCK_TIMEOUT_KEY = 'KOPRU-TIMEOUT';

/** Zaman aşımı anahtarında yanıtın geciktirildiği süre (ms). */
export const YURTICI_MOCK_TIMEOUT_DELAY_MS = 10_000;

/** Açık adreste geçerse gönderi oluşturma geçersiz adres hatası (`60019`) ile başarısız olur. */
export const YURTICI_MOCK_INVALID_ADDRESS_MARKER = 'KOPRU-INVALID-ADDRESS';

const event = (
  eventId: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  unitName: string,
  townName: string,
  cityName: string,
  reason: { reasonId: string; reasonName: string } = { reasonId: 'OK', reasonName: 'Sorun Yok' },
): YurticiMockEvent => ({
  eventId,
  eventName,
  eventDate,
  eventTime,
  unitName,
  townName,
  cityName,
  ...reason,
});

const PICKED_UP = event(
  'GT',
  'Kargo Teslim Alındı',
  '20261116',
  '143005',
  'Kadıköy Şube',
  'Kadıköy',
  'İstanbul',
);
const DEPARTED = event(
  'IN',
  'Transfer Merkezinden Çıktı',
  '20261116',
  '221540',
  'Tuzla Transfer Merkezi',
  'Tuzla',
  'İstanbul',
);
const ARRIVED = event(
  'YK',
  'Kargo İndirildi',
  '20261117',
  '061210',
  'Ankara Transfer Merkezi',
  'Sincan',
  'Ankara',
);
const OUT_FOR_DELIVERY = event(
  'DG',
  'Dağıtıma Çıkarıldı',
  '20261117',
  '091500',
  'Çankaya Şube',
  'Çankaya',
  'Ankara',
);
const DELIVERED = event(
  'TS',
  'Teslim Edildi',
  '20261117',
  '143000',
  'Çankaya Şube',
  'Çankaya',
  'Ankara',
);
const NOT_DELIVERED = event(
  'DG',
  'Dağıtıma Çıkarıldı',
  '20261117',
  '091500',
  'Çankaya Şube',
  'Çankaya',
  'Ankara',
  {
    reasonId: 'AY',
    reasonName: 'Alıcı Adreste Yok',
  },
);
const RETURNED = event(
  'IA',
  'Göndericiye İade Edildi',
  '20261119',
  '101500',
  'Kadıköy Şube',
  'Kadıköy',
  'İstanbul',
);

/**
 * Hazır gönderiler: kargo anahtarı → gönderi. Hareketler bilinçli olarak karışık sırada
 * verilmiştir; sağlayıcının sıralama yaptığı da sınanır.
 */
export const YURTICI_MOCK_SEEDED_SHIPMENTS: ReadonlyMap<string, YurticiMockShipment> = new Map([
  [
    YURTICI_MOCK_DELIVERED_KEY,
    {
      operationStatus: 'DLV',
      docId: '700000000001',
      returnStatus: '0',
      events: [DELIVERED, PICKED_UP, DEPARTED, ARRIVED, OUT_FOR_DELIVERY],
    },
  ],
  [
    YURTICI_MOCK_IN_TRANSIT_KEY,
    {
      operationStatus: 'IND',
      docId: '700000000002',
      returnStatus: '0',
      events: [PICKED_UP, DEPARTED],
    },
  ],
  [
    YURTICI_MOCK_OUT_FOR_DELIVERY_KEY,
    {
      operationStatus: 'IND',
      docId: '700000000003',
      returnStatus: '0',
      events: [PICKED_UP, DEPARTED, ARRIVED, OUT_FOR_DELIVERY],
    },
  ],
  [
    YURTICI_MOCK_RETURNED_KEY,
    {
      operationStatus: 'IND',
      docId: '700000000004',
      returnStatus: '3',
      events: [PICKED_UP, DEPARTED, ARRIVED, NOT_DELIVERED, RETURNED],
    },
  ],
  [
    YURTICI_MOCK_EXISTING_KEY,
    { operationStatus: 'NOP', docId: undefined, returnStatus: undefined, events: [] },
  ],
]);
