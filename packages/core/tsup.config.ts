import { defineConfig } from 'tsup';
import { defineLibraryConfig } from '@kopru/tsup-config';

export default defineConfig(
  defineLibraryConfig({
    entry: { index: 'src/index.ts', 'testing/index': 'src/testing/index.ts' },
    // testing alt girişi core sınıflarını kopyalamamalı (instanceof tutarlılığı); ortak kod chunk'a ayrılır.
    splitting: true,
  }),
);
