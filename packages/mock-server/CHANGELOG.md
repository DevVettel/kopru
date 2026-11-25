# @kopru/mock-server

## 0.1.0

### Minor Changes

- 480c425: Add the `@kopru/iyzico` payment provider (non-3DS charge, 3D Secure, full refund with same-day cancel fallback, IYZWSv2 signing, error code mapping) and the iyzico mock server plugin with deterministic sandbox test cards.
- a375b5f: Add the mock server framework: Hono-based app with a plugin and scenario registry, `startMockServer` programmatic API, `kopru-mock` CLI, redacted request log with admin endpoints and `createMockServerClient`, 3DS auto form-post page, and a built-in `echo` plugin.
- e3b9109: Add the `@kopru/yurtici` cargo provider (create, cancel and track shipments over Yurtiçi Kargo's SOAP web service, status and error code mapping) and the Yurtiçi mock server plugin with seeded tracking histories. Core gains `xmlList`, `istanbulLocalToDateTime` and suffix-based redaction of `*password` / `*secret` keys.

### Patch Changes

- Updated dependencies [dcdfee8]
- Updated dependencies [3d1e4a7]
- Updated dependencies [e3b9109]
  - @kopru/core@0.1.0
