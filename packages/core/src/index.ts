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
  summarizeIssues,
  toValidationIssues,
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

export {
  BasketItemSchema,
  BuyerSchema,
  CardSchema,
  ChargeRequestSchema,
  ChargeResultSchema,
  PositiveMoneySchema,
  RefundRequestSchema,
  RefundResultSchema,
  ThreeDSActionSchema,
  ThreeDSCallbackSchema,
  ThreeDSInitRequestSchema,
  ThreeDSInitResultSchema,
  parseCardExpiry,
  passesLuhn,
  type BasketItem,
  type Buyer,
  type Card,
  type ChargeRequest,
  type ChargeRequestInput,
  type ChargeResult,
  type RefundRequest,
  type RefundRequestInput,
  type RefundResult,
  type ThreeDSAction,
  type ThreeDSCallback,
  type ThreeDSInitRequest,
  type ThreeDSInitRequestInput,
  type ThreeDSInitResult,
} from './domain/payment/schemas.js';

export {
  PAYMENT_CAPABILITIES,
  type PaymentCapability,
  type PaymentOperations,
  type PaymentProvider,
} from './domain/payment/provider.js';

export {
  CreateShipmentRequestSchema,
  SHIPMENT_STATUSES,
  ShipmentContactSchema,
  ShipmentLookupSchema,
  ShipmentSchema,
  ShipmentStatusSchema,
  ShipmentTrackingSchema,
  TrackingEventSchema,
  type CreateShipmentRequest,
  type CreateShipmentRequestInput,
  type Shipment,
  type ShipmentContact,
  type ShipmentLookup,
  type ShipmentStatus,
  type ShipmentTracking,
  type TrackingEvent,
} from './domain/cargo/schemas.js';

export {
  CARGO_CAPABILITIES,
  type CargoCapability,
  type CargoOperations,
  type CargoProvider,
} from './domain/cargo/provider.js';

export type { ProviderContext } from './provider/context.js';

export {
  CARGO_CAPABILITY_METHODS,
  PAYMENT_CAPABILITY_METHODS,
  assertCapabilityMethods,
  capabilityNotSupported,
  supports,
  type HasCapabilities,
} from './provider/capabilities.js';

export {
  defineCargoProvider,
  definePaymentProvider,
  type ProviderDefinition,
  type ProviderFactory,
} from './provider/define-provider.js';

export {
  createHttpClient,
  type HttpClient,
  type HttpClientOptions,
  type HttpHooks,
  type HttpMethod,
  type HttpRequest,
  type HttpRequestLogEvent,
  type HttpResponse,
  type HttpResponseLogEvent,
  type RetryOptions,
} from './http/client.js';

export {
  REDACTED,
  SENSITIVE_KEYS,
  redact,
  redactHeaders,
  redactSensitiveNumbers,
  redactText,
  redactUrl,
  type RedactOptions,
} from './http/redact.js';

export {
  base64Decode,
  base64Encode,
  hash,
  hmac,
  randomHex,
  safeEqual,
  type DigestEncoding,
  type HashAlgorithm,
} from './utils/crypto.js';

export {
  XML_ATTRIBUTE_PREFIX,
  XML_TEXT_KEY,
  buildSoapEnvelope,
  buildXml,
  parseSoapEnvelope,
  parseXml,
  type SoapEnvelope,
  type SoapEnvelopeOptions,
  type SoapVersion,
} from './utils/xml.js';

export { DEFAULT_TIME_ZONE, DateTimeSchema, formatIstanbulDateTime } from './utils/date.js';

export type { CallOptions, ClientOptions } from './client/run-operation.js';
export {
  createPaymentClient,
  type PaymentClient,
  type PaymentClientOptions,
} from './client/payment-client.js';
export {
  createCargoClient,
  type CargoClient,
  type CargoClientOptions,
} from './client/cargo-client.js';
