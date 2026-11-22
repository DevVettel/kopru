import { createKopruError, type KopruError, type KopruErrorCode } from '@kopru/core';

/** Sağlayıcı kimliği; hatalarda `provider` alanına yazılır. */
export const YURTICI_PROVIDER_ID = 'yurtici';

/** Gönderinin daha önce iptal edildiğini bildiren kod; iptal işleminde başarı sayılır. */
export const YURTICI_ALREADY_CANCELLED = '82520';

function codes(code: KopruErrorCode, list: readonly string[]): [string, KopruErrorCode][] {
  return list.map((providerCode) => [providerCode, code]);
}

/**
 * Yurtiçi hata kodu (`errCode`) → Köprü hata kodu tablosu (ayrıntılar için `NOTES.md` §4).
 * Tabloda olmayan kodlar `PROVIDER_UNEXPECTED_RESPONSE` olur.
 */
export const YURTICI_ERROR_MAP: ReadonlyMap<string, KopruErrorCode> = new Map([
  ...codes('CARGO_SHIPMENT_NOT_FOUND', ['82519']),
  ...codes('CARGO_CANCELLATION_NOT_ALLOWED', [YURTICI_ALREADY_CANCELLED]),
  ...codes('CARGO_ADDRESS_INVALID', ['60019', '82502']),
  ...codes('VALIDATION_FAILED', [
    '60017',
    '60018',
    '60020',
    '80859',
    '82500',
    '82501',
    '82503',
    '82505',
    '82506',
    '82507',
    '82508',
    '82509',
    '82510',
    '82511',
    '82512',
    '82513',
    '82514',
    '82515',
    '82516',
    '82517',
    '82518',
    '82526',
    '82527',
  ]),
]);

/** Yurtiçi yanıtındaki hata alanları. */
export interface YurticiFailure {
  errCode?: string | undefined;
  errMessage?: string | undefined;
}

/**
 * Hata kodunun gerçek bir hata olup olmadığını döner. Yurtiçi başarılı kayıtlarda
 * `errCode` alanını boş bırakır veya `0` yazar.
 */
export function isYurticiErrorCode(code: string | undefined): code is string {
  return code !== undefined && code !== '' && code !== '0';
}

/**
 * Yurtiçi hata alanlarını standart `KopruError`'a çevirir. Saf fonksiyondur.
 *
 * @param failure - Yanıttaki `errCode` ve `errMessage`
 */
export function mapYurticiError(failure: YurticiFailure): KopruError {
  const providerCode = isYurticiErrorCode(failure.errCode) ? failure.errCode : undefined;
  const code =
    (providerCode === undefined ? undefined : YURTICI_ERROR_MAP.get(providerCode)) ??
    'PROVIDER_UNEXPECTED_RESPONSE';
  const providerMessage =
    failure.errMessage === undefined || failure.errMessage === '' ? undefined : failure.errMessage;
  return createKopruError({
    code,
    message:
      providerCode === undefined
        ? 'Yurtiçi returned a failure response without an error code'
        : `Yurtiçi request failed with error code ${providerCode}`,
    provider: YURTICI_PROVIDER_ID,
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(providerMessage === undefined ? {} : { providerMessage }),
  });
}
