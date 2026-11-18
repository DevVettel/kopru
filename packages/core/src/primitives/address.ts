import { z } from 'zod';

/** Türkiye illeri, plaka kodlarıyla birlikte (01–81). */
export const CITIES = [
  { code: '01', name: 'Adana' },
  { code: '02', name: 'Adıyaman' },
  { code: '03', name: 'Afyonkarahisar' },
  { code: '04', name: 'Ağrı' },
  { code: '05', name: 'Amasya' },
  { code: '06', name: 'Ankara' },
  { code: '07', name: 'Antalya' },
  { code: '08', name: 'Artvin' },
  { code: '09', name: 'Aydın' },
  { code: '10', name: 'Balıkesir' },
  { code: '11', name: 'Bilecik' },
  { code: '12', name: 'Bingöl' },
  { code: '13', name: 'Bitlis' },
  { code: '14', name: 'Bolu' },
  { code: '15', name: 'Burdur' },
  { code: '16', name: 'Bursa' },
  { code: '17', name: 'Çanakkale' },
  { code: '18', name: 'Çankırı' },
  { code: '19', name: 'Çorum' },
  { code: '20', name: 'Denizli' },
  { code: '21', name: 'Diyarbakır' },
  { code: '22', name: 'Edirne' },
  { code: '23', name: 'Elazığ' },
  { code: '24', name: 'Erzincan' },
  { code: '25', name: 'Erzurum' },
  { code: '26', name: 'Eskişehir' },
  { code: '27', name: 'Gaziantep' },
  { code: '28', name: 'Giresun' },
  { code: '29', name: 'Gümüşhane' },
  { code: '30', name: 'Hakkari' },
  { code: '31', name: 'Hatay' },
  { code: '32', name: 'Isparta' },
  { code: '33', name: 'Mersin' },
  { code: '34', name: 'İstanbul' },
  { code: '35', name: 'İzmir' },
  { code: '36', name: 'Kars' },
  { code: '37', name: 'Kastamonu' },
  { code: '38', name: 'Kayseri' },
  { code: '39', name: 'Kırklareli' },
  { code: '40', name: 'Kırşehir' },
  { code: '41', name: 'Kocaeli' },
  { code: '42', name: 'Konya' },
  { code: '43', name: 'Kütahya' },
  { code: '44', name: 'Malatya' },
  { code: '45', name: 'Manisa' },
  { code: '46', name: 'Kahramanmaraş' },
  { code: '47', name: 'Mardin' },
  { code: '48', name: 'Muğla' },
  { code: '49', name: 'Muş' },
  { code: '50', name: 'Nevşehir' },
  { code: '51', name: 'Niğde' },
  { code: '52', name: 'Ordu' },
  { code: '53', name: 'Rize' },
  { code: '54', name: 'Sakarya' },
  { code: '55', name: 'Samsun' },
  { code: '56', name: 'Siirt' },
  { code: '57', name: 'Sinop' },
  { code: '58', name: 'Sivas' },
  { code: '59', name: 'Tekirdağ' },
  { code: '60', name: 'Tokat' },
  { code: '61', name: 'Trabzon' },
  { code: '62', name: 'Tunceli' },
  { code: '63', name: 'Şanlıurfa' },
  { code: '64', name: 'Uşak' },
  { code: '65', name: 'Van' },
  { code: '66', name: 'Yozgat' },
  { code: '67', name: 'Zonguldak' },
  { code: '68', name: 'Aksaray' },
  { code: '69', name: 'Bayburt' },
  { code: '70', name: 'Karaman' },
  { code: '71', name: 'Kırıkkale' },
  { code: '72', name: 'Batman' },
  { code: '73', name: 'Şırnak' },
  { code: '74', name: 'Bartın' },
  { code: '75', name: 'Ardahan' },
  { code: '76', name: 'Iğdır' },
  { code: '77', name: 'Yalova' },
  { code: '78', name: 'Karabük' },
  { code: '79', name: 'Kilis' },
  { code: '80', name: 'Osmaniye' },
  { code: '81', name: 'Düzce' },
] as const;

/** İl plaka kodu (`"01"`–`"81"`). */
export type CityCode = (typeof CITIES)[number]['code'];

const CITY_NAMES: ReadonlyMap<string, string> = new Map(CITIES.map((c) => [c.code, c.name]));

/** İl plaka kodu şeması (`cityCode`). İki haneli metin bekler (örn. `"06"`). */
// `Array.prototype.map` tuple tipini koruyamaz; CITIES boş olmayan sabit bir liste olduğundan
// sonucun `[CityCode, ...CityCode[]]` olduğu kesindir. Kodları ikinci kez elle yazmamak için `as` kullanılır.
export const CityCodeSchema = z.enum(CITIES.map((c) => c.code) as [CityCode, ...CityCode[]]);

/**
 * Plaka koduna karşılık gelen il adını döner (örn. `"34"` → `"İstanbul"`).
 * Sağlayıcıların il adı beklediği mapper'larda kullanılır.
 */
export function getCityName(code: CityCode): string {
  // CITY_NAMES, CITIES listesinden üretildiğinden her `CityCode` için kayıt vardır.
  /* v8 ignore next */
  return CITY_NAMES.get(code) ?? code;
}

/**
 * Türkiye adresi şeması. Faz 1'de ilçe ve mahalle serbest metindir.
 */
export const AddressSchema = z.object({
  /** İl plaka kodu. */
  cityCode: CityCodeSchema,
  /** İlçe. */
  district: z.string().trim().min(1).max(100),
  /** Mahalle. */
  neighborhood: z.string().trim().min(1).max(100).optional(),
  /** Açık adres. */
  addressLine: z.string().trim().min(1).max(500),
  /** Posta kodu (5 hane). */
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, { message: 'Postal code must be 5 digits' })
    .optional(),
});

/** Türkiye adresi. */
export type Address = z.infer<typeof AddressSchema>;
