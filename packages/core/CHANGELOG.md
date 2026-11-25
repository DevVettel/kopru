# @kopru/core

## 0.1.0

### Minor Changes

- dcdfee8: Add core foundations: `Result` type and helpers, `KopruError` hierarchy with error code catalog, Zod → `ValidationError` conversion, and primitives (`Money`, `TCKN`, `VKN`, `PhoneNumber`, `Address`, `IBAN`).
- 3d1e4a7: Add the provider layer: payment and cargo domain schemas, `PaymentProvider` / `CargoProvider` contracts, `definePaymentProvider` / `defineCargoProvider` with capability checks, fetch-based HTTP client with retry and redaction, crypto/XML/SOAP/date utilities, `createPaymentClient` / `createCargoClient`, and the `@kopru/core/testing` contract test suites.
- e3b9109: Add the `@kopru/yurtici` cargo provider (create, cancel and track shipments over Yurtiçi Kargo's SOAP web service, status and error code mapping) and the Yurtiçi mock server plugin with seeded tracking histories. Core gains `xmlList`, `istanbulLocalToDateTime` and suffix-based redaction of `*password` / `*secret` keys.
