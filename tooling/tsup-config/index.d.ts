import type { Options } from 'tsup';

/**
 * Tüm @kopru kütüphane paketleri için ortak tsup ayarları.
 * ESM + CJS çift çıktı ve .d.ts tip tanımları üretir.
 */
export declare function defineLibraryConfig(overrides?: Options): Options;
