import {
  ERROR_CATALOG,
  createKopruError,
  type ErrorCategory,
  type KopruError,
  type KopruErrorCode,
} from '@kopru/core';

/** Sağlayıcı kimliği; hatalarda `provider` alanına yazılır. */
export const IYZICO_PROVIDER_ID = 'iyzico';

/** iyzico'nun iade gerektiren aynı gün işlemleri için döndüğü kod ("Gün sonu yapılmalı"). */
export const IYZICO_REQUIRES_DAY_END = '10223';

function codes(code: KopruErrorCode, list: readonly string[]): [string, KopruErrorCode][] {
  return list.map((providerCode) => [providerCode, code]);
}

/**
 * iyzico hata kodu → Köprü hata kodu tablosu. Kaynak: docs.iyzico.com "Hata Kodları"
 * (ayrıntılar için `NOTES.md`). Tabloda olmayan kodlar `PROVIDER_UNEXPECTED_RESPONSE` olur.
 */
export const IYZICO_ERROR_MAP: ReadonlyMap<string, KopruErrorCode> = new Map([
  ...codes('PAYMENT_INSUFFICIENT_FUNDS', ['10051']),
  ...codes('PAYMENT_CARD_EXPIRED', ['10054', '10229']),
  ...codes('PAYMENT_INVALID_CARD', [
    '12',
    '13',
    '14',
    '15',
    '16',
    '10084',
    '10212',
    '10213',
    '10215',
    '10233',
  ]),
  ...codes('PAYMENT_CARD_DECLINED', [
    '10005',
    '10012',
    '10041',
    '10043',
    '10057',
    '10058',
    '10093',
    '10201',
    '10202',
    '10204',
    '10207',
    '10208',
    '10209',
    '10216',
    '10217',
    '10218',
    '10220',
    '10221',
    '10222',
    '10224',
    '10225',
    '10226',
    '10227',
    '10230',
    '10232',
    '10248',
  ]),
  ...codes('PAYMENT_FRAUD_SUSPECTED', ['10034', '6001']),
  ...codes('PAYMENT_THREEDS_FAILED', ['10210', '10211']),
  ...codes('PROVIDER_UNAVAILABLE', ['1', '2', '10214', '10219', '10228']),
  ...codes('PROVIDER_AUTHENTICATION_FAILED', [
    '1000',
    '1001',
    '1002',
    '1003',
    '1004',
    '1006',
    '1007',
    '1008',
    '1009',
  ]),
  ...codes('VALIDATION_FAILED', [
    '3',
    '4',
    '5',
    '8',
    '9',
    '10',
    '11',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
    '25',
    '26',
    '27',
    '10205',
    '5008',
    '5050',
    '5062',
  ]),
]);

/** Hatanın oluştuğu işlem türü; iade bağlamında iş hataları farklı eşlenir. */
export type IyzicoOperationKind = 'payment' | 'refund';

/** iyzico başarısız yanıtının hata alanları. */
export interface IyzicoFailure {
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  errorGroup?: string | undefined;
}

const PASSTHROUGH_CATEGORIES_IN_REFUND: ReadonlySet<ErrorCategory> = new Set([
  'provider',
  'network',
  'config',
  'validation',
]);

/**
 * iyzico'nun başarısız yanıtını standart `KopruError`'a çevirir. Saf fonksiyondur.
 *
 * İade/iptal işlemlerinde ödeme kategorisindeki ve eşlenmeyen kodlar
 * `PAYMENT_REFUND_FAILED` olur; kimlik doğrulama ve erişilebilirlik hataları korunur.
 *
 * @param failure - Yanıttaki `errorCode`, `errorMessage`, `errorGroup`
 * @param operation - Hatanın oluştuğu işlem türü
 */
export function mapIyzicoError(
  failure: IyzicoFailure,
  operation: IyzicoOperationKind = 'payment',
): KopruError {
  const providerCode = failure.errorCode;
  const mapped = providerCode === undefined ? undefined : IYZICO_ERROR_MAP.get(providerCode);
  let code: KopruErrorCode = mapped ?? 'PROVIDER_UNEXPECTED_RESPONSE';

  if (operation === 'refund') {
    const keep =
      mapped !== undefined && PASSTHROUGH_CATEGORIES_IN_REFUND.has(ERROR_CATALOG[mapped].category);
    if (!keep) code = 'PAYMENT_REFUND_FAILED';
  }

  const label = [providerCode, failure.errorGroup].filter((part) => part !== undefined).join(' ');
  return createKopruError({
    code,
    message:
      label === ''
        ? 'iyzico returned a failure response without an error code'
        : `iyzico request failed with ${label}`,
    provider: IYZICO_PROVIDER_ID,
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(failure.errorMessage === undefined ? {} : { providerMessage: failure.errorMessage }),
    ...(failure.errorGroup === undefined ? {} : { details: { errorGroup: failure.errorGroup } }),
  });
}
