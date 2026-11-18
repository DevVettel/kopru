/**
 * @packageDocumentation
 * `@kopru/core/testing`: sağlayıcı paketlerinin geçmek zorunda olduğu sözleşme
 * (contract) test paketleri ve test yardımcıları. Vitest gerektirir.
 */

export {
  runPaymentProviderContract,
  type PaymentContractFixtures,
  type PaymentContractOptions,
} from './payment-contract.js';
export {
  runCargoProviderContract,
  type CargoContractFixtures,
  type CargoContractOptions,
} from './cargo-contract.js';
export { createRecordingHttpClient, type RecordingHttpClient } from './shared.js';
