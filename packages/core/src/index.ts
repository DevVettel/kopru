/**
 * @packageDocumentation
 * Köprü çekirdek paketi. Tüm sağlayıcı paketlerinin dayandığı ortak sözleşmeleri,
 * Zod şemalarını, hata sınıflarını ve yardımcıları içerir.
 */

/** Paketin npm üzerindeki adı. */
export const PACKAGE_NAME = '@kopru/core';

export {
  err,
  isErr,
  isOk,
  mapResult,
  ok,
  unwrap,
  unwrapOr,
  type Err,
  type Ok,
  type Result,
} from './result/result.js';

export {
  ERROR_CATALOG,
  ERROR_CATEGORIES,
  ERROR_CODES,
  ErrorCategorySchema,
  KopruErrorCodeSchema,
  type ErrorCategory,
  type ErrorCodeDefinition,
  type ErrorCodeOf,
  type KopruErrorCode,
} from './errors/codes.js';

export {
  CargoError,
  ConfigurationError,
  KopruError,
  KopruErrorJSONSchema,
  NetworkError,
  PaymentError,
  ProviderError,
  ValidationError,
  createKopruError,
  isErrorCodeOf,
  isKopruError,
  type CategoryErrorOptions,
  type KopruErrorJSON,
  type KopruErrorOptions,
} from './errors/kopru-error.js';

export {
  ValidationIssueSchema,
  formatIssuePath,
  fromZodError,
  validate,
  type FromZodErrorOptions,
  type ValidationIssue,
} from './errors/from-zod.js';

export {
  CURRENCIES,
  CurrencySchema,
  MoneySchema,
  fromDecimalString,
  toDecimalString,
  type Currency,
  type Money,
} from './primitives/money.js';

export {
  TCKNSchema,
  VKNSchema,
  isValidTCKN,
  isValidVKN,
  type TCKN,
  type VKN,
} from './primitives/identity.js';

export { PhoneNumberSchema, normalizePhoneNumber, type PhoneNumber } from './primitives/phone.js';

export {
  AddressSchema,
  CITIES,
  CityCodeSchema,
  getCityName,
  type Address,
  type CityCode,
} from './primitives/address.js';

export { IBANSchema, isValidTRIBAN, normalizeIBAN, type IBAN } from './primitives/iban.js';
