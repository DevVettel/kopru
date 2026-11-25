# @kopru/iyzico

## 0.1.0

### Minor Changes

- 480c425: Add the `@kopru/iyzico` payment provider (non-3DS charge, 3D Secure, full refund with same-day cancel fallback, IYZWSv2 signing, error code mapping) and the iyzico mock server plugin with deterministic sandbox test cards.

### Patch Changes

- Take the `orderId` of a completed 3D Secure payment from iyzico's server response (`basketId`) instead of the browser-supplied callback, so a tampered callback can no longer attribute a payment to another order.
- Updated dependencies [dcdfee8]
- Updated dependencies [3d1e4a7]
- Updated dependencies [e3b9109]
  - @kopru/core@0.1.0
