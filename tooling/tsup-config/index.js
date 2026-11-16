// @ts-check
/**
 * Tüm @kopru kütüphane paketleri için ortak tsup ayarları.
 * ESM + CJS çift çıktı ve .d.ts tip tanımları üretir.
 *
 * Not: Bu dosya bilinçli olarak JavaScript'tir; paket konfigürasyon dosyalarından
 * derleme adımı olmadan doğrudan yüklenebilmesi gerekir.
 *
 * @param {import('tsup').Options} [overrides] - Pakete özgü ek ayarlar
 * @returns {import('tsup').Options}
 */
export function defineLibraryConfig(overrides = {}) {
  return {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target: 'node22',
    platform: 'node',
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    ...overrides,
  };
}
